import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import jwt from 'jsonwebtoken';

const router = Router();

// Generate Text
router.post('/text', async (req: Request, res: Response) => {
  try {
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Add your text generation logic here
    return res.status(501).json({ success: false, message: "Text generation not implemented yet" });

  } catch (error) {
    console.error("Text Generation Error:", error);
    return res.status(500).json({ success: false, message: "Failed to generate text" });
  }
});

// Get My Texts
router.get('/my-texts', async (req: Request, res: Response) => {
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

    const texts = await prisma.text.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({
      success: true,
      count: texts.length,
      texts: texts
    });

  } catch (error) {
    console.error("Get Texts Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch texts" });
  }
});

export default router;
