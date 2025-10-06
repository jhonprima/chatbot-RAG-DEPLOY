// pages/api/auth/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type ResponseData = {
  success: boolean;
  message?: string;
  token?: string;
  user?: {
    id: string;
    email: string;
    name?: string | null;
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Input tidak valid' });
    }
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email dan password diperlukan' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Format email tidak valid' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      console.log(`Login attempt failed - user not found: ${normalizedEmail}`);
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      console.log(`Login attempt failed - invalid password for user: ${user.id}`);
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET tidak terdefinisi');
    }

    // --- KESALAHAN ADA DI BAGIAN INI ---
    // Kode di bawah ini adalah versi yang sudah diperbaiki
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    // --- -------------------------- ---

    const { password: _, ...userData } = user;

    console.log(`User logged in: ${user.id}`);
    return res.status(200).json({
      success: true,
      token,
      user: userData,
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Terjadi kesalahan server' 
    });
  }
}