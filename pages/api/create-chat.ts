import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client'; // Impor Prisma
import { validate as isUUID } from 'uuid';

// Inisialisasi Prisma Client
const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, chatId } = req.body; // 'title' tidak lagi digunakan

  // Validasi input disederhanakan
  if (!userId || !chatId) {
    return res.status(400).json({ error: 'Missing required fields: userId and chatId are required' });
  }
  if (!isUUID(userId)) {
    return res.status(400).json({ error: 'Invalid userId format: must be a valid UUID' });
  }
  if (typeof chatId !== 'string') {
    return res.status(400).json({ error: 'Invalid chatId format' });
  }

  try {
    // GANTI: Buat ChatContent baru dengan satu perintah Prisma
    // Ini menggantikan semua SELECT dan INSERT yang lama
    const newChat = await prisma.chatContent.create({
      data: {
        chatId: chatId,
        // Hubungkan langsung ke user yang ada menggunakan relasi
        user: {
          connect: {
            id: userId,
          },
        },
      },
    });

    console.log('Chat created successfully:', { newChat });
    return res.status(201).json({ message: 'Chat created successfully', chat: newChat });

  } catch (error: any) {
    console.error('Error creating chat:', error