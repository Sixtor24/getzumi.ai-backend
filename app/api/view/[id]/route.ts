import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const image = await prisma.image.findUnique({
      where: { id }
    });

    if (!image) {
      return new NextResponse("Image not found", { status: 404 });
    }

    // Redirect to the image URL
    return NextResponse.redirect(image.imageUrl);

  } catch (error) {
    console.error(error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
