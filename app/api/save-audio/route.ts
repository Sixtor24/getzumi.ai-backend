import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import jwt from 'jsonwebtoken';

export async function POST(req: NextRequest) {
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

        const { audioUrl, text, voice } = await req.json();

        if (!audioUrl || !text) {
             return NextResponse.json({ success: false, message: "Missing audio URL or text" }, { status: 400 });
        }

        const audio = await prisma.audio.create({
            data: {
                userId,
                text,
                voice: voice || 'default',
                audioUrl,
                status: "completed"
            }
        });

        return NextResponse.json({
            success: true,
            audio_id: audio.id,
            audio_url: audio.audioUrl
        });

    } catch (e) {
        console.error("Save Audio Error", e);
        return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
    }
}
