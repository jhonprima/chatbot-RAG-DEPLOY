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
    const index = pinecone.Index(PINECONE_INDEX_NAME);
    const vectorStore = await PineconeStore.fromExistingIndex(
      new CohereEmbeddings({
        model: 'embed-english-v3.0',
      }),
      {
        pineconeIndex: index,
        textKey: 'text',
        namespace: PINECONE_NAME_SPACE,
      }
    );

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

    const chain = makeChain(retriever);

    const pastMessages = history
      .map((message: [string, string]) => {
        return [`Human: ${message[0]}`, `Assistant: ${message[1]}`].join('\n');
      })
      .join('\n');

    const response = await chain.invoke({
      question: sanitizedQuestion,
      chat_history: pastMessages,
    });

    const sourceDocuments = await documentPromise;

    // Simpan pesan user
    await pool.query(
      `INSERT INTO messages (user_id, chat_id, title, content, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'user', NOW(), NOW())`,
      [user_id, chat_id, title || null, sanitizedQuestion]
    );

    // Simpan jawaban AI
    await pool.query(
      `INSERT INTO messages (user_id, chat_id, title, content, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'assistant', NOW(), NOW())`,
      [user_id, chat_id, title || null, response]
    );

    return res.status(200).json({ text: response, sourceDocuments });
  } catch (error: any) {
    console.error('error', error);
    return res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
