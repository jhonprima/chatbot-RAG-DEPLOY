// File: pages/api/chat-contents.ts
import { query } from '@/utils/db';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { chat_id, user_id } = req.query;

  if (!chat_id || !user_id) {
    return res.status(400).json({ error: 'Missing chat_id or user_id' });
  }

  if (req.method === 'GET') {
    try {
      const chatRes = await query(
        `SELECT message, type, timestamp FROM messages WHERE chat_id = $1 ORDER BY timestamp ASC`,
        [chat_id]
      );

      const messages = chatRes.rows.map((row: any) => ({
        message: row.message,
        type: row.type,
      }));

      const history = [];
      for (let i = 0; i < messages.length; i += 2) {
        const userMsg = messages[i]?.message || '';
        const botMsg = messages[i + 1]?.message || '';
        history.push([userMsg, botMsg]);
      }

      return res.status(200).json({
        messages: messages.length
          ? messages
          : [{ message: 'Halo!!, Apa yang ingin kamu tanyakan ?', type: 'apiMessage' }],
        history: messages.length ? history : [],
      });
    } catch (err) {
      console.error('Error fetching chat contents:', err);
      return res.status(500).json({ error: 'Failed to fetch chat contents' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
