import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { fullName, username, email, password } = body;

        // 1. Basic Validation
        if (!fullName || !username || !email || !password) {
            return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db(process.env.MONGO_DB_NAME || "zumidb");
        const usersCollection = db.collection("users");

        // 2. Check for existing user (username OR email)
        const existingUser = await usersCollection.findOne({
            $or: [{ email: email }, { username: username }]
        });

        if (existingUser) {
            const field = existingUser.email === email ? "Email" : "Username";
            return NextResponse.json({ success: false, message: `${field} already exists` }, { status: 409 });
        }

        // 3. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. Create User
        const newUser = {
            fullName,
            username,
            email,
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await usersCollection.insertOne(newUser);
        const userId = result.insertedId.toString();

        // 5. Generate Permanent Session Token (JWT)
        // Note: "Permanent" usually means a very long expiry. Let's set it to 10 years.
        const token = jwt.sign(
            { userId: userId, username: username, email: email },
            process.env.JWT_SECRET || 'fallback-secret-key-change-me',
            { expiresIn: '3650d' } // ~10 years
        );

        // 6. Set Cookie
        const cookie = serialize('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 365 * 10, // 10 years in seconds
            path: '/',
        });

        const response = NextResponse.json({ 
            success: true, 
            message: "User registered successfully",
            token: token, // Returning token in body as requested as well, but cookie is safer
            user: { id: userId, username, email, fullName }
        }, { status: 201 });

        response.headers.set('Set-Cookie', cookie);

        return response;

    } catch (error) {
        console.error("Signup Error:", error);
        return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
    }
}
