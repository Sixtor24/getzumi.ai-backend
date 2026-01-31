import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import jwt from 'jsonwebtoken';

export async function POST(req: NextRequest) {
    try {
        // 1. Auth Check
        const token = req.cookies.get('auth_token')?.value;
        if (!token) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

        let userId: string;
        try {
            const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
            userId = decoded.userId;
        } catch (e) {
            return NextResponse.json({ success: false, message: "Invalid session" }, { status: 401 });
        }

        // 2. Parse Body
        const { text, voice_id } = await req.json();
        
        if (!text) {
            return NextResponse.json({ success: false, message: "Text is required" }, { status: 400 });
        }

        // 3. Call Cartesia API
        const apiKey = process.env.CARTESIA_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, message: "Cartesia API Key not configured" }, { status: 500 });
        }

        const cartesiaRes = await fetch("https://api.cartesia.ai/tts/bytes", {
            method: "POST",
            headers: {
                "Cartesia-Version": "2024-06-10",
                "X-API-Key": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                transcript: text,
                model_id: "sonic-english",
                voice: {
                    mode: "id",
                    // Use provided voice or default to a known good one (e.g., generic male/female)
                    id: voice_id || "694f9389-aac1-45b6-b726-9d9369183238" 
                },
                output_format: {
                    container: "mp3",
                    encoding: "mp3",
                    sample_rate: 44100
                }
            })
        });

        if (!cartesiaRes.ok) {
            const errText = await cartesiaRes.text();
            console.error("Cartesia Error:", errText);
            return NextResponse.json({ success: false, message: `Cartesia API Error: ${cartesiaRes.status}` }, { status: 502 });
        }

        // 4. Get Audio Data (ArrayBuffer -> Base64)
        const arrayBuffer = await cartesiaRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        // Store as Binary in Mongo usually, but utilizing Base64 string for consistency with previous Image implementation is easier for JSON transfer
        // 5. Save audio URL to database
        // Convert buffer to base64 URL for now (in production, upload to cloud storage)
        const base64Audio = `data:audio/mpeg;base64,${buffer.toString('base64')}`;
        
        const audio = await prisma.audio.create({
            data: {
                userId,
                text,
                voice: voice_id || "default",
                audioUrl: base64Audio,
                status: "completed"
            }
        });

        return NextResponse.json({
            success: true,
            audio_id: audio.id,
            audio_url: audio.audioUrl
        });

    } catch (error) {
        console.error("Cartesia TTS Error:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}
