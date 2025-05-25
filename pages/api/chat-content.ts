// File: pages/api/chat-content.ts

import { executeQuery } from '@/utils/db';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { chat_id, user_id } = req.query;

  if (!chat_id || !user_id) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Ambil data chat dari database
    const result = await executeQuery(
      'SELECT messages, history FROM chat_contents WHERE chat_id = $1 AND user_id = $2',
      [chat_id, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Chat content not found' });
    }

    const chatContent = result.rows[0];

    return res.status(200).json({
      messages: chatContent.messages || [],
      history: chatContent.history || []
    });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}