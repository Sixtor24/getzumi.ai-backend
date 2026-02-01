import { NextRequest } from 'next/server';
import prisma from '../../../lib/prisma';
import jwt from 'jsonwebtoken';
import { handleCorsResponse, handleCorsError } from '../../../lib/cors';

export async function GET(request: NextRequest) {
    const origin = request.headers.get('origin');
    
    try {
        const token = request.cookies.get('auth_token')?.value;

        if (!token) {
            return handleCorsError("Unauthorized", 401, origin);
        }

        let userId: string;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
            userId = decoded.userId;
        } catch (e) {
            console.error(e);
            return handleCorsError("Invalid token", 401, origin);
        }

        const images = await prisma.image.findMany({
            where: { userId: userId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        return handleCorsResponse({
            success: true,
            images: images.map(img => ({
                id: img.id,
                prompt: img.prompt,
                model: img.model,
                image_url: img.imageUrl,
                created_at: img.createdAt
            }))
        }, 200, origin);

    } catch (error) {
        console.error("Get My Images Error:", error);
        return handleCorsError("Internal Server Error", 500, origin);
    }
}
