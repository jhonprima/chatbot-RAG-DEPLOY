// File: hooks/useChat.ts
import { useState, useEffect, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

interface Chat {
  chat_id: string;
  title: string;
  updated_at: string;
  created_at: string;
}

export const useChat = (userId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load all chats for user
  const loadChats = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/auth/chat-contents?user_id=${userId}`);
      const data = await response.json();

      if (data.success) {
        setChats(data.data);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  }, [userId]);

  // Load specific chat
  const loadChat = useCallback(async (chatId: string) => {
    if (!userId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/load-chat?user_id=${userId}&chat_id=${chatId}`);
      const data = await response.json();

      if (data.success && data.data) {
        setMessages(data.data.messages || []);
        setCurrentChatId(chatId);
      }
    } catch (error) {
      console.error('Error loading chat:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Save current chat
  const saveChat = useCallback(async (chatId?: string) => {
    if (!userId || messages.length === 0) return;

    const targetChatId = chatId || currentChatId;
    if (!targetChatId) return;

    setSaving(true);
    try {
      await fetch('/api/save-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          chat_id: targetChatId,
          messages: messages,
          history: messages // You can modify this based on your needs
        }),
      });
      // Refresh chats list
      await loadChats();
    } catch (error) {
      console.error('Error saving chat:', error);
    } finally {
      setSaving(false);
    }
  }, [userId, messages, currentChatId, loadChats]);

  // Create new chat
  const createNewChat = useCallback(async () => {
    if (!userId) return null;

    try {
      const response = await fetch('/api/auth/create-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await response.json();
      if (data.success) {
        setMessages([]);
        setCurrentChatId(data.chat_id);
        await loadChats();
        return data.chat_id;
      }
    } catch (error) {
      console.error('Error creating chat:', error);
    }
    return null;
  }, [userId, loadChats]);

  // Delete chat
  const deleteChat = useCallback(async (chatId: string) => {
    if (!userId) return;

    try {
      await fetch('/api/auth/chat-contents', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          user_id: userId, 
          chat_id: chatId 
        }),
      });

      if (currentChatId === chatId) {
        setMessages([]);
        setCurrentChatId(null);
      }

      await loadChats();
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  }, [userId, currentChatId, loadChats]);

  // Add message and auto-save
  const addMessage = useCallback(async (message: Message) => {
    const newMessages = [...messages, message];
    setMessages(newMessages);

    // Auto-save after adding message
    if (currentChatId) {
      setTimeout(() => saveChat(currentChatId), 1000); // Debounce save
    }
  }, [messages, currentChatId, saveChat]);

  // Load chats on mount
  useEffect(() => {
    if (userId) {
      loadChats();
    }
  }, [userId, loadChats]);

  return {
    messages,
    chats,
    currentChatId,
    loading,
    saving,
    setMessages,
    loadChats,
    loadChat,
    saveChat,
    createNewChat,
    deleteChat,
    addMessage,
  };
};