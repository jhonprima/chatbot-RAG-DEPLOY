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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, history, user_id, chat_id, title } = req.body;

  console.log('Payload received:', req.body);

  // Validasi wajib
  if (!question || !user_id || !chat_id) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // Validasi user_id (harus UUID)
  if (!isUUID(user_id)) {
    return res.status(400).json({ message: 'user_id is not a valid UUID' });
  }

  // Validasi chat_id (cukup pastikan string yang dimulai dari "session_")
  if (typeof chat_id !== 'string' || !chat_id.startsWith('session_')) {
    return res.status(400).json({ message: 'chat_id is not valid format' });
  }

  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  try {
    // Setup Pinecone & embedding store
    const index = pinecone.Index(PINECONE_INDEX_NAME);
    const vectorStore = await PineconeStore.fromExistingIndex(
      new CohereEmbeddings({ model: 'embed-english-v3.0' }),
      {
        pineconeIndex: index,
        textKey: 'text',
        namespace: PINECONE_NAME_SPACE,
      }
    );

    // Promise untuk menangkap dokumen hasil retrieval
    let resolveWithDocuments: (value: Document[]) => void;
    const documentPromise = new Promise<Document[]>((resolve) => {
      resolveWithDocuments = resolve;
    });

    const retriever = vectorStore.asRetriever({
      callbacks: [
        {
          handleRetrieverEnd(documents: any) {
            resolveWithDocuments(documents);
          },
        },
      ],
    });

    // Buat chain untuk Q&A
    const chain = makeChain(retriever);

    // Format history ke string
    const pastMessages = history
      .map((message: [string, string]) => `Human: ${message[0]}\nAssistant: ${message[1]}`)
      .join('\n');

    // Dapatkan jawaban dari chain
    const response = await chain.invoke({
      question: sanitizedQuestion,
      chat_history: pastMessages,
    });

    // Ambil dokumen sumber dari promise
    const sourceDocuments = await documentPromise;

    // --- SIMPAN TITLE CHAT HANYA JIKA CHAT BARU ---
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

    // Simpan pesan user
    await pool.query(
      `INSERT INTO messages (user_id, chat_id, content, role, created_at, updated_at)
       VALUES ($1, $2, $3, 'user', NOW(), NOW())`,
      [user_id, chat_id, sanitizedQuestion]
    );

    // Simpan pesan assistant
    await pool.query(
      `INSERT INTO messages (user_id, chat_id, content, role, created_at, updated_at)
       VALUES ($1, $2, $3, 'assistant', NOW(), NOW())`,
      [user_id, chat_id, response]
    );

    // --- UPDATE TITLE CHAT JIKA INI PERTANYAAN PERTAMA ---
    if (history.length === 0) {
      await pool.query(
        `UPDATE chats SET title = $1, updated_at = NOW() WHERE chat_id = $2 AND user_id = $3`,
        [sanitizedQuestion.slice(0, 50), chat_id, user_id]
      );
    }

    // Sinkronisasi chat_contents
    const allMessagesResult = await pool.query(
      'SELECT content, role FROM messages WHERE chat_id = $1 AND user_id = $2 ORDER BY created_at ASC',
      [chat_id, user_id]
    );

    const messagesArray = allMessagesResult.rows.map(msg => ({
      content: msg.content,
      role: msg.role,
    }));

    const existingChatContents = await pool.query(
      'SELECT id FROM chat_contents WHERE chat_id = $1 AND user_id = $2',
      [chat_id, user_id]
    );

    if (existingChatContents.rows.length === 0) {
      await pool.query(
        `INSERT INTO chat_contents (user_id, chat_id, messages, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [user_id, chat_id, JSON.stringify(messagesArray)]
      );
    } else {
      await pool.query(
        `UPDATE chat_contents SET messages = $1, updated_at = NOW() WHERE chat_id = $2 AND user_id = $3`,
        [JSON.stringify(messagesArray), chat_id, user_id]
      );
    }

    return res.status(200).json({ text: response, sourceDocuments });
  } catch (error: any) {
    console.error('error', error);
    return res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
