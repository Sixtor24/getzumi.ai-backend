import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import jwt from 'jsonwebtoken';
import Cartesia from '@cartesia/cartesia-js';

const router = Router();

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;

// Inicializar Cartesia Client
let cartesiaClient: Cartesia | null = null;
if (CARTESIA_API_KEY) {
  cartesiaClient = new Cartesia({ apiKey: CARTESIA_API_KEY });
}

// Helper para extraer userId del token
function getUserIdFromToken(req: Request): string | null {
  try {
    const token = req.cookies.auth_token;
    if (!token) return null;
    
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
    return decoded.userId;
  } catch (e) {
    return null;
  }
}

// Get Cartesia Voices
router.get('/voices', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!cartesiaClient) {
      return res.status(500).json({ success: false, message: "Cartesia API key not configured" });
    }

    // Obtener voces usando el SDK oficial
    const voicesPage = await cartesiaClient.voices.list();
    const voices = [];
    
    for await (const voice of voicesPage) {
      voices.push({
        id: voice.id,
        name: voice.name,
        description: voice.description || '',
        language: voice.language || 'en',
        is_public: voice.is_public || false
      });
    }

    return res.status(200).json({
      success: true,
      voices: voices
    });

  } catch (error: any) {
    console.error("Get Voices Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch voices" });
  }
});

// TTS (Text-to-Speech) - Generate audio with Cartesia
router.post('/tts', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!CARTESIA_API_KEY) {
      return res.status(500).json({ success: false, message: "Cartesia API key not configured" });
    }

    const { text, voiceId, modelId, speed, language, outputFormat } = req.body;

    if (!text || !voiceId) {
      return res.status(400).json({ success: false, message: "Text and voiceId are required" });
    }

    if (!cartesiaClient) {
      return res.status(500).json({ success: false, message: "Cartesia client not initialized" });
    }

    // Generar audio con Cartesia SDK
    const audioResponse = await cartesiaClient.tts.bytes({
      model_id: modelId || 'sonic-english',
      transcript: text,
      voice: {
        mode: 'id',
        id: voiceId,
      },
      language: language || 'en',
      output_format: outputFormat || {
        container: 'wav',
        sample_rate: 44100,
        encoding: 'pcm_f32le',
      }
    });

    // Convertir a base64 para enviar al frontend
    const audioBuffer = Buffer.from(audioResponse);
    const audioBase64 = audioBuffer.toString('base64');
    const audioDataUrl = `data:audio/wav;base64,${audioBase64}`;

    return res.status(200).json({
      success: true,
      audioUrl: audioDataUrl,
      format: 'wav'
    });

  } catch (error: any) {
    console.error("TTS Error:", error.response?.data || error.message);
    return res.status(500).json({ success: false, message: "Failed to generate audio" });
  }
});

// Preview Voice - Generate short sample
router.post('/preview-voice', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!CARTESIA_API_KEY) {
      return res.status(500).json({ success: false, message: "Cartesia API key not configured" });
    }

    const { voiceId } = req.body;

    if (!voiceId) {
      return res.status(400).json({ success: false, message: "VoiceId is required" });
    }

    if (!cartesiaClient) {
      return res.status(500).json({ success: false, message: "Cartesia client not initialized" });
    }

    // Texto de prueba MUY corto para preview rápido
    const sampleText = "Hi, this is my voice!";

    const audioResponse = await cartesiaClient.tts.bytes({
      model_id: 'sonic-turbo', // Modelo más rápido para previews
      transcript: sampleText,
      voice: {
        mode: 'id',
        id: voiceId,
      },
      language: 'en',
      output_format: {
        container: 'mp3',
        encoding: 'mp3',
        sample_rate: 22050,
      }
    });

    const audioBuffer = Buffer.from(audioResponse);
    const audioBase64 = audioBuffer.toString('base64');
    const audioDataUrl = `data:audio/mp3;base64,${audioBase64}`;

    return res.status(200).json({
      success: true,
      audioUrl: audioDataUrl,
      format: 'mp3'
    });

  } catch (error: any) {
    console.error("Preview Voice Error:", error.response?.data || error.message);
    return res.status(500).json({ success: false, message: "Failed to preview voice" });
  }
});

// Save Audio
router.post('/save-audio', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
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

    const userId = getUserIdFromToken(req);
    if (!userId) {
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
