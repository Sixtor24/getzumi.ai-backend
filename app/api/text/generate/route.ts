import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import jwt from 'jsonwebtoken';

export async function POST(req: NextRequest) {
    try {
        const token = req.cookies.get('auth_token')?.value;
        if (!token) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

        let userId: string;
        try {
            const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
            userId = decoded.userId;
        } catch (e) {
            return NextResponse.json({ success: false, message: "Invalid session" }, { status: 401 });
        }

        const { prompt, model, system_prompt } = await req.json();
        
        if (!prompt) {
            return NextResponse.json({ success: false, message: "Prompt is required" }, { status: 400 });
        }

        const apiKey = process.env.APIYI_API_KEY;
        const baseUrl = process.env.APIYI_BASE_URL || "https://api.apiyi.com";

        if (!apiKey) {
            return NextResponse.json({ success: false, message: "API Configuration Missing" }, { status: 500 });
        }

        const messages = [];
        if (system_prompt) messages.push({ role: "system", content: system_prompt });
        messages.push({ role: "user", content: prompt });

        const apiRes = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model || "nano-banana",
                messages: messages,
                stream: true
            })
        });

        if (!apiRes.ok) throw new Error(await apiRes.text());

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        
        // This variable will hold the accumulated generated text to save to DB
        let fullGeneratedText = "";
        
        const stream = new ReadableStream({
            async start(controller) {
                // @ts-ignore
                const reader = apiRes.body.getReader();
                let buffer = "";

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });
                        buffer += chunk;
                        
                        // Process lines
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || ""; // Keep incomplete line

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (trimmed.startsWith('data: ')) {
                                const dataStr = trimmed.replace('data: ', '');
                                if (dataStr === '[DONE]') continue;
                                
                                try {
                                    const parsed = JSON.parse(dataStr);
                                    const content = parsed.choices?.[0]?.delta?.content || "";
                                    const reasoning = parsed.choices?.[0]?.delta?.reasoning_content || ""; // DeepSeek support
                                    
                                    // Append to full text for DB
                                    fullGeneratedText += content; // We only save main content for now, maybe reasoning later? 
                                    // Actually, let's concatenate reasoning too if present, or just content?
                                    // For now, just content.
                                    
                                    // Pass through to client
                                    // We can just enqueue the raw chunk? 
                                    // Or safer: Re-encode the parsed data to ensure our client understands it? 
                                    // The client expects SSE. Let's just passthrough the raw binary "value" is easiest 
                                    // but we need to intercept for "fullGeneratedText".
                                    // Since we decoded "value" into strings and lines, passing "value" directly 
                                    // is better to avoid breaking chunks unless we reconstruct the stream.
                                    // But wait! "value" is the raw bytes. We stripped it. 
                                    // Simpler: Just enqueue "value" immediately at start of loop, 
                                    // AND do the parsing for side-effect.
                                } catch (e) {
                                    // JSON parse error (maybe partial line despite split?)
                                }
                            }
                        }
                        
                        // Passthrough to client (original bytes)
                        controller.enqueue(value);
                    }
                } catch (e) {
                    console.error("Stream Error", e);
                    controller.error(e);
                } finally {
                    controller.close();

                    // SAVE TO DB ON COMPLETE
                    if (fullGeneratedText.trim().length > 0) {
                        try {
                            const client = await clientPromise;
                            const db = client.db(process.env.MONGO_DB_NAME || "zumidb");
                            await db.collection("generated_texts").insertOne({
                                user_id: userId,
                                prompt: prompt,
                                system_prompt: system_prompt,
                                model: model,
                                content: fullGeneratedText,
                                created_at: new Date()
                            });
                            console.log("Saved generated text to DB");
                        } catch (err) {
                            console.error("Error saving text to DB:", err);
                        }
                    }
                }
            }
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error("Text Gen Error:", error);
        return NextResponse.json({ success: false, message: error.message || "Server Error" }, { status: 500 });
    }
}
