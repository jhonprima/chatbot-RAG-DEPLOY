'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { v4 as uuidv4 } from 'uuid';
import { Document } from 'langchain/document';
import { Menu, LogOut, Plus, MessageCircle, Send, X } from 'lucide-react';

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

  const [messageState, setMessageState] = useState<ChatState>({
    messages: [{ message: 'Halo!!, Apa yang ingin kamu tanyakan ?', type: 'apiMessage' }],
    history: [],
  });

  const [chatHistory, setChatHistory] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('');

  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLInputElement>(null);

  const generateSessionId = () =>
    `session_${Date.now()}_${uuidv4().substring(0, 8)}`;

  const fetchSavedState = async (chatId: string, userId: string) => {
    try {
      const res = await fetch(`/api/chat-contents?chat_id=${chatId}&user_id=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch chat content');
      const data = await res.json();

      if (data.messages && data.history) {
        const newState = {
          messages: data.messages,
          history: data.history,
        };
        setMessageState(newState);
        
        // Simpan ke localStorage untuk persist state
        if (typeof window !== 'undefined') {
          localStorage.setItem(`chat_state_${chatId}`, JSON.stringify({
            messages: data.messages,
            history: data.history,
            timestamp: Date.now(),
          }));
        }
        
        // Set isNewChat berdasarkan jumlah pesan
        setIsNewChat(data.messages.length <= 1);
        
        return newState;
      } else {
        const defaultState = {
          messages: [{ message: 'Halo!!, Apa yang ingin kamu tanyakan ?', type: 'apiMessage' }],
          history: [],
        };
        setMessageState(defaultState);
        setIsNewChat(true);
        return defaultState;
      }
    } catch (err) {
      console.error('Failed to fetch chat content:', err);
      const defaultState = {
        messages: [{ message: 'Halo!!, Apa yang ingin kamu tanyakan ?', type: 'apiMessage' }],
        history: [],
      };
      setMessageState(defaultState);
      setIsNewChat(true);
      return defaultState;
    }
  };

  const fetchUserChats = async (userId: string) => {
    try {
      const res = await fetch(`/api/user-chats?user_id=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch user chats');
      const response = await res.json();
      const data: Chat[] = response.data || [];
      // Urutkan berdasarkan waktu terbaru (asumsi ada created_at atau timestamp)
      // Jika tidak ada, urutkan berdasarkan ID yang mengandung timestamp
      const sortedData = data.sort((a, b) => {
        // Extract timestamp dari session ID
        const timestampA = parseInt(a.id.split('_')[1]) || 0;
        const timestampB = parseInt(b.id.split('_')[1]) || 0;
        return timestampB - timestampA; // Terbaru di atas
      });
      setChatHistory(Array.isArray(sortedData) ? sortedData : []);
      return sortedData;
    } catch (err) {
      console.error('Failed to fetch user chats:', err);
      setChatHistory([]);
      return [];
    }
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile && showSidebar) setShowSidebar(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showSidebar]);

  useEffect(() => {
    let isMounted = true;

    const initializeApp = async () => {
      try {
        if (typeof window === 'undefined') return;
        
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
          router.push('/login');
          return;
        }

        const userData: UserData = JSON.parse(storedUser);
        if (!userData.name || !userData.id) throw new Error('Invalid user');

        if (!isMounted) return;
        setUsername(userData.name);
        setUserId(userData.id);

        // Fetch existing chats
        const existingChats = await fetchUserChats(userData.id);

        // Cek apakah ada active chat dari localStorage
        let activeId = localStorage.getItem('activeChatId');
        
        // Validasi apakah activeId masih ada di chat history
        if (activeId && existingChats.some(chat => chat.id === activeId)) {
          // Chat masih ada, load state-nya
          setActiveChatId(activeId);
          
          // Coba load dari localStorage dulu
          const savedState = localStorage.getItem(`chat_state_${activeId}`);
          if (savedState) {
            try {
              const parsedState = JSON.parse(savedState);
              if (parsedState.messages && parsedState.history) {
                setMessageState(parsedState);
                setIsNewChat(parsedState.messages.length <= 1);
              }
            } catch {
              // Jika localStorage rusak, fetch dari server
              await fetchSavedState(activeId, userData.id);
            }
          } else {
            // Jika tidak ada di localStorage, fetch dari server
            await fetchSavedState(activeId, userData.id);
          }
          

        } else {
          // Tidak ada active chat atau chat sudah tidak ada, reset ke default
          setActiveChatId('');
          if (typeof window !== 'undefined') {
            localStorage.removeItem('activeChatId');
          }
          setMessageState({
            messages: [{ message: 'Halo!!, Apa yang ingin kamu tanyakan ?', type: 'apiMessage' }],
            history: [],
          });
          setIsNewChat(true);
        }

        const sidebarPref = localStorage.getItem('showSidebar');
        setShowSidebar(sidebarPref !== null ? sidebarPref === 'true' : !isMobile);
        setIsInitialized(true);
      } catch (err) {
        console.error('Initialization error:', err);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('user');
        }
        if (isMounted) router.push('/login');
      }
    };

    if (!isInitialized) {
      initializeApp();
    }

    return () => {
      isMounted = false;
    };
  }, [router, isInitialized, isMobile]);

  // Simpan state ke localStorage dan server setiap kali messageState berubah
  useEffect(() => {
    if (isInitialized && activeChatId && messageState.messages.length > 1) {
      // Simpan ke localStorage untuk akses cepat
      if (typeof window !== 'undefined') {
        localStorage.setItem(`chat_state_${activeChatId}`, JSON.stringify({
          messages: messageState.messages,
          history: messageState.history,
          timestamp: Date.now(),
        }));
      }

      // Debounce untuk menghindari terlalu banyak request ke server
      const timeoutId = setTimeout(async () => {
        try {
          // Simpan ke server juga untuk persistensi
          await fetch('/api/save-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: userId,
              chat_id: activeChatId,
              messages: messageState.messages,
              history: messageState.history,
            }),
          });
        } catch (err) {
          console.error('Failed to save chat state to server:', err);
        }
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [messageState, activeChatId, isInitialized, userId]);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTo({
        top: messageListRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messageState.messages]);

  const toggleSidebar = () => {
    const newValue = !showSidebar;
    setShowSidebar(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem('showSidebar', newValue.toString());
    }
  };

  const createNewChat = useCallback(async () => {
    if (!userId || loading) return;

    const newChatId = generateSessionId();
    setActiveChatId(newChatId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeChatId', newChatId);
    }
    setMessageState({
      messages: [{ message: 'Halo!!, Apa yang ingin kamu tanyakan ?', type: 'apiMessage' }],
      history: [],
    });
    setIsNewChat(true);
    if (isMobile) setShowSidebar(false);

    // Reset query juga
    setQuery('');
  }, [userId, isMobile, loading]);

  const switchChat = useCallback(async (chatId: string) => {
    if (loading) return;
    
    setActiveChatId(chatId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeChatId', chatId);
    }

    // Coba load dari localStorage dulu untuk response yang cepat
    if (typeof window !== 'undefined') {
      const savedState = localStorage.getItem(`chat_state_${chatId}`);
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          if (parsedState.messages && parsedState.history) {
            setMessageState(parsedState);
            setIsNewChat(parsedState.messages.length <= 1);
            
            // Setelah load dari localStorage, sync dengan server di background
            setTimeout(() => {
              fetchSavedState(chatId, userId || '').then((serverState) => {
                // Hanya update jika ada perbedaan dengan localStorage
                if (serverState && JSON.stringify(serverState) !== savedState) {
                  setMessageState(serverState);
                }
              });
            }, 100);
          } else {
            await fetchSavedState(chatId, userId || '');
          }
        } catch {
          await fetchSavedState(chatId, userId || '');
        }
      } else {
        // Jika tidak ada di localStorage, langsung fetch dari server
        await fetchSavedState(chatId, userId || '');
      }
    } else {
      // Server-side rendering fallback
      await fetchSavedState(chatId, userId || '');
    }

    if (isMobile) setShowSidebar(false);
    setTimeout(() => textAreaRef.current?.focus(), 100);
  }, [isMobile, userId, loading]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
    router.push('/login');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const question = query.trim();
    if (!question || !userId) return;

    // Jika belum ada activeChatId, buat chat baru
    let currentChatId = activeChatId;
    if (!currentChatId) {
      currentChatId = generateSessionId();
      setActiveChatId(currentChatId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('activeChatId', currentChatId);
      }
    }

    // Tambahkan pesan user ke messages
    setMessageState(prev => ({
      ...prev,
      messages: [...prev.messages, { type: 'userMessage', message: question }],
    }));

    setQuery('');
    setLoading(true);
    setError(null);

    try {
      // Jika ini chat pertama, buat judul berdasarkan pertanyaan
      const chatTitle = isNewChat ? question.slice(0, 50) : (chatHistory.find(c => c.id === currentChatId)?.title || question.slice(0, 50));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          chat_id: currentChatId,
          title: chatTitle,
          question,
          history: messageState.history,
        }),
      });

      if (!res.ok) throw new Error('Failed to get response from API');

      const data = await res.json();

      // Update messageState dengan response dari API
      const apiMessage = data.text || 'Tidak ada jawaban dari server.';
      const newHistory: [string, string][] = data.history || [...messageState.history, [question, apiMessage]];

      setMessageState(prev => ({
        messages: [...prev.messages, { type: 'apiMessage', message: apiMessage }],
        history: newHistory,
      }));

      // Jika ini chat baru, tambahkan ke chat history dan update title
      if (isNewChat) {
        const newChat = { id: currentChatId, title: chatTitle };
        // Tambahkan chat baru di posisi teratas (terbaru)
        setChatHistory(prev => [newChat, ...prev]);
        setIsNewChat(false);
      } else {
        // Jika chat sudah ada, pindahkan ke posisi teratas sebagai yang terakhir digunakan
        setChatHistory(prev => {
          const existingChatIndex = prev.findIndex(chat => chat.id === currentChatId);
          if (existingChatIndex > 0) {
            const updatedChats = [...prev];
            const [currentChat] = updatedChats.splice(existingChatIndex, 1);
            return [currentChat, ...updatedChats];
          }
          return prev;
        });
      }

    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat mengirim pesan.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleSubmit();
    }
  };

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

              {chatHistory.length > 0 && (
                <>
                  <div className="px-3 py-2 border-b border-gray-200 flex-shrink-0">
                    <h2 className="text-sm font-semibold text-gray-600">
                      CHAT HISTORY
                    </h2>
                  </div>

                  <div className="overflow-y-auto flex-1 p-2">
                    {chatHistory.map((chat) => (
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
                    ))}
                  </div>
                </>
              )}
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
            {!activeChatId || (isNewChat && messageState.messages.length <= 1 && 
             messageState.messages[0]?.message.includes('Halo')) ? (
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