"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { tr, type L } from "@/lib/i18n-text";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { SayButton } from "@/components/arcade/read-aloud";
import { SantaScene } from "@/components/santa/SantaScene";
import { SantaAudio, wait } from "@/lib/santa/audio";
import { openEars, type Ears } from "@/lib/santa/listen";
import {
  createTranscriber,
  transcriberKind,
  type Transcriber,
} from "@/lib/santa/transcribe";
import {
  buildCall,
  callClips,
  seedFromId,
  type CallKind,
  type CallStep,
} from "@/lib/santa/call-script";
import { activeChild, santaStore, useSantaFamily } from "@/lib/santa/store";
import { scheduleStore } from "@/lib/santa/schedule";
import { useSantaPass } from "@/lib/santa/pass-client";
import type { SantaChild, SantaSceneHandle } from "@/lib/santa/types";
import { ChildSetup } from "@/components/santa/ChildSetup";
import { Snow } from "@/components/santa/Snow";

const T = {
  title: { fr: "Appelle le Père Noël", en: "Call Santa" },
  pick: { fr: "Choisis ton appel", en: "Pick your call" },
  ringing: { fr: "Appel vidéo entrant…", en: "Incoming video call…" },
  from: { fr: "Pôle Nord", en: "North Pole" },
  santa: { fr: "Père Noël", en: "Santa Claus" },
  answer: { fr: "Décrocher", en: "Answer" },
  call: { fr: "Appeler", en: "Call" },
  later: { fr: "Plus tard", en: "Later" },
  micNote: {
    fr: "Le micro sert seulement à savoir quand tu réponds. Rien n’est enregistré, tout reste sur l’appareil.",
    en: "The microphone only tells when you answer. Nothing is recorded, everything stays on the device.",
  },
  connecting: {
    fr: "Connexion avec le Pôle Nord…",
    en: "Connecting to the North Pole…",
  },
  live: { fr: "En direct du Pôle Nord", en: "Live from the North Pole" },
  yourTurn: { fr: "À toi de parler !", en: "Your turn to talk!" },
  talk: { fr: "Parler au Père Noël", en: "Talk to Santa" },
  listening: { fr: "Le Père Noël t’écoute…", en: "Santa is listening…" },
  thinking: { fr: "Le Père Noël réfléchit…", en: "Santa is thinking…" },
  prep: { fr: "Le Père Noël règle ses oreilles magiques…", en: "Santa is tuning his magic ears…" },
  goodbye: { fr: "Dire au revoir", en: "Say goodbye" },
  hangup: { fr: "Raccrocher", en: "Hang up" },
  captions: { fr: "Sous-titres", en: "Captions" },
  ended: { fr: "Le Père Noël t’a appelé !", en: "Santa called you!" },
  again: { fr: "Rappeler", en: "Call again" },
  others: { fr: "Autres appels", en: "Other calls" },
  photo: { fr: "Photo avec le Père Noël", en: "Photo with Santa" },
  previewEnd: {
    fr: "Pour les appels en entier, demande à un parent : le Pack Noël est dans l’espace parents.",
    en: "For the full calls, ask a grown-up: the Christmas Pack is in the parents’ area.",
  },
  parents: { fr: "Espace parents", en: "Parents’ area" },
  locked: { fr: "Pack Noël", en: "Christmas Pack" },
  free: { fr: "Gratuit", en: "Free" },
  freePreview: { fr: "Début gratuit", en: "Free start" },
  aiBadge: { fr: "+ questions en direct", en: "+ live questions" },
  pipOff: { fr: "Caméra éteinte", en: "Camera off" },
  message: { fr: "Le message du Père Noël", en: "Santa’s message" },
  messageText: {
    fr: "Un petit coucou du Pôle Nord, rien que pour toi.",
    en: "A little hello from the North Pole, just for you.",
  },
  listen: { fr: "Écouter", en: "Listen" },
} satisfies Record<string, L>;

const CALLS: {
  kind: CallKind;
  emoji: string;
  title: L;
  text: L;
  from: string;
  to: string;
}[] = [
  {
    kind: "liste",
    emoji: "📜",
    title: { fr: "L’appel de ma liste", en: "My wish-list call" },
    text: {
      fr: "Le Père Noël a ta lettre devant lui et te parle de tes cadeaux.",
      en: "Santa has your letter in front of him and talks about your gifts.",
    },
    from: "#c92a2a",
    to: "#ff6b6b",
  },
  {
    kind: "nouvelles",
    emoji: "🦌",
    title: { fr: "Les nouvelles du Pôle Nord", en: "News from the North Pole" },
    text: {
      fr: "Les rennes, les lutins, Mère Noël… et ta blague préférée !",
      en: "The reindeer, the elves, Mrs Claus… and your best joke!",
    },
    from: "#1864ab",
    to: "#4dabf7",
  },
  {
    kind: "veille",
    emoji: "🌙",
    title: { fr: "L’appel de la veille de Noël", en: "The Christmas Eve call" },
    text: {
      fr: "Le traîneau est prêt ! Le Père Noël appelle juste avant de partir.",
      en: "The sleigh is ready! Santa calls just before he sets off.",
    },
    from: "#5f3dc4",
    to: "#9775fa",
  },
];

type Phase = "pick" | "ringing" | "call" | "ended";

/** Full-screen layers go to <body>, above the site's header and the page's stacking contexts. */
function Overlay({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => setEl(document.body), []);
  return el ? createPortal(children, el) : null;
}
type Mode = "santa" | "listen" | "ai-ready" | "ai-listen" | "ai-think" | "ai-prep";

const b64ToBuf = (b64: string) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)).buffer;

export function SantaCall({
  initialKind,
  ringId,
}: {
  initialKind?: CallKind | "message";
  /** A scheduled call (src/lib/santa/schedule.ts) to ring right away. */
  ringId?: string;
}) {
  const locale = useLocale() === "fr" ? "fr" : "en";
  const reduced = useReducedMotion();
  const family = useSantaFamily();
  const child = activeChild(family);
  const pass = useSantaPass();
  const paid = pass.tier !== null;
  const aiAllowed =
    pass.tier === "magique" && !!family.aiConsentAt && pass.aiSecondsLeft > 0;

  const [phase, setPhase] = useState<Phase>("pick");
  const [kind, setKind] = useState<CallKind | "message">(
    initialKind ?? "liste",
  );
  const [preview, setPreview] = useState(false);
  const [endReason, setEndReason] = useState<"done" | "preview">("done");
  const [caption, setCaption] = useState("");
  const [showCaptions, setShowCaptions] = useState(true);
  const [mode, setMode] = useState<Mode>("santa");
  const [level, setLevel] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [aiKind, setAiKind] = useState<string | null>(null);
  const [sttProgress, setSttProgress] = useState(0);

  const audio = useRef<SantaAudio | null>(null);
  const scene = useRef<SantaSceneHandle | null>(null);
  const ears = useRef<Ears | null>(null);
  const stt = useRef<Transcriber | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const pip = useRef<HTMLVideoElement | null>(null);
  const runId = useRef(0);
  const ringTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiDone = useRef<(() => void) | null>(null);
  const aiTalk = useRef<(() => void) | null>(null);
  const steps = useRef<CallStep[]>([]);
  const aiHistory = useRef<{ role: "child" | "santa"; text: string }[]>([]);

  useEffect(() => {
    if (initialKind) setKind(initialKind);
  }, [initialKind]);

  useEffect(() => {
    let on = true;
    transcriberKind(locale).then((k) => on && setAiKind(k));
    return () => {
      on = false;
    };
  }, [locale]);

  const cleanup = useCallback(() => {
    runId.current++;
    if (ringTimer.current) clearInterval(ringTimer.current);
    ringTimer.current = null;
    aiDone.current?.();
    stt.current?.close();
    stt.current = null;
    ears.current?.close();
    ears.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    audio.current?.close();
    audio.current = null;
    setLevel(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  // Mouth follows the voice.
  const onLevel = useCallback((v: number) => scene.current?.setTalk(v), []);

  /** Tap on a call card: the phone rings while the clips load. */
  const ring = useCallback(
    async (
      k: CallKind | "message",
      isPreview: boolean,
      sched?: { seed: number },
    ) => {
      if (!child) return;
      cleanup();
      setKind(k);
      setPreview(isPreview);
      setPhase("ringing");
      setLoaded(0);
      const a = new SantaAudio(locale, onLevel);
      audio.current = a;
      await a.unlock();
      const play = () => a.sfx("ring");
      play();
      ringTimer.current = setInterval(play, 3400);
      if (typeof navigator !== "undefined" && "vibrate" in navigator)
        navigator.vibrate?.([300, 200, 300]);
      steps.current = buildCall(k, child, {
        preview: isPreview,
        ai: aiAllowed && aiKind !== null && k !== "message",
        seed: sched ? sched.seed : Date.now() % 997,
        scheduled: Boolean(sched),
      });
      void a.preload(callClips(steps.current), setLoaded);
    },
    [child, cleanup, locale, onLevel, aiAllowed, aiKind],
  );

  // A scheduled call: the phone rings as soon as the page opens (the ring
  // sound starts at the first touch — browsers need one before any sound).
  const rangFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ringId || rangFor.current === ringId) return;
    const sc = scheduleStore.find(ringId);
    if (!sc || sc.doneAt) return;
    if (child?.id !== sc.childId) {
      if (santaStore.get().children.some((ch) => ch.id === sc.childId)) santaStore.setActive(sc.childId);
      return; // re-runs with the right child
    }
    rangFor.current = ringId;
    scheduleStore.update(ringId, { doneAt: Date.now() });
    void ring(sc.kind, false, { seed: seedFromId(sc.id) });
  }, [ringId, child, ring]);

  /** "Answer": camera + mic (both optional), then the call runs. */
  const answer = useCallback(async () => {
    if (ringTimer.current) clearInterval(ringTimer.current);
    ringTimer.current = null;
    const a = audio.current;
    if (!a || !child) return;
    await a.unlock();
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          facingMode: "user",
          width: { ideal: 480 },
          height: { ideal: 640 },
        },
      });
    } catch {
      try {
        stream.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      } catch {
        stream.current = null;
      }
    }
    ears.current = stream.current
      ? await openEars(a.ctx, stream.current)
      : null;
    setPhase("call");
    setElapsed(0);
  }, [child]);

  // The camera preview (local only, never recorded).
  useEffect(() => {
    if (
      phase === "call" &&
      pip.current &&
      stream.current?.getVideoTracks().length
    ) {
      pip.current.srcObject = stream.current;
      void pip.current.play().catch(() => {});
    }
  }, [phase]);

  // Call timer.
  useEffect(() => {
    if (phase !== "call") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  /** Runs the steps once the call is on screen and the 3D Santa is ready. */
  const run = useCallback(async () => {
    const a = audio.current;
    if (!a || !child) return;
    const id = ++runId.current;
    const alive = () => id === runId.current;
    await wait(0.8);
    for (const step of steps.current) {
      if (!alive()) return;
      if (step.t === "say") {
        setMode("santa");
        if (step.expr) scene.current?.setExpression(step.expr);
        for (const clip of step.clips) {
          if (!alive()) return;
          await a.say(clip, setCaption);
          await wait(0.18);
        }
        if (step.expr && step.expr !== "listen")
          scene.current?.setExpression("idle");
      } else if (step.t === "listen") {
        setMode("listen");
        scene.current?.setExpression("listen");
        if (ears.current) await ears.current.listen(step.ms, setLevel);
        else await wait(Math.min(4, step.ms / 1000));
        setLevel(0);
        if (alive()) scene.current?.setExpression("idle");
      } else if (step.t === "sfx") {
        const d = a.sfx(step.id);
        scene.current?.setExpression("laugh");
        await wait(d);
      } else if (step.t === "ai") {
        await runAi(a, child, alive);
      } else if (step.t === "end") {
        setEndReason(step.reason);
        a.sfx("sparkle");
        await wait(1.2);
        if (!alive()) return;
        cleanup();
        setPhase("ended");
        return;
      }
    }
    // runAi is stable for the duration of a call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child, cleanup]);

  /** The live AI part: the child taps, speaks, Santa answers — until goodbye or time is up. */
  async function runAi(a: SantaAudio, c: SantaChild, alive: () => boolean) {
    const t = await createTranscriber(locale, { ctx: a.ctx, stream: stream.current });
    if (!t) return;
    stt.current = t;
    try {
      // On Safari / iPhone the on-device model is fetched once (then cached): show it.
      if (t.kind === "sherpa-wasm") {
        setMode("ai-prep");
        setSttProgress(0);
      }
      await t.prepare(setSttProgress);
    } catch {
      return;
    }
    if (!alive()) return;
    aiHistory.current = [];
    let keepGoing = true;
    // After a barge-in the child is already talking: listen straight away.
    let autoListen = false;
    while (keepGoing && alive()) {
      if (!autoListen) {
        setMode("ai-ready");
        const action = await new Promise<"talk" | "bye">((resolve) => {
          aiDone.current = () => resolve("bye");
          aiTalk.current = () => resolve("talk");
        });
        if (action === "bye" || !alive()) break;
      }
      autoListen = false;
      setMode("ai-listen");
      scene.current?.setExpression("listen");
      const heard = await t.hear(12000, setLevel);
      if (!alive()) return;
      if (!heard) {
        await a.say("line:ai.again", setCaption);
        continue;
      }
      setMode("ai-think");
      scene.current?.setExpression("idle");
      const out = await streamSanta(a, c, heard, alive);
      if (!alive()) return;
      if (out.interrupted) autoListen = true;
      if (out.left !== undefined && out.left <= 0) keepGoing = false;
      if (out.timeUp) keepGoing = false;
    }
    aiDone.current = null;
    pass.refresh();
  }

  /**
   * One live answer, streamed: Santa starts speaking with the first sentence
   * while the next ones are still being written. If the child talks over him
   * (barge-in), he stops at once and listens.
   */
  async function streamSanta(
    a: SantaAudio,
    c: SantaChild,
    heard: string,
    alive: () => boolean,
  ): Promise<{ interrupted: boolean; left?: number; timeUp?: boolean }> {
    const ctrl = new AbortController();
    const said: string[] = [];
    let interrupted = false;
    let stopWatch: (() => void) | null = null;
    let left: number | undefined;
    let line: string | null = null;
    // Sentences waiting to be spoken, in order.
    const queue: { text: string; wav: ArrayBuffer | null }[] = [];
    let ended = false;
    let wake: (() => void) | null = null;
    const push = () => {
      wake?.();
      wake = null;
    };
    const reader = (async () => {
      try {
        const r = await fetch("/api/santa/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            locale,
            name: c.name,
            age: c.age,
            wishes: c.wishes,
            history: aiHistory.current,
            text: heard,
            stream: true,
          }),
        });
        const type = r.headers.get("content-type") ?? "";
        if (!r.body || !type.includes("ndjson")) {
          // Old answer shape (or an error as JSON).
          const res = (await r.json().catch(() => ({ line: "ai.busy" }))) as { text?: string; audio?: string | null; line?: string; left?: number };
          if (res.text) queue.push({ text: res.text, wav: res.audio ? b64ToBuf(res.audio) : null });
          else line = res.line ?? "ai.busy";
          left = res.left;
          return;
        }
        const rd = r.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = "";
        for (;;) {
          const { done, value } = await rd.read();
          if (done) break;
          buf += value;
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const raw = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!raw) continue;
            try {
              const ev = JSON.parse(raw) as { t: string; text?: string; audio?: string | null; line?: string; left?: number };
              if (ev.t === "s" && ev.text) {
                queue.push({ text: ev.text, wav: ev.audio ? b64ToBuf(ev.audio) : null });
                push();
              } else if (ev.t === "line") line = ev.line ?? "ai.busy";
              else if (ev.t === "done") left = ev.left;
            } catch {
              /* partial line */
            }
          }
        }
      } catch {
        if (!ctrl.signal.aborted && !queue.length && !said.length) line = "ai.busy";
      } finally {
        ended = true;
        push();
      }
    })();

    // Barge-in: the child's voice over Santa's stops him.
    if (ears.current)
      stopWatch = ears.current.watch(() => {
        interrupted = true;
        ctrl.abort();
        a.interrupt();
        push();
      });

    try {
      for (;;) {
        if (!alive() || interrupted) break;
        const next = queue.shift();
        if (next) {
          setMode("santa");
          scene.current?.setExpression(/ho ho/i.test(next.text) ? "laugh" : "idle");
          said.push(next.text);
          await a.sayRaw(next.text, next.wav, setCaption);
          if (a.takeInterrupted()) interrupted = true;
          continue;
        }
        if (ended) break;
        await new Promise<void>((r) => (wake = r));
      }
    } finally {
      stopWatch?.();
      if (interrupted) ctrl.abort();
      await reader.catch(() => {});
    }
    if (said.length) aiHistory.current.push({ role: "child", text: heard }, { role: "santa", text: said.join(" ") });
    if (!interrupted && !said.length && alive()) {
      const l = line === "ai.timeup" ? "ai.timeup" : line === "ai.again" ? "ai.again" : "ai.busy";
      setMode("santa");
      await a.say(`line:${l}`, setCaption);
      return { interrupted, left, timeUp: l === "ai.timeup" };
    }
    if (interrupted) scene.current?.setExpression("listen");
    return { interrupted, left };
  }

  const onSceneReady = useCallback(
    (h: SantaSceneHandle) => {
      scene.current = h;
      if (phase === "call") void run();
    },
    [phase, run],
  );

  // If the scene was ready before the call phase (re-render), start anyway.
  useEffect(() => {
    if (phase === "call" && scene.current) void run();
  }, [phase, run]);

  const hangUp = useCallback(() => {
    audio.current?.sfx("hangup");
    setEndReason("done");
    cleanup();
    setPhase("ended");
  }, [cleanup]);

  // Escape / back hangs up.
  useEffect(() => {
    if (phase !== "call" && phase !== "ringing") return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" &&
      (phase === "call" ? hangUp() : (cleanup(), setPhase("pick")));
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, hangUp, cleanup]);

  if (!child) return <ChildSetup purpose="call" />;

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="relative">
      {phase === "pick" && (
        <section className="mx-auto max-w-5xl px-4 pb-24 pt-24 sm:px-6 sm:pt-28">
          <div className="flex items-center justify-center gap-3 text-center">
            <h1 className="font-display text-4xl font-bold text-white text-balance drop-shadow-[0_3px_0_rgba(0,0,0,0.25)] sm:text-5xl">
              {tr(T.title, locale)}
            </h1>
            <SayButton
              texts={[tr(T.title, locale), tr(T.pick, locale)]}
              locale={locale}
              size="md"
              className="shrink-0"
            />
          </div>
          <p className="mt-3 text-center text-lg text-white/85">
            {tr(T.pick, locale)}
          </p>

          <motion.button
            type="button"
            onClick={() => ring("message", false)}
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className={`group relative mx-auto mt-8 flex w-full max-w-3xl items-center gap-4 overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#e67700] to-[#fcc419] p-4 text-start text-[#3b1f00] shadow-[0_14px_30px_-12px_rgba(0,0,0,0.6)] transition-transform hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70 sm:p-5 ${initialKind === "message" ? "ring-4 ring-white/80" : ""}`}
          >
            <span
              className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/90 text-4xl shadow-inner"
              aria-hidden="true"
            >
              🎧
            </span>
            <span className="flex-1">
              <span className="block font-display text-2xl font-bold leading-tight">
                {tr(T.message, locale)}
              </span>
              <span className="block text-sm font-semibold opacity-80">
                {tr(T.messageText, locale)}
              </span>
            </span>
            <span className="hidden rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-wider sm:inline">
              {tr(T.free, locale)}
            </span>
            <span className="inline-flex min-h-14 items-center rounded-full bg-[#3b1f00] px-5 font-display text-lg font-bold text-white">
              ▶ {tr(T.listen, locale)}
            </span>
          </motion.button>

          <ul className="mt-6 grid gap-5 sm:grid-cols-3">
            {CALLS.map((c, i) => {
              const isPreview = !paid && c.kind === "liste";
              const locked = !paid && c.kind !== "liste";
              const title = tr(c.title, locale);
              return (
                <li key={c.kind}>
                  <motion.button
                    type="button"
                    onClick={() =>
                      locked ? undefined : ring(c.kind, isPreview)
                    }
                    aria-disabled={locked}
                    initial={reduced ? false : { opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * i }}
                    className={`group relative flex h-full min-h-[15rem] w-full flex-col overflow-hidden rounded-[2rem] p-5 text-start text-white shadow-[0_14px_30px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/15 transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/70 ${locked ? "opacity-75" : "hover:-translate-y-1 active:scale-[0.98]"}`}
                    style={{
                      background: `linear-gradient(150deg, ${c.from}, ${c.to})`,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute -right-2 -top-3 text-[5.5rem] leading-none opacity-90 drop-shadow-lg transition-transform group-hover:rotate-6"
                    >
                      {c.emoji}
                    </span>
                    <span className="relative w-fit rounded-full bg-white/25 px-3 py-1 text-xs font-black uppercase tracking-wider">
                      {locked
                        ? `🎁 ${tr(T.locked, locale)}`
                        : isPreview
                          ? tr(T.freePreview, locale)
                          : aiAllowed && aiKind
                            ? tr(T.aiBadge, locale)
                            : "📞"}
                    </span>
                    <span className="relative mt-auto pt-12 font-display text-2xl font-bold leading-tight">
                      {title}
                    </span>
                    <span className="relative mt-1 text-sm text-white/90">
                      {tr(c.text, locale)}
                    </span>
                    <span className="relative mt-4 inline-flex min-h-14 w-fit items-center gap-2 rounded-full bg-white px-5 font-display text-lg font-bold text-[#1b2150] shadow-[0_4px_0_rgba(0,0,0,0.2)]">
                      {locked ? "🔒" : "📞"}{" "}
                      {locked ? tr(T.locked, locale) : tr(T.call, locale)}
                    </span>
                  </motion.button>
                </li>
              );
            })}
          </ul>

          {!paid && (
            <p className="mx-auto mt-8 max-w-xl text-center text-sm text-white/80">
              {tr(T.previewEnd, locale)}{" "}
              <Link
                href="/pere-noel/parents"
                className="font-bold text-amber-200 underline underline-offset-4"
              >
                {tr(T.parents, locale)}
              </Link>
            </p>
          )}
        </section>
      )}

      <Overlay>
        <AnimatePresence>
          {phase === "ringing" && (
            <motion.div
              key="ring"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] flex flex-col items-center justify-between overflow-hidden bg-[radial-gradient(120%_80%_at_50%_0%,#3b1f6b_0%,#120b2e_55%,#07051a_100%)] px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(4rem,env(safe-area-inset-top))] text-white"
              role="dialog"
              aria-label={tr(T.ringing, locale)}
              onPointerDown={() => void audio.current?.unlock()}
            >
              <Snow count={reduced ? 0 : 50} />
              <div className="relative flex flex-col items-center text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
                  {tr(T.ringing, locale)}
                </p>
                <div className="relative mt-8">
                  {!reduced && (
                    <>
                      <span className="absolute inset-0 animate-ping rounded-full bg-red-400/30" />
                      <span className="absolute -inset-4 animate-pulse rounded-full bg-amber-300/10" />
                    </>
                  )}
                  <div className="relative grid h-40 w-40 place-items-center overflow-hidden rounded-full bg-gradient-to-b from-[#ff8787] to-[#c92a2a] text-[5.5rem] shadow-[0_0_60px_rgba(255,120,120,0.5)] ring-4 ring-white/80">
                    <span aria-hidden="true">🎅</span>
                  </div>
                </div>
                <h2 className="mt-6 font-display text-4xl font-bold">
                  {tr(T.santa, locale)}
                </h2>
                <p className="mt-1 text-lg text-white/75">
                  📍 {tr(T.from, locale)}
                </p>
                <div
                  className="mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-white/15"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-amber-300 transition-[width] duration-300"
                    style={{ width: `${Math.round(loaded * 100)}%` }}
                  />
                </div>
              </div>
              <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
                <p className="text-center text-xs text-white/60">
                  🎙️ {tr(T.micNote, locale)}
                </p>
                <div className="flex w-full items-end justify-around">
                  <button
                    type="button"
                    onClick={() => (cleanup(), setPhase("pick"))}
                    className="flex flex-col items-center gap-2 text-sm font-semibold text-white/80"
                  >
                    <span
                      className="grid h-16 w-16 place-items-center rounded-full bg-white/15 text-2xl ring-1 ring-white/25"
                      aria-hidden="true"
                    >
                      ⏰
                    </span>
                    {tr(T.later, locale)}
                  </button>
                  <button
                    type="button"
                    onClick={answer}
                    className="flex flex-col items-center gap-2 text-base font-bold"
                    autoFocus
                  >
                    <span
                      className={`grid h-24 w-24 place-items-center rounded-full bg-[#2fb344] text-4xl shadow-[0_0_40px_rgba(47,179,68,0.6)] ring-4 ring-white/30 ${reduced ? "" : "animate-bounce"}`}
                      aria-hidden="true"
                    >
                      📞
                    </span>
                    {tr(T.answer, locale)}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Overlay>

      {phase === "call" && (
        <Overlay>
          <div
            className="fixed inset-0 z-[70] overflow-hidden bg-[#0d0a24] text-white"
            role="dialog"
            aria-label={tr(T.santa, locale)}
          >
            <SantaScene
              mode="call"
              className="absolute inset-0"
              onReady={onSceneReady}
            />

            {/* Top bar */}
            <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/55 to-transparent px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
              <div>
                <p className="font-display text-xl font-bold leading-none">
                  🎅 {tr(T.santa, locale)}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-white/80">
                  <span
                    className="h-2 w-2 rounded-full bg-red-500"
                    aria-hidden="true"
                  />{" "}
                  {tr(T.live, locale)} · {mm}:{ss}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCaptions((v) => !v)}
                aria-pressed={showCaptions}
                className="min-h-12 rounded-full bg-white/15 px-4 text-sm font-bold ring-1 ring-white/25 backdrop-blur"
              >
                CC · {tr(T.captions, locale)}
              </button>
            </div>

            {/* The child's own camera, like a real video call (local only). */}
            <div className="absolute right-3 top-[calc(max(1rem,env(safe-area-inset-top))+4.5rem)] h-36 w-24 overflow-hidden rounded-2xl bg-black/40 shadow-xl ring-2 ring-white/70 sm:h-44 sm:w-32">
              {stream.current?.getVideoTracks().length ? (
                <video
                  ref={(v) => {
                    pip.current = v;
                    if (v && stream.current && v.srcObject !== stream.current) {
                      v.srcObject = stream.current;
                      void v.play().catch(() => {});
                    }
                  }}
                  muted
                  playsInline
                  className="h-full w-full -scale-x-100 object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center p-2 text-center text-[11px] text-white/70">
                  <span>
                    <span className="block text-2xl" aria-hidden="true">
                      🙂
                    </span>
                    {tr(T.pipOff, locale)}
                  </span>
                </div>
              )}
            </div>

            {/* Bottom: captions, turn indicator, controls */}
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16">
              {showCaptions &&
                caption &&
                (mode === "santa" || mode === "ai-think") && (
                  <p
                    className="max-w-2xl rounded-2xl bg-black/55 px-4 py-2.5 text-center text-base font-semibold leading-snug backdrop-blur sm:text-lg"
                    aria-live="polite"
                  >
                    {caption}
                  </p>
                )}
              {(mode === "listen" || mode === "ai-listen") && (
                <div
                  className="flex items-center gap-3 rounded-full bg-[#2fb344]/90 px-5 py-3 font-display text-xl font-bold shadow-lg"
                  aria-live="polite"
                >
                  <span
                    className="relative grid h-10 w-10 place-items-center rounded-full bg-white/25"
                    aria-hidden="true"
                  >
                    <span
                      className="absolute inset-0 rounded-full bg-white/40 transition-transform"
                      style={{ transform: `scale(${1 + level * 0.8})` }}
                    />
                    👂
                  </span>
                  {mode === "listen"
                    ? tr(T.yourTurn, locale)
                    : tr(T.listening, locale)}
                </div>
              )}
              {mode === "ai-prep" && (
                <div className="w-full max-w-sm rounded-2xl bg-white/15 px-5 py-3 text-center text-sm font-bold backdrop-blur" aria-live="polite">
                  ✨ {tr(T.prep, locale)} {Math.round(sttProgress * 100)} %
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
                    <motion.div className="h-full rounded-full bg-amber-300" animate={{ width: `${Math.round(sttProgress * 100)}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
                  </div>
                </div>
              )}
              {mode === "ai-think" && (
                <div className="rounded-full bg-white/15 px-5 py-2 text-sm font-bold backdrop-blur">
                  ✨ {tr(T.thinking, locale)}
                </div>
              )}
              {mode === "ai-ready" && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => aiTalk.current?.()}
                    className="inline-flex min-h-20 items-center gap-3 rounded-full bg-[#2fb344] px-8 font-display text-2xl font-bold shadow-[0_0_40px_rgba(47,179,68,0.55)] ring-4 ring-white/30 active:scale-95"
                  >
                    <span aria-hidden="true">🎙️</span> {tr(T.talk, locale)}
                  </button>
                  <button
                    type="button"
                    onClick={() => aiDone.current?.()}
                    className="min-h-14 rounded-full bg-white/15 px-5 font-bold ring-1 ring-white/30"
                  >
                    👋 {tr(T.goodbye, locale)}
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={hangUp}
                className="grid h-16 w-16 place-items-center rounded-full bg-[#e03131] text-2xl shadow-[0_6px_20px_rgba(224,49,49,0.5)] ring-4 ring-white/20 active:scale-95"
                aria-label={tr(T.hangup, locale)}
              >
                <span aria-hidden="true" className="rotate-[135deg]">
                  📞
                </span>
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {phase === "ended" && (
        <section className="relative mx-auto flex min-h-[80vh] max-w-xl flex-col items-center justify-center px-4 pb-24 pt-28 text-center text-white">
          <motion.div
            initial={reduced ? false : { scale: 0.6, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 14 }}
            className="text-[6rem] leading-none"
            aria-hidden="true"
          >
            🎅
          </motion.div>
          <div className="mt-4 flex items-center gap-3">
            <h2 className="font-display text-4xl font-bold text-balance">
              {tr(T.ended, locale)}
            </h2>
            <SayButton
              texts={[
                tr(T.ended, locale),
                endReason === "preview" ? tr(T.previewEnd, locale) : null,
              ]}
              locale={locale}
              size="md"
              className="shrink-0"
            />
          </div>
          {endReason === "preview" && (
            <p className="mt-4 text-white/85">{tr(T.previewEnd, locale)}</p>
          )}
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => ring(kind, preview)}
              className="inline-flex min-h-16 items-center gap-2 rounded-full bg-[#2fb344] px-7 font-display text-xl font-bold shadow-lg active:scale-95"
            >
              📞 {tr(T.again, locale)}
            </button>
            <button
              type="button"
              onClick={() => setPhase("pick")}
              className="inline-flex min-h-16 items-center gap-2 rounded-full bg-white/15 px-7 font-display text-xl font-bold ring-1 ring-white/30"
            >
              ✨ {tr(T.others, locale)}
            </button>
          </div>
          <Link
            href="/pere-noel/photo"
            className="mt-4 inline-flex min-h-14 items-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-amber-400 px-6 font-display text-lg font-bold text-[#3b1f00] shadow-lg"
          >
            📸 {tr(T.photo, locale)}
          </Link>
          {endReason === "preview" && (
            <Link
              href="/pere-noel/parents"
              className="mt-6 text-sm font-bold text-amber-200 underline underline-offset-4"
            >
              {tr(T.parents, locale)}
            </Link>
          )}
        </section>
      )}
      {child && phase === "pick" && family.children.length > 1 && (
        <div className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 gap-2 rounded-full bg-black/40 p-1.5 backdrop-blur">
          {family.children.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => santaStore.setActive(c.id)}
              className={`min-h-12 rounded-full px-4 font-bold ${c.id === child.id ? "bg-white text-[#1b2150]" : "text-white"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
