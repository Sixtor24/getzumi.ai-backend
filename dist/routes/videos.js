import { Router } from 'express';
import prisma from '../lib/prisma';
import jwt from 'jsonwebtoken';
const router = Router();
// Generate Video (placeholder - add your video generation logic)
router.post('/video', async (req, res) => {
    try {
        const token = req.cookies.auth_token;
        if (!token) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        // Add your video generation logic here
        return res.status(501).json({ success: false, message: "Video generation not implemented yet" });
    }
    catch (error) {
        console.error("Video Generation Error:", error);
        return res.status(500).json({ success: false, message: "Failed to generate video" });
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
export default router;
//# sourceMappingURL=videos.js.map