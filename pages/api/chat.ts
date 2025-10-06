import type { NextApiRequest, NextApiResponse } from 'next';
import type { Document } from 'langchain/document';
import { CohereEmbeddings } from '@langchain/cohere';
import { PineconeStore } from '@langchain/pinecone';
import { makeChain } from '@/utils/makechain';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { pool } from '@/utils/db';
import { validate as isUUID } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { chat_id, user_id } = req.query;

    if (!chat_id || !user_id || typeof chat_id !== 'string' || typeof user_id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid chat_id or user_id' });
    }

    try {
      const result = await pool.query(
        `SELECT content, role, source_documents, created_at
         FROM messages 
         WHERE chat_id = $1 AND user_id = $2 
         ORDER BY created_at ASC`,
        [chat_id, user_id]
      );

      const messages = result.rows.map((row) => ({
        message: row.content,
        type: row.role === 'user' ? 'userMessage' : 'apiMessage',
        sourceDocs: row.source_documents ? JSON.parse(row.source_documents) : [],
        created_at: row.created_at,
      }));

      return res.status(200).json({ messages });
    } catch (error: any) {
      console.error('Error fetching chat messages:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    const { question, history, user_id, chat_id, title } = req.body;

    console.log('Payload received:', req.body);

    if (!question || !user_id || !chat_id) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!isUUID(user_id)) {
      return res.status(400).json({ message: 'user_id is not a valid UUID' });
    }

    if (typeof chat_id !== 'string' || !chat_id.startsWith('session_')) {
      return res.status(400).json({ message: 'chat_id is not valid format' });
    }

    const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

    try {
      const index = pinecone.Index(PINECONE_INDEX_NAME);
      const vectorStore = await PineconeStore.fromExistingIndex(
        new CohereEmbeddings({ model: 'embed-english-v3.0' }),
        {
          pineconeIndex: index,
          textKey: 'text',
          namespace: PINECONE_NAME_SPACE,
        }
      );

      const retriever = vectorStore.asRetriever({ k: 4 });
      const sourceDocuments = await retriever.invoke(sanitizedQuestion);

      console.log('Retrieved documents:', sourceDocuments?.length || 0);
      console.log('First document preview:', sourceDocuments?.[0]?.pageContent?.substring(0, 100));

      const chain = makeChain(retriever);
      const pastMessages = history
        .map((message: [string, string]) => `Human: ${message[0]}\nAssistant: ${message[1]}`)
        .join('\n');

      const response = await chain.invoke({
        question: sanitizedQuestion,
        chat_history: pastMessages,
      });

      console.log('Chain response structure:', JSON.stringify(response, null, 2));
      console.log('Response keys:', Object.keys(response || {}));

      let responseText = '';

      if (typeof response === 'object' && response !== null) {
        const r = response as any;
        responseText = r.text ||
                       r.output ||
                       r.answer ||
                       r.result ||
                       r.content ||
                       r.response ||
                       JSON.stringify(r);
      } else if (typeof response === 'string') {
        responseText = response;
      } else {
        responseText = 'Maaf, tidak ada respons yang valid.';
      }

      if (!responseText || responseText.trim() === '' || responseText === '{}') {
        console.error('No valid response text found. Response object:', response);
        responseText = 'Maaf, tidak dapat menghasilkan respons untuk pertanyaan Anda.';
      }

      const documentsToSave = sourceDocuments && Array.isArray(sourceDocuments) 
        ? sourceDocuments.map(doc => ({
            pageContent: doc.pageContent || '',
            metadata: doc.metadata || {},
          }))
        : [];

      console.log('Documents to save count:', documentsToSave.length);
      console.log('Sample document:', documentsToSave[0]);

      const existingChatResult = await pool.query(
        'SELECT id FROM chats WHERE chat_id = $1 AND user_id = $2',
        [chat_id, user_id]
      );

      if (existingChatResult.rows.length === 0) {
        await pool.query(
          `INSERT INTO chats (user_id, chat_id, title, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())`,
          [user_id, chat_id, title || 'Chat Baru']
        );
      }

      await pool.query(
        `INSERT INTO messages (user_id, chat_id, content, role, created_at, updated_at)
         VALUES ($1, $2, $3, 'user', NOW(), NOW())`,
        [user_id, chat_id, sanitizedQuestion]
      );

      await pool.query(
        `INSERT INTO messages (user_id, chat_id, content, role, source_documents, created_at, updated_at)
         VALUES ($1, $2, $3, 'assistant', $4, NOW(), NOW())`,
        [user_id, chat_id, responseText, JSON.stringify(documentsToSave)]
      );

      await pool.query(
        'UPDATE chats SET updated_at = NOW() WHERE chat_id = $1 AND user_id = $2',
        [chat_id, user_id]
      );

      return res.status(200).json({
        text: responseText,
        sourceDocuments: documentsToSave,
      });

    } catch (error: any) {
      console.error('Error processing chat:', error);

      if (error.code === '23502') {
        console.error('Database constraint violation - null value detected');
      }

      return res.status(500).json({ 
        error: 'Failed to process chat request',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
// ini adalah chat ts untuk cyuber ruby 