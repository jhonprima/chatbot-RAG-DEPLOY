import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/utils/db';
import { validate as isUUID } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Request received:', {
    method: req.method,
    body: req.body
  });

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user_id, chat_id, title } = req.body;

  if (!user_id || !chat_id || !title) {
    return res.status(400).json({ error: 'Missing required fields: user_id, chat_id, and title are required' });
  }

  if (!isUUID(user_id)) {
    return res.status(400).json({ error: 'Invalid user_id format: must be a valid UUID' });
  }

  if (typeof chat_id !== 'string' || !chat_id.startsWith('session_')) {
    return res.status(400).json({ error: 'Invalid chat_id format: must be a string starting with "session_"' });
  }

  try {
    const existingChat = await pool.query('SELECT id FROM chats WHERE id = $1', [chat_id]);

    if (existingChat.rows.length > 0) {
      return res.status(409).json({ error: 'Chat with this ID already exists' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE id = $1', [user_id]);

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await pool.query(
      `INSERT INTO chats (id, user_id, title, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [chat_id, user_id, title]
    );

    await pool.query(
      `INSERT INTO chat_contents (user_id, chat_id, messages, history, created_at, updated_at)
       VALUES ($1, $2, '[]', '[]', NOW(), NOW())
       ON CONFLICT (user_id, chat_id) DO NOTHING`,
      [user_id, chat_id]
    );

    console.log('Chat created successfully:', { chat_id, user_id, title });
    return res.status(200).json({ message: 'Chat created successfully', chat_id });
  } catch (error: any) {
    console.error('Error creating chat:', error);

    const errorMessage = error.code === '23505' ? 
      'Duplicate key violation: Chat ID already exists' : 
      error.message || 'An unknown database error occurred';

    return res.status(500).json({ 
      error: errorMessage,  
      details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
    });
  }
}
