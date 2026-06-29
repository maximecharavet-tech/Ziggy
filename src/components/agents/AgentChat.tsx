'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AgentChatProps {
  agentId: string;
  agentName: string;
  agentIcon: string;
  color: string;
  suggestions: string[];
  placeholder: string;
}

export function AgentChat({ agentId, agentName, agentIcon, color, suggestions, placeholder }: AgentChatProps) {
  const locale = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: messageText };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(({ role, content }) => ({ role, content })),
          locale,
          agentId,
        }),
      });
      if (!res.ok) throw new Error('Chat error');
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.message }]);
    } catch {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `Oops! ${agentName} is taking a break. Try again! ⭐` },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="glass-strong border border-border/50 rounded-2xl shadow-lg overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50" style={{ backgroundColor: `${color}08` }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg" style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)` }}>
            {agentIcon}
          </div>
          <div>
            <div className="text-sm font-bold text-text-body flex items-center gap-1.5">
              {agentName}
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
            </div>
            <div className="text-xs text-text-muted">
              {isLoading ? 'Typing...' : 'Online'}
            </div>
          </div>
        </div>

        <div className="h-80 sm:h-96 overflow-y-auto p-4 space-y-3 scroll-smooth">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="text-4xl">{agentIcon}</div>
              <p className="text-sm text-text-muted max-w-xs">{placeholder}</p>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="px-3 py-1.5 rounded-full glass border border-border/50 text-xs font-medium text-text-body hover:border-opacity-60 hover:bg-opacity-5 transition-all active:scale-95"
                    style={{ ['--tw-border-opacity' as string]: undefined }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = color)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '')}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed max-w-[85%] ${
                    msg.role === 'user'
                      ? 'text-white rounded-br-md shadow-sm'
                      : 'glass border border-border/50 text-text-body rounded-bl-md'
                  }`}
                  style={msg.role === 'user' ? { background: `linear-gradient(135deg, ${color}, ${color}CC)` } : undefined}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="glass border border-border/50 px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  {[0, 150, 300].map((delay) => (
                    <span key={delay} className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: color, animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border/50 p-3 bg-bg/50">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask ${agentName}...`}
              className="flex-1 glass rounded-full px-4 py-2.5 text-sm text-text-body placeholder:text-text-dim border border-border/50 outline-none focus:ring-2 transition-all"
              style={{ ['--tw-ring-color' as string]: `${color}40` }}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-11 h-11 rounded-full text-white flex items-center justify-center disabled:opacity-40 transition-all hover:shadow-lg active:scale-95"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)` }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
