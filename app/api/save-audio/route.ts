
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import jwt from 'jsonwebtoken';
import { Binary } from 'mongodb';

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

        const { audioData, prompt, provider, mimeType } = await req.json();

        if (!audioData || !provider) {
             return NextResponse.json({ success: false, message: "Missing audio data or provider" }, { status: 400 });
        }

        // Convert Base64 to Buffer
        // audioData might have prefix like "data:audio/mpeg;base64,"
        const base64Content = audioData.split(';base64,').pop();
        const buffer = Buffer.from(base64Content, 'base64');

        const client = await clientPromise;
        const db = client.db(process.env.MONGO_DB_NAME || "zumidb");

        const doc = {
            user_id: userId,
            prompt: prompt || "Audio Upload",
            provider: provider,
            model: 'unknown',
            audio_data: new Binary(buffer),
            mime_type: mimeType || 'audio/mpeg',
            created_at: new Date()
        };

        const result = await db.collection("generated_audios").insertOne(doc);

        return NextResponse.json({
            success: true,
            view_url: `/api/view-audio/${result.insertedId.toString()}`
        });

    } catch (e) {
        console.error("Save Audio Error", e);
        return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
    }
}
