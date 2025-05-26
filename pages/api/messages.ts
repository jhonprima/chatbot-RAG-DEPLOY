import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/utils/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { chat_id, user_id } = req.query;

  if (!chat_id || typeof chat_id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid chat_id' });
  }

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id' });
  }

  try {
    // Prioritas 1: Ambil dari tabel messages (yang lebih akurat)
    const result = await pool.query(
      'SELECT id, chat_id, content, role, created_at FROM messages WHERE chat_id = $1 AND user_id = $2 ORDER BY created_at ASC',
      [chat_id, user_id]
    );

    if (result.rows.length > 0) {
      // Format response agar konsisten
      const formattedMessages = result.rows.map(msg => ({
        id: msg.id,
        chat_id: msg.chat_id,
        content: msg.content,
        role: msg.role,
        created_at: msg.created_at
      }));

      return res.status(200).json(formattedMessages);
    }

    // Prioritas 2: Jika tidak ada di messages, ambil dari chat_contents sebagai fallback
    const chatContents = await pool.query(
      'SELECT messages FROM chat_contents WHERE chat_id = $1 AND user_id = $2',
      [chat_id, user_id]
    );

    if (chatContents.rows.length > 0 && chatContents.rows[0].messages) {
      const messages = chatContents.rows[0].messages;
      return res.status(200).json(Array.isArray(messages) ? messages : []);
    }

    // Jika tidak ada data sama sekali
    return res.status(200).json([]);

  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: error.message });
  }
}