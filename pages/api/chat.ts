import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
// ... (imports lainnya tetap sama) ...
import { CohereEmbeddings } from '@langchain/cohere';
import { PineconeStore } from '@langchain/pinecone';
import { makeChain } from '@/utils/makechain';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    // FIX: Mengubah userId dan chatId menjadi user_id dan chat_id
    const { question, history, user_id, chat_id } = req.body; 

    // Validasi input disesuaikan dengan snake_case
    if (!question || !user_id || !chat_id) {
      // Menggunakan nama variabel yang benar dalam pesan error
      return res.status(400).json({ message: 'Missing required fields: question, user_id, chatId' }); 
    }

    const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

    try {
      // --- Logika LangChain (TIDAK BERUBAH) ---
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
      const chain = makeChain(retriever);
      const pastMessages = history
        .map((message: [string, string]) => `Human: ${message[0]}\nAssistant: ${message[1]}`)
        .join('\n');

      const response = await chain.invoke({
        question: sanitizedQuestion,
        chat_history: pastMessages,
      });

      const responseText = (response as any).text || 'Maaf, saya tidak dapat menghasilkan respons.';
      const sourceDocuments = (response as any).sourceDocuments || [];

      // --- Interaksi Database dengan Prisma ---

      // Cari atau buat sesi chat (ChatContent)
      const chatContent = await prisma.chatContent.upsert({
        where: {
          user_id_chat_id: { 
            user_id: user_id, // Menggunakan user_id
            chat_id: chat_id, // Menggunakan chat_id
          },
        },
        create: {
          chat_id: chat_id,
          user: {
            connect: { id: user_id },
          },
        },
        update: {
          updated_at: new Date(),
        },
      });

      // Simpan pesan user dan pesan AI dalam satu transaksi
      await prisma.$transaction([
        prisma.message.create({
          data: {
            content: sanitizedQuestion,
            role: 'user',
            user: {
              connect: { id: user_id }, // Menggunakan user_id
            },
            chat_content: {
              connect: { id: chatContent.id },
            },
          },
        }),
        prisma.message.create({
          data: {
            content: responseText,
            role: 'assistant',
            user: {
              connect: { id: user_id }, // Menggunakan user_id
            },
            chat_content: {
              connect: { id: chatContent.id },
            },
          },
        }),
      ]);

      return res.status(200).json({
        text: responseText,
        sourceDocuments,
      });

    } catch (error: any) {
      console.error('Error processing chat:', error);
      return res.status(500).json({
        error: 'Failed to process chat request',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}