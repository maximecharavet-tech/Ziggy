"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { COMPANIONS } from "@/data/companions";
import type { CompanionId } from "@/data/types";
import type { NidGame, NidProgress } from "@/games3d/nid/NidGame";
import {
  DECOR,
  DECOR_INFO,
  FOOD_INFO,
  NEEDS,
  NEED_INFO,
  NEED_MAX,
  NID_KEY,
  STAGE_INFO,
  allFull,
  careNeed,
  celebrate,
  challengeText,
  choiceWords,
  decorUnlocked,
  emptySave,
  growthOf,
  hintText,
  nextStageHint,
  parseSave,
  placeDecor,
  planChallenge,
  praiseFor,
  type Band,
  type Challenge,
  type DecorId,
  type NeedId,
  type NidSave,
} from "@/games3d/nid/logic";
import {
  getMemory,
  setMemory,
  useHydrated,
  useWorldMemory,
} from "@/lib/world/store";
import { maxDifficulty, readAloudOn } from "@/lib/world/memory";
import { unlockedCompanions } from "@/lib/world/engine";
import { finishExtraGame } from "@/lib/world/play";
import { speakSequence, stopSpeaking, unlockAudio } from "@/lib/voice";
import { tr, type L } from "@/lib/i18n-text";
import { SayButton } from "@/components/arcade/read-aloud";

const T = {
  title: { fr: "Le Nid de mon compagnon", en: "My Companion’s Nest" },
  teaser: {
    fr: "Ton compagnon vit dans un petit jardin. Prends soin de lui avec de petits défis : il grandit quand tu apprends !",
    en: "Your companion lives in a little garden. Look after it with tiny challenges: it grows when you learn!",
  },
  enter: { fr: "Entrer dans le nid", en: "Enter the nest" },
  loading: { fr: "On prépare le jardin…", en: "Getting the garden ready…" },
  back: { fr: "Retour", en: "Back" },
  noWebgl: {
    fr: "Ce jeu en 3D a besoin de WebGL, qui n’est pas disponible sur cet appareil.",
    en: "This 3D game needs WebGL, which this device does not support.",
  },
  later: { fr: "Plus tard", en: "Later" },
  ready: { fr: "C’est prêt !", en: "Ready!" },
  inBasket: { fr: "Dans le panier", en: "In the basket" },
  decorate: { fr: "Décorer", en: "Decorate" },
  decorateHelp: {
    fr: "Choisis une décoration, puis touche un rond qui brille dans le jardin.",
    en: "Pick a decoration, then tap a shining circle in the garden.",
  },
  erase: { fr: "Enlever", en: "Remove" },
  done: { fr: "Fini", en: "Done" },
  friends: { fr: "Compagnon", en: "Companion" },
  chooseFriend: { fr: "Choisis ton compagnon", en: "Choose your companion" },
  goodNight: { fr: "Bonne nuit", en: "Good night" },
  wake: { fr: "Réveiller", en: "Wake up" },
  dodo: { fr: "Une histoire pour s’endormir", en: "A bedtime story" },
  party: { fr: "Fête du nid !", en: "Nest party!" },
  stage: { fr: "Taille", en: "Size" },
  locked: { fr: "à débloquer", en: "to unlock" },
} satisfies Record<string, L>;

const SKILL_EMOJI: Partial<Record<string, string>> = {
  counting: "🔢",
  addition: "➕",
  vocabulary: "📖",
  logic: "🧩",
};

function webglOk() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function loadSave(): NidSave {
  try {
    const raw = window.localStorage.getItem(NID_KEY);
    return raw ? parseSave(JSON.parse(raw)) : emptySave();
  } catch {
    return emptySave();
  }
}
function storeSave(s: NidSave) {
  try {
    window.localStorage.setItem(NID_KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: the garden simply isn't remembered */
  }
}

type Mode = "home" | "care" | "decor" | "friends" | "night";

export function NidPlayer() {
  const raw = useLocale();
  const locale = raw === "fr" ? "fr" : "en";
  const hydrated = useHydrated();
  const memory = useWorldMemory();
  const reduce = useReducedMotion();
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<NidGame | null>(null);
  const [phase, setPhase] = useState<"intro" | "loading" | "play">("intro");
  const [supported, setSupported] = useState(true);
  const [mode, setMode] = useState<Mode>("home");
  const [save, setSave] = useState<NidSave>(emptySave);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [progress, setProgress] = useState<NidProgress | null>(null);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const [step, setStep] = useState<{ text: string; id: number } | null>(null);
  const [xp, setXp] = useState<{ n: number; id: number } | null>(null);
  const [decorItem, setDecorItem] = useState<DecorId | "erase">("flowers");
  const seed = useRef(Math.floor(Math.random() * 1e6));
  const careStart = useRef(0);
  const saveRef = useRef(save);
  const decorItemRef = useRef<DecorId | "erase">("flowers");
  const challengeRef = useRef<Challenge | null>(null);

  useEffect(() => {
    setSupported(webglOk());
    const s = loadSave();
    saveRef.current = s;
    setSave(s);
  }, []);

  const band: Band = (memory.age ?? "middle") as Band;
  const companion =
    COMPANIONS.find((c) => c.id === memory.companion) ?? COMPANIONS[0];
  const fullName = tr(companion.name, locale);
  const short = fullName.split(" ")[0];
  const growth = useMemo(() => growthOf(memory), [memory]);
  const unlocked = useMemo(
    () => new Set(unlockedCompanions(memory, COMPANIONS)),
    [memory],
  );

  const say = useCallback(
    (
      lines: string[],
      opts: { force?: boolean; bedtime?: boolean; id?: string } = {},
    ) => {
      if (!opts.force && !readAloudOn(getMemory())) return;
      void speakSequence(
        opts.id ?? "nid",
        lines.filter(Boolean),
        locale,
        undefined,
        opts.bedtime ? "bedtime" : "ziggy",
      );
    },
    [locale],
  );
  const showToast = useCallback(
    (text: string) => setToast({ text, id: Date.now() }),
    [],
  );

  const persist = useCallback((s: NidSave) => {
    saveRef.current = s;
    setSave(s);
    storeSave(s);
  }, []);

  /* ── The scene ── */

  const updateChallenge = (ch: Challenge | null) => {
    challengeRef.current = ch;
    setChallenge(ch);
  };
  const pickDecor = (d: DecorId | "erase") => {
    decorItemRef.current = d;
    setDecorItem(d);
  };

  const start = async () => {
    unlockAudio();
    setPhase("loading");
    const current = () =>
      COMPANIONS.find((c) => c.id === getMemory().companion) ?? COMPANIONS[0];
    const m = getMemory();
    const comp = current();
    game.current?.dispose();
    game.current = null;
    let created: NidGame;
    try {
      const { NidGame } = await import("@/games3d/nid/NidGame");
      created = new NidGame(
        canvas.current!,
        {
          companion: comp.id,
          color: comp.color,
          stage: growthOf(m).index,
          decor: saveRef.current.decor,
          locale,
        },
        {
          onCompanionTap: () => {
            const lines = current().reactions.success;
            const line = tr(
              lines[Math.floor(Math.random() * lines.length)],
              locale,
            );
            showToast(line);
            say([line], { id: "nid-tap" });
          },
          onProgress: setProgress,
          onStep: (text) => {
            setStep({ text, id: Date.now() });
            say([text], { id: "nid-step" });
          },
          onHint: (reason, ctx) => {
            const ch = challengeRef.current;
            if (!ch) return;
            const text = hintText(ch, reason, locale, ctx);
            showToast(text);
            say([text], { id: "nid-hint" });
          },
          onDone: (stats) => {
            const ch = challengeRef.current;
            if (!ch) return;
            const outcome = finishExtraGame(
              "nid",
              ch.skill,
              stats,
              performance.now() - careStart.current,
            );
            setXp({ n: outcome.xpGained, id: Date.now() });
            const s = saveRef.current;
            persist({
              ...s,
              needs: careNeed(s.needs, ch.need),
              cares: s.cares + 1,
            });
            const praise = praiseFor(s.cares + seed.current, locale);
            showToast(praise);
            say([praise], { id: "nid-praise" });
            window.setTimeout(() => {
              if (challengeRef.current !== ch) return;
              challengeRef.current = null;
              setChallenge(null);
              setProgress(null);
              setMode((md) => (md === "care" ? "home" : md));
            }, 2300);
          },
          onSpot: (spot) => {
            const item = decorItemRef.current;
            const s = saveRef.current;
            const next = placeDecor(
              s.decor,
              spot,
              item === "erase" ? null : item,
            );
            persist({ ...s, decor: next });
            game.current?.setDecor(next);
          },
        },
      );
    } catch {
      // No WebGL context (or the device refused it): show the friendly message instead.
      setSupported(false);
      setPhase("intro");
      return;
    }
    game.current = created;
    // Lets the end-to-end test drive the scene; never in production.
    if (process.env.NODE_ENV !== "production")
      (window as unknown as { __nid?: NidGame }).__nid = game.current;
    setPhase("play");
    setMode("home");
    const hello =
      locale === "fr"
        ? `Coucou ! C’est moi, ${short} ! Touche une de mes envies en bas pour prendre soin de moi.`
        : `Hi! It’s me, ${short}! Tap one of my wishes below to look after me.`;
    showToast(hello);
    say([hello]);
  };

  useEffect(
    () => () => {
      game.current?.dispose();
      game.current = null;
      stopSpeaking();
    },
    [],
  );

  // The companion changes (picker here, or elsewhere in Ziggy World).
  const lastCompanion = useRef<CompanionId | null>(null);
  useEffect(() => {
    if (phase !== "play") return;
    if (lastCompanion.current && lastCompanion.current !== companion.id)
      game.current?.setCompanion(companion.id, companion.color);
    lastCompanion.current = companion.id;
  }, [companion, phase]);

  // Growth: learning in Ziggy World (or here) makes the companion grow.
  const lastStage = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== "play") return;
    if (lastStage.current !== null && lastStage.current !== growth.index) {
      game.current?.setStage(growth.index);
      if (growth.index > lastStage.current) {
        const text =
          locale === "fr"
            ? `Waouh ! ${short} a grandi : ${tr(STAGE_INFO[growth.stage].label, locale)} ! Merci d’avoir appris avec moi !`
            : `Wow! ${short} grew: ${tr(STAGE_INFO[growth.stage].label, locale)}! Thanks for learning with me!`;
        showToast(text);
        say([text], { id: "nid-grow" });
      }
    }
    lastStage.current = growth.index;
  }, [growth, phase, locale, short, say, showToast]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!step) return;
    const t = setTimeout(() => setStep(null), 1100);
    return () => clearTimeout(t);
  }, [step]);
  useEffect(() => {
    if (!xp) return;
    const t = setTimeout(() => setXp(null), 3200);
    return () => clearTimeout(t);
  }, [xp]);

  /* ── Actions ── */

  const startCare = (need: NeedId) => {
    if (!game.current) return;
    unlockAudio();
    const m = getMemory();
    const skill = band === "big" ? "addition" : "counting";
    const level = Math.min(m.skills[skill]?.difficulty ?? 1, maxDifficulty(m));
    const ch = planChallenge(
      seed.current,
      band,
      need,
      save.cares + NEEDS.indexOf(need),
      level,
      locale,
    );
    careStart.current = performance.now();
    updateChallenge(ch);
    setProgress(null);
    setMode("care");
    game.current.startChallenge(ch);
    say([challengeText(ch, locale, short), ...choiceWords(ch, locale)], {
      id: "nid-ch",
    });
  };

  const stopCare = () => {
    game.current?.cancelChallenge();
    updateChallenge(null);
    setProgress(null);
    setMode("home");
    stopSpeaking();
  };

  // A new throwing round: say the new instruction.
  const round = progress?.round ?? 0;
  useEffect(() => {
    if (
      !challenge ||
      challenge.kind !== "throw" ||
      challenge.mode === "count" ||
      round === 0 ||
      round >= challenge.rounds.length
    )
      return;
    say([challengeText(challenge, locale, short, round)], { id: "nid-ch" });
  }, [round, challenge, locale, short, say]);

  const openDecor = () => {
    setMode("decor");
    game.current?.setDecorMode(true);
    setToast(null);
    say([tr(T.decorateHelp, locale)]);
  };
  const closeDecor = () => {
    setMode("home");
    game.current?.setDecorMode(false);
  };

  const goodNight = () => {
    updateChallenge(null);
    setProgress(null);
    setMode("night");
    game.current?.setNight(true);
    const text =
      locale === "fr"
        ? `Bonne nuit, ${short}. Fais de beaux rêves… À demain !`
        : `Good night, ${short}. Sweet dreams… See you tomorrow!`;
    showToast(text);
    say([text], { bedtime: true, id: "nid-night" });
  };
  const wakeUp = () => {
    setMode("home");
    game.current?.setNight(false);
    const text =
      locale === "fr"
        ? `Bonjour ! ${short} est tout reposé !`
        : `Good morning! ${short} feels all rested!`;
    showToast(text);
    say([text]);
  };

  const throwParty = () => {
    if (!allFull(save.needs)) return;
    persist(celebrate(save));
    game.current?.party();
    const text =
      locale === "fr"
        ? `C’est la fête du nid ! Merci de si bien t’occuper de ${short} !`
        : `It’s a nest party! Thank you for looking after ${short} so well!`;
    showToast(text);
    say([text]);
  };

  const chooseCompanion = (id: CompanionId) => {
    if (!unlocked.has(id)) return;
    setMemory({
      ...getMemory(),
      companion: id,
      updatedAt: new Date().toISOString(),
    });
    setMode("home");
  };

  /* ── Render ── */

  const wishNeed = NEEDS.find((n) => save.needs[n] < NEED_MAX);
  const wishText = wishNeed
    ? `${short} ${tr(NEED_INFO[wishNeed].wish, locale)} ${NEED_INFO[wishNeed].emoji}`
    : locale === "fr"
      ? `${short} est tout content ! Prêt pour la fête ? 🎉`
      : `${short} is so happy! Ready for the party? 🎉`;
  const instruction = challenge
    ? challengeText(challenge, locale, short, progress?.round ?? 0)
    : "";

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-gradient-to-b from-[#9fd8ff] to-[#ffe8c2] text-[#33264a]">
      <canvas
        ref={canvas}
        className="absolute inset-0 h-full w-full touch-none"
        aria-label={tr(T.title, locale)}
      />

      {phase === "play" ? (
        <>
          {/* Top bar */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-2 sm:p-4">
            <div className="pointer-events-auto mx-auto flex w-full max-w-4xl items-center gap-2 rounded-[1.75rem] bg-white/90 p-2 shadow-[0_8px_30px_rgba(60,40,90,.18)] ring-1 ring-white sm:gap-3 sm:p-2.5">
              <Link
                href="/monde"
                aria-label={tr(T.back, locale)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f3ecff] text-lg font-bold text-[#5b3f8f] transition hover:bg-[#e8dcff]"
              >
                ←
              </Link>
              <div
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-2xl shadow-inner"
                style={{ backgroundColor: `${companion.color}33` }}
                aria-hidden="true"
              >
                {companion.emoji}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate font-display text-base font-bold sm:text-lg">
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{fullName}</span>
                </p>
                <p className="flex items-center gap-1 text-xs font-semibold text-[#6b5a86]">
                  <span aria-hidden="true">
                    {STAGE_INFO[growth.stage].emoji}
                  </span>
                  <span className="truncate">
                    {tr(STAGE_INFO[growth.stage].label, locale)}
                  </span>
                </p>
              </div>
              <TopButton
                label={tr(T.friends, locale)}
                emoji="🐾"
                active={mode === "friends"}
                disabled={mode === "care" || mode === "night"}
                onClick={() => setMode(mode === "friends" ? "home" : "friends")}
              />
              <TopButton
                label={tr(T.decorate, locale)}
                emoji="🎨"
                active={mode === "decor"}
                disabled={mode === "care" || mode === "night"}
                onClick={() => (mode === "decor" ? closeDecor() : openDecor())}
              />
              <TopButton
                label={tr(T.goodNight, locale)}
                emoji="🌙"
                active={mode === "night"}
                disabled={mode === "care"}
                onClick={() => (mode === "night" ? wakeUp() : goodNight())}
              />
            </div>
            {/* Growth */}
            {mode === "home" ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="pointer-events-auto mx-auto flex w-full max-w-4xl items-center gap-2 sm:justify-start"
              >
                <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-white/90 px-3 py-1.5 text-xs font-semibold shadow ring-1 ring-white sm:text-sm">
                  <span className="shrink-0" aria-hidden="true">
                    {STAGE_INFO[growth.stage].emoji}
                  </span>
                  <span
                    className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-[#ece4f7] sm:w-24"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-[#ffb86b] to-[#ff7ab8]"
                      style={{ width: `${Math.round(growth.progress * 100)}%` }}
                    />
                  </span>
                  {growth.next ? (
                    <span aria-hidden="true">
                      {STAGE_INFO[growth.next].emoji}
                    </span>
                  ) : null}
                  <span className="min-w-0 leading-tight">
                    ⭐ {nextStageHint(growth, locale)}
                  </span>
                  <SayButton
                    texts={[nextStageHint(growth, locale)]}
                    locale={locale}
                    size="sm"
                  />
                </div>
              </motion.div>
            ) : null}
          </div>

          {/* XP gain */}
          <AnimatePresence>
            {xp ? (
              <motion.div
                key={xp.id}
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                className="pointer-events-none absolute right-3 top-20 rounded-full bg-gradient-to-r from-amber-300 to-pink-300 px-4 py-2 text-base font-bold text-[#4a2350] shadow-lg sm:right-6 sm:top-24 sm:text-lg"
                role="status"
              >
                +{xp.n} XP ⭐
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Big counting pop */}
          <AnimatePresence>
            {step ? (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.4 }}
                transition={{ duration: reduce ? 0 : 0.25 }}
                className="pointer-events-none absolute left-1/2 top-[30%] -translate-x-1/2 rounded-full bg-white/90 px-6 py-2 font-display text-4xl font-bold text-[#ff5c8a] shadow-xl sm:text-5xl"
                aria-hidden="true"
              >
                {step.text}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Bottom area */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-4">
            <AnimatePresence>
              {toast ? (
                <motion.div
                  key={toast.id}
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  role="status"
                  className="pointer-events-none relative max-w-md rounded-3xl bg-white px-4 py-2.5 text-center text-sm font-bold shadow-xl ring-2 ring-[#ffd6e8] sm:text-base"
                >
                  <span aria-hidden="true">{companion.emoji} </span>
                  {toast.text}
                  <span
                    className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-white ring-0"
                    aria-hidden="true"
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            {mode === "home" ? (
              <div className="pointer-events-auto flex w-full max-w-2xl flex-col items-center gap-2">
                {!toast ? (
                  <div className="flex items-center gap-2 rounded-full bg-white/90 py-1 pe-1 ps-4 text-sm font-bold shadow ring-1 ring-white">
                    <span>{wishText}</span>
                    <SayButton texts={[wishText]} locale={locale} size="sm" />
                  </div>
                ) : null}
                {allFull(save.needs) ? (
                  <motion.button
                    type="button"
                    onClick={throwParty}
                    animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                    className="rounded-full bg-gradient-to-r from-[#ffb86b] via-[#ff7ab8] to-[#b38cff] px-7 py-3 text-lg font-bold text-white shadow-[0_8px_30px_rgba(255,122,184,.5)]"
                  >
                    🎉 {tr(T.party, locale)}
                  </motion.button>
                ) : null}
                <div className="grid w-full grid-cols-4 gap-2 rounded-[1.75rem] bg-white/90 p-2 shadow-[0_8px_30px_rgba(60,40,90,.18)] ring-1 ring-white sm:gap-3 sm:p-3">
                  {NEEDS.map((n) => (
                    <NeedTile
                      key={n}
                      need={n}
                      level={save.needs[n]}
                      locale={locale}
                      wish={n === wishNeed}
                      reduce={Boolean(reduce)}
                      onClick={() => startCare(n)}
                    />
                  ))}
                </div>
                {save.parties > 0 ? (
                  <p
                    className="text-xs font-semibold text-[#6b5a86]"
                    aria-label={`${save.parties} 🎉`}
                  >
                    🎉 × {save.parties}
                  </p>
                ) : null}
              </div>
            ) : null}

            {mode === "care" && challenge ? (
              <CarePanel
                challenge={challenge}
                progress={progress}
                instruction={instruction}
                locale={locale}
                band={band}
                onReady={() => game.current?.pickReady()}
                onChoose={(f) => game.current?.chooseFood(f)}
                onLater={stopCare}
              />
            ) : null}

            {mode === "decor" ? (
              <div className="pointer-events-auto w-full max-w-2xl rounded-[1.75rem] bg-white/90 p-3 shadow-[0_8px_30px_rgba(60,40,90,.18)] ring-1 ring-white">
                <div className="mb-2 flex items-center gap-2">
                  <p className="flex-1 text-sm font-bold">
                    {tr(T.decorateHelp, locale)}
                  </p>
                  <SayButton
                    texts={[tr(T.decorateHelp, locale)]}
                    locale={locale}
                    size="sm"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {DECOR.map((d) => {
                    const open = decorUnlocked(d, growth);
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={!open}
                        onClick={() => pickDecor(d)}
                        aria-pressed={decorItem === d}
                        className={`flex min-w-[4.5rem] shrink-0 flex-col items-center rounded-2xl px-2 py-1.5 text-xs font-bold transition ${decorItem === d ? "bg-[#ffe6f1] ring-2 ring-[#ff7ab8]" : "bg-[#f6f1ff]"} ${open ? "" : "opacity-50"}`}
                      >
                        <span className="text-3xl" aria-hidden="true">
                          {DECOR_INFO[d].emoji}
                        </span>
                        <span>{tr(DECOR_INFO[d].label, locale)}</span>
                        {!open ? (
                          <span className="text-[10px] font-semibold text-[#6b5a86]">
                            🔒 {STAGE_INFO[DECOR_INFO[d].stage].emoji}{" "}
                            {tr(STAGE_INFO[DECOR_INFO[d].stage].label, locale)}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => pickDecor("erase")}
                    aria-pressed={decorItem === "erase"}
                    className={`flex min-w-[4.5rem] shrink-0 flex-col items-center rounded-2xl px-2 py-1.5 text-xs font-bold ${decorItem === "erase" ? "bg-[#ffe6f1] ring-2 ring-[#ff7ab8]" : "bg-[#f6f1ff]"}`}
                  >
                    <span className="text-3xl" aria-hidden="true">
                      🧽
                    </span>
                    <span>{tr(T.erase, locale)}</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={closeDecor}
                  className="mt-2 w-full rounded-full bg-gradient-to-r from-[#7fd0ff] to-[#b38cff] py-3 text-base font-bold text-white shadow"
                >
                  ✓ {tr(T.done, locale)}
                </button>
              </div>
            ) : null}

            {mode === "night" ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="pointer-events-auto flex w-full max-w-md flex-col gap-2 rounded-[1.75rem] bg-[#1c2657]/85 p-4 text-center text-white shadow-2xl ring-1 ring-white/20"
              >
                <p className="font-display text-xl font-bold">
                  🌙 {short} {locale === "fr" ? "fait dodo…" : "is sleeping…"}{" "}
                  💤
                </p>
                <Link
                  href="/dodo"
                  className="rounded-full bg-gradient-to-r from-[#8fa0ff] to-[#c99bff] px-5 py-3 text-base font-bold text-white shadow-[0_0_30px_rgba(150,140,255,.5)]"
                >
                  📖 {tr(T.dodo, locale)}
                </Link>
                <button
                  type="button"
                  onClick={wakeUp}
                  className="rounded-full bg-white/15 px-5 py-2.5 text-sm font-bold"
                >
                  ☀️ {tr(T.wake, locale)}
                </button>
              </motion.div>
            ) : null}
          </div>

          {/* Companion picker */}
          <AnimatePresence>
            {mode === "friends" ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-end justify-center bg-[#33264a]/30 p-3 sm:items-center"
                onClick={() => setMode("home")}
              >
                <motion.div
                  initial={{ y: 30 }}
                  animate={{ y: 0 }}
                  className="w-full max-w-lg rounded-[2rem] bg-white p-4 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-label={tr(T.chooseFriend, locale)}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="flex-1 font-display text-xl font-bold">
                      🐾 {tr(T.chooseFriend, locale)}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setMode("home")}
                      className="grid h-11 w-11 place-items-center rounded-full bg-[#f3ecff] font-bold"
                      aria-label={tr(T.done, locale)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {COMPANIONS.map((c) => {
                      const open = unlocked.has(c.id);
                      const current = c.id === companion.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          disabled={!open}
                          onClick={() => chooseCompanion(c.id)}
                          aria-pressed={current}
                          aria-label={tr(c.name, locale)}
                          className={`flex flex-col items-center gap-0.5 rounded-2xl p-2 text-[11px] font-bold transition ${current ? "ring-4" : "ring-1 ring-[#eee6fa]"} ${open ? "hover:scale-105" : "opacity-45 grayscale"}`}
                          style={{
                            backgroundColor: `${c.color}22`,
                            ...(current
                              ? { boxShadow: `0 0 0 4px ${c.color}` }
                              : {}),
                          }}
                        >
                          <span className="text-4xl" aria-hidden="true">
                            {c.emoji}
                          </span>
                          <span className="leading-tight">
                            {tr(c.name, locale).split(" ")[0]}
                          </span>
                          {!open ? (
                            <span className="text-[10px] font-semibold">
                              🔒 ⭐ {c.unlockStars}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </>
      ) : null}

      {/* Intro */}
      {phase !== "play" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#9fd8ff] via-[#d9efff] to-[#ffe8c2] p-6 text-center">
          <Floaters reduce={Boolean(reduce)} />
          <motion.div
            className="relative grid h-36 w-36 place-items-center rounded-full bg-white/70 text-8xl shadow-[0_20px_60px_rgba(255,150,200,.45)] ring-8 ring-white/70"
            animate={
              reduce ? undefined : { y: [0, -12, 0], rotate: [0, -3, 3, 0] }
            }
            transition={{ duration: 3, repeat: Infinity }}
            aria-hidden="true"
          >
            {companion.emoji}
            <span className="absolute -bottom-2 -right-2 text-4xl">🪺</span>
          </motion.div>
          <h1 className="font-display text-4xl font-bold text-[#3b2a5a] drop-shadow-sm sm:text-6xl">
            {tr(T.title, locale)}
          </h1>
          <p className="max-w-lg text-lg font-semibold text-[#5b4a78]">
            {tr(T.teaser, locale)}
          </p>
          <div className="flex items-center gap-2 text-3xl" aria-hidden="true">
            {NEEDS.map((n) => (
              <span
                key={n}
                className="grid h-14 w-14 place-items-center rounded-2xl bg-white/90 shadow"
              >
                {NEED_INFO[n].emoji}
              </span>
            ))}
          </div>
          {supported ? (
            <button
              type="button"
              disabled={!hydrated || phase === "loading"}
              onClick={() => void start()}
              className="mt-2 rounded-full bg-gradient-to-r from-[#ffb86b] to-[#ff7ab8] px-10 py-4 text-xl font-bold text-white shadow-[0_10px_40px_rgba(255,122,184,.5)] transition hover:scale-105 disabled:opacity-60"
            >
              {phase === "loading"
                ? tr(T.loading, locale)
                : `🏡 ${tr(T.enter, locale)}`}
            </button>
          ) : (
            <p className="rounded-2xl bg-white/90 px-4 py-3 font-semibold">
              {tr(T.noWebgl, locale)}
            </p>
          )}
          <Link
            href="/monde"
            className="text-sm font-semibold text-[#5b4a78] underline"
          >
            ← {tr(T.back, locale)}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function TopButton({
  label,
  emoji,
  active,
  disabled,
  onClick,
}: {
  label: string;
  emoji: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl transition disabled:opacity-40 sm:h-12 sm:w-12 ${active ? "bg-gradient-to-br from-[#ffb86b] to-[#ff7ab8] shadow-md" : "bg-[#f3ecff] hover:bg-[#e8dcff]"}`}
    >
      <span aria-hidden="true">{emoji}</span>
    </button>
  );
}

function NeedTile({
  need,
  level,
  locale,
  wish,
  reduce,
  onClick,
}: {
  need: NeedId;
  level: number;
  locale: string;
  wish: boolean;
  reduce: boolean;
  onClick: () => void;
}) {
  const info = NEED_INFO[need];
  const full = level >= NEED_MAX;
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-label={`${tr(info.label, locale)} — ${level} / ${NEED_MAX}`}
      className={`relative flex flex-col items-center gap-1 rounded-2xl px-1 py-2 transition sm:py-3 ${full ? "bg-gradient-to-b from-[#fff6d6] to-[#ffe6f1]" : "bg-[#f8f4ff] hover:bg-[#f1eaff]"} ${wish ? "ring-2 ring-[#ffb86b]" : ""}`}
    >
      <motion.span
        className="text-4xl sm:text-5xl"
        animate={wish && !reduce ? { y: [0, -4, 0] } : undefined}
        transition={{ duration: 1.6, repeat: Infinity }}
        aria-hidden="true"
      >
        {info.emoji}
      </motion.span>
      <span className="text-xs font-bold sm:text-sm">
        {tr(info.label, locale)}
      </span>
      <span className="flex gap-1" aria-hidden="true">
        {Array.from({ length: NEED_MAX }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3 ${i < level ? "bg-gradient-to-br from-[#ffb86b] to-[#ff5c8a]" : "bg-[#e4dcf2]"}`}
          />
        ))}
      </span>
      {full ? (
        <span className="absolute -right-1 -top-1 text-lg" aria-hidden="true">
          ✨
        </span>
      ) : null}
    </motion.button>
  );
}

function CarePanel({
  challenge: ch,
  progress,
  instruction,
  locale,
  band,
  onReady,
  onChoose,
  onLater,
}: {
  challenge: Challenge;
  progress: NidProgress | null;
  instruction: string;
  locale: string;
  band: Band;
  onReady: () => void;
  onChoose: (
    f: Extract<Challenge, { kind: "choose" }>["choices"][number],
  ) => void;
  onLater: () => void;
}) {
  const count = progress?.count ?? (ch.kind === "pick" ? ch.start : 0);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="pointer-events-auto w-full max-w-2xl rounded-[1.75rem] bg-white/92 p-3 shadow-[0_8px_30px_rgba(60,40,90,.22)] ring-1 ring-white sm:p-4"
    >
      <div className="flex items-start gap-2">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#fff1e0] text-2xl"
          aria-hidden="true"
        >
          {NEED_INFO[ch.need].emoji}
        </span>
        <p className="flex-1 text-base font-bold leading-snug sm:text-lg">
          {instruction}
        </p>
        <SayButton
          texts={[instruction, ...choiceWords(ch, locale)]}
          locale={locale}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {ch.kind === "pick" ? (
          <>
            {band === "little" ? (
              <span
                className="flex gap-1"
                aria-label={`${count} / ${ch.target}`}
              >
                {Array.from({ length: ch.target }, (_, i) => (
                  <span
                    key={i}
                    className={`grid h-9 w-9 place-items-center rounded-full text-xl ${i < count ? "bg-[#ffe1de]" : "border-2 border-dashed border-[#e4c9c4]"}`}
                  >
                    {i < count ? "🍎" : ""}
                  </span>
                ))}
              </span>
            ) : (
              <span className="rounded-full bg-[#fff1e0] px-4 py-2 text-base font-bold">
                🧺 {tr(T.inBasket, locale)} :{" "}
                <span className="text-2xl text-[#e8403a]">{count}</span>
              </span>
            )}
            {!ch.autoFinish ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={onReady}
                className="rounded-full bg-gradient-to-r from-[#7ad37a] to-[#3fbf6a] px-6 py-3 text-lg font-bold text-white shadow"
              >
                ✓ {tr(T.ready, locale)}
              </motion.button>
            ) : null}
          </>
        ) : null}

        {ch.kind === "choose" ? (
          <div className="grid w-full grid-cols-3 gap-2">
            {ch.choices.map((f) => (
              <motion.button
                key={f}
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => onChoose(f)}
                className="flex flex-col items-center rounded-2xl bg-[#fff7ec] px-1 py-2 shadow-sm ring-1 ring-[#ffe0bf] hover:bg-[#ffefd9]"
                aria-label={tr(FOOD_INFO[f].name, locale)}
              >
                <span className="text-5xl" aria-hidden="true">
                  {FOOD_INFO[f].emoji}
                </span>
                <span className="text-xs font-bold sm:text-sm">
                  {tr(FOOD_INFO[f].name, locale)}
                </span>
              </motion.button>
            ))}
          </div>
        ) : null}

        {ch.kind === "throw" ? (
          <>
            {ch.mode === "sequence" && ch.rounds[progress?.round ?? 0] ? (
              <span className="flex items-center gap-1.5 font-display text-2xl font-bold">
                {ch.rounds[progress?.round ?? 0].shown.map((n, i) => (
                  <span
                    key={i}
                    className="grid h-11 min-w-11 place-items-center rounded-xl bg-[#eef6ff] px-2"
                  >
                    {n}
                  </span>
                ))}
                <span className="grid h-11 w-11 place-items-center rounded-xl border-2 border-dashed border-[#7fb8f0]">
                  ?
                </span>
              </span>
            ) : null}
            <span
              className="flex gap-1.5"
              aria-label={`${progress?.round ?? 0} / ${ch.rounds.length}`}
            >
              {ch.rounds.map((_, i) => (
                <span
                  key={i}
                  className={`grid h-9 w-9 place-items-center rounded-full text-lg ${i < (progress?.round ?? 0) ? "bg-[#e6f6ff]" : "border-2 border-dashed border-[#c7dff0]"}`}
                >
                  {i < (progress?.round ?? 0) ? "⚽" : ""}
                </span>
              ))}
            </span>
          </>
        ) : null}

        {ch.kind === "rub" ? (
          <span
            className="flex flex-wrap justify-center gap-1"
            aria-label={`${count} ❤`}
          >
            {ch.expr ? (
              <span className="me-2 rounded-xl bg-[#fff0f5] px-3 py-1 font-display text-2xl font-bold">
                {ch.expr[0]} + {ch.expr[1]}
              </span>
            ) : null}
            {Array.from({ length: ch.expr ? count : ch.hearts }, (_, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                className={`text-3xl ${i < count ? "" : "opacity-25 grayscale"}`}
              >
                💗
              </motion.span>
            ))}
          </span>
        ) : null}

        {ch.kind === "bubbles" ? (
          ch.mode === "any" ? (
            <span
              className="flex gap-1"
              aria-label={`${count} / ${ch.labels.length}`}
            >
              {ch.labels.map((_, i) => (
                <span
                  key={i}
                  className={`grid h-9 w-9 place-items-center rounded-full text-lg ${i < count ? "bg-[#e6f6ff]" : "border-2 border-dashed border-[#c7dff0]"}`}
                >
                  {i < count ? "🫧" : ""}
                </span>
              ))}
            </span>
          ) : (
            <span
              className="flex gap-1.5 font-display text-2xl font-bold"
              aria-label={ch.order.join(" ")}
            >
              {ch.order.map((l, i) => (
                <span
                  key={i}
                  className={`grid h-11 w-11 place-items-center rounded-xl ${i < count ? "bg-gradient-to-br from-[#9fd8ff] to-[#c99bff] text-white" : "bg-[#eef6ff] text-[#7fa8d0]"}`}
                >
                  {l}
                </span>
              ))}
            </span>
          )
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span
          className="text-[11px] font-semibold text-[#8a7aa6]"
          aria-hidden="true"
        >
          {SKILL_EMOJI[ch.skill] ?? "✨"}
        </span>
        <button
          type="button"
          onClick={onLater}
          className="rounded-full px-3 py-1.5 text-sm font-bold text-[#6b5a86] hover:bg-[#f3ecff]"
        >
          ↩ {tr(T.later, locale)}
        </button>
      </div>
    </motion.div>
  );
}

function Floaters({ reduce }: { reduce: boolean }) {
  const items = ["🌸", "🦋", "☁️", "🍎", "🌼", "🫧", "🌷", "✨"];
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {items.concat(items).map((e, i) => (
        <motion.span
          key={i}
          className="absolute text-2xl opacity-70"
          style={{
            left: `${(i * 23 + 7) % 95}%`,
            top: `${(i * 37 + 11) % 90}%`,
          }}
          animate={reduce ? undefined : { y: [0, -14, 0], rotate: [0, 8, 0] }}
          transition={{
            duration: 3 + (i % 4),
            repeat: Infinity,
            delay: (i % 5) * 0.4,
          }}
        >
          {e}
        </motion.span>
      ))}
    </div>
  );
}
