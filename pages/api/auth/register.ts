// pages/api/auth/register.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../../utils/db';

type ResponseData = {
  success: boolean;
  message?: string;
  token?: string;
  user?: {
    id: number;
    email: string;
    name?: string;
  };
}

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

    // Validasi input
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Input tidak valid' });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Semua field harus diisi' });
    }

    // Validasi email dengan regex
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Format email tidak valid' });
    }

    // Validasi password (minimal 6 karakter, memiliki huruf besar & angka)
    if (
      password.length < 6 ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Password harus 6+ karakter, mengandung huruf besar & angka',
      });
    }

    // Normalisasi email
    const normalizedEmail = email.toLowerCase().trim();

    // Cek apakah email sudah terdaftar
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email sudah terdaftar' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Simpan user baru ke database
    const result = await query(
      'INSERT INTO users (name, email, password, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, name, email',
      [name, normalizedEmail, hashedPassword]
    );

    const newUser = result.rows[0];
    
    // Pastikan JWT_SECRET ada
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET tidak terdefinisi');
    }

    // Buat token
    const token = jwt.sign(
      { userId: newUser.id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`User registered: ${newUser.id}`);
    
    // Response sukses
    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Terjadi kesalahan pada server' 
    });
  }
}







