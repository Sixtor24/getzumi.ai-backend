
import clientPromise from './mongodb';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { promisify } from 'util';
import * as stream from 'stream';

// Ensure FFMPEG path is set
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const pipeline = promisify(stream.pipeline);

interface SoraGenerationContext {
    prompt: string;
    model: string;
    totalSeconds: number;
    userId: string;
    sendChunk: (msg: string) => void;
    aspectRatio?: string;
    // Input image from user (optional initial image)
    initialImage?: string; 
    apiKey: string;
    baseUrl: string;
    reqHost: string;
    reqProto: string;
}

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
        const filename = `frame_${randomUUID()}.jpg`;
        const outputPath = path.join(tempDir, filename);

        ffmpeg(videoPath)
            .on('end', () => {
                // Read and delete
                try {
                    const data = fs.readFileSync(outputPath);
                    fs.unlinkSync(outputPath); // cleanup frame
                    resolve(data);
                } catch (e) {
                    reject(e);
                }
            })
            .on('error', (err) => reject(err))
            .screenshots({
                count: 1,
                timestamps: ['99%'],
                filename: filename,
                folder: tempDir
            });
    });
}

// Helper: Concatenate videos
async function concatVideos(videoPaths: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (videoPaths.length === 0) return reject(new Error("No videos to concat"));
        
        // Create a list file for ffmpeg concat demuxer
        const listFileName = `list_${randomUUID()}.txt`;
        const listPath = path.join(path.dirname(videoPaths[0]), listFileName);
        
        const fileContent = videoPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
        fs.writeFileSync(listPath, fileContent);

        ffmpeg()
            .input(listPath)
            .inputOptions(['-f', 'concat', '-safe', '0'])
            .outputOptions(['-c', 'copy'])
            .on('end', () => {
                try { fs.unlinkSync(listPath); } catch(e) {}
                resolve();
            })
            .on('error', (err) => {
                try { fs.unlinkSync(listPath); } catch(e) {}
                reject(err);
            })
            .save(outputPath);
    });
}

export async function generateSoraLoop(ctx: SoraGenerationContext) {
    const { prompt, model, totalSeconds, userId, sendChunk, aspectRatio = '16:9', initialImage, apiKey, baseUrl, reqHost, reqProto } = ctx;
    
    const client = await clientPromise;
    const db = client.db(process.env.MONGO_DB_NAME || "zumidb");
    const collection = db.collection("generated_videos");

    const tempSessionId = randomUUID();
    const tempDir = path.join(process.cwd(), 'public', 'generated', 'temp_' + tempSessionId);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // 15 seconds per video as per description
    const segmentDuration = 15; 
    const iterations = Math.ceil(Math.max(10, totalSeconds) / segmentDuration);
    
    const intermediateDbIds: any[] = [];
    const localSegmentPaths: string[] = [];
    
    // For Sora parameter mapping
    let videoSize = "1280x720";
    if (aspectRatio === "9:16") videoSize = "720x1280";
    if (aspectRatio === "1:1") videoSize = "1024x1024";

    let currentInputImage = initialImage || null;

    sendChunk(`Starting Sora Chain Generation: ${totalSeconds}s requested (${iterations} loops)\n`);

    try {
        for (let i = 0; i < iterations; i++) {
            sendChunk(`\n--- Segment ${i + 1}/${iterations} ---\n`);

            // 1. Prepare Prompt
            let currentPrompt = prompt;
            if (i > 0) {
                // Modified to ensure development and coherence as requested
                currentPrompt = `${prompt}. Continue the video sequence seamlessly from the provided starting frame. Develop the action and narrative further; do not simply repeat the initial scene. Ensure visual consistency with the previous segment.`;
            }

            // 2. Call API
            const formData = new FormData();
            formData.append("prompt", currentPrompt);
            formData.append("model", model); 
            formData.append("size", videoSize); 
            // Request 10s if total is <= 10, otherwise maximize chunks with 15s
            formData.append("seconds", (totalSeconds <= 10) ? "10" : "15");

            if (currentInputImage) {
                 const cleanB64 = currentInputImage.replace(/^data:image\/\w+;base64,/, "");
                 const buffer = Buffer.from(cleanB64, 'base64');
                 const blob = new Blob([buffer], { type: 'image/jpeg' });
                 
                 // Docs usually use 'input_image' for Sora Img2Video
                 formData.append("input_image", blob, `input_${i}.jpg`);
            }

            sendChunk(`Requesting generation (Loop ${i+1})...\n`);
            
            const submitRes = await fetch(`${baseUrl}/v1/videos`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}` },
                body: formData
            });

            if (!submitRes.ok) throw new Error("API Error: " + await submitRes.text());
            const { id: taskId } = await submitRes.json();

            // 3. Poll
            let segmentUrl = "";
            let polls = 0;
            while (!segmentUrl && polls < 120) { // 10 mins timeout
                polls++;
                await new Promise(r => setTimeout(r, 5000));
                
                // Progress Reporting Calculation
                // Total Progress = (CompletedSegments / TotalSegments) + (CurrentSegmentProgress / TotalSegments)
                // But simplified: Just show segment X/Y
                
                const checkRes = await fetch(`${baseUrl}/v1/videos/${taskId}`, {
                     headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                if (checkRes.ok) {
                    const statusData = await checkRes.json();
                    if (statusData.status === 'completed') {
                         segmentUrl = statusData.url;
                         // Fallback for missing URL in status
                         if(!segmentUrl) {
                            const cRes = await fetch(`${baseUrl}/v1/videos/${taskId}/content`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
                            if(cRes.ok) segmentUrl = (await cRes.json()).url;
                         }
                    } else if (statusData.status === 'failed') {
                        console.error("Segment failed. Status Data:", JSON.stringify(statusData, null, 2));
                        const reason = statusData.error || statusData.message || statusData.reason || "Unknown reason";
                        throw new Error(`Segment generation failed: ${reason}`);
                    }
                    
                    const segmentProgress = statusData.progress || 0;
                    // Global Progress: (i * 100 + segmentProgress) / iterations
                    const globalProgress = ((i * 100) + segmentProgress) / iterations;
                    
                    sendChunk(`Status: ${statusData.status} (Seg: ${segmentProgress}%, Total: ${globalProgress.toFixed(1)}%)\n`);
                }
            }
            if (!segmentUrl) throw new Error("Timeout waiting for segment");

            // 4. Download locally
            const segFileName = `sora_seg_${i}_${randomUUID()}.mp4`;
            const segPath = path.join(tempDir, segFileName);
            await downloadFile(segmentUrl, segPath);
            localSegmentPaths.push(segPath);
            sendChunk(`Segment saved.\n`);

            // 5. Save to DB (Intermediate)
            const publicSegUrl = `${reqProto}://${reqHost}/generated/temp_${tempSessionId}/${segFileName}`;
            const dbEntry = await collection.insertOne({
                user_id: userId,
                prompt: currentPrompt,
                model: model,
                video_url: publicSegUrl,
                created_at: new Date(),
                is_intermediate: true,
                session_id: tempSessionId
            });
            intermediateDbIds.push(dbEntry.insertedId);

            // 6. Prepare Next Loop
            if (i < iterations - 1) {
                sendChunk(`Extracting last frame for continuity...\n`);
                const frameBuffer = await extractLastFrame(segPath);
                // Set as input for next loop
                currentInputImage = "data:image/jpeg;base64," + frameBuffer.toString('base64');
            }
        }

        // --- FINAL STITCHING ---
        sendChunk(`\nStitching ${localSegmentPaths.length} videos...\n`);
        
        const finalFileName = `sora_complete_${randomUUID()}.mp4`;
        const publicGenDir = path.join(process.cwd(), 'public', 'generated');
        if (!fs.existsSync(publicGenDir)) fs.mkdirSync(publicGenDir, { recursive: true });
        const finalPath = path.join(publicGenDir, finalFileName);

        await concatVideos(localSegmentPaths, finalPath);

        const finalUrl = `${reqProto}://${reqHost}/generated/${finalFileName}`;

        // Save Final DB Entry
        await collection.insertOne({
            user_id: userId,
            prompt: prompt, // Original prompt
            model: model,   // Original model request
            video_url: finalUrl,
            created_at: new Date(),
            duration: totalSeconds,
            is_intermediate: false
        });
        sendChunk(`Final video saved to DB.\n`);

        // Cleanup Intermediate
        if (intermediateDbIds.length > 0) {
            await collection.deleteMany({ _id: { $in: intermediateDbIds } });
            sendChunk(`Cleaned up intermediate records.\n`);
        }

        // Cleanup Temp Files
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch(e) { console.error("Temp file cleanup error:", e); }

        sendChunk(`Done.\n`);
        return finalUrl;

    } catch (error) {
        // Cleanup on error
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch(e) {}
        throw error;
    }
}
