import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

const router = Router();

// Sign Up
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { fullName, username, email, password } = req.body;

    if (!fullName || !username || !email || !password) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
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
      return res.status(409).json({ success: false, message: `${field} already exists` });
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

    res.setHeader('Set-Cookie', cookie);
    
    return res.status(201).json({ 
      success: true, 
      message: "User registered successfully",
      token: token,
      user: { id: userId, username, email, fullName }
    });

  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Sign In
router.post('/signin', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
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

    res.setHeader('Set-Cookie', cookie);

    return res.status(200).json({ 
      success: true, 
      message: "Login successful",
      token: token,
      user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName }
    });

  } catch (error) {
    console.error("Signin Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Sign Out
router.post('/signout', async (req: Request, res: Response) => {
  try {
    const cookie = serialize('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 0,
      path: '/',
    });

    res.setHeader('Set-Cookie', cookie);

    return res.status(200).json({ 
      success: true, 
      message: "Logged out successfully" 
    });

  } catch (error) {
    console.error("Signout Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

export default router;
