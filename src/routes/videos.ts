import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import jwt from 'jsonwebtoken';

const router = Router();

// Generate Video with streaming
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
    const baseUrl = process.env.APIYI_BASE_URL || "https://api.apiyi.com";
    
    if (!apiKey) {
      return res.status(500).json({ success: false, message: "API Configuration Missing" });
    }

    const messages: any[] = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt }
        ]
      }
    ];

    if (input_image) {
      messages[0].content.push({
        type: "image_url",
        image_url: { url: input_image }
      });
    }

    console.log('[Video Generate] Starting video generation:', { model: model || "sora_video2", hasInputImage: !!input_image });

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

    if (!apiRes.ok) {
      const err = await apiRes.text();
      console.error("APIYI Video Error:", err);
      return res.status(502).json({ success: false, message: "Provider Error" });
    }

    // Set headers for SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let accumulatedText = "";
    const decoder = new TextDecoder();

    // Stream the response
    if (apiRes.body) {
      const reader = apiRes.body.getReader();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunkText = decoder.decode(value);
          accumulatedText += chunkText;
          
          // Forward chunk to client
          res.write(value);
        }
        
        res.end();

        // Process accumulated text to extract video URL and save to DB
        try {
          const lines = accumulatedText.split('\n');
          let fullContent = "";
          
          for (const line of lines) {
            if (line.trim().startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const jsonStr = line.replace('data: ', '').trim();
                const json = JSON.parse(jsonStr);
                if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
                  fullContent += json.choices[0].delta.content;
                }
              } catch (e) {
                // Ignore parse errors for partial lines
              }
            }
          }

          console.log("[Video Generate] Full Stream Content:", fullContent.substring(0, 200) + '...');

          // Extract video URL from markdown or raw URL
          let videoUrl = null;
          const mdMatch = fullContent.match(/\[.*?\]\((https?:\/\/[^\s)]+)\)/);
          if (mdMatch && mdMatch[1]) {
            videoUrl = mdMatch[1];
          } else {
            const rawMatch = fullContent.match(/(https?:\/\/[^\s]+)/);
            if (rawMatch && rawMatch[1]) {
              videoUrl = rawMatch[1].replace(/[)\]\.]+$/, "");
            }
          }

          if (videoUrl) {
            // Save to PostgreSQL using Prisma
            await prisma.video.create({
              data: {
                userId: userId,
                prompt: prompt,
                model: model || "sora_video2",
                videoUrl: videoUrl,
                createdAt: new Date()
              }
            });
            console.log("[Video Generate] Video saved to DB:", videoUrl);
          } else {
            console.warn("[Video Generate] No video URL found in stream content");
          }

        } catch (err) {
          console.error("[Video Generate] Error processing video stream completion:", err);
        }

      } catch (streamError) {
        console.error("[Video Generate] Streaming error:", streamError);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: "Streaming error" });
        }
      }
    }

  } catch (error) {
    console.error("[Video Generate] Error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: "Server Error" });
    }
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
