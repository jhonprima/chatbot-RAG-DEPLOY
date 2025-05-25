import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/utils/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { chat_id } = req.query;

  if (!chat_id || typeof chat_id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid chat_id' });
  }

  try {
    const result = await pool.query(
      'SELECT id, chat_id, sender, content, created_at FROM messages WHERE chat_id = $1 ORDER BY created_at ASC',
      [chat_id]
    );
    return res.status(200).json(result.rows);
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: error.message });
  }
}
