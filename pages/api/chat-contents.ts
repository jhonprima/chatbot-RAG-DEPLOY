import { query } from '@/utils/db';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { user_id } = req.query;

  if (!user_id || typeof user_id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid user_id parameter' });
  }

  try {
    if (req.method === 'GET') {
      // Ambil data chat dari tabel messages (utama), pakai LEFT JOIN LATERAL agar aman untuk subquery
      const result = await query(
        `SELECT 
          m.chat_id,
          COALESCE(
            m.title, 
            first_message.content
          ) AS title,
          MAX(m.updated_at) AS updated_at,
          MIN(m.created_at) AS created_at,
          COUNT(*) AS message_count
        FROM messages m
        LEFT JOIN LATERAL (
          SELECT content 
          FROM messages m2 
          WHERE m2.chat_id = m.chat_id 
            AND m2.user_id = m.user_id 
            AND m2.role = 'user'
          ORDER BY m2.created_at ASC 
          LIMIT 1
        ) AS first_message ON true
        WHERE m.user_id = $1 
        GROUP BY m.chat_id, m.title, first_message.content
        ORDER BY updated_at DESC`,
        [user_id]
      );

      // Fallback jika tidak ada data di messages
      if (result.rows.length === 0) {
        const fallbackResult = await query(
          `SELECT chat_id,
                  CASE
                    WHEN messages::text != '[]' THEN
                      COALESCE((messages->0->>'content'), 'New Chat')
                    ELSE 'New Chat'
                  END AS title,
                  updated_at,
                  created_at
           FROM chat_contents 
           WHERE user_id = $1 
           ORDER BY updated_at DESC`,
          [user_id]
        );

        const fallbackChats = fallbackResult.rows.map(chat => ({
          id: chat.chat_id,
          title: chat.title,
          updated_at: chat.updated_at,
          created_at: chat.created_at,
          message_count: 0
        }));

        return res.status(200).json(fallbackChats);
      }

      // Format hasil dari tabel messages
      const formattedChats = result.rows.map(chat => ({
        id: chat.chat_id,
        title: chat.title
          ? chat.title.length > 50
            ? chat.title.substring(0, 50) + '...'
            : chat.title
          : 'New Chat',
        updated_at: chat.updated_at,
        created_at: chat.created_at,
        message_count: parseInt(chat.message_count)
      }));

      return res.status(200).json(formattedChats);
    }

    if (req.method === 'DELETE') {
      const { chat_id } = req.body;

      if (!chat_id || typeof chat_id !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid chat_id' });
      }

      // Hapus dari kedua tabel
      await query('DELETE FROM messages WHERE chat_id = $1 AND user_id = $2', [
        chat_id,
        user_id
      ]);

      await query('DELETE FROM chat_contents WHERE chat_id = $1 AND user_id = $2', [
        chat_id,
        user_id
      ]);

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
