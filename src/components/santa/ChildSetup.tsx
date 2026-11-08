'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLocale } from 'next-intl';
import { tr, type L } from '@/lib/i18n-text';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { SayButton } from '@/components/arcade/read-aloud';
import { cleanName, santaStore } from '@/lib/santa/store';

const T = {
  hello: { fr: 'Comment tu t’appelles ?', en: 'What’s your name?' },
  why: {
    call: { fr: 'Pour que le Père Noël sache qui il appelle.', en: 'So Santa knows who he is calling.' },
    letter: { fr: 'Pour signer ta lettre au Père Noël.', en: 'To sign your letter to Santa.' },
    photo: { fr: 'Pour écrire ton prénom sur ta photo.', en: 'To write your name on your photo.' },
  },
  name: { fr: 'Ton prénom', en: 'Your first name' },
  age: { fr: 'Ton âge', en: 'Your age' },
  go: { fr: 'C’est parti !', en: 'Let’s go!' },
  help: { fr: 'Un grand peut t’aider à écrire.', en: 'A grown-up can help you write.' },
  privacy: { fr: 'Ton prénom reste sur cet appareil.', en: 'Your name stays on this device.' },
  bad: { fr: 'Juste le prénom, avec des lettres.', en: 'Just the first name, with letters.' },
} satisfies Record<string, L | Record<string, L>>;

/** First name + age, the only thing Santa needs (stays on the device). */
export function ChildSetup({ purpose, onDone }: { purpose: 'call' | 'letter' | 'photo'; onDone?: () => void }) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [name, setName] = useState('');
  const [age, setAge] = useState(6);
  const [error, setError] = useState(false);

  const submit = () => {
    if (!cleanName(name)) {
      setError(true);
      return;
    }
    santaStore.addChild(name, age);
    onDone?.();
  };

  return (
    <section className="mx-auto flex min-h-[80vh] max-w-lg flex-col justify-center px-4 pb-20 pt-28 text-white">
      <motion.div initial={reduced ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] bg-white/10 p-6 shadow-2xl ring-1 ring-white/20 backdrop-blur-md sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-5xl" aria-hidden="true">
              🎅
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{tr(T.hello, locale)}</h1>
            <p className="mt-2 text-white/85">{tr(T.why[purpose], locale)}</p>
          </div>
          <SayButton texts={[tr(T.hello, locale), tr(T.why[purpose], locale), tr(T.help, locale)]} locale={locale} size="md" className="shrink-0" />
        </div>
        <form
          className="mt-6 flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold uppercase tracking-wider text-white/75">{tr(T.name, locale)}</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(false);
              }}
              maxLength={24}
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="done"
              className="min-h-16 rounded-2xl bg-white px-5 font-display text-2xl font-bold text-[#1b2150] outline-none ring-4 ring-transparent focus:ring-amber-300"
              aria-invalid={error}
            />
            {error && <span className="text-sm font-semibold text-amber-200">{tr(T.bad, locale)}</span>}
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-bold uppercase tracking-wider text-white/75">{tr(T.age, locale)}</legend>
            <div className="grid grid-cols-6 gap-2">
              {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAge(n)}
                  aria-pressed={age === n}
                  className={`min-h-14 rounded-2xl font-display text-xl font-bold transition-transform active:scale-95 ${age === n ? 'bg-amber-300 text-[#3b1f00] shadow-lg' : 'bg-white/15 text-white ring-1 ring-white/25'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="mt-2 inline-flex min-h-16 items-center justify-center gap-2 rounded-full bg-[#2fb344] px-7 font-display text-2xl font-bold shadow-[0_8px_0_rgba(0,0,0,0.2)] active:translate-y-1 active:shadow-none">
            ✨ {tr(T.go, locale)}
          </button>
          <p className="text-center text-xs text-white/65">
            {tr(T.help, locale)} · 🔒 {tr(T.privacy, locale)}
          </p>
        </form>
      </motion.div>
    </section>
  );
}
