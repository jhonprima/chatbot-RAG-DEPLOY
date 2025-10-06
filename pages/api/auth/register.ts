// pages/api/auth/register.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
// GANTI: Hapus impor 'query' dan ganti dengan PrismaClient
import { PrismaClient } from '@prisma/client';

// Inisialisasi Prisma Client
const prisma = new PrismaClient();

type ResponseData = {
  success: boolean;
  message?: string;
  token?: string;
  user?: {
    // FIX: Tipe id diubah menjadi string karena kita menggunakan UUID
    id: string;
    email: string;
    name?: string | null; // Nama bisa null
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Hanya menerima method POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { name, email, password } = req.body;

    // --- Validasi input (TIDAK PERLU DIUBAH, sudah bagus) ---
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Input tidak valid' });
    }
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Semua field harus diisi' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Format email tidak valid' });
    }
    if (password.length < 6 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password harus 6+ karakter, mengandung huruf besar & angka',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // GANTI: Cek apakah email sudah terdaftar menggunakan Prisma
    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email sudah terdaftar' });
    }
    
    // Hash password (TIDAK PERLU DIUBAH)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // GANTI: Simpan user baru ke