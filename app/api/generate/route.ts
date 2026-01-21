import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { GeminiImageService } from '../../../lib/gemini';
import sharp from 'sharp';
import { Binary } from 'mongodb';

interface GenerateRequestBody {
    prompt: string;
    model?: string;
    input_images?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequestBody = await request.json();
    const { prompt, model = "gemini-3-pro-image-preview", input_images = [] } = body;

    const apiKey = process.env.APIYI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, message: "API Key not configured" }, { status: 500 });
    }

    // 1. Generate Image
    const service = new GeminiImageService(apiKey);
    const result = await service.generateImageBytes(prompt, model, input_images);

    if (!result.success || !result.data) {
      return NextResponse.json({ success: false, message: result.error }, { status: 502 });
    }

    // 2. Compress Image using Sharp
    const compressedBuffer = await sharp(result.data)
      .jpeg({ quality: 70, mozjpeg: true })
      .toBuffer();

    // 3. Save to MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGO_DB_NAME || "zumidb");
    const collection = db.collection("generated_images");

    // Process input images for storage
    const storedInputImages = input_images.map(imgStr => {
      // Remove data URL prefix if present to get clean base64
      const base64Data = imgStr.replace(/^data:image\/\w+;base64,/, "");
      return new Binary(Buffer.from(base64Data, 'base64'));
    });

    const doc = {
      prompt,
      model,
      image_data: new Binary(compressedBuffer),
      input_images: storedInputImages,
      content_type: "image/jpeg",
      created_at: new Date(),
    };

    const insertResult = await collection.insertOne(doc);
    const imageId = insertResult.insertedId.toString();

    // Obtener la URL base dinámicamente desde la solicitud (funciona en localhost y en Netlify automáticamente)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const viewUrl = `${baseUrl}/api/view/${imageId}`;

    return NextResponse.json({
      success: true,
      image_id: imageId,
      message: `Image saved. View at: ${viewUrl}`,
      view_url: viewUrl
    });

  } catch (error) {
    console.error(error);
    const msg = error instanceof Error ? error.message : "Start Error";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
