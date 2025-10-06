// pages/api/create-chat.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import { validate as isUUID } from 'uuid';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, chatId } = req.body;

  if (!userId || !chatId) {
    return res.status(400).json({ error: 'Missing required fields: userId and chatId are required' });
  }
  if (!isUUID(userId)) {
    return res.status(400).json({ error: 'Invalid userId format: must be a valid UUID' });
  }
  if (typeof chatId !== 'string') {
    return res.status(400).json({ error: 'Invalid chatId format' });
  }

  try {
    const newChat = await prisma.chatContent.create({
      data: {
        // FIX: Menggunakan snake_case agar sesuai dengan schema.prisma
        chat_id: chatId,
        user: {
          connect: {
            id: userId,
          },
        },
      },
    });

    console.log('Chat created successfully:', { newChat });
    return res.status(201).json({ message: 'Chat created successfully', chat: newChat });

  } catch (error: any) {
    console.error('Error creating chat:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'Chat with this ID already exists for this user' });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return res.status(404).json({ error: 'User not found' });
    }

    return res.status(500).json({ 
      error: 'An unknown error occurred', 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}