'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Menu, LogOut, Plus, MessageCircle, Send, X } from 'lucide-react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import LoadingDots from '@/components/ui/LoadingDots';
import { Document } from 'langchain/document';
import { v4 as uuidv4 } from 'uuid';

// Type definitions
interface UserData {
  id: string;
  name: string;
  email?: string;
}

interface Chat {
  id: string;
  title: string;
}

interface ChatMessage {
  message: string;
  type: 'userMessage' | 'apiMessage';
  sourceDocs?: Document[];
}

interface ChatState {
  messages: ChatMessage[];
  history: [string, string][];
}

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [showSidebar, setShowSidebar] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isNewChat, setIsNewChat] = useState(true);

  const [messageState, setMessageState] = useState<{
    messages: { message: string; type: string; sourceDocs?: any }[];
    history: [string, string][];
  }>(() => ({
    messages: [
      { message: 'Halo!!, Apa yang ingin kamu tanyakan ?', type: 'apiMessage' },
    ],
    history: [],
  }));

  const [chatHistory, setChatHistory] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState('');

  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLInputElement>(null);

  // Responsive handling
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile && showSidebar) {
        setShowSidebar(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showSidebar]);

  const generateSessionId = () => `session_${Date.now()}_${uuidv4().substring(0, 8)}`;

  // Initialize user session and chats
  useEffect(() => {
    let isMounted = true; // Prevent state updates if component unmounted
    
    const initializeApp = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
          router.push('/login');
          return;
        }

        const userData = JSON.parse(storedUser);
        if (!userData.name || !userData.id) {
          throw new Error('Invalid user data');
        }

        if (!isMounted) return; // Exit if component unmounted

        setUsername(userData.name);
        setUserId(userData.id);

        const loadChatHistory = async () => {
          try {
            const res = await fetch(`/api/user-chats?user_id=${userData.id}`);
            if (!res.ok) throw new Error('Failed to load chats');
            
            const data = await res.json();
            const chats = Array.isArray(data) ? data : [];
            
            if (!isMounted) return []; // Exit if component unmounted
            setChatHistory(chats);
            
            return chats;
          } catch (err) {
            console.error('Error loading chat history:', err);
            if (isMounted) setChatHistory([]);
            return [];
          }
        };

        const loadedChats = await loadChatHistory();
        if (!isMounted) return; // Exit if component unmounted

        // Initialize active chat
        let activeId = localStorage.getItem('activeChatId');
        const needsNewChat = !activeId || !loadedChats.some(chat => chat.id === activeId);
        
        if (needsNewChat) {
          activeId = generateSessionId();
          localStorage.setItem('activeChatId', activeId);
          setIsNewChat(true);
          
          // Only create chat if component is still mounted
          if (isMounted) {
            setChatHistory(prev => [...prev, { id: activeId, title: 'Chat Baru' }]);
            
            // Create chat in background without blocking UI
            fetch('/api/create-chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: userData.id,
                chat_id: activeId,
                title: 'Chat Baru',
              }),
            }).catch(err => {
              console.error('Failed to create new chat:', err);
            });
          }
        } else {
          setIsNewChat(false);
        }

        if (!isMounted) return; // Exit if component unmounted
        setActiveChatId(activeId);

        // Load chat state
        const savedState = localStorage.getItem(`chat_state_${activeId}`);
        if (savedState && isMounted) {
          try {
            const parsedState = JSON.parse(savedState);
            if (parsedState.messages && parsedState.history) {
              setMessageState(parsedState);
              if (parsedState.messages.length > 1) {
                setIsNewChat(false);
              }
            }
          } catch (err) {
            console.error('Error parsing saved state:', err);
          }
        }

        // Load sidebar preference
        if (isMounted) {
          const sidebarPref = localStorage.getItem('showSidebar');
          if (sidebarPref !== null) {
            setShowSidebar(sidebarPref === 'true');
          } else {
            setShowSidebar(!isMobile);
          }

          setIsInitialized(true);
        }
      } catch (err) {
        console.error('Initialization error:', err);
        localStorage.removeItem('user');
        if (isMounted) {
          router.push('/login');
        }
      }
    };

    if (!isInitialized) {
      initializeApp();
    }

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [router, isInitialized]); // Removed isMobile from dependencies

  // Save chat state to localStorage
  useEffect(() => {
    if (isInitialized && activeChatId) {
      const saveData = {
        messages: messageState.messages,
        history: messageState.history,
        timestamp: Date.now()
      };
      localStorage.setItem(`chat_state_${activeChatId}`, JSON.stringify(saveData));
    }
  }, [messageState, activeChatId, isInitialized]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTo({
        top: messageListRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messageState.messages]);

  const toggleSidebar = () => {
    const newValue = !showSidebar;
    setShowSidebar(newValue);
    localStorage.setItem('showSidebar', newValue.toString());
  };

  const createNewChat = useCallback(async () => {
    if (!userId || loading) {
      setError('User ID tidak valid atau sedang memproses. Silakan tunggu.');
      return;
    }

    setLoading(true);
    const newChatId = generateSessionId();
    const newChat = { id: newChatId, title: `Chat Baru` };

    try {
      // Optimistically update UI first
      setChatHistory(prev => [...prev, newChat]);
      setActiveChatId(newChatId);
      localStorage.setItem('activeChatId', newChatId);
      
      setMessageState({
        messages: [{ message: 'Halo!!, Apa yang ingin kamu tanyakan ?', type: 'apiMessage' }],
        history: [],
      });
      
      setIsNewChat(true);
      
      if (isMobile) setShowSidebar(false);

      // Create chat in background
      const response = await fetch('/api/create-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          chat_id: newChatId,
          title: newChat.title,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create chat');
      }

      setTimeout(() => textAreaRef.current?.focus(), 100);
    } catch (error) {
      console.error('Error creating chat:', error);
      
      // Rollback optimistic update on error
      setChatHistory(prev => prev.filter(chat => chat.id !== newChatId));
      
      setError(error instanceof Error ? error.message : 'Gagal membuat chat baru');
    } finally {
      setLoading(false);
    }
  }, [userId, isMobile, loading]);

  const switchChat = useCallback((chatId: string) => {
    setActiveChatId(chatId);
    localStorage.setItem('activeChatId', chatId);
    
    const savedState = localStorage.getItem(`chat_state_${chatId}`);
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        if (parsedState.messages && parsedState.history) {
          setMessageState(parsedState);
          setIsNewChat(parsedState.messages.length <= 1);
        } else {
          setMessageState({
            messages: [{ message: 'Halo!!, Apa yang ingin kamu tanyakan ?', type: 'apiMessage' }],
            history: [],
          });
          setIsNewChat(true);
        }
      } catch {
        setMessageState({
          messages: [{ message: 'Halo!!, Apa yang ingin kamu tanyakan ?', type: 'apiMessage' }],
          history: [],
        });
        setIsNewChat(true);
      }
    }
    
    if (isMobile) setShowSidebar(false);
    setTimeout(() => textAreaRef.current?.focus(), 100);
  }, [isMobile]);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const question = query.trim();
    
    if (!question) {
      setError('Masukkan pertanyaan Anda');
      return;
    }
    
    if (!userId || !activeChatId) {
      setError('Session tidak valid');
      return;
    }

    setError(null);
    const userMessage = { type: 'userMessage', message: question };

    setMessageState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
    }));

    setLoading(true);
    setQuery('');
    setIsNewChat(false);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          chat_id: activeChatId,
          title: chatHistory.find(c => c.id === activeChatId)?.title || 
                 question.slice(0, 30) || 'Percakapan Baru',
          question,
          history: messageState.history,
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Request failed');
      }

      const data = await response.json();

      // Update chat title if first real message
      if (messageState.messages.length === 1 && 
          messageState.messages[0].message.includes('Halo')) {
        const newTitle = question.length > 20 ? 
                       question.slice(0, 20) + '...' : 
                       question;
        
        setChatHistory(prev => 
          prev.map(c => c.id === activeChatId ? { ...c, title: newTitle } : c)
        );
      }

      setMessageState(prev => ({
        messages: [
          ...prev.messages, 
          { 
            type: 'apiMessage', 
            message: data.text, 
            sourceDocs: data.sourceDocuments 
          }
        ],
        history: [...prev.history, [question, data.text]],
      }));

    } catch (err) {
      console.error('Chat error:', err);
      
      let errorMessage = 'Terjadi kesalahan';
      if (err instanceof Error) {
        errorMessage = err.name === 'AbortError' 
          ? 'Permintaan timeout' 
          : err.message || 'Terjadi kesalahan';
      }
      
      setError(errorMessage);
      setQuery(question);
    } finally {
      setLoading(false);
    }
  };

  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !loading) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-purple-50 overflow-hidden">
      {/* Header - Fixed */}
      <header className="bg-purple-50 text-gray-800 py-3 px-4 md:py-4 md:px-6 flex items-center justify-between shadow-md border-b border-gray-200 z-30 flex-shrink-0">
        <div className="flex items-center">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors mr-3"
            aria-label="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center">
            <div className="relative w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden mr-2 md:mr-3 bg-orange-500 flex-shrink-0">
              <img
                src="bot-image.jpg"
                alt="CyberFox"
                className="object-cover w-full h-full"
              />
            </div>
            <h1 className="text-lg md:text-xl font-bold">CYBERFOX</h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-3">
          <div className="hidden md:flex items-center">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-medium text-sm mr-2">
              {username?.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-800 mr-3">
              {username}
            </span>
          </div>
          <button
            className="py-1.5 px-2 md:px-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md text-xs md:text-sm transition-colors flex items-center"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {showSidebar && (
          <>
            {isMobile && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40"
                onClick={toggleSidebar}
              />
            )}
            <aside className={`${
              isMobile ? 'fixed z-50' : 'relative'
            } w-80 max-w-[85vw] h-full bg-purple-50 shadow-md flex flex-col border-r border-gray-200`}>
              <div className="p-3 border-b border-gray-200 flex-shrink-0">
                <button
                  className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md transition-colors flex items-center justify-center text-sm"
                  onClick={createNewChat}
                  disabled={loading}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Chat Baru
                </button>
              </div>
              
              <div className="px-3 py-2 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-sm font-semibold text-gray-600">
                  CHAT HISTORY
                </h2>
              </div>
              
              <div className="overflow-y-auto flex-1 p-2">
                {chatHistory.length === 0 ? (
                  <p className="p-3 text-gray-500 text-sm text-center">
                    Belum ada riwayat chat
                  </p>
                ) : (
                  chatHistory.map((chat) => (
                    <button
                      key={chat.id}
                      className={`w-full text-left p-3 rounded-md mb-1 transition-colors text-sm flex items-center ${
                        chat.id === activeChatId
                          ? "bg-blue-100 text-blue-700 font-medium border-l-4 border-blue-600"
                          : "hover:bg-gray-100 text-gray-700"
                      }`}
                      onClick={() => switchChat(chat.id)}
                    >
                      <MessageCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{chat.title}</span>
                    </button>
                  ))
                )}
              </div>
            </aside>
          </>
        )}

        {/* Chat Area */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Messages Container */}
          <div
            ref={messageListRef}
            className="flex-1 overflow-y-auto px-4 md:px-6 py-4"
          >
            {isNewChat && messageState.messages.length <= 1 && 
             messageState.messages[0]?.message.includes('Halo') ? (
              // Welcome Screen
              <div className="flex flex-col items-center justify-center h-full text-center px-4 max-w-2xl mx-auto">
                <div className="relative w-24 h-24 md:w-32 md:h-32 mb-6 md:mb-8">
                  <div className="w-full h-full bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center shadow-lg overflow-hidden">
                    <img
                      src="bot-image.jpg"
                      alt="CyberFox"
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 md:-bottom-2 md:-right-2 w-6 h-6 md:w-8 md:h-8 bg-blue-500 rounded-full flex items-center justify-center"></div>
                </div>
                
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-3 md:mb-4">
                  Learn and Surf Safely with Rubi the Fox!
                </h2>
                
                <div className="mb-4 md:mb-6 text-gray-600">
                  <p className="mb-2">🔍 Real or fake? Let's check!</p>
                </div>
                
                <div className="space-y-2 md:space-y-3 mb-6 md:mb-8 max-w-md">
                  <div className="bg-purple-100 text-purple-800 px-3 md:px-4 py-2 rounded-full text-xs md:text-sm">
                    🔐 Passwords are secret spells—only you should know the magic!
                  </div>
                  <div className="bg-purple-100 text-purple-800 px-3 md:px-4 py-2 rounded-full text-xs md:text-sm">
                    🎣 Phishing? Not today! Rubi knows the tricks and stays away!
                  </div>
                </div>
              </div>
            ) : (
              // Chat Messages
              <div className="max-w-4xl mx-auto">
                {messageState.messages.map((msg, index) => (
                  <div
                    key={`${msg.type}-${index}`}
                    className={`flex mb-4 ${
                      msg.type === "userMessage"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] md:max-w-[75%] rounded-lg p-3 ${
                        msg.type === "userMessage"
                          ? "bg-white border border-[#A093FF] text-gray-800 rounded-br-none shadow-sm"
                          : "bg-[#DCD9FF] text-gray-800 rounded-bl-none shadow-sm"
                      }`}
                    >
                      {msg.type === "apiMessage" && (
                        <div className="flex items-center mb-2">
                          <div className="w-6 h-6 rounded-full overflow-hidden mr-2 bg-transparent flex items-center justify-center">
                            <img
                              src="bot-image.jpg"
                              alt="CyberFox"
                              className="object-cover w-full h-full"
                            />
                          </div>
                          <span className="text-xs font-medium">CyberFox</span>
                        </div>
                      )}
                      <div className="prose prose-sm max-w-none text-sm md:text-base">
                        {msg.message}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Loading Indicator */}
                {loading && (
                  <div className="flex justify-start mb-4">
                    <div className="bg-[#DCD9FF] text-gray-800 rounded-lg rounded-bl-none p-3 max-w-[75%]">
                      <div className="flex items-center mb-2">
                        <div className="w-6 h-6 rounded-full overflow-hidden mr-2">
                          <img
                            src="bot-image.jpg"
                            alt="CyberFox"
                            className="object-cover w-full h-full"
                          />
                        </div>
                        <span className="text-xs font-medium">CyberFox</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></div>
                        <div 
                          className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                        <div 
                          className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"
                          style={{ animationDelay: "0.4s" }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input Area - Fixed at bottom */}
          <div className="bg-purple-50 border-t border-gray-200 p-4 flex-shrink-0">
            <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto">
              <div className="flex-1 relative">
                <input
                  ref={textAreaRef}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm md:text-base"
                  placeholder={loading ? "Rubi sedang menjawab..." : "Ketik pertanyaanmu..."}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleEnter}
                  disabled={loading}
                  spellCheck={false}
                  autoFocus
                  autoComplete="off"
                />
                {query.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear input"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <button
                type="submit"
                disabled={loading || query.trim().length === 0}
                className={`p-2 rounded-md transition-colors flex-shrink-0 ${
                  loading || query.trim().length === 0
                    ? "bg-gray-300 cursor-not-allowed text-gray-500"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
                aria-label="Send message"
              >
                <Send className={`w-5 h-5 ${loading ? 'animate-pulse' : ''}`} />
              </button>
            </form>
            
            {error && (
              <div className="mt-2 max-w-4xl mx-auto">
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md flex items-center justify-between">
                  {error}
                  <button
                    onClick={() => setError(null)}
                    className="ml-2 text-red-700 hover:text-red-800"
                    aria-label="Dismiss error"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Toast - Global */}
      {error && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-100 text-red-700 px-4 py-2 rounded-md text-sm shadow-lg flex items-center z-50 max-w-sm mx-4">
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-700 hover:text-red-800 flex-shrink-0"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}