
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
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

        const client = await clientPromise;
        const db = client.db(process.env.MONGO_DB_NAME || "zumidb");
        const collection = db.collection("generated_audios");

        // Find audios for this user.
        // We project only necessary fields to reduce payload size.
        const audios = await collection.find(
            { user_id: userId },
            { 
                projection: { 
                    prompt: 1, 
                    provider: 1, 
                    created_at: 1,
                    mime_type: 1 
                },
                sort: { created_at: -1 } // Newest first
            }
        ).toArray();

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;

        const formattedAudios = audios.map(audio => ({
            id: audio._id.toString(),
            prompt: audio.prompt,
            provider: audio.provider,
            created_at: audio.created_at,
            view_url: `${baseUrl}/api/view-audio/${audio._id.toString()}`
        }));

        return NextResponse.json({
            success: true,
            count: formattedAudios.length,
            audios: formattedAudios
        });

    } catch (error) {
        console.error("Get My Audios Error:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}
