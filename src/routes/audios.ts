import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import jwt from 'jsonwebtoken';

const router = Router();

// TTS (Text-to-Speech)
router.post('/tts', async (req: Request, res: Response) => {
  try {
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Add your TTS logic here
    return res.status(501).json({ success: false, message: "TTS not implemented yet" });

  } catch (error) {
    console.error("TTS Error:", error);
    return res.status(500).json({ success: false, message: "Failed to generate audio" });
  }
});

// Save Audio
router.post('/save-audio', async (req: Request, res: Response) => {
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

    const { text, voice, audioUrl } = req.body;

    if (!text || !audioUrl) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const audio = await prisma.audio.create({
      data: {
        userId,
        text,
        voice: voice || 'default',
        audioUrl,
        status: 'completed'
      }
    });

    return res.status(200).json({
      success: true,
      audio_id: audio.id,
      audio_url: audio.audioUrl
    });

  } catch (error) {
    console.error("Save Audio Error:", error);
    return res.status(500).json({ success: false, message: "Failed to save audio" });
  }
});

// Get My Audios
router.get('/my-audios', async (req: Request, res: Response) => {
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

    const audios = await prisma.audio.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({
      success: true,
      count: audios.length,
      audios: audios
    });

  } catch (error) {
    console.error("Get Audios Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch audios" });
  }
});

export default router;
