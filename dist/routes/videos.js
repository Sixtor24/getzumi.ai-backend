import { Router } from 'express';
import prisma from '../lib/prisma.js';
import jwt from 'jsonwebtoken';
import { VideoGenerationService } from '../lib/videoService.js';
const router = Router();
// Background processing for SORA (uses streaming)
async function processVideoInBackground(videoId, prompt, model, inputImage, apiKey) {
    console.log(`[SORA Background] Starting streaming for ${videoId}`);
    try {
        const videoService = new VideoGenerationService(apiKey);
        const result = await videoService.generateVideo(prompt, model, inputImage);
        if (result.success && result.videoUrl) {
            await prisma.video.update({
                where: { id: videoId },
                data: {
                    videoUrl: result.videoUrl,
                    status: 'completed',
                    updatedAt: new Date()
                }
            });
            console.log(`[SORA Background] ✅ Video ${videoId} completed:`, result.videoUrl);
        }
        else {
            await prisma.video.update({
                where: { id: videoId },
                data: {
                    status: 'failed',
                    metadata: { error: result.error || 'Unknown error' },
                    updatedAt: new Date()
                }
            });
            console.error(`[SORA Background] ❌ Video ${videoId} failed:`, result.error);
        }
    }
    catch (error) {
        console.error(`[SORA Background] ⚠️ Exception for ${videoId}:`, error);
        await prisma.video.update({
            where: { id: videoId },
            data: {
                status: 'failed',
                metadata: { error: error instanceof Error ? error.message : 'Processing error' },
                updatedAt: new Date()
            }
        });
    }
}
// Generate Video using VEO/SORA APIs
router.post('/generate', async (req, res) => {
    try {
        const token = req.cookies.auth_token;
        if (!token) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        let userId;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
            userId = decoded.userId;
        }
        catch (e) {
            return res.status(401).json({ success: false, message: "Invalid session" });
        }
        const { prompt, model, input_image, projectId } = req.body;
        if (!prompt) {
            return res.status(400).json({ success: false, message: "Prompt is required" });
        }
        console.log('[Video Generate] Request data:', { prompt, model, hasInputImage: !!input_image, projectId });
        const apiKey = process.env.APIYI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, message: "API Configuration Missing" });
        }
        const videoService = new VideoGenerationService(apiKey);
        // VEO: New architecture (submit + poll)
        if (model.includes('veo')) {
            console.log('[Video Generate] VEO - Using submit+poll architecture');
            const submitResult = await videoService.submitTask(prompt, model, input_image);
            if (!submitResult.success || !submitResult.taskId) {
                console.error('[Video Generate] Failed to submit VEO task:', submitResult.error);
                return res.status(500).json({
                    success: false,
                    message: submitResult.error || 'Failed to submit video generation task'
                });
            }
            console.log('[Video Generate] VEO task submitted:', submitResult.taskId);
            // Create video record with apiTaskId
            const video = await prisma.video.create({
                data: {
                    userId: userId,
                    prompt: prompt,
                    model: model,
                    videoUrl: '',
                    apiTaskId: submitResult.taskId,
                    status: 'queued',
                    projectId: projectId || null,
                    metadata: { input_image: !!input_image },
                    createdAt: new Date()
                }
            });
            console.log('[Video Generate] ✅ VEO video record created:', video.id);
            return res.status(200).json({
                success: true,
                video: {
                    id: video.id,
                    status: 'queued',
                    apiTaskId: submitResult.taskId,
                    message: 'Video generation task submitted. Poll /api/videos/status/:id to check progress.'
                }
            });
        }
        // SORA: Streaming in background (old architecture)
        else if (model.includes('sora')) {
            console.log('[Video Generate] SORA - Using streaming+background architecture');
            // Create pending video record
            const pendingVideo = await prisma.video.create({
                data: {
                    userId: userId,
                    prompt: prompt,
                    model: model,
                    videoUrl: '',
                    status: 'processing',
                    projectId: projectId || null,
                    metadata: { input_image: !!input_image },
                    createdAt: new Date()
                }
            });
            console.log('[Video Generate] ✅ SORA video record created:', pendingVideo.id);
            // Process in background with streaming
            processVideoInBackground(pendingVideo.id, prompt, model, input_image, apiKey);
            return res.status(200).json({
                success: true,
                video: {
                    id: pendingVideo.id,
                    status: 'processing',
                    message: 'Video generation started. Poll /api/videos/status/:id to check progress.'
                }
            });
        }
        return res.status(400).json({
            success: false,
            message: 'Unsupported model'
        });
    }
    catch (error) {
        console.error("[Video Generate] Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
});
// Get My Videos
router.get('/my-videos', async (req, res) => {
    try {
        const token = req.cookies.auth_token;
        if (!token) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        let userId;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
            userId = decoded.userId;
        }
        catch (e) {
            return res.status(401).json({ success: false, message: "Invalid token" });
        }
        const videos = await prisma.video.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        return res.status(200).json({
            success: true,
            count: videos.length,
            videos: videos
        });
    }
    catch (error) {
        console.error("Get Videos Error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch videos" });
    }
});
// Get Video Status (for polling)
router.get('/status/:id', async (req, res) => {
    try {
        const token = req.cookies.auth_token;
        if (!token) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        let userId;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
            userId = decoded.userId;
        }
        catch (e) {
            return res.status(401).json({ success: false, message: "Invalid token" });
        }
        const videoId = req.params.id;
        const video = await prisma.video.findFirst({
            where: {
                id: videoId,
                userId: userId
            }
        });
        if (!video) {
            return res.status(404).json({ success: false, message: "Video not found" });
        }
        // If video already completed or failed, return cached status
        if (video.status === 'completed' || video.status === 'failed') {
            return res.status(200).json({
                success: true,
                video: {
                    id: video.id,
                    status: video.status,
                    videoUrl: video.videoUrl || null,
                    model: video.model,
                    prompt: video.prompt,
                    createdAt: video.createdAt,
                    error: video.metadata && typeof video.metadata === 'object' && 'error' in video.metadata
                        ? video.metadata.error
                        : null
                }
            });
        }
        // Video is still processing - check status in APIYI
        if (video.apiTaskId) {
            const apiKey = process.env.APIYI_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ success: false, message: "API Configuration Missing" });
            }
            console.log('[Video Status] Checking APIYI status for task:', video.apiTaskId);
            const videoService = new VideoGenerationService(apiKey);
            const statusResult = await videoService.checkTaskStatus(video.apiTaskId, video.model);
            if (statusResult.success && statusResult.status === 'completed' && statusResult.videoUrl) {
                // Update DB with completed video
                console.log('[Video Status] ✅ Video completed:', statusResult.videoUrl);
                await prisma.video.update({
                    where: { id: videoId },
                    data: {
                        videoUrl: statusResult.videoUrl,
                        status: 'completed',
                        updatedAt: new Date()
                    }
                });
                return res.status(200).json({
                    success: true,
                    video: {
                        id: video.id,
                        status: 'completed',
                        videoUrl: statusResult.videoUrl,
                        model: video.model,
                        prompt: video.prompt,
                        createdAt: video.createdAt,
                        error: null
                    }
                });
            }
            else if (!statusResult.success || statusResult.status === 'failed') {
                // Update DB with failed status
                console.error('[Video Status] ❌ Video failed:', statusResult.error);
                await prisma.video.update({
                    where: { id: videoId },
                    data: {
                        status: 'failed',
                        metadata: { error: statusResult.error || 'Generation failed' },
                        updatedAt: new Date()
                    }
                });
                return res.status(200).json({
                    success: true,
                    video: {
                        id: video.id,
                        status: 'failed',
                        videoUrl: null,
                        model: video.model,
                        prompt: video.prompt,
                        createdAt: video.createdAt,
                        error: statusResult.error || 'Generation failed'
                    }
                });
            }
            else {
                // Still processing
                console.log('[Video Status] ⏳ Still processing:', statusResult.status);
                return res.status(200).json({
                    success: true,
                    video: {
                        id: video.id,
                        status: statusResult.status,
                        videoUrl: null,
                        model: video.model,
                        prompt: video.prompt,
                        createdAt: video.createdAt,
                        error: null
                    }
                });
            }
        }
        // No apiTaskId - return current DB status
        return res.status(200).json({
            success: true,
            video: {
                id: video.id,
                status: video.status,
                videoUrl: video.videoUrl || null,
                model: video.model,
                prompt: video.prompt,
                createdAt: video.createdAt,
                error: video.metadata && typeof video.metadata === 'object' && 'error' in video.metadata
                    ? video.metadata.error
                    : null
            }
        });
    }
    catch (error) {
        console.error("Get Video Status Error:", error);
        return res.status(500).json({ success: false, message: "Failed to get video status" });
    }
});
export default router;
//# sourceMappingURL=videos.js.map