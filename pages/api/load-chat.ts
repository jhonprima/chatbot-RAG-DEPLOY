// File: pages/api/load-chat.ts
import { query } from '@/utils/db';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, chat_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id parameter' });
  }

  try {
    let result;
    
    if (chat_id) {
      // Load specific chat
      result = await query(
        'SELECT * FROM chat_contents WHERE chat_id = $1 AND user_id = $2',
        [chat_id, user_id]
      );
    } else {
      // Load all chats for user
      result = await query(
        'SELECT * FROM chat_contents WHERE user_id = $1 ORDER BY updated_at DESC',
        [user_id]
      );
    }

    const chats = result.rows.map(row => ({
      ...row,
      messages: typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages,
      history: typeof row.history === 'string' ? JSON.parse(row.history) : row.history
    }));

    return res.status(200).json({ 
      success: true, 
      data: chat_id ? chats[0] || null : chats 
    });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}