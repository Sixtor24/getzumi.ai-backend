import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import jwt from 'jsonwebtoken';
import { VideoGenerationService } from '../lib/videoService.js';

const router = Router();

// No background processing needed - just submit task and let polling handle it

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

    // NEW ARCHITECTURE: Submit task only (no waiting)
    console.log('[Video Generate] Submitting task for model:', model);
    
    const videoService = new VideoGenerationService(apiKey);
    const submitResult = await videoService.submitTask(prompt, model, input_image);
    
    if (!submitResult.success || !submitResult.taskId) {
      console.error('[Video Generate] Failed to submit task:', submitResult.error);
      return res.status(500).json({
        success: false,
        message: submitResult.error || 'Failed to submit video generation task'
      });
    }
    
    console.log('[Video Generate] Task submitted successfully:', submitResult.taskId);
    
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

    console.log('[Video Generate] ✅ Video record created:', video.id);
    
    // Return immediately with video ID
    return res.status(200).json({
      success: true,
      video: {
        id: video.id,
        status: 'queued',
        apiTaskId: submitResult.taskId,
        message: 'Video generation task submitted. Poll /api/videos/status/:id to check progress.'
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
            ? (video.metadata as any).error 
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
      } else if (!statusResult.success || statusResult.status === 'failed') {
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
      } else {
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
