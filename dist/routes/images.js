import { Router } from 'express';
import prisma from '../lib/prisma.js';
import jwt from 'jsonwebtoken';
import { GeminiImageService } from '../lib/gemini.js';
import sharp from 'sharp';
const router = Router();
// Generate Image
router.post('/generate', async (req, res) => {
    try {
        const { prompt, model = "gemini-3-pro-image-preview", input_images = [] } = req.body;
        const apiKey = process.env.APIYI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, message: "API Key not configured" });
        }
        const service = new GeminiImageService(apiKey);
        const result = await service.generateImages(prompt, model, input_images, 4);
        if (!result.success || !result.data || result.data.length === 0) {
            return res.status(502).json({ success: false, message: result.error });
        }
        const compressedImages = await Promise.all(result.data.map(buffer => sharp(buffer)
            .jpeg({ quality: 70, mozjpeg: true })
            .toBuffer()));
        const candidates = compressedImages.map(buf => `data:image/jpeg;base64,${buf.toString('base64')}`);
        return res.status(200).json({
            success: true,
            candidates: candidates,
            message: "Generated 4 candidates. Please select one to save."
        });
    }
    catch (error) {
        console.error(error);
        const msg = error instanceof Error ? error.message : "Generation Error";
        return res.status(500).json({ success: false, message: msg });
    }
});
// Save Image
router.post('/save-image', async (req, res) => {
    try {
        // Accept token from Authorization header or cookies
        let token = req.cookies.auth_token;
        // If not in cookies, check Authorization header
        if (!token && req.headers.authorization) {
            const authHeader = req.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }
        if (!token) {
            console.log('No auth token found');
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please sign in or register to save images."
            });
        }
        let userId;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
            userId = decoded.userId;
        }
        catch (e) {
            console.error("JWT Verification failed", e);
            return res.status(401).json({
                success: false,
                message: "Invalid session. Please sign in again."
            });
        }
        const { prompt, model, imageData, input_images, projectId } = req.body;
        const imageUrlToSave = imageData || req.body.imageUrl;
        if (!imageUrlToSave || !prompt) {
            console.error("Missing data in save-image:", { hasImageData: !!imageData, hasImageUrl: !!req.body.imageUrl, hasPrompt: !!prompt });
            return res.status(400).json({ success: false, message: "Missing data" });
        }
        const metadata = {};
        if (projectId)
            metadata.projectId = projectId;
        if (input_images)
            metadata.input_images = input_images;
        const image = await prisma.image.create({
            data: {
                userId,
                prompt,
                model: model || 'unknown',
                imageUrl: imageUrlToSave,
                status: "completed",
                metadata: Object.keys(metadata).length > 0 ? metadata : undefined
            }
        });
        return res.status(200).json({
            success: true,
            id: image.id,
            view_url: image.imageUrl
        });
    }
    catch (error) {
        console.error("Save Error", error);
        return res.status(500).json({ success: false, message: "Save failed" });
    }
});
// Get My Images
router.get('/my-images', async (req, res) => {
    try {
        // Accept token from Authorization header or cookies
        let token = req.cookies.auth_token;
        if (!token && req.headers.authorization) {
            const authHeader = req.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }
        if (!token) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        let userId;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
            userId = decoded.userId;
        }
        catch (e) {
            return res.status(401).json({ success: false, message: "Invalid session" });
        }
        const images = await prisma.image.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        const formattedImages = images.map(img => ({
            id: img.id,
            prompt: img.prompt,
            model: img.model,
            view_url: img.imageUrl,
            created_at: img.createdAt.toISOString(),
            projectId: img.metadata?.projectId || null
        }));
        return res.status(200).json({
            success: true,
            count: formattedImages.length,
            images: formattedImages
        });
    }
    catch (error) {
        console.error("Get Images Error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch images" });
    }
});
// Delete Image
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Accept token from Authorization header or cookies
        let token = req.cookies.auth_token;
        if (!token && req.headers.authorization) {
            const authHeader = req.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }
        if (!token) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        let userId;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
            userId = decoded.userId;
        }
        catch (e) {
            return res.status(401).json({ success: false, message: "Invalid session" });
        }
        // Verify the image belongs to the user
        const image = await prisma.image.findUnique({
            where: { id }
        });
        if (!image) {
            return res.status(404).json({ success: false, message: "Image not found" });
        }
        if (image.userId !== userId) {
            return res.status(403).json({ success: false, message: "Unauthorized to delete this image" });
        }
        // Delete the image
        await prisma.image.delete({
            where: { id }
        });
        return res.status(200).json({
            success: true,
            message: "Image deleted successfully"
        });
    }
    catch (error) {
        console.error("Delete Image Error:", error);
        return res.status(500).json({ success: false, message: "Failed to delete image" });
    }
});
// View Image
router.get('/view/:imageId', async (req, res) => {
    try {
        const { imageId } = req.params;
        const image = await prisma.image.findUnique({
            where: { id: imageId }
        });
        if (!image) {
            return res.status(404).json({ success: false, message: "Image not found" });
        }
        return res.status(200).json({
            success: true,
            image: {
                id: image.id,
                prompt: image.prompt,
                model: image.model,
                imageUrl: image.imageUrl,
                createdAt: image.createdAt
            }
        });
    }
    catch (error) {
        console.error("View Image Error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch image" });
    }
});
export default router;
//# sourceMappingURL=images.js.map