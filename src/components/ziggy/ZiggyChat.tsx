'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import { StarBurst } from './StarBurst';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function ZiggyChat() {
  const t = useTranslations('demo');
  const locale = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [starBurst, setStarBurst] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

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
        body: JSON.stringify({ messages: newMessages, locale }),
      });
      if (!res.ok) throw new Error('Chat error');
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.message }]);
      if (data.message.includes('⭐')) {
        setStarBurst(true);
        setTimeout(() => setStarBurst(false), 700);
      }
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: "Oops! I'm having a little nap. Try again? ⭐" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions: string[] = t.raw('suggestions');

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div className="bg-bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="h-80 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm gap-3">
              <p>{t('subtitle')}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => sendMessage(s)} className="px-3 py-1.5 rounded-full bg-green/10 text-green text-xs font-bold hover:bg-green/20 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-green text-white rounded-br-md' : 'bg-border/50 text-text-body rounded-bl-md'}`}>
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-border/50 px-4 py-2.5 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-green rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-green rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-green rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="border-t border-border p-3">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('placeholder')} className="flex-1 bg-bg rounded-full px-4 py-2.5 text-sm text-text-body placeholder:text-text-dim outline-none focus:ring-2 focus:ring-green/30 transition-shadow" disabled={isLoading} />
            <button type="submit" disabled={isLoading || !input.trim()} className="w-10 h-10 rounded-full gradient-green-cta text-white flex items-center justify-center disabled:opacity-50 transition-opacity">
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
      <StarBurst trigger={starBurst} x={200} y={100} />
    </div>
  );
}
