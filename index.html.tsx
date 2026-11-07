import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import { Send, Menu, X, MessageSquare, User, Loader2, Search, PlusCircle, Sparkles } from 'lucide-react';

const SYSTEM_PROMPT = `You are the Mubeen-developed AI, an ultra-strict educational assistant. YOUR ONLY KNOWLEDGE BASE is the DIT syllabus books: 1. Mohsin Introduction To Programming, 2. MS Office, 3. Operating System.
CRITICAL RULE: If the user's query is about ANYTHING not explicitly covered in these three specific books, you MUST reply EXACTLY with this exact phrase and nothing else: "Sorry, this is outside the syllabus of my books."
Do not use outside knowledge. Do not guess. Understand user intent in Roman Urdu, Urdu, English, or slang. Zero tolerance for hallucinations or out-of-scope answers.`;

// --- Memoized Message Component for Performance ---
// Prevents re-rendering all messages when the user is simply typing in the input box.
const ChatMessage = memo(({ message, searchQuery }) => {
  // Lightweight custom markdown parser for bold, inline code, and search highlighting
  const renderFormattedText = (text) => {
    if (!text) return null;

    let lines = text.split('\n');
    return lines.map((line, lineIndex) => {
      // Basic tokenization for **bold** and `code`
      const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
      
      const formattedLine = parts.map((part, partIndex) => {
        let content = part;
        let isBold = false;
        let isCode = false;

        if (part.startsWith('**') && part.endsWith('**')) {
          content = part.slice(2, -2);
          isBold = true;
        } else if (part.startsWith('`') && part.endsWith('`')) {
          content = part.slice(1, -1);
          isCode = true;
        }

        // Highlight search keywords if a search query is active
        if (searchQuery && content.toLowerCase().includes(searchQuery.toLowerCase())) {
          const splitRegex = new RegExp(`(${searchQuery})`, 'gi');
          const highlightParts = content.split(splitRegex);
          
          content = highlightParts.map((hp, idx) => 
            hp.toLowerCase() === searchQuery.toLowerCase() 
              ? <mark key={idx} className="bg-yellow-500/40 text-yellow-100 rounded-sm px-0.5">{hp}</mark>
              : hp
          );
        }

        if (isBold) return <strong key={partIndex} className="text-gray-100 font-bold">{content}</strong>;
        if (isCode) return <code key={partIndex} className="bg-[#1a1a1a] text-yellow-400 px-1.5 py-0.5 rounded text-sm font-mono border border-yellow-500/20">{content}</code>;
        return <React.Fragment key={partIndex}>{content}</React.Fragment>;
      });

      return (
        <React.Fragment key={lineIndex}>
          {formattedLine}
          {lineIndex !== lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  const isUser = message.role === 'user';

  return (
    <div 
      className={`flex gap-4 p-4 md:p-6 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-300 ${
        isUser 
          ? 'bg-[#151515] ml-auto max-w-[85%] border border-yellow-500/10 shadow-sm' 
          : 'bg-transparent max-w-full hover:bg-white/[0.02] transition-colors'
      }`}
    >
      <div className="shrink-0 mt-1">
        {isUser ? (
          <div className="h-8 w-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-md shadow-yellow-500/10">
            <User size={16} className="text-black" />
          </div>
        ) : (
          <div className="relative">
            <img src='mubeen.jpg' alt='Logo' className='h-8 w-8 rounded-full object-cover shadow-sm ring-2 ring-yellow-500/30' onError={(e) => {
                // Fallback icon if image fails to load
                e.target.onerror = null; 
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }} 
            />
            <div className="hidden h-8 w-8 bg-gradient-to-br from-gray-800 to-black rounded-full items-center justify-center shadow-md ring-2 ring-yellow-500/30">
               <Sparkles size={16} className="text-yellow-500" />
            </div>
          </div>
        )}
      </div>

      <div className={`flex-1 min-w-0 leading-relaxed ${isUser ? 'text-gray-200' : 'text-gray-300'}`}>
         {renderFormattedText(message.text)}
      </div>
    </div>
  );
});

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: 'model',
      text: "Hello! I am the **Mubeen-developed AI**. I can answer questions specifically from your DIT syllabus (`Introduction To Programming`, `MS Office`, `Operating System`). \n\nHow can I help you today?",
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const abortControllerRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    // Only scroll if we aren't heavily searching history
    if (!searchQuery) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [searchQuery]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Responsive sidebar handling
  useEffect(() => {
    const handleResize = () => setSidebarOpen(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Efficient Auto-resizing textarea
  const handleInput = (e) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    const newUserMessage = { role: 'user', text: userText };
    
    setMessages((prev) => [...prev, newUserMessage]);
    setInput('');
    setSearchQuery(''); // Clear search on new message
    if (textareaRef.current) textareaRef.current.style.height = '56px'; // Reset height
    setIsLoading(true);

    // Cancel any previous pending request to prevent overlaps
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const chatHistory = messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));
      chatHistory.push({ role: 'user', parts: [{ text: userText }] });

      const payload = {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: chatHistory,
      };

      const apiKey = ""; // API Key handled by Canvas environment
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal, // Connect abort signal
      });

      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        setMessages((prev) => [...prev, { role: 'model', text: data.candidates[0].content.parts[0].text }]);
      } else {
        throw new Error('Invalid response structure');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request aborted for optimization.');
        return; // Exit silently if aborted
      }
      console.error("API Error:", error);
      setMessages((prev) => [...prev, { role: 'model', text: "Sorry, I encountered a network error. Please verify your connection or try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([{
      role: 'model',
      text: "Starting a new session. I am ready to answer questions about `Introduction To Programming`, `MS Office`, and `Operating System`.",
    }]);
    setSearchQuery('');
  };

  // Highly optimized filtering using useMemo (Keyword Researchable feature)
  const displayedMessages = useMemo(() => {
    return searchQuery 
      ? messages.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
      : messages;
  }, [messages, searchQuery]);

  return (
    <div className="flex h-screen bg-black text-gray-200 font-sans overflow-hidden selection:bg-yellow-500/30 selection:text-white border-t-4 border-yellow-500">
      
      {/* Sidebar */}
      <aside 
        className={`${
          sidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full'
        } transition-all duration-300 ease-in-out bg-[#0a0a0a] border-r border-yellow-500/10 flex flex-col fixed md:relative z-30 h-full flex-shrink-0 shadow-2xl md:shadow-none`}
      >
        <div className="p-4 flex items-center justify-between border-b border-white/5 shrink-0 h-16 bg-[#111]">
          <span className="font-bold text-sm text-yellow-500 tracking-wide flex items-center gap-2">
            <MessageSquare size={16} className="text-yellow-500" />
            CHAT HISTORY
          </span>
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="md:hidden text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="p-4 border-b border-white/5">
          <button 
            onClick={handleNewChat}
            className="w-full bg-white/5 hover:bg-white/10 text-white font-medium p-2.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 border border-white/5 hover:border-white/10"
          >
            <PlusCircle size={18} />
            New Session
          </button>
        </div>

        <div className="p-4 border-b border-white/5 bg-[#0a0a0a]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text"
              placeholder="Search keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111] text-sm text-gray-200 rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 border border-white/5 placeholder-gray-600 transition-all"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar bg-[#0a0a0a]">
          {messages.filter(m => m.role === 'user').map((m, idx) => (
             <div key={idx} className="w-full text-left p-3 rounded-lg flex items-center gap-3 hover:bg-yellow-500/10 transition-colors group cursor-pointer border border-transparent hover:border-yellow-500/20">
               <MessageSquare size={14} className="text-gray-600 group-hover:text-yellow-500 transition-colors shrink-0" />
               <span className="truncate text-xs text-gray-400 group-hover:text-gray-200">{m.text}</span>
             </div>
          ))}
          {messages.filter(m => m.role === 'user').length === 0 && (
            <div className="text-center text-xs text-gray-600 mt-4">No user messages yet.</div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative h-full bg-gradient-to-br from-[#111] to-black">
        
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 border-b border-yellow-500/10 shrink-0 sticky top-0 z-20 bg-black/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="text-gray-400 hover:text-yellow-500 p-2 rounded-lg hover:bg-yellow-500/10 transition-colors"
                aria-label="Open Sidebar"
              >
                <Menu size={20} />
              </button>
            )}
            <div className="flex items-center gap-3 pl-1">
              <div className="relative">
                <img src='mubeen.jpg' alt='Logo' className='h-9 w-9 rounded-xl object-cover shadow-sm ring-1 ring-yellow-500/30' onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                <div className="hidden h-9 w-9 bg-yellow-500 rounded-xl items-center justify-center shadow-sm ring-1 ring-yellow-500/30">
                   <Sparkles size={18} className="text-black" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 bg-yellow-400 rounded-full border-2 border-black shadow-[0_0_8px_rgba(250,204,21,0.6)]"></div>
              </div>
              <div>
                <h1 className="font-bold text-base tracking-tight text-gray-100">Mubeen-developed</h1>
                <p className="text-[11px] text-yellow-500/80 font-medium tracking-wide">DIT SYLLABUS EXPERT</p>
              </div>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto scroll-smooth p-4 md:p-0">
          <div className="max-w-4xl mx-auto md:px-8 py-6 space-y-6">
            
            {searchQuery && displayedMessages.length === 0 && (
              <div className="text-center text-gray-500 mt-10 p-8 bg-white/5 rounded-2xl border border-white/5">
                 No results found for "<span className="text-gray-300">{searchQuery}</span>"
              </div>
            )}

            {displayedMessages.map((message, index) => (
              <ChatMessage key={index} message={message} searchQuery={searchQuery} />
            ))}
            
            {/* Loading Indicator */}
            {isLoading && !searchQuery && (
              <div className="flex gap-4 p-4 md:p-6 animate-in fade-in duration-300">
                 <div className="shrink-0 mt-1">
                   <div className="h-8 w-8 bg-gradient-to-br from-gray-800 to-black rounded-full flex items-center justify-center shadow-md ring-2 ring-yellow-500/30">
                      <Sparkles size={16} className="text-yellow-500" />
                   </div>
                 </div>
                 <div className="flex-1 flex items-center gap-3">
                    <Loader2 size={18} className="animate-spin text-yellow-500" />
                    <span className="text-sm font-medium bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 to-yellow-600">Analyzing syllabus...</span>
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-gradient-to-t from-black via-black/90 to-transparent shrink-0">
          <div className="max-w-4xl mx-auto relative group">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question from your DIT syllabus..."
              className="w-full bg-[#111] text-gray-100 rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 resize-none overflow-y-auto shadow-xl placeholder-gray-500 min-h-[56px] transition-all border border-yellow-500/20 hover:border-yellow-500/40"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={`absolute right-2.5 bottom-2.5 p-2 rounded-xl transition-all duration-200 flex items-center justify-center
                ${!input.trim() || isLoading 
                  ? 'bg-transparent text-gray-600' 
                  : 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-md hover:shadow-yellow-500/25 scale-100 active:scale-95'
                }
              `}
              aria-label="Send message"
            >
              <Send size={18} className={input.trim() && !isLoading ? 'ml-0.5' : ''} />
            </button>
          </div>
          <div className="text-center mt-3 text-[11px] text-gray-500 font-medium tracking-wide">
            Powered by Mubeen AI • Strictly limited to DIT Syllabus context
          </div>
        </div>
      </main>
      
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-20 md:hidden animate-in fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #eab308; }
      `}} />
    </div>
  );
}