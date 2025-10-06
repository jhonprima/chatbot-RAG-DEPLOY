// File: pages/api/messages.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

// Inisialisasi Prisma Client
const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Ambil chatId dan userId dari query parameter
  const chatId = req.query.chat_id as string;
  const userId = req.query.user_id as string;

  // Validasi input
  if (!chatId) {
    return res.status(400).json({ error: 'Missing or invalid chat_id' });
  }
  if (!userId) {
    return res.status(400).json({ error: 'Missing user_id' });
  }

  try {
    // Ganti semua logika query dengan satu perintah Prisma findMany
    const messages = await prisma.message.findMany({
      // Filter pesan berdasarkan relasi ke ChatContent
      where: {
        chatContent: {
          chatId: chatId,
          userId: userId,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      // Pilih field yang ingin ditampilkan (opsional, tapi praktik yang baik)
      select: {
        id: true,
        content: true,
        role: true,
        createdAt: true,
      },
    });

    // Langsung kembalikan hasilnya. Prisma sudah mengembalikan array yang rapi.
    return res.status(200).json(messages);

  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}