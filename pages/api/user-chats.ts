// File: pages/api/user-chats.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client'; // Ganti impor pool dengan PrismaClient
import { validate as isUUID } from 'uuid';

// Inisialisasi Prisma Client
const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Hanya izinkan metode GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Ambil dan validasi user_id dari query
  const userId = req.query.user_id as string;

  if (!userId) {
    return res.status(400).json({ error: 'Bad Request', message: 'Parameter user_id diperlukan' });
  }
  if (!isUUID(userId)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Format user_id tidak valid' });
  }

  try {
    // 4. Ganti query SQL manual dengan prisma.chatContent.findMany
    const chats = await prisma.chatContent.findMany({
      where: {
        userId: userId,
      },
      // Ambil pesan pertama untuk judul dan hitung total pesan
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 100, // Sama seperti LIMIT 100 di SQL
    });

    // 5. Format ulang hasil dari Prisma agar sesuai kebutuhan frontend
    const formattedChats = chats.map(chat => ({
      id: chat.chatId,
      title: chat.messages[0]?.content.substring(0, 50) || 'New Chat',
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      message_count: chat._count.messages,
    }));

    return res.status(200).json({