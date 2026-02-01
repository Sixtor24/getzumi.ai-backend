import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
import { corsHeaders } from '../../../../lib/cors';

export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin');
    
    try {
        const body = await request.json();
        const { identifier, password } = body;

        if (!identifier || !password) {
            return NextResponse.json({ success: false, message: "Missing identifier or password" }, { 
                status: 400,
                headers: corsHeaders(origin)
            });
        }

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { username: identifier }
                ]
            }
        });

        if (!user) {
            return NextResponse.json({ success: false, message: "Invalid credentials" }, { 
                status: 401,
                headers: corsHeaders(origin)
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return NextResponse.json({ success: false, message: "Invalid credentials" }, { 
                status: 401,
                headers: corsHeaders(origin)
            });
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username, email: user.email },
            process.env.JWT_SECRET || 'fallback-secret-key-change-me',
            { expiresIn: '3650d' }
        );

        const cookie = serialize('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'none',
            maxAge: 60 * 60 * 24 * 365 * 10,
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
        }, { 
            status: 200,
            headers: corsHeaders(origin)
        });

        response.headers.set('Set-Cookie', cookie);

        return response;

    } catch (error) {
        console.error("Signin Error:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { 
            status: 500,
            headers: corsHeaders(origin)
        });
    }
}
