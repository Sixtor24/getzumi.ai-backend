import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import jwt from 'jsonwebtoken';
import { VideoGenerationService } from '../lib/videoService.js';

const router = Router();

// Background processing function for SORA Streaming
async function processSoraVideoInBackground(
  videoId: string,
  prompt: string,
  model: string,
  inputImage: string | undefined,
  apiKey: string
) {
  console.log(`[Background] Processing SORA video ${videoId}`);
  
  try {
    const videoService = new VideoGenerationService(apiKey);
    const result = await videoService.generateVideo(prompt, model, inputImage);
    
    if (result.success && result.videoUrl) {
      // Update video with success
      await prisma.video.update({
        where: { id: videoId },
        data: {
          videoUrl: result.videoUrl,
          status: 'completed',
          updatedAt: new Date()
        }
      });
      console.log(`[Background] ✅ Video ${videoId} completed:`, result.videoUrl);
    } else {
      // Update video with error
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: 'failed',
          metadata: { error: result.error || 'Unknown error' },
          updatedAt: new Date()
        }
      });
      console.error(`[Background] ❌ Video ${videoId} failed:`, result.error);
    }
  } catch (error) {
    console.error(`[Background] Exception processing video ${videoId}:`, error);
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
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    let userId: string;
    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
      userId = decoded.userId;
    } catch (e) {
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

    // Check if model needs async processing (ALL models to avoid Railway timeout)
    const needsAsyncProcessing = true; // Enable async for all video models
    
    if (needsAsyncProcessing) {
      // All models: Create pending video and process in background
      console.log('[Video Generate] Using async processing for model:', model);
      
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

      // Process in background (don't await)
      processSoraVideoInBackground(pendingVideo.id, prompt, model, input_image, apiKey).catch((err: Error) => {
        console.error('[Video Generate] Background processing error:', err);
      });

      return res.status(200).json({
        success: true,
        video: {
          id: pendingVideo.id,
          status: 'processing',
          message: 'Video generation started. Poll /api/videos/status/:id to check progress.'
        }
      });
    }

    // Non-SORA models: Process synchronously (VEO, SORA Async)
    console.log('[Video Generate] Starting:', { model: model || "veo-3.1", hasInputImage: !!input_image });

    let result;
    try {
      const videoService = new VideoGenerationService(apiKey);
      result = await videoService.generateVideo(prompt, model || "veo-3.1", input_image);
      console.log('[Video Generate] Service result:', { success: result.success, hasVideoUrl: !!result.videoUrl });
    } catch (serviceError) {
      console.error('[Video Generate] Service error:', serviceError);
      return res.status(500).json({ 
        success: false, 
        message: serviceError instanceof Error ? serviceError.message : "Video service error" 
      });
    }

    if (!result.success) {
      console.error('[Video Generate] Failed:', result.error);
      return res.status(502).json({ success: false, message: result.error || "Video generation failed" });
    }

    // Save to database
    const savedVideo = await prisma.video.create({
      data: {
        userId: userId,
        prompt: prompt,
        model: model || "veo-3.1",
        videoUrl: result.videoUrl!,
        status: "completed",
        projectId: projectId || null,
        createdAt: new Date()
      }
    });

    console.log('[Video Generate] Success:', { videoId: savedVideo.id, url: result.videoUrl });

    return res.status(200).json({
      success: true,
      video: {
        id: savedVideo.id,
        videoUrl: result.videoUrl,
        taskId: result.taskId
      }
    });

  } catch (error) {
    console.error("[Video Generate] Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});

// Get My Videos
router.get('/my-videos', async (req: Request, res: Response) => {
  try {
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    let userId: string;
    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
      userId = decoded.userId;
    } catch (e) {
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

  } catch (error) {
    console.error("Get Videos Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch videos" });
  }
});

// Get Video Status (for polling)
router.get('/status/:id', async (req: Request, res: Response) => {
  try {
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    let userId: string;
    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
      userId = decoded.userId;
    } catch (e) {
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
          ? (video.metadata as any).error 
          : null
      }
    });

  } catch (error) {
    console.error("Get Video Status Error:", error);
    return res.status(500).json({ success: false, message: "Failed to get video status" });
  }
});

export default router;
