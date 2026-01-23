import { NextRequest, NextResponse } from 'next/server';
import { serialize } from 'cookie';

export async function POST(request: NextRequest) {
    try {
        // Clear the auth cookie by setting maxAge to 0 (or -1) and strict path
        const cookie = serialize('auth_token', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: -1,
            path: '/',
        });

        const response = NextResponse.json({ 
            success: true, 
            message: "Logged out successfully" 
        }, { status: 200 });

        response.headers.set('Set-Cookie', cookie);

        return response;
    } catch (error) {
        console.error("Signout Error:", error);
         return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}
