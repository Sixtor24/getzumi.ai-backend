import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get('auth_token')?.value;

        if (!token) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }

        let userId: string;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
            userId = decoded.userId;
        } catch (e) {
            console.error(e);
             return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
        }

        const audios = await prisma.audio.findMany({
            where: { userId: userId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        return NextResponse.json({
            success: true,
            audios: audios.map(aud => ({
                id: aud.id,
                text: aud.text,
                voice: aud.voice,
                audio_url: aud.audioUrl,
                created_at: aud.createdAt
            }))
        });

    } catch (error) {
        console.error("Get My Audios Error:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}
