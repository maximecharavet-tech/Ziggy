'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { tr, type L } from '@/lib/i18n-text';
import { useHydrated, useWorldMemory } from '@/lib/world/store';
import { speakSequence, unlockAudio } from '@/lib/voice';
import { haptic } from '@/lib/app-bridge';
import { SayButton } from '@/components/arcade/read-aloud';
import { Ziggy3D } from '@/components/ziggy3d/Ziggy3D';
import { MascotCutout } from '@/components/ziggy/Mascot';
import { AGE_CHOICES, chooseAge } from '@/components/world/AgePicker';
import { DioramaCard } from '@/components/create/fx/DioramaCard';
import { Layer } from '@/components/create/fx/Parallax';
import { Twinkle } from '@/components/create/fx/Burst';
import { fx, loop, shade } from '@/components/create/fx/toy';
import { ColorScene } from '@/components/create/HubScenes';
import { Moon } from '@/components/dodo/Scenery';

const T = {
  hello: { fr: 'Coucou !', en: 'Hello!' },
  ask: { fr: 'Qu’est-ce qu’on fait ?', en: 'What shall we do?' },
  welcome: { fr: 'Bonjour ! Je suis Ziggy.', en: 'Hello! I’m Ziggy.' },
  welcomeSub: { fr: 'Je vais jouer, lire et créer avec toi.', en: 'I’ll play, read and create with you.' },
  who: { fr: 'Qui va jouer ?', en: 'Who is playing?' },
  whoNote: { fr: 'Un parent peut changer ça plus tard, dans l’Espace parents.', en: 'A parent can change this later, in the Parents’ area.' },
  chosen: { fr: 'Super ! On y va !', en: 'Great! Let’s go!' },
} satisfies Record<string, L>;

type Tile = { href: string; title: L; text: L; cta: L; from: string; to: string; scene: ReactNode };

const TILES: Tile[] = [
  {
    href: '/monde',
    title: { fr: 'Ziggy World', en: 'Ziggy World' },
    text: { fr: 'Des mondes à explorer et plein de jeux pour apprendre en s’amusant.', en: 'Worlds to explore and lots of games to learn while having fun.' },
    cta: { fr: 'Jouer', en: 'Play' },
    from: '#6fd6f7',
    to: '#3f8fe0',
    scene: <WorldScene />,
  },
  {
    href: '/dodo',
    title: { fr: 'Ziggy te raconte une histoire', en: 'Ziggy tells you a story' },
    text: { fr: 'Des histoires douces, lues par Ziggy, pour rêver.', en: 'Gentle stories, read by Ziggy, to dream.' },
    cta: { fr: 'Écouter', en: 'Listen' },
    from: '#7a6cf0',
    to: '#2c2477',
    scene: <NightScene />,
  },
  {
    href: '/creer',
    title: { fr: 'Créer', en: 'Create' },
    text: { fr: 'Colorie, compose, invente : ici, c’est toi l’artiste.', en: 'Colour, compose, invent: here, you are the artist.' },
    cta: { fr: 'Créer', en: 'Create' },
    from: '#ff9a8b',
    to: '#ff5f86',
    scene: <ColorScene />,
  },
];

/**
 * The home of the Ziggy app (phones and tablets): Ziggy says hello, and the
 * three essentials as big toy cards. The very first time, a calm welcome
 * asks who is playing (it decides whether Ziggy reads everything aloud).
 */
export function AppHome() {
  const locale = useLocale();
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const [greeting, setGreeting] = useState<L>(T.hello);
  const welcome = hydrated && !memory.age;

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h >= 18 || h < 5 ? { fr: 'Bonsoir !', en: 'Good evening!' } : h < 12 ? { fr: 'Bonjour !', en: 'Good morning!' } : T.hello);
  }, []);

  return (
    <div className="relative min-h-[calc(100dvh-var(--tabbar-h,0px))] overflow-clip px-4 pb-10 pt-[5.25rem] sm:px-6 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_45%_at_15%_0%,rgba(255,217,160,0.55),transparent_70%),radial-gradient(60%_40%_at_95%_20%,rgba(95,182,234,0.22),transparent_70%),radial-gradient(70%_40%_at_50%_100%,rgba(127,200,92,0.18),transparent_70%)] dark:bg-[radial-gradient(70%_45%_at_15%_0%,rgba(255,217,160,0.1),transparent_70%),radial-gradient(60%_40%_at_95%_20%,rgba(95,182,234,0.12),transparent_70%)]"
      />
      <AnimatePresence mode="wait">
        {!hydrated ? (
          <div key="wait" className="h-[70vh]" aria-hidden="true" />
        ) : welcome ? (
          <Welcome key="welcome" locale={locale} />
        ) : (
          <motion.div key="hub" className="relative mx-auto max-w-6xl md:flex md:min-h-[calc(100dvh-var(--tabbar-h,0px)-8rem)] md:flex-col md:justify-center" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
            <header className="flex items-center gap-3 sm:gap-5">
              <div className="relative h-36 w-28 shrink-0 sm:h-48 sm:w-36 md:h-60 md:w-44">
                <div className="absolute inset-x-0 bottom-1 mx-auto h-5 w-24 rounded-full bg-[#6b4a2b]/15 blur-md" aria-hidden="true" />
                <Ziggy3D className="h-full w-full" idle="wave" mood="happy" framing="full" fallback="wave" label={locale === 'fr' ? 'Ziggy te fait coucou' : 'Ziggy waves at you'} />
              </div>
              <div className="min-w-0">
                <div className="relative w-fit rounded-[1.6rem] rounded-es-md bg-bg-card px-5 py-3 shadow-[0_14px_30px_-16px_rgba(107,74,43,0.5)] ring-1 ring-border/70">
                  <h1 className="font-display text-[1.75rem] font-bold leading-tight text-text-body sm:text-4xl md:text-5xl">{tr(greeting, locale)}</h1>
                  <p className="font-display text-lg font-semibold text-text-muted sm:text-2xl md:text-3xl">{tr(T.ask, locale)}</p>
                </div>
                <SayButton texts={[tr(greeting, locale), tr(T.ask, locale)]} locale={locale} size="md" className="mt-3" />
              </div>
            </header>

            <ul className="mt-7 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {TILES.map((t, i) => {
                const title = tr(t.title, locale);
                return (
                  <li key={t.href} className={i === 0 ? 'sm:col-span-2 lg:col-span-1' : ''}>
                    <DioramaCard
                      href={t.href}
                      label={`${title}. ${tr(t.text, locale)}`}
                      from={t.from}
                      to={t.to}
                      index={i}
                      window={t.scene}
                      corner={<SayButton texts={[title, tr(t.text, locale)]} locale={locale} size="md" className="!bg-white/90 !text-[#5FB6EA] shadow-[0_4px_0_rgba(0,0,0,0.12)] !ring-white" />}
                    >
                      <span className="flex flex-1 flex-col px-1.5 pb-1.5 pt-4">
                        <span className="font-display text-[1.75rem] font-bold leading-tight [text-shadow:0_2px_0_rgba(0,0,0,0.14)]">{title}</span>
                        <span className="mt-1.5 flex-1 text-[1rem] leading-snug text-white/90">{tr(t.text, locale)}</span>
                        <span
                          className={`${fx.toy} ${fx.light} ${fx.sheen} mt-5 inline-flex min-h-14 w-fit items-center gap-2 rounded-full px-7 font-display text-xl font-bold`}
                          style={{ '--ink': shade(t.to, -0.35), '--delay': `${1 + i * 0.7}s` } as CSSProperties}
                        >
                          <span aria-hidden="true">▶</span> {tr(t.cta, locale)}
                        </span>
                      </span>
                    </DioramaCard>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** First launch: Ziggy says hello and asks who is playing. Calm, one choice, no marketing. */
function Welcome({ locale }: { locale: string }) {
  return (
    <motion.section
      className="relative mx-auto flex max-w-3xl flex-col items-center text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.5 }}
      aria-labelledby="welcome-title"
    >
      <div className="relative h-56 w-44 sm:h-72 sm:w-56">
        <div className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,#FFE7C2_0%,rgba(255,217,160,0.35)_55%,transparent_72%)]" aria-hidden="true" />
        <Ziggy3D className="h-full w-full" idle="wave" mood="happy" framing="full" fallback="wave" label={locale === 'fr' ? 'Ziggy te fait coucou' : 'Ziggy waves at you'} />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <h1 id="welcome-title" className="font-display text-4xl font-bold text-text-body sm:text-5xl">
          {tr(T.welcome, locale)}
        </h1>
        <SayButton texts={[tr(T.welcome, locale), tr(T.welcomeSub, locale), tr(T.who, locale), ...AGE_CHOICES.map((a) => tr(a.title, locale))]} locale={locale} size="lg" />
      </div>
      <p className="mt-2 text-lg text-text-muted sm:text-xl">{tr(T.welcomeSub, locale)}</p>

      <h2 className="mt-8 font-display text-2xl font-bold text-text-body sm:text-3xl">{tr(T.who, locale)}</h2>
      <div className="mt-5 grid w-full gap-4 sm:grid-cols-3">
        {AGE_CHOICES.map((a, i) => (
          <motion.button
            key={a.id}
            type="button"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + 0.08 * i, type: 'spring', stiffness: 260, damping: 22 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              unlockAudio();
              haptic('success');
              chooseAge(a.id);
              if (a.id !== 'big') void speakSequence('age-chosen', [tr(T.chosen, locale)], locale);
            }}
            className="flex min-h-[7.5rem] items-center gap-4 rounded-[1.75rem] border-[3px] bg-bg-card p-4 text-start shadow-[0_6px_0_rgba(40,30,80,0.06)] sm:flex-col sm:justify-center sm:p-5 sm:text-center"
            style={{ borderColor: `${a.color}88`, backgroundImage: `linear-gradient(180deg, ${a.color}1f, ${a.color}0a)` }}
          >
            <span className="text-6xl leading-none sm:text-7xl" aria-hidden="true">
              {a.emoji}
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-display text-xl font-bold leading-tight text-text-body">{tr(a.title, locale)}</span>
              <span className="text-sm text-text-muted">{tr(a.detail, locale)}</span>
            </span>
          </motion.button>
        ))}
      </div>
      <p className="mt-5 text-sm text-text-muted">{tr(T.whoNote, locale)}</p>
    </motion.section>
  );
}

/** The world map in a little window: hills, a castle, a rocket, and Ziggy waving. */
function WorldScene() {
  return (
    <>
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(80%_60%_at_80%_0%,#fff7d6_0%,transparent_60%),linear-gradient(180deg,#8fd3ff_0%,#c9ecff_58%,#bfe8a8_58%,#8fd36c_100%)]" />
      <Layer depth={-5} className="left-[8%] top-[12%]">
        <div className={`h-6 w-16 rounded-full bg-white/90 shadow-[14px_-8px_0_-2px_rgba(255,255,255,0.9)] ${fx.drift}`} style={loop({ dur: 12, dx: 16, dy: 0 })} />
      </Layer>
      <Layer depth={6} className="bottom-[18%] left-[8%] text-[2.8rem]">
        <span className={`block leading-none drop-shadow-[0_6px_5px_rgba(40,10,60,0.22)] ${fx.float}`} style={loop({ dur: 4, amp: -6 })}>
          🏰
        </span>
      </Layer>
      <Layer depth={14} className="right-[8%] top-[12%] text-[2.4rem]">
        <span className={`block leading-none drop-shadow-[0_6px_5px_rgba(40,10,60,0.22)] ${fx.drift}`} style={loop({ dur: 7, dx: -14, dy: 8 })}>
          🚀
        </span>
      </Layer>
      <Layer depth={10} className="bottom-[14%] right-[10%] text-[2.6rem]">
        <span className={`block leading-none drop-shadow-[0_6px_5px_rgba(40,10,60,0.22)] ${fx.bob}`}>🦕</span>
      </Layer>
      <Layer depth={18} className="bottom-[-4%] left-1/2 h-[92%] -translate-x-1/2">
        <MascotCutout pose="wave" width={150} glow={false} className="h-full [&_img]:h-full [&_img]:w-auto" />
      </Layer>
      <Layer depth={16} className="left-[38%] top-[14%]">
        <Twinkle size={16} color="#FFD447" className={fx.twinkle} style={loop({ dur: 2.4 })} />
      </Layer>
    </>
  );
}

/** Bedtime in a little window: the moon, stars, a sleepy cloud. */
function NightScene() {
  return (
    <>
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(70%_60%_at_75%_20%,rgba(255,230,170,0.35),transparent_60%),linear-gradient(180deg,#1b1650_0%,#2c2477_60%,#4a3a9a_100%)]" />
      {[
        [12, 18, 14],
        [30, 40, 10],
        [52, 14, 12],
        [84, 52, 10],
        [66, 70, 8],
        [20, 66, 9],
      ].map(([x, y, s], i) => (
        <Layer key={i} depth={4 + i * 2} className="" style={{ left: `${x}%`, top: `${y}%` }}>
          <Twinkle size={s} color="#FFF4C8" className={fx.twinkle} style={loop({ dur: 2.2 + i * 0.4, delay: i * 0.3 })} />
        </Layer>
      ))}
      <Layer depth={8} className="right-[10%] top-[10%]">
        <Moon size="4.5rem" />
      </Layer>
      <Layer depth={14} className="bottom-[8%] left-[10%] text-[2.6rem]">
        <span className={`block leading-none ${fx.float}`} style={loop({ dur: 5, amp: -5 })}>
          ☁️
        </span>
      </Layer>
      <Layer depth={20} className="bottom-[12%] left-[42%] text-[2.6rem]">
        <span className={`block leading-none ${fx.bob}`}>📖</span>
      </Layer>
      <Layer depth={12} className="bottom-[16%] right-[14%] text-[2.2rem]">
        <span className={`block leading-none ${fx.float}`} style={loop({ dur: 6, amp: -4, delay: 1 })}>
          🐑
        </span>
      </Layer>
    </>
  );
}
