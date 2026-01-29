import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
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

        const client = await clientPromise;
        const db = client.db(process.env.MONGO_DB_NAME || "zumidb");

        const texts = await db.collection("generated_texts")
            .find({ user_id: userId })
            .sort({ created_at: -1 })
            .limit(50)
            .toArray();

        return NextResponse.json({
            success: true,
            texts: texts.map(t => ({
                id: t._id.toString(),
                prompt: t.prompt,
                model: t.model,
                content: t.content, // Return full content or snippet? User wants "recuperar", probably full.
                created_at: t.created_at
            }))
        });

    } catch (error) {
        console.error("My Texts Error:", error);
        return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
    }
}
