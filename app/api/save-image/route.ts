import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
    try {
        // 1. Check Authentication (Cookie)
        const token = request.cookies.get('auth_token')?.value;

        if (!token) {
            return NextResponse.json({ 
                success: false, 
                message: "Authentication required. Please sign in or register to save images." 
            }, { status: 401 });
        }

        let userId: string;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
            userId = decoded.userId;
        } catch (e) {
            console.error("JWT Verification failed", e);
             return NextResponse.json({ 
                success: false, 
                message: "Invalid session. Please sign in again." 
            }, { status: 401 });
        }

        const body = await request.json();
        const { prompt, model, imageData, input_images, projectId } = body;

        // imageData is base64, imageUrl is URL - accept either
        const imageUrlToSave = imageData || body.imageUrl;

        if (!imageUrlToSave || !prompt) {
            console.error("Missing data in save-image:", { hasImageData: !!imageData, hasImageUrl: !!body.imageUrl, hasPrompt: !!prompt });
            return NextResponse.json({ success: false, message: "Missing data" }, { status: 400 });
        }

        const metadata: { projectId?: string; input_images?: string[] } = {};
        if (projectId) metadata.projectId = projectId;
        if (input_images) metadata.input_images = input_images;

        const image = await prisma.image.create({
            data: {
                userId,
                prompt,
                model: model || 'unknown',
                imageUrl: imageUrlToSave,
                status: "completed",
                metadata: Object.keys(metadata).length > 0 ? metadata as never : undefined
            }
        });

        return NextResponse.json({
            success: true,
            id: image.id,
            view_url: image.imageUrl
        });

    } catch (error) {
        console.error("Save Error", error);
        return NextResponse.json({ success: false, message: "Save failed" }, { status: 500 });
    }
}
