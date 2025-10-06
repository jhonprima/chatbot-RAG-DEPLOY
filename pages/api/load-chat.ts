// File: pages/api/load-chat.ts
import { PrismaClient } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';

// Inisialisasi Prisma Client
const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Nama variabel di sini boleh camelCase, yang penting saat query harus snake_case
  const userId = req.query.userId as string;
  const chatId = req.query.chatId as string;

  if (!userId) {
    return res.status(400).json({ error: 'Missing or invalid userId parameter' });
  }

  try {
    // --- LOGIKA JIKA MENGAMBIL SATU CHAT SPESIFIK ---
    if (chatId) {
      const chat = await prisma.chatContent.findFirst({
        where: {
          // FIX: Menggunakan snake_case
          chat_id: chatId,
          user_id: userId,
        },
        include: {
          messages: {
            orderBy: {
              // FIX: Menggunakan snake_case
              created_at: 'asc',
            },
          },
        },
      });

      return res.status(200).json({ success: true, data: chat || null });

    // --- LOGIKA JIKA MENGAMBIL SEMUA CHAT MILIK USER ---
    } else {
      const chats = await prisma.chatContent.findMany({
        where: {
          // FIX: Menggunakan snake_case
          user_id: userId,
        },
        include: {
          messages: {
            orderBy: { 
              // FIX: Menggunakan snake_case
              created_at: 'asc' 
            },
            take: 1,
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: {
          // FIX: Menggunakan snake_case
          updated_at: 'desc',
        },
      });

      const formattedChats = chats.map(chat => ({
        // FIX: Menggunakan snake_case untuk membaca hasil dari Prisma
        id: chat.chat_id,
        title: chat.messages[0]?.content.substring(0, 50) || 'New Chat',
        updatedAt: chat.updated_at,
        createdAt: chat.created_at,
        message_count: chat._count.messages,
      }));

      return res.status(200).json({ success: true, data: formattedChats });
    }
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}