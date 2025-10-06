import { PrismaClient } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';

// Inisialisasi Prisma Client
const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Mengambil user_id dari req.query dan memastikannya string
  const userId = req.query.user_id as string;

  if (!userId) {
    return res.status(400).json({ error: 'Missing or invalid user_id parameter' });
  }

  try {
    if (req.method === 'GET') {
      // Mengambil semua sesi chat milik user_id tertentu
      const chatContents = await prisma.chatContent.findMany({
        where: {
          userId: userId, // Filter berdasarkan user_id
        },
        // 'include' untuk mengambil data dari tabel lain yang berelasi
        include: {
          // Ambil 1 pesan pertama untuk dijadikan judul
          messages: {
            orderBy: {
              createdAt: 'asc',
            },
            take: 1,
          },
          // Hitung jumlah pesan di setiap sesi chat secara efisien
          _count: {
            select: { messages: true },
          },
        },
        orderBy: {
          updatedAt: 'desc', // Urutkan dari yang terbaru
        },
      });

      // Format hasil query agar sesuai dengan yang dibutuhkan frontend
      const formattedChats = chatContents.map((chat) => ({
        id: chat.chatId,
        // Judul diambil dari pesan pertama, atau 'New Chat' jika tidak ada pesan
        title: chat.messages[0]?.content.substring(0, 50) || 'New Chat',
        updatedAt: chat.updatedAt,
        createdAt: chat.createdAt,
        message_count: chat._count.messages,
      }));

      return res.status(200).json(formattedChats);
    }

    if (req.method === 'DELETE') {
      const { chatId } = req.body;

      if (!chatId || typeof chatId !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid chat_id' });
      }

      // Hapus ChatContent. Karena ada 'onDelete: Cascade',
      // semua Message yang terhubung akan ikut terhapus otomatis oleh database.
      await prisma.chatContent.deleteMany({
        where: {
          chatId: chatId,
          userId: userId, // Pastikan user hanya bisa menghapus chat miliknya sendiri
        },
      });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}