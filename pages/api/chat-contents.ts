// pages/api/chat-contents.ts
import { PrismaClient } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.query.user_id as string;

  if (!userId) {
    return res.status(400).json({ error: 'Missing or invalid user_id parameter' });
  }

  try {
    if (req.method === 'GET') {
      const chatContents = await prisma.chatContent.findMany({
        where: {
          user_id: userId,
        },
        include: {
          messages: {
            // FIX: Menggunakan snake_case
            orderBy: {
              created_at: 'asc',
            },
            take: 1,
          },
          _count: {
            select: { messages: true },
          },
        },
        // FIX: Menggunakan snake_case
        orderBy: {
          updated_at: 'desc',
        },
      });

      const formattedChats = chatContents.map((chat) => ({
        id: chat.chat_id,
        title: chat.messages[0]?.content.substring(0, 50) || 'New Chat',
        // FIX: Menggunakan snake_case
        updatedAt: chat.updated_at,
        createdAt: chat.created_at,
        message_count: chat._count.messages,
      }));

      return res.status(200).json(formattedChats);
    }

    if (req.method === 'DELETE') {
      const { chatId } = req.body;

      if (!chatId || typeof chatId !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid chat_id' });
      }

      await prisma.chatContent.deleteMany({
        where: {
          chat_id: chatId,
          user_id: userId,
        },
      });

      return res.status(200).json({ success: true });
    }

    // FIX: Mengubah 4is05 menjadi 405
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}