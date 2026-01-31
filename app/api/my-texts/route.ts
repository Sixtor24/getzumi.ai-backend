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

        const texts = await prisma.text.findMany({
            where: { userId: userId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        return NextResponse.json({
            success: true,
            texts: texts.map(txt => ({
                id: txt.id,
                prompt: txt.prompt,
                model: txt.model,
                content: txt.content,
                created_at: txt.createdAt
            }))
        });

    } catch (error) {
        console.error("My Texts Error:", error);
        return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
    }
}
