'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Bot } from 'lucide-react';
import { StarBurst } from './StarBurst';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function ZiggyChat() {
  const t = useTranslations('demo');
  const locale = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [starBurst, setStarBurst] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: messageText, timestamp: new Date() };
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
        }),
      });
      if (!res.ok) throw new Error('Chat error');
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.message, timestamp: new Date() }]);
      if (data.message.includes('⭐')) {
        setStarBurst(true);
        setTimeout(() => setStarBurst(false), 700);
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: "Oops! I'm having a little nap. Try again? ⭐", timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const suggestions: string[] = t.raw('suggestions');

  const formatTime = (date: Date) =>
    date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div className="glass-strong border border-border/50 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-green/5">
          <div className="w-9 h-9 rounded-full gradient-green-cta flex items-center justify-center">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-text-body flex items-center gap-1.5">
              Ziggy
              <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
            </div>
            <div className="text-xs text-text-muted">
              {isLoading ? 'Typing...' : 'Online'}
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div className="h-80 sm:h-96 overflow-y-auto p-4 space-y-4 scroll-smooth">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-green/10 flex items-center justify-center animate-float">
                <Sparkles size={28} className="text-green" />
              </div>
              <p className="text-sm text-text-muted max-w-xs">{t('subtitle')}</p>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="px-4 py-2 rounded-full glass border border-border/50 text-xs font-bold text-text-body hover:border-green/40 hover:bg-green/5 transition-all duration-200 active:scale-95"
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
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="flex flex-col gap-1 max-w-[85%]">
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-green to-green-dark text-white rounded-br-md shadow-sm shadow-green/20'
                        : 'glass border border-border/50 text-text-body rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className={`text-[10px] text-text-dim px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="glass border border-border/50 px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-green rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-green rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-green rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-text-dim">Ziggy is thinking...</span>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border/50 p-3 bg-bg/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('placeholder')}
              className="flex-1 glass rounded-full px-4 py-2.5 text-sm text-text-body placeholder:text-text-dim border border-border/50 outline-none focus:ring-2 focus:ring-green/30 focus:border-green/30 transition-all"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-11 h-11 rounded-full gradient-green-cta text-white flex items-center justify-center disabled:opacity-40 transition-all hover:shadow-lg hover:shadow-green/30 active:scale-95"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      <StarBurst trigger={starBurst} x={200} y={100} />
    </div>
  );
}
