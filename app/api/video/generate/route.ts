import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import jwt from 'jsonwebtoken';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { promisify } from 'util';
import * as stream from 'stream';

// Configure FFMPEG
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const pipeline = promisify(stream.pipeline);

// Helper: Download file
async function downloadFile(url: string, outputPath: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download ${url}: ${response.statusText}`);
    if (!response.body) throw new Error(`No body in response ${url}`);
    
    // @ts-ignore
    await pipeline(response.body, fs.createWriteStream(outputPath));
}

// Helper: Extract last frame
async function extractLastFrame(videoPath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const tempDir = path.dirname(videoPath);
        const filename = path.basename(videoPath, path.extname(videoPath)) + '_last.jpg';
        const outputPath = path.join(tempDir, filename);

        ffmpeg(videoPath)
            .on('end', () => {
                const readStream = fs.createReadStream(outputPath);
                const chunks: any[] = [];
                readStream.on('data', (chunk) => chunks.push(chunk));
                readStream.on('end', () => resolve(Buffer.concat(chunks)));
                readStream.on('error', reject);
            })
            .on('error', (err) => reject(err))
            .screenshots({
                count: 1,
                timemarks: ['99%'], // Near end
                filename: filename,
                folder: tempDir
            });
    });
}

// Helper: Concatenate videos
async function concatVideos(videoPaths: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const cmd = ffmpeg();
        videoPaths.forEach(p => cmd.input(p));
        
        cmd.on('end', () => resolve())
           .on('error', (err) => reject(err))
           .mergeToFile(outputPath, path.dirname(outputPath)); // tempDir
    });
}

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

        const body = await req.json();
        const { prompt, model, input_image, input_images, seconds, aspect_ratio } = body;
        
        if (!prompt) {
            return NextResponse.json({ success: false, message: "Prompt is required" }, { status: 400 });
        }

        const apiKey = process.env.APIYI_API_KEY;
        const baseUrl = process.env.APIYI_BASE_URL || "https://api.apiyi.com";

        if (!apiKey) {
            return NextResponse.json({ success: false, message: "API Configuration Missing" }, { status: 500 });
        }

        // --- MODEL SELECTION LOGIC ---
        // Async Models: sora-2, sora-2-pro, veo-*
        if (model === "sora-2-pro" || model === "sora-2" || model.startsWith("veo-")) {
            
            const encoder = new TextEncoder();
            const streamOut = new ReadableStream({
                async start(controller) {
                    const sendChunk = (text: string) => {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                            choices: [{ delta: { content: text } }] 
                        })}\n\n`));
                    };

                    try {
                        let finalVideoUrl = "";
                        
                        // Map Aspect Ratio
                        let videoSize = "1280x720"; // default 16:9
                        if (aspect_ratio === "9:16") videoSize = "720x1280";
                        else if (aspect_ratio === "1:1") videoSize = "1024x1024";

                        // Helper to adjust Veo Model Name based on aspect ratio AND input images
                        const getVeoModelName = (baseModel: string, ratio: string, hasInputImages: boolean) => {
                             if (!baseModel.startsWith('veo')) return baseModel;
                             
                             // 1. Clean base string to root "veo-3.1"
                             // Remove existing suffixes to rebuild from scratch
                             let clean = baseModel
                                .replace('-landscape', '')
                                .replace('-portrait', '')
                                .replace('-fl', '')
                                .replace('-fast', '');
                             
                             // 2. Add aspect ratio suffix
                             // Docs: veo-3.1 = Portrait (9:16), veo-3.1-landscape = Landscape (16:9)
                             if (ratio === '16:9') {
                                 clean += '-landscape';
                             } else {
                                 // Default is Portrait (9:16) for veo-3.1 base
                                 // If ratio is 1:1, we still settle for Portrait as closest supported
                             }

                             // 3. Add Fast suffix if requested (checked from original input)
                             if (baseModel.includes('fast')) {
                                 clean += '-fast';
                             }

                             // 4. Add FL suffix if images are present (CRITICAL for Img2Vid)
                             if (hasInputImages) {
                                 clean += '-fl';
                             }
                             
                             return clean;
                        };

                        // --- VEO LOOP LOGIC (> 15s) ---
                        // Only trigger if model is Veo AND seconds requested > 15
                        if (model.startsWith("veo-") && seconds && parseInt(seconds) > 15) {
                            sendChunk(`Initialing Veo Chain Loop for ${seconds}s (Aspect: ${aspect_ratio || '16:9'})...\n`);
                            
                            const tempDir = path.join(process.cwd(), 'public', 'generated', 'temp_' + randomUUID());
                            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

                            const videoSegments: string[] = [];
                            let currentImages = input_images && input_images.length > 0 ? [...input_images] : (input_image ? [input_image] : []);
                            
                            // Estimate iterations. Veo is usually ~5s.
                            const targetDuration = parseInt(seconds);
                            const segmentDuration = 5; 
                            const iterations = Math.ceil(targetDuration / segmentDuration);

                            for (let i = 0; i < iterations; i++) {
                                sendChunk(`\nGenerando segmento ${i + 1}/${iterations}...\n`);
                                
                                const hasImages = currentImages.length > 0;
                                
                                // Construct Correct Model Name (Auto-add -fl if images exist)
                                let currentModel = getVeoModelName(model, aspect_ratio || '16:9', hasImages);

                                // 1. Submit Request
                                const formData = new FormData();
                                formData.append("prompt", prompt);
                                formData.append("model", currentModel);
                                
                                // CRITICAL: Do NOT send 'size' or 'aspect_ratio' to Veo. 
                                // It is controlled solely by 'currentModel' suffix (e.g. -landscape).
                                if (!model.startsWith('veo')) {
                                     formData.append("size", videoSize);
                                }

                                
                                // Attach images
                                // Veo Quick Start: "input_reference" is key.
                                for (let j = 0; j < currentImages.length; j++) {
                                    const b64 = currentImages[j];
                                    if (!b64 || typeof b64 !== 'string') continue;
                                    const base64Data = b64.replace(/^data:image\/\w+;base64,/, "");
                                    const buffer = Buffer.from(base64Data, 'base64');
                                    const blob = new Blob([buffer], { type: 'image/jpeg' });
                                    // Veo API expects 'input_reference' for image-to-video
                                    formData.append("input_reference", blob, `ref_${i}_${j}.jpg`);
                                }
                                
                                // Veo Prompt Logic for Continuity
                                let currentPrompt = prompt;
                                if (i > 0) {
                                    currentPrompt = `${prompt}. Seamlessly continue the motion and narrative from the reference starting frame. Develop the scene further.`;
                                }
                                // We are already appending model and input_reference. Now append prompt.
                                // NOTE: formData.set() would overwrite if we had added it before loop, but we create fresh formData each iter
                                // But wait, in lines above I see: formData.append("prompt", prompt); 
                                // I should override it here for i > 0
                                if (i > 0) {
                                    formData.set("prompt", currentPrompt);
                                }

                                const submitRes = await fetch(`${baseUrl}/v1/videos`, {
                                    method: 'POST',
                                    headers: { 'Authorization': `Bearer ${apiKey}` },
                                    body: formData
                                });

                                if (!submitRes.ok) throw new Error("API Error: " + await submitRes.text());
                                const submitData = await submitRes.json();
                                const taskId = submitData.id;

                                // 2. Poll
                                let segmentUrl = null;
                                let polls = 0;
                                while (!segmentUrl && polls < 120) { // 10 mins max per segment
                                    polls++;
                                    await new Promise(r => setTimeout(r, 5000));
                                    const statusRes = await fetch(`${baseUrl}/v1/videos/${taskId}`, {
                                        headers: { 'Authorization': `Bearer ${apiKey}` }
                                    });
                                    if (statusRes.ok) {
                                        const statusData = await statusRes.json();
                                        if (statusData.status === 'completed') {
                                            segmentUrl = statusData.url;
                                            if (!segmentUrl) {
                                                const contentRes = await fetch(`${baseUrl}/v1/videos/${taskId}/content`, {
                                                    headers: { 'Authorization': `Bearer ${apiKey}` }
                                                });
                                                if(contentRes.ok) segmentUrl = (await contentRes.json()).url;
                                            }
                                        } else if (statusData.status === 'failed') {
                                            throw new Error("Segment generation failed");
                                        }
                                        sendChunk(`Status: ${statusData.status} (${statusData.progress || 0}%)\n`);
                                    }
                                }

                                if (!segmentUrl) throw new Error("Timeout generating segment");

                                // 3. Download
                                sendChunk(`Descargando segmento ${i+1}...\n`);
                                const segPath = path.join(tempDir, `seg_${i}.mp4`);
                                await downloadFile(segmentUrl, segPath);
                                videoSegments.push(segPath);
                                sendChunk(`Segmento guardado.\n`);

                            // 4. Prepare next iteration (Extract Frame)
                                if (i < iterations - 1) {
                                    sendChunk(`Extrayendo frame de referencia para el siguiente tramo...\n`);
                                    try { 
                                        const lastFrameBuffer = await extractLastFrame(segPath);
                                        const b64Frame = "data:image/jpeg;base64," + lastFrameBuffer.toString('base64');
                                        
                                        // Veo logic: Uses 'input_reference' for start/end frames.
                                        // Since we are CHAINING, we want the LAST frame of Segment A to be the FIRST frame of Segment B.
                                        // So we replace currentImages for the next iteration.
                                        
                                        // IMPORTANT: Veo supports 2 images (Start & End).
                                        // For chain continuity, we only provide the Start image (the frame we just extracted).
                                        // We do NOT want to constrain the End of the next segment, we want it to EVOLVE.
                                        currentImages = [b64Frame]; 
                                        
                                    } catch (err: any) {
                                        sendChunk(`Warn: Error extrayendo frame: ${err.message}. Usando configuración previa.\n`);
                                    }
                                }
                            }

                            // 5. Stitch
                            if (videoSegments.length > 0) {
                                sendChunk(`\nUniendo ${videoSegments.length} videos...\n`);
                                const finalFileName = `veo_long_${randomUUID()}.mp4`;
                                const publicGenDir = path.join(process.cwd(), 'public', 'generated');
                                if (!fs.existsSync(publicGenDir)) fs.mkdirSync(publicGenDir, { recursive: true });
                                
                                const finalPath = path.join(publicGenDir, finalFileName);
                                
                                try {
                                    await concatVideos(videoSegments, finalPath);
                                    
                                    // 6. Set Final URL
                                    const protocol = req.headers.get('x-forwarded-proto') || 'http';
                                    const host = req.headers.get('host');
                                    finalVideoUrl = `${protocol}://${host}/generated/${finalFileName}`;
                                } catch (e: any) {
                                    throw new Error("Error uniendo videos: " + e.message);
                                }

                                // Clean Temp
                                try {
                                    fs.rmSync(tempDir, { recursive: true, force: true });
                                } catch (e) { console.error("Temp cleanup failed", e); }
                            } else {
                                throw new Error("No video segments generated.");
                            }
                            
                        } 
                        // --- SORA LOOP LOGIC (> 15s) ---
                        else if (model.startsWith("sora") && seconds && parseInt(seconds) > 15) {
                             const { generateSoraLoop } = await import('../../../../lib/sora-generator');
                             
                             const protocol = req.headers.get('x-forwarded-proto') || 'http';
                             const host = req.headers.get('host') || 'localhost:3000';

                             finalVideoUrl = await generateSoraLoop({
                                 prompt,
                                 model,
                                 totalSeconds: parseInt(seconds),
                                 userId,
                                 sendChunk,
                                 aspectRatio: aspect_ratio || '16:9',
                                 initialImage: input_image || (input_images && input_images.length > 0 ? input_images[0] : undefined),
                                 apiKey,
                                 baseUrl, // This needs to be passed, confirm it is in scope
                                 reqHost: host,
                                 reqProto: protocol
                             });
                        }
                        // --- STANDARD ASYNC LOGIC (Sora or Veo <= 15) ---
                        // --- STANDARD ASYNC LOGIC (Sora or Veo <= 15s or Default) ---
                        else {
                            const formData = new FormData();
                            
                            // Images Check
                            const imagesToProcess = input_images && input_images.length > 0 ? input_images : (input_image ? [input_image] : []);
                            console.log(`[Veo/Sora Input] ${imagesToProcess.length} images provided.`);

                            let finalModel = model;
                            if (model.startsWith('veo')) {
                                // Just a prompt pass-through if no special logic needed? 
                                // Actually, standard logic handles model renaming
                                const hasImages = imagesToProcess.length > 0;
                                finalModel = getVeoModelName(model, aspect_ratio || '16:9', hasImages);
                            }
                            formData.append("model", finalModel);
                            
                            // Adjust prompt? No, standard prompt is fine.
                            formData.append("prompt", prompt);

                            // Sora Specific
                            if (model.startsWith("sora-")) {
                                formData.append("size", videoSize); 
                                if (seconds) formData.append("seconds", seconds.toString());
                                else formData.append("seconds", "15");
                            }

                            // Veo Specific: Standard
                            // Attach Images
                            for (let i = 0; i < imagesToProcess.length; i++) {
                                const b64 = imagesToProcess[i];
                                // Basic validation
                                if(typeof b64 === 'string' && b64.startsWith('data:image')) {
                                    const base64Data = b64.replace(/^data:image\/\w+;base64,/, "");
                                    const buffer = Buffer.from(base64Data, 'base64');
                                    const blob = new Blob([buffer], { type: 'image/jpeg' });
                                    
                                    if(model.startsWith('sora')) {
                                        formData.append("input_image", blob, `input_${i}.jpg`);
                                    } else {
                                        // Veo uses 'input_reference'
                                        formData.append("input_reference", blob, `ref_${i}.jpg`);
                                    }
                                }
                            }

                            console.log(`[Async] Submitting single task for ${finalModel}...`);
                            const submitRes = await fetch(`${baseUrl}/v1/videos`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${apiKey}` },
                                body: formData
                            });

                            if (!submitRes.ok) {
                                const errText = await submitRes.text();
                                console.error(`Provider Error for ${finalModel}:`, errText);
                                throw new Error("Provider Error: " + errText);
                            }
                            const submitData = await submitRes.json();
                            const taskId = submitData.id;

                            // Standard Loop
                            let polls = 0;
                            while (!finalVideoUrl && polls < 300) {
                                polls++;
                                await new Promise(r => setTimeout(r, 5000));
                                const statusRes = await fetch(`${baseUrl}/v1/videos/${taskId}`, {
                                    headers: { 'Authorization': `Bearer ${apiKey}` }
                                });
                                if (statusRes.ok) {
                                    const statusData = await statusRes.json();
                                    const state = statusData.status;
                                    sendChunk(`Status: ${state} (${statusData.progress || 0}%)\n`);

                                    if (state === 'completed') {
                                        finalVideoUrl = statusData.url;
                                        if (!finalVideoUrl) {
                                             const cRes = await fetch(`${baseUrl}/v1/videos/${taskId}/content`, {
                                                 headers: { 'Authorization': `Bearer ${apiKey}` }
                                             });
                                             if(cRes.ok) finalVideoUrl = (await cRes.json()).url;
                                        }
                                    } else if (state === 'failed') {
                                        throw new Error(statusData.error?.message || "Generation Failed");
                                    }
                                }
                            }
                        }

                        if (finalVideoUrl) {
                            sendChunk(`\n\nDONE: [Download Video](${finalVideoUrl})`);
                            
                            try {
                                const client = await clientPromise;
                                const db = client.db(process.env.MONGO_DB_NAME || "zumidb");
                                await db.collection("generated_videos").insertOne({
                                    user_id: userId,
                                    prompt,
                                    model,
                                    video_url: finalVideoUrl,
                                    created_at: new Date()
                                });
                                console.log(`Saved video to DB: ${finalVideoUrl}`);
                            } catch (dbErr) {
                                console.error("DB Save Error:", dbErr);
                            }

                            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                        } else {
                            throw new Error("Timeout or No URL returned");
                        }

                    } catch (error: any) {
                        console.error("Async Loop Error:", error);
                        sendChunk(`\n\nError: ${error.message}`);
                        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    } finally {
                        controller.close();
                    }
                }
            });

            return new NextResponse(streamOut, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
        } 
        
        // --- SYNC API HANDLER (Fallback / Legacy) ---
        else {
             const messages: any[] = [{ role: "user", content: [{ type: "text", text: prompt }] }];
             if (input_image) messages[0].content.push({ type: "image_url", image_url: { url: input_image } });

             const apiRes = await fetch(`${baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model || "sora_video2",
                    stream: true,
                    messages: messages
                })
            });

            if (!apiRes.ok) throw new Error(await apiRes.text());

            // Simple pass-through stream
            const simpleStream = new ReadableStream({
                 async start(controller) {
                     // @ts-ignore
                     for await (const chunk of apiRes.body) {
                         controller.enqueue(chunk);
                     }
                     controller.close();
                 }
            });

            return new NextResponse(simpleStream, {
                headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
            });
        }

    } catch (error: any) {
        console.error("General API Error:", error);
        return NextResponse.json({ success: false, message: error.message || "Server Error" }, { status: 500 });
    }
}
