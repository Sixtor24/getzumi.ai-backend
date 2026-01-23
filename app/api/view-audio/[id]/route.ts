
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const id = new ObjectId(params.id);
        const client = await clientPromise;
        const db = client.db(process.env.MONGO_DB_NAME || "zumidb");
        
        const doc = await db.collection("generated_audios").findOne({ _id: id });

        if (!doc) {
            return new NextResponse("Not Found", { status: 404 });
        }

        const buffer = doc.audio_data.buffer;

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': doc.mime_type || 'audio/mpeg',
                'Content-Length': buffer.length.toString()
            }
        });

    } catch (e) {
        console.error("View Audio Error", e);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
