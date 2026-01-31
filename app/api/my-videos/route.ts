import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import jwt from 'jsonwebtoken';

export async function GET(req: NextRequest) {
    try {
        const token = req.cookies.get('auth_token')?.value;
        if (!token) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

        let userId: string;
        try {
            const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-change-me');
            userId = decoded.userId;
        } catch (e) {
            return NextResponse.json({ success: false, message: "Invalid session" }, { status: 401 });
        }

        const videos = await prisma.video.findMany({
            where: { userId: userId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        return NextResponse.json({
            success: true,
            videos: videos.map(vid => ({
                id: vid.id,
                prompt: vid.prompt,
                model: vid.model,
                video_url: vid.videoUrl,
                created_at: vid.createdAt
            }))
        });

    } catch (error) {
        console.error("My Videos Error:", error);
        return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
    }
}
