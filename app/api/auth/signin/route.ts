import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { identifier, password } = body; // identifier can be email OR username

        if (!identifier || !password) {
            return NextResponse.json({ success: false, message: "Missing identifier or password" }, { status: 400 });
        }

        // 1. Find User by Email OR Username
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { username: identifier }
                ]
            }
        });

        if (!user) {
            return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 });
        }

        // 2. Verify Password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 });
        }

        // 3. Generate Permanent Session Token
        const token = jwt.sign(
            { userId: user.id, username: user.username, email: user.email },
            process.env.JWT_SECRET || 'fallback-secret-key-change-me',
            { expiresIn: '3650d' } // ~10 years
        );

        // 4. Set Cookie
        const cookie = serialize('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
            path: '/',
        });

        const response = NextResponse.json({ 
            success: true, 
            message: "Login successful",
            token: token,
            user: { 
                id: user.id, 
                username: user.username, 
                email: user.email, 
                fullName: user.fullName 
            }
        }, { status: 200 });

        response.headers.set('Set-Cookie', cookie);

        return response;

    } catch (error) {
        console.error("Signin Error:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}
