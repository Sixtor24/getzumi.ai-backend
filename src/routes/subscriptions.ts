import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import jwt from 'jsonwebtoken';

const router = Router();

// Helper function to get userId from token
const getUserIdFromToken = (req: Request): string | null => {
  let token = req.cookies.auth_token;
  
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) return null;

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
    return decoded.userId;
  } catch (e) {
    return null;
  }
};

// Get user subscription
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isSubscribed: true,
        subscriptionPlan: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      subscription: user
    });
  } catch (error: any) {
    console.error('Get subscription error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get subscription' });
  }
});

// Subscribe to a plan
router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { planId, billingPeriod } = req.body;

    if (!planId) {
      return res.status(400).json({ success: false, message: 'Plan ID is required' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isSubscribed: true,
        subscriptionPlan: planId,
        subscriptionStartDate: new Date(),
        subscriptionEndDate: billingPeriod === 'yearly' 
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        isSubscribed: true,
        subscriptionPlan: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
      }
    });

    return res.status(200).json({
      success: true,
      user: updatedUser
    });
  } catch (error: any) {
    console.error('Subscribe error:', error);
    return res.status(500).json({ success: false, message: 'Failed to subscribe' });
  }
});

// Cancel subscription
router.post('/cancel', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isSubscribed: false,
        subscriptionPlan: null,
        subscriptionEndDate: null,
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        isSubscribed: true,
        subscriptionPlan: true,
      }
    });

    return res.status(200).json({
      success: true,
      user: updatedUser
    });
  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    return res.status(500).json({ success: false, message: 'Failed to cancel subscription' });
  }
});

export default router;
