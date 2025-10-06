// File: pages/api/load-chat.ts
import { PrismaClient } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';

// Inisialisasi Prisma Client
const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, chatId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid userId parameter' });
  }

  try {
    // --- LOGIKA JIKA MENGAMBIL SATU CHAT SPESIFIK ---
    if (chatId && typeof chatId === 'string') {
      
      // Ambil satu ChatContent beserta semua Message yang berelasi
      const chat = await prisma.chatContent.findFirst({
        where: {
          chatId: chatId,
          userId: userId,
        },
        include: {
          // 'include' untuk mengambil semua pesan yang terhubung dengan sesi chat ini
          messages: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      return res.status(200).json({ success: true, data: chat || null });

    // --- LOGIKA JIKA MENGAMBIL SEMUA CHAT MILIK USER ---
    } else {

      // Logika ini sama seperti di file user-chats.ts sebelumnya
      const chats = await prisma.chatContent.findMany({
        where: {
          userId: userId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 1, // Ambil 1 pesan pertama untuk judul
          },
          _count: {
            select: { messages: true }, // Hitung total pesan
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      // Format data agar sesuai dengan yang dibutuhkan frontend
      const formattedChats = chats.map(chat => ({
        id: chat.chatId,
        title: chat.messages[0]?.content.substring(0, 50) || 'New Chat',
        updatedAt: chat.updatedAt,
        createdAt: chat.createdAt,
        message_count: chat._count.messages,
      }));

      return res.status(200).json({ success: true, data: formattedChats });
    }
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}