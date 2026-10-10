'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { GOALS, HEROES, OBJECTS, PLACES, STORY_COMPANIONS, type StoryChoices } from '@/lib/story/choices';
import type { StoryJson } from '@/lib/hyper-engine/schemas';
import { localStory } from '@/lib/story/local-story';
import { accessToken, api } from '@/lib/world/store';
import { speak, stopSpeaking } from '@/lib/voice';
import { tr, type L } from '@/lib/i18n-text';
import { playSound } from '@/lib/sound';
import { AppPage } from '@/components/learn/AppPage';

type Key = 'hero' | 'place' | 'companion' | 'object' | 'goal';
const STEPS: { key: Key; title: L; list: { id: string; emoji: string; label: L }[] }[] = [
  { key: 'hero', title: { fr: 'Qui est le héros ?', en: 'Who is the hero?' }, list: HEROES },
  { key: 'place', title: { fr: 'Où se passe l’aventure ?', en: 'Where does it happen?' }, list: PLACES },
  { key: 'companion', title: { fr: 'Avec quel ami ?', en: 'With which friend?' }, list: STORY_COMPANIONS },
  { key: 'object', title: { fr: 'Quel objet magique ?', en: 'Which magic object?' }, list: OBJECTS },
  { key: 'goal', title: { fr: 'Quelle est la mission ?', en: 'What is the mission?' }, list: GOALS },
];
const AGES = ['5-7', '8-10', '11-12'] as const;
const T = {
  tell: { fr: 'Raconte-moi l’histoire !', en: 'Tell me the story!' },
  writing: { fr: 'Ziggy écrit ton histoire…', en: 'Ziggy is writing your story…' },
  age: { fr: 'Âge', en: 'Age' },
  read: { fr: '🔊 Lire à voix haute', en: '🔊 Read aloud' },
  stop: { fr: '⏹ Stop', en: '⏹ Stop' },
  prev: { fr: '← Avant', en: '← Back' },
  nextP: { fr: 'Suite →', en: 'Next →' },
  newStory: { fr: 'Nouvelle histoire', en: 'New story' },
  library: { fr: 'Ma bibliothèque', en: 'My library' },
  open: { fr: 'Lire', en: 'Read' },
  del: { fr: 'Supprimer', en: 'Delete' },
  ai: { fr: '✨ Créée par Hyper Engine, vérifiée par ChildShield', en: '✨ Made by Hyper Engine, checked by ChildShield' },
  local: { fr: '📖 Histoire Ziggy', en: '📖 Ziggy story' },
  end: { fr: 'Fin', en: 'The end' },
  saved: { fr: 'Gardée dans ta bibliothèque', en: 'Saved in your library' },
} satisfies Record<string, L>;

type Saved = { id: string; story: StoryJson; source: 'ai' | 'local'; createdAt: string };

export function StoryBuilder() {
  const locale = useLocale();
  const [choices, setChoices] = useState<Partial<StoryChoices>>({ ageGroup: '5-7' });
  const [story, setStory] = useState<{ story: StoryJson; source: 'ai' | 'local'; saved: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [library, setLibrary] = useState<Saved[] | null>(null);

  const loadLibrary = useCallback(async () => {
    if (!(await accessToken())) return setLibrary(null);
    const res = await api<{ stories: Saved[] }>('story');
    if (res.ok) setLibrary(res.data.stories);
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const ready = STEPS.every((s) => choices[s.key]);

  async function tell() {
    if (!ready) return;
    setBusy(true);
    const full = choices as StoryChoices;
    const res = await api<{ id: string | null; story: StoryJson; source: 'ai' | 'local' }>('story/generate', { body: { choices: full, locale } });
    setStory(res.ok ? { story: res.data.story, source: res.data.source, saved: Boolean(res.data.id) } : { story: localStory(full, locale), source: 'local', saved: false });
    setBusy(false);
    playSound('reward');
    if (res.ok && res.data.id) void loadLibrary();
  }

  async function remove(id: string) {
    const res = await api('story?id=' + id, { method: 'DELETE' });
    if (res.ok) setLibrary((l) => l?.filter((s) => s.id !== id) ?? null);
  }

  return (
    <AppPage
      eyebrow={<>📚 Story Builder</>}
      title={locale === 'fr' ? 'Invente ton histoire magique' : 'Invent your magic story'}
      subtitle={locale === 'fr' ? 'Choisis un héros, un lieu, un ami, un objet et une mission : Ziggy raconte !' : 'Pick a hero, a place, a friend, an object and a mission: Ziggy tells the tale!'}
      color="#5FB6EA"
    >
      {story ? (
        <StoryBook story={story.story} source={story.source} saved={story.saved} locale={locale} onClose={() => setStory(null)} />
      ) : (
        <div className="grid gap-6">
          {STEPS.map((step, si) => (
            <section key={step.key} aria-labelledby={`step-${step.key}`} className="rounded-[2rem] bg-bg-card p-5 shadow-sm">
              <h2 id={`step-${step.key}`} className="font-display text-xl font-bold text-text-body">
                {si + 1}. {tr(step.title, locale)}
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" role="radiogroup" aria-labelledby={`step-${step.key}`}>
                {step.list.map((o) => {
                  const on = choices[step.key] === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setChoices((c) => ({ ...c, [step.key]: o.id }));
                        playSound('tap');
                      }}
                      className={`flex flex-col items-center gap-1 rounded-3xl border-2 p-3 text-center text-sm font-semibold transition focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky/40 ${on ? 'border-sky bg-sky/10 text-text-body' : 'border-border/60 text-text-muted hover:border-sky/50'}`}
                    >
                      <motion.span animate={on ? { scale: [1, 1.25, 1] } : {}} className="text-4xl" aria-hidden="true">
                        {o.emoji}
                      </motion.span>
                      {tr(o.label, locale)}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="text-sm font-bold text-text-muted">{tr(T.age, locale)} :</span>
            {AGES.map((a) => (
              <button key={a} type="button" aria-pressed={choices.ageGroup === a} onClick={() => setChoices((c) => ({ ...c, ageGroup: a }))} className={`rounded-full px-4 py-2 text-sm font-bold ${choices.ageGroup === a ? 'bg-text-body text-bg' : 'border border-border bg-bg-card text-text-body'}`}>
                {a}
              </button>
            ))}
          </div>
          <button type="button" disabled={!ready || busy} onClick={() => void tell()} className="mx-auto rounded-full bg-sky px-8 py-4 text-xl font-bold text-white shadow-lg transition hover:scale-105 disabled:opacity-50">
            {busy ? tr(T.writing, locale) : `✨ ${tr(T.tell, locale)}`}
          </button>
        </div>
      )}

      {library && library.length ? (
        <section aria-labelledby="library" className="mt-12">
          <h2 id="library" className="font-display text-2xl font-bold text-text-body">
            📚 {tr(T.library, locale)}
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {library.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl bg-bg-card p-4 shadow-sm">
                <span className="min-w-0">
                  <span className="block truncate font-bold text-text-body">{s.story.title}</span>
                  <span className="block text-xs text-text-muted">{new Date(s.createdAt).toLocaleDateString(locale)}</span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => setStory({ story: s.story, source: s.source, saved: true })} className="rounded-full bg-sky px-3 py-1.5 text-sm font-bold text-white">
                    {tr(T.open, locale)}
                  </button>
                  <button type="button" onClick={() => void remove(s.id)} className="rounded-full border border-border px-3 py-1.5 text-sm font-bold text-text-muted">
                    {tr(T.del, locale)}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppPage>
  );
}

function StoryBook({ story, source, saved, locale, onClose }: { story: StoryJson; source: 'ai' | 'local'; saved: boolean; locale: string; onClose: () => void }) {
  const pages = story.chapters.flatMap((c, ci) => c.scenes.map((s, si) => ({ chapter: c.title, first: si === 0, ci, ...s })));
  const [i, setI] = useState(0);
  const [reading, setReading] = useState(false);
  const last = i === pages.length;

  useEffect(() => () => stopSpeaking(), []);

  async function readAloud() {
    setReading(true);
    const text = last ? story.moral : `${pages[i].first ? pages[i].chapter + '. ' : ''}${pages[i].text}`;
    await speak(`story-${i}`, text, locale).catch(() => undefined);
    setReading(false);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-center text-xs font-bold text-text-muted">
        {tr(source === 'ai' ? T.ai : T.local, locale)}
        {saved ? ` · ${tr(T.saved, locale)}` : ''}
      </p>
      <h2 className="mt-2 text-center font-display text-3xl font-bold text-text-body sm:text-4xl">{story.title}</h2>
      <div className="relative mt-6 min-h-[18rem] [perspective:1200px]">
        <AnimatePresence mode="wait">
          <motion.article
            key={i}
            initial={{ rotateY: 70, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -70, opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="rounded-[2rem] border border-sky/30 bg-gradient-to-br from-bg-card to-sky/10 p-8 text-center shadow-xl"
            aria-live="polite"
          >
            {last ? (
              <>
                <div className="text-6xl" aria-hidden="true">
                  🌟
                </div>
                <p className="mt-4 font-display text-2xl font-bold text-text-body">{tr(T.end, locale)}</p>
                <p className="mt-3 text-lg text-text-muted">{story.moral}</p>
              </>
            ) : (
              <>
                {pages[i].first ? <p className="text-sm font-bold uppercase tracking-wider text-sky">{pages[i].chapter}</p> : null}
                <div className="mt-2 text-6xl" aria-hidden="true">
                  {pages[i].emoji ?? '✨'}
                </div>
                <p className="mt-4 text-lg leading-relaxed text-text-body sm:text-xl">{pages[i].text}</p>
              </>
            )}
          </motion.article>
        </AnimatePresence>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button type="button" disabled={i === 0} onClick={() => setI((n) => n - 1)} className="rounded-full border border-border bg-bg-card px-5 py-2.5 font-bold text-text-body disabled:opacity-40">
          {tr(T.prev, locale)}
        </button>
        <button type="button" onClick={() => (reading ? (stopSpeaking(), setReading(false)) : void readAloud())} className="rounded-full bg-purple px-5 py-2.5 font-bold text-white">
          {tr(reading ? T.stop : T.read, locale)}
        </button>
        {last ? (
          <button type="button" onClick={onClose} className="rounded-full bg-sky px-5 py-2.5 font-bold text-white">
            {tr(T.newStory, locale)}
          </button>
        ) : (
          <button type="button" onClick={() => setI((n) => n + 1)} className="rounded-full bg-sky px-5 py-2.5 font-bold text-white">
            {tr(T.nextP, locale)}
          </button>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-text-muted">
        {Math.min(i + 1, pages.length + 1)} / {pages.length + 1}
      </p>
    </div>
  );
}
