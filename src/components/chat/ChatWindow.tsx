'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ShieldCheck, Phone } from 'lucide-react';
import { VoiceCall } from './VoiceCall';
import { StarBurst } from '@/components/ziggy/StarBurst';
import { SpeakButton, AutoReadToggle, MicButton, TalkingHalo } from '@/components/ziggy/VoiceControls';
import { speak, unlockAudio, voiceStore } from '@/lib/voice';
import { EASE_OUT } from '@/lib/motion';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  at: Date;
  safety?: string;
}

export interface ChatIdentity {
  name: string;
  /** Brand colour of the speaker: bubbles, buttons, focus rings. */
  color: string;
  /** Avatar at a given size; used in the header, beside replies and while thinking. */
  avatar: (size: number) => ReactNode;
  /** What fills the empty conversation. */
  welcome: ReactNode;
  /** Big round portrait for the voice call. */
  portrait: ReactNode;
}

interface ChatWindowProps {
  identity: ChatIdentity;
  intro: string;
  suggestions: string[];
  placeholder: string;
  /** Specialist agent id, if this is not Ziggy himself. */
  agentId?: string;
}

let seq = 0;
const nextId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

/**
 * The one chat used everywhere: Ziggy on the demo page, the specialist agents
 * on theirs. It talks (Gemini voice, browser voice as fallback), listens (the
 * microphone fills the box), and every message goes through the child-safety
 * screen on the server.
 */
export function ChatWindow({ identity, intro, suggestions, placeholder, agentId }: ChatWindowProps) {
  const t = useTranslations('chat');
  const locale = useLocale();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(false);
  const [calling, setCalling] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { color } = identity;

  // Scroll the list itself; scrollIntoView() would scroll the whole page too.
  useEffect(() => {
    const list = listRef.current;
    if (!list || messages.length === 0) return;
    list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    unlockAudio(); // this tap is what lets the answer be spoken on iOS

    const mine: Message = { id: nextId(), role: 'user', content, at: new Date() };
    const history = [...messages, mine];
    setMessages(history);
    setInput('');
    setBusy(true);

    let reply: Message;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.slice(-12).map(({ role, content }) => ({ role, content })),
          locale,
          agentId,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { message: string; safety?: string };
      reply = { id: nextId(), role: 'assistant', content: data.message, at: new Date(), safety: data.safety };
    } catch {
      reply = { id: nextId(), role: 'assistant', content: t('nap', { name: identity.name }), at: new Date() };
    }

    setMessages([...history, reply]);
    setBusy(false);
    if (reply.content.includes('⭐')) {
      setBurst(true);
      setTimeout(() => setBurst(false), 700);
    }
    if (voiceStore.get().autoRead) void speak(reply.id, reply.content, locale);
    inputRef.current?.focus();
  };

  const time = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div
        className="glass-strong border border-border/50 rounded-3xl overflow-hidden"
        style={{ boxShadow: `0 30px 60px -30px ${color}55, 0 8px 30px rgba(0,0,0,0.06)` }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50" style={{ backgroundColor: `${color}0D` }}>
          <TalkingHalo color={color}>{identity.avatar(40)}</TalkingHalo>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-text-body flex items-center gap-1.5">
              {identity.name}
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
            </div>
            <div className="text-xs text-text-muted h-4">
              {busy ? (
                <span className="inline-flex items-center gap-1">
                  {t('thinking', { name: identity.name })}
                  <span className="inline-flex gap-0.5" aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
                    ))}
                  </span>
                </span>
              ) : (
                'Hyper™ AI Engine'
              )}
            </div>
          </div>
          <AutoReadToggle color={color} />
          <button
            type="button"
            onClick={() => setCalling(true)}
            className="press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-md"
            style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 75%, #000))` }}
            aria-label={t('call', { name: identity.name })}
          >
            <Phone size={13} className="fill-current" />
            <span className="hidden sm:inline">{t('call_short')}</span>
          </button>
        </div>

        {/* Messages */}
        <div ref={listRef} className="h-[22rem] sm:h-[26rem] overflow-y-auto p-4 space-y-4 overscroll-contain" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              {identity.welcome}
              <p className="text-sm text-text-muted max-w-xs">{intro}</p>
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {suggestions.map((s, i) => (
                  <motion.button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.055, duration: 0.28, ease: EASE_OUT }}
                    className="press px-4 py-2 rounded-full glass border border-border/50 text-xs font-bold text-text-body transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${color}66`)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '')}
                  >
                    {s}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <motion.div
                  key={m.id}
                  layout="position"
                  initial={{ opacity: 0, y: 14, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', duration: 0.42, bounce: 0.25 }}
                  className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                  style={{ transformOrigin: isUser ? '100% 100%' : '0% 100%' }}
                >
                  {!isUser && <span className="mb-6 shrink-0">{identity.avatar(28)}</span>}
                  <div className={`flex flex-col gap-1 max-w-[82%] ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-[0.95rem] leading-relaxed ${
                        isUser ? 'text-white rounded-br-md shadow-sm' : 'glass border border-border/50 text-text-body rounded-bl-md'
                      }`}
                      style={isUser ? { background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 75%, #000))` } : undefined}
                    >
                      {m.safety && (
                        <span className="mb-1 flex items-center gap-1 text-[11px] font-bold" style={{ color }}>
                          <ShieldCheck size={12} /> {t('safety')}
                        </span>
                      )}
                      {m.content}
                    </div>
                    <span className="flex items-center gap-1 text-[10px] text-text-dim px-1">
                      {!isUser && <SpeakButton id={m.id} text={m.content} locale={locale} color={color} />}
                      {time(m.at)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {busy && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-2">
              <span className="animate-bounce">{identity.avatar(28)}</span>
              <div className="glass border border-border/50 px-4 py-3 rounded-2xl rounded-bl-md flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: color, animationDelay: `${d}ms` }} />
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border/50 p-3 bg-bg/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex gap-2"
          >
            <MicButton locale={locale} onText={setInput} onFinal={(text) => void send(text)} disabled={busy} color={color} />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              maxLength={500}
              enterKeyHint="send"
              className="flex-1 min-w-0 glass rounded-full px-4 py-2.5 text-sm text-text-body placeholder:text-text-dim border border-border/50 outline-none focus:ring-2 transition-shadow"
              style={{ ['--tw-ring-color' as string]: `${color}55` }}
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label={t('send')}
              className="press w-11 h-11 shrink-0 rounded-full text-white flex items-center justify-center disabled:opacity-40 hover:shadow-lg"
              style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 75%, #000))` }}
            >
              <Send size={16} className="rtl:rotate-180" />
            </button>
          </form>
        </div>
      </div>

      <StarBurst trigger={burst} x={200} y={100} />

      <VoiceCall
        open={calling}
        name={identity.name}
        color={color}
        portrait={identity.portrait}
        agentId={agentId}
        onClose={(turns) => {
          setCalling(false);
          // What was said in the call joins the written conversation.
          if (turns.length) {
            setMessages((prev) => [
              ...prev,
              ...turns.map((tr) => ({ id: nextId(), role: tr.role, content: tr.content, at: new Date() })),
            ]);
          }
        }}
      />
    </div>
  );
}
