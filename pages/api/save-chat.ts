// File: pages/api/save-chat.ts

import { query } from '@/utils/db';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, chat_id, messages, history } = req.body;

  if (!user_id || !chat_id) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Periksa apakah chat sudah ada
    const checkResult = await query(
      'SELECT id FROM chat_contents WHERE chat_id = $1 AND user_id = $2',
      [chat_id, user_id]
    );

    if (checkResult.rows.length > 0) {
      // Update chat yang sudah ada
      await query(
        `UPDATE chat_contents 
         SET messages = $1, history = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE chat_id = $3 AND user_id = $4`,
        [JSON.stringify(messages), JSON.stringify(history), chat_id, user_id]
      );
    } else {
      // Buat chat baru
      await query(
        `INSERT INTO chat_contents (user_id, chat_id, messages, history) 
         VALUES ($1, $2, $3, $4)`,
        [user_id, chat_id, JSON.stringify(messages), JSON.stringify(history)]
      );
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}