import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const audio = await prisma.audio.findUnique({
            where: { id: params.id }
        });

        if (!audio) {
            return new NextResponse("Not Found", { status: 404 });
        }

        // Redirect to the audio URL
        return NextResponse.redirect(audio.audioUrl);

    } catch (e) {
        console.error("View Audio Error", e);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
