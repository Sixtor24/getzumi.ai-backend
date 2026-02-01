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
        const { fullName, username, email, password } = body;

        if (!fullName || !username || !email || !password) {
            return NextResponse.json({ success: false, message: "Missing required fields" }, { 
                status: 400,
                headers: corsHeaders(origin)
            });
        }

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email },
                    { username: username }
                ]
            }
        });

        if (existingUser) {
            const field = existingUser.email === email ? "Email" : "Username";
            return NextResponse.json({ success: false, message: `${field} already exists` }, { 
                status: 409,
                headers: corsHeaders(origin)
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await prisma.user.create({
            data: {
                fullName,
                username,
                email,
                password: hashedPassword,
            }
        });

        const userId = newUser.id;

        const token = jwt.sign(
            { userId: userId, username: username, email: email },
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
            message: "User registered successfully",
            token: token,
            user: { id: userId, username, email, fullName }
        }, { 
            status: 201,
            headers: corsHeaders(origin)
        });

        response.headers.set('Set-Cookie', cookie);

        return response;

    } catch (error) {
        console.error("Signup Error:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { 
            status: 500,
            headers: corsHeaders(origin)
        });
    }
}
