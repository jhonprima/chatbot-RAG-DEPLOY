// pages/api/auth/login.ts
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

    // --- Validasi input (TIDAK PERLU DIUBAH, sudah bagus) ---
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

    // GANTI: Cari pengguna dengan Prisma, bukan SQL manual
    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    // Jika user tidak ditemukan, langsung kirim error.
    // Kita tidak perlu menunggu bcrypt.compare, jadi sedikit lebih cepat.
    if (!user) {
      console.log(`Login attempt failed - user not found: ${normalizedEmail}`);
      // Gunakan pesan yang sama untuk tidak memberi info ke peretas
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }

    // Verifikasi password (TIDAK PERLU DIUBAH)
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      console.log(`Login attempt failed - invalid password for user: ${user.id}`);
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }

    // Pastikan JWT_SECRET ada (TIDAK PERLU DIUBAH)
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET tidak terdefinisi');
    }

    // Buat token (TIDAK PERLU DIUBAH)
    const token = jwt.sign(
      { userId: user.id }, // ID adalah string (UUID)
      process.env.JWT_SECRET,