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

        const audios = await prisma.audio.findMany({
            where: { userId: userId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        return handleCorsResponse({
            success: true,
            audios: audios.map(aud => ({
                id: aud.id,
                text: aud.text,
                voice: aud.voice,
                audio_url: aud.audioUrl,
                created_at: aud.createdAt
            }))
        }, 200, origin);

    } catch (error) {
        console.error("Get My Audios Error:", error);
        return handleCorsError("Internal Server Error", 500, origin);
    }
}
