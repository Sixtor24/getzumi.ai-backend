import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import jwt from 'jsonwebtoken';
import { VideoGenerationService } from '../lib/videoService.js';

const router = Router();

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

    const { prompt, model, input_image } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ success: false, message: "Prompt is required" });
    }

    const apiKey = process.env.APIYI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, message: "API Configuration Missing" });
    }

    console.log('[Video Generate] Starting:', { model: model || "veo-3.1", hasInputImage: !!input_image });

    // Use VideoGenerationService
    const videoService = new VideoGenerationService(apiKey);
    const result = await videoService.generateVideo(prompt, model || "veo-3.1", input_image);

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

export default router;
