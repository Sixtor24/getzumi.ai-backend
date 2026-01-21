import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return new NextResponse("Invalid Image ID", { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGO_DB_NAME || "zumidb");
    const collection = db.collection("generated_images");

    const doc = await collection.findOne({ _id: new ObjectId(id) });

    if (!doc || !doc.image_data) {
      return new NextResponse("Image not found", { status: 404 });
    }

    // doc.image_data is a BSON Binary
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const binaryData: any = doc.image_data;
    const buffer = binaryData.buffer || binaryData.read(0, binaryData.length());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': doc.content_type || 'image/jpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  } catch (error) {
    console.error(error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
