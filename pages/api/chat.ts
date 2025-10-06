import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { CohereEmbeddings } from '@langchain/cohere';
import { PineconeStore } from '@langchain/pinecone';
import { makeChain } from '@/utils/makechain';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';

// Inisialisasi Prisma Client
const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { question, history, userId, chatId } = req.body;

    // Validasi input
    if (!question || !userId || !chatId) {
      return res.status(400).json({ message: 'Missing required fields: question, userId, chatId' });
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

      // Anda bisa menyederhanakan cara mendapatkan teks respons jika Anda tahu kuncinya
      const responseText = (response as any).text || 'Maaf, saya tidak dapat menghasilkan respons.';
      const sourceDocuments = (response as any).sourceDocuments || [];

      // --- Interaksi Database dengan Prisma ---

      // Cari atau buat sesi chat (ChatContent)
      // `upsert` adalah perintah create-or-update yang sangat efisien
      const chatContent = await prisma.chatContent.upsert({
        where: {
          // Cari berdasarkan kombinasi unik userId dan chatId
          userId_chatId: {
            userId: userId,
            chatId: chatId,
          },