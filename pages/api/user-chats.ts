// File: pages/api/user-chats.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { validate as isUUID } from 'uuid';

// Inisialisasi Prisma Client
const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Hanya izinkan metode GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Ambil user_id dari query
  const userId = req.query.user_id as string;

  if (!userId) {
    return res.status(400).json({ error: 'Bad Request', message: 'Parameter user_id diperlukan' });
  }
  if (!isUUID(userId)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Format user_id tidak valid' });
  }

  try {
    // 4. Query database dengan penamaan yang benar
    const chats = await prisma.chatContent.findMany({
      where: {
        // FIX: user_id
        user_id: userId,
      },
      include: {
        messages: {
          // FIX: created_at
          orderBy: { created_at: 'asc' }, 
          take: 1, 
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: {
        // FIX: updated_at
        updated_at: 'desc', 
      },
      take: 100, 
    });

    // 5. Format ulang hasil dari Prisma agar sesuai kebutuhan frontend
    const formattedChats = chats.map(chat => ({
      // FIX: Menggunakan snake_case untuk membaca hasil dari Prisma
      id: chat.chat_id, 
      title: chat.messages[0]?.content.substring(0, 50) || 'New Chat',
      updatedAt: chat.updated_at,
      createdAt: chat.created_at,
      message_count: chat._count.messages,
    }));

    return res.status(200).json({
      success: true,
      data: formattedChats,
      count: formattedChats.length,
    });
  } catch (error: any) {
    console.error('Error fetching user chats:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Terjadi kesalahan saat mengambil data chat',
    });
  }
}