import { NextRequest } from 'next/server';
import prisma from '../../../lib/prisma';
import jwt from 'jsonwebtoken';
import { handleCorsResponse, handleCorsError } from '../../../lib/cors';

export async function GET(req: NextRequest) {
    const origin = req.headers.get('origin');
    
    try {
        const token = req.cookies.get('auth_token')?.value;
        if (!token) return handleCorsError("Unauthorized", 401, origin);

        let userId: string;
        try {
            const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
            userId = decoded.userId;
        } catch (e) {
            return handleCorsError("Invalid session", 401, origin);
        }

        const texts = await prisma.text.findMany({
            where: { userId: userId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        return handleCorsResponse({
            success: true,
            texts: texts.map(txt => ({
                id: txt.id,
                prompt: txt.prompt,
                model: txt.model,
                content: txt.content,
                created_at: txt.createdAt
            }))
        }, 200, origin);

    } catch (error) {
        console.error("My Texts Error:", error);
        return handleCorsError("Server Error", 500, origin);
    }
}
