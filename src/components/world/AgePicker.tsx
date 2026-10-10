'use client';

import { motion } from 'framer-motion';
import type { AgeBand } from '@/lib/world/memory';
import { getMemory, setMemory, syncWorld } from '@/lib/world/store';
import { speakSequence, unlockAudio } from '@/lib/voice';
import { tr, type L } from '@/lib/i18n-text';
import { SayButton } from '@/components/arcade/read-aloud';

export const AGE_CHOICES: { id: AgeBand; emoji: string; title: L; detail: L; color: string }[] = [
  {
    id: 'little',
    emoji: '🐣',
    title: { fr: 'Je ne sais pas encore lire', en: 'I can’t read yet' },
    detail: { fr: '4–6 ans · Ziggy lit tout à voix haute', en: 'Ages 4–6 · Ziggy reads everything aloud' },
    color: '#FBBF24',
  },
  {
    id: 'middle',
    emoji: '🧒',
    title: { fr: 'J’apprends à lire', en: 'I’m learning to read' },
    detail: { fr: '6–8 ans · Ziggy lit et j’écoute si je veux', en: 'Ages 6–8 · Ziggy reads, I can listen again' },
    color: '#5FB6EA',
  },
  {
    id: 'big',
    emoji: '🧑‍🎓',
    title: { fr: 'Je sais lire', en: 'I can read' },
    detail: { fr: '8–12 ans · je lis tout seul', en: 'Ages 8–12 · I read on my own' },
    color: '#7FC85C',
  },
];

const Q: L = { fr: 'Qui va jouer ?', en: 'Who is playing?' };
const SUB: L = { fr: 'Un parent peut choisir. On peut changer à tout moment dans l’Espace parents.', en: 'A parent can choose. You can change it any time in the Parents’ area.' };

export function chooseAge(age: AgeBand) {
  setMemory({ ...getMemory(), age, readAloud: null, updatedAt: new Date().toISOString() });
  void syncWorld();
}

/** First visit: who is playing? This decides whether Ziggy reads everything aloud. */
export function AgePicker({ locale, onChosen }: { locale: string; onChosen?: (age: AgeBand) => void }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-bg-dark/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="age-title">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-3xl rounded-[2rem] bg-bg-card p-6 text-center shadow-2xl sm:p-8">
        <div className="flex items-center justify-center gap-3">
          <h2 id="age-title" className="font-display text-3xl font-bold text-text-body sm:text-4xl">
            {tr(Q, locale)}
          </h2>
          <SayButton texts={[tr(Q, locale), ...AGE_CHOICES.map((a) => tr(a.title, locale))]} locale={locale} />
        </div>
        <p className="mt-2 text-sm text-text-muted">{tr(SUB, locale)}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {AGE_CHOICES.map((a, i) => (
            <motion.button
              key={a.id}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                unlockAudio();
                chooseAge(a.id);
                if (a.id !== 'big') void speakSequence('age-chosen', [locale === 'fr' ? 'Super ! Je vais tout te lire.' : 'Great! I’ll read everything to you.'], locale);
                onChosen?.(a.id);
              }}
              className="flex flex-col items-center gap-2 rounded-3xl border-4 p-5 transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline focus-visible:outline-4"
              style={{ borderColor: `${a.color}66`, backgroundColor: `${a.color}14`, outlineColor: `${a.color}88` }}
            >
              <span className="text-7xl" aria-hidden="true">
                {a.emoji}
              </span>
              <span className="font-display text-xl font-bold text-text-body">{tr(a.title, locale)}</span>
              <span className="text-sm text-text-muted">{tr(a.detail, locale)}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
