'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { tr, type L } from '@/lib/i18n-text';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { SantaGate, gateGraceValid } from '@/components/santa/parents/SantaGate';
import { ElfAvatar } from '@/components/lutins/ElfAvatar';
import bible from '@/data/lutins/bible.json';
import { journal, nextMorning, type JournalEntry } from '@/lib/lutins/journal';
import { CctvPlayer } from '@/components/lutins/CctvPlayer';
import { shareOrSave } from '@/components/santa/booth/share';
import { arCaption, coverFov, coverRect } from '@/games3d/lutins/ar-math';
import type { ARAction, ARSpot, LutinsARHandle } from '@/games3d/lutins/ar';
import type { ElfId } from '@/games3d/lutins/types';

/**
 * "La caméra magique" (parents): the felt elves appear live in the room
 * through the phone's rear camera, standing on the floor. The parent places
 * them (drag, pinch, twist), picks what each one does, then takes a photo or
 * films 6 seconds, adds it to the child's journal and shares it. Unlimited,
 * offline, free: the camera picture never leaves the device (no upload, no
 * server call). Without a camera, a photo from the gallery is the background.
 */

const T = {
  title: { fr: 'La caméra magique', en: 'The magic camera' },
  lead: {
    fr: 'Les lutins apparaissent dans votre maison, en direct, à travers la caméra. Placez-les, prenez une photo ou filmez : votre enfant la découvrira dans le journal des lutins.',
    en: 'The elves appear in your home, live, through the camera. Place them, take a photo or film: your child will find it in the elves’ journal.',
  },
  who: { fr: 'Quels lutins viennent ?', en: 'Which elves are coming?' },
  open: { fr: 'Ouvrir la caméra', en: 'Open the camera' },
  photo: { fr: 'Utiliser une photo', en: 'Use a photo' },
  privacy: {
    fr: '100 % sur votre téléphone : rien n’est envoyé, ni la vidéo de la caméra, ni les photos. Ça marche même sans internet.',
    en: '100% on your phone: nothing is sent, not the camera picture, not the photos. It even works offline.',
  },
  privacyShort: { fr: 'Rien ne quitte votre téléphone', en: 'Nothing leaves your phone' },
  denied: {
    fr: 'La caméra n’est pas disponible (refusée ou absente). Vous pouvez choisir une photo de la pièce : les lutins s’y installeront de la même façon.',
    en: 'The camera is not available (blocked or missing). You can pick a photo of the room instead: the elves will move in just the same.',
  },
  retryCam: { fr: 'Réessayer la caméra', en: 'Try the camera again' },
  starting: { fr: 'Les lutins arrivent…', en: 'The elves are coming…' },
  close: { fr: 'Fermer la caméra', en: 'Close the camera' },
  hint: {
    fr: 'Faites glisser un lutin pour le déplacer. Pincez pour l’agrandir, tournez à deux doigts. Touchez le sol pour y amener le lutin choisi.',
    en: 'Drag an elf to move it. Pinch to resize, twist with two fingers. Tap the floor to bring the chosen elf there.',
  },
  pick: { fr: 'Touchez un lutin pour choisir ce qu’il fait', en: 'Tap an elf to choose what it does' },
  add: { fr: 'Ajouter', en: 'Add' },
  remove: { fr: 'Retirer ce lutin', en: 'Remove this elf' },
  left: { fr: 'Tourner à gauche', en: 'Turn left' },
  right: { fr: 'Tourner à droite', en: 'Turn right' },
  smaller: { fr: 'Plus petit', en: 'Smaller' },
  bigger: { fr: 'Plus grand', en: 'Bigger' },
  floor: { fr: 'Inclinaison du sol', en: 'Floor tilt' },
  sensorsOn: { fr: 'Suivre le téléphone', en: 'Follow the phone' },
  recenter: { fr: 'Ramener les lutins devant', en: 'Bring the elves back in front' },
  shoot: { fr: 'Prendre la photo', en: 'Take the photo' },
  film: { fr: 'Filmer 6 s', en: 'Film 6 s' },
  filming: { fr: 'On filme…', en: 'Filming…' },
  noRecord: { fr: 'Ce navigateur ne sait pas filmer : prenez une photo.', en: 'This browser can’t film: take a photo instead.' },
  failed: { fr: 'Oups, ça n’a pas marché. Réessayez.', en: 'Oops, that didn’t work. Try again.' },
  reviewTitle: { fr: 'Les lutins ont été pris sur le fait !', en: 'The elves were caught in the act!' },
  addMorning: { fr: 'Pour demain matin', en: 'For tomorrow morning' },
  addNow: { fr: 'À montrer tout de suite', en: 'Show right now' },
  added: { fr: 'C’est dans le journal des lutins !', en: 'It’s in the elves’ journal!' },
  openJournal: { fr: 'Ouvrir le journal', en: 'Open the journal' },
  share: { fr: 'Partager ou enregistrer', en: 'Share or save' },
  again: { fr: 'Reprendre', en: 'Take another' },
  otherCaption: { fr: 'Autre légende', en: 'Another caption' },
  back: { fr: 'Retour', en: 'Back' },
  cctv: { fr: 'Version caméra de surveillance', en: 'Security camera version' },
  cctvHelp: {
    fr: 'Comme si une caméra de surveillance avait filmé les lutins cette nuit. Ajoutée au journal avec la photo.',
    en: 'As if a security camera had caught the elves last night. Added to the journal with the photo.',
  },
  room: { fr: 'Quelle pièce ?', en: 'Which room?' },
  cctvMaking: { fr: 'La caméra de surveillance enregistre…', en: 'The security camera is recording…' },
  cctvDone: { fr: 'La vidéo de surveillance est dans le journal !', en: 'The security clip is in the journal!' },
} satisfies Record<string, L>;

const ROOMS: L[] = [
  { fr: 'Salon', en: 'Living room' },
  { fr: 'Cuisine', en: 'Kitchen' },
  { fr: 'Chambre', en: 'Bedroom' },
  { fr: 'Entrée', en: 'Hallway' },
  { fr: 'Sapin', en: 'Tree' },
];

const ACTIONS: { id: ARAction; emoji: string; label: L }[] = [
  { id: 'wave', emoji: '👋', label: { fr: 'Coucou', en: 'Wave' } },
  { id: 'laugh', emoji: '😂', label: { fr: 'Rigole', en: 'Laugh' } },
  { id: 'peek', emoji: '👀', label: { fr: 'Curieux', en: 'Peek' } },
  { id: 'tiptoe', emoji: '🤫', label: { fr: 'Pointe des pieds', en: 'Tiptoe' } },
  { id: 'sit', emoji: '🪑', label: { fr: 'Assis', en: 'Sit' } },
  { id: 'point', emoji: '👉', label: { fr: 'Montre du doigt', en: 'Point' } },
  { id: 'dance', emoji: '💃', label: { fr: 'Danse en rond', en: 'Dance around' } },
  { id: 'hide', emoji: '🙈', label: { fr: 'Cache-cache', en: 'Hide and seek' } },
  { id: 'stand', emoji: '🧍', label: { fr: 'Debout', en: 'Stand' } },
];

const ALL: ElfId[] = ['pepin', 'grelotte', 'noisette'];
const ELVES = bible.elves as { id: ElfId; name: L; color: string; accent: string }[];
const nameOf = (id: ElfId, locale: string) => tr(ELVES.find((e) => e.id === id)?.name ?? { fr: id, en: id }, locale);

type Background = { kind: 'camera'; video: HTMLVideoElement } | { kind: 'photo'; canvas: HTMLCanvasElement; url: string };
type Shot = { kind: 'photo' | 'clip'; blob: Blob; url: string; poster: Blob; spots: ARSpot[]; ext: string };
type Sensors = 'off' | 'waiting' | 'on' | 'unavailable';

type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

const even = (v: number) => Math.max(2, Math.round(v / 2) * 2);

/** Photo file → canvas (≤ 2048 px, orientation applied, EXIF dropped). */
async function fileToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const s = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * s));
  c.height = Math.max(1, Math.round(bmp.height * s));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

function sourceSize(bg: Background): [number, number] {
  return bg.kind === 'camera' ? [bg.video.videoWidth, bg.video.videoHeight] : [bg.canvas.width, bg.canvas.height];
}

export function MagicCamera() {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<ElfId[]>(ALL);
  const [bg, setBg] = useState<Background | null>(null);
  const [camError, setCamError] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ready, setReady] = useState(false);
  const [present, setPresent] = useState<ElfId[]>([]);
  const [actions, setActions] = useState<Partial<Record<ElfId, ARAction>>>({});
  const [picked, setPicked] = useState<ElfId | null>(null);
  const [sensors, setSensors] = useState<Sensors>('off');
  const [pitch, setPitch] = useState(-32);
  const [hint, setHint] = useState(true);
  const [busy, setBusy] = useState<null | 'photo' | 'clip'>(null);
  const [progress, setProgress] = useState(0);
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState<L | null>(null);
  const [shot, setShot] = useState<Shot | null>(null);
  const [caption, setCaption] = useState('');
  const [captionSeed, setCaptionSeed] = useState(0);
  const [added, setAdded] = useState(false);
  const [cctvOn, setCctvOn] = useState(false);
  const [room, setRoom] = useState(0);
  const [cctvState, setCctvState] = useState<null | { p: number } | 'done' | 'failed'>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const handleRef = useRef<LutinsARHandle | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const sensorsRef = useRef<Sensors>('off');
  sensorsRef.current = sensors;
  const bgRef = useRef<Background | null>(null);
  bgRef.current = bg;

  useEffect(() => {
    if (gateGraceValid()) setOpen(true);
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  useEffect(() => stopCamera, [stopCamera]);

  // --- Phone orientation -------------------------------------------------
  const askSensors = useCallback(async () => {
    const Ctor = (typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : null) as OrientationCtor | null;
    if (!Ctor) return setSensors('unavailable');
    try {
      // iOS asks for permission, and only from a tap.
      if (typeof Ctor.requestPermission === 'function' && (await Ctor.requestPermission()) !== 'granted') return setSensors('unavailable');
    } catch {
      return setSensors('unavailable');
    }
    setSensors('waiting');
  }, []);

  useEffect(() => {
    if (sensors !== 'waiting' && sensors !== 'on') return;
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      if (sensorsRef.current === 'waiting') setSensors('on');
      const screenAngle = (typeof screen !== 'undefined' && screen.orientation?.angle) || 0;
      handleRef.current?.setDeviceOrientation({ alpha: e.alpha ?? 0, beta: e.beta, gamma: e.gamma, screen: screenAngle });
    };
    window.addEventListener('deviceorientation', onOrient);
    // No reading within 1.5 s (a computer, a blocked sensor): the slider stays.
    const t = sensors === 'waiting' ? setTimeout(() => sensorsRef.current === 'waiting' && setSensors('unavailable'), 1500) : undefined;
    return () => {
      window.removeEventListener('deviceorientation', onOrient);
      clearTimeout(t);
    };
  }, [sensors]);

  const toggleSensors = () => {
    if (sensors === 'on' || sensors === 'waiting') {
      setSensors('off');
      handleRef.current?.setDeviceOrientation(null);
      handleRef.current?.setPitch(pitch);
    } else void askSensors();
  };

  // --- Backgrounds --------------------------------------------------------
  const startCamera = useCallback(async () => {
    setCamError(false);
    setStarting(true);
    void askSensors();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      streamRef.current = stream;
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      if (!video.videoWidth) await new Promise<void>((r) => video.addEventListener('loadedmetadata', () => r(), { once: true }));
      setBg({ kind: 'camera', video });
    } catch {
      stopCamera();
      setCamError(true);
    } finally {
      setStarting(false);
    }
  }, [askSensors, stopCamera]);

  const onPhoto = useCallback(async (file: File | undefined) => {
    if (!file) return;
    try {
      const canvas = await fileToCanvas(file);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
      if (!blob) throw new Error('encode');
      stopCamera();
      setBg({ kind: 'photo', canvas, url: URL.createObjectURL(blob) });
      setCamError(false);
    } catch {
      setError(T.failed);
    }
  }, [stopCamera]);

  useEffect(() => () => {
    if (bg?.kind === 'photo') URL.revokeObjectURL(bg.url);
  }, [bg]);

  // The camera <video> is created in startCamera; show it in the stage.
  useEffect(() => {
    if (bg?.kind !== 'camera' || !videoRef.current) return;
    videoRef.current.srcObject = bg.video.srcObject;
    void videoRef.current.play().catch(() => undefined);
    // The visible <video> is the one drawn into photos (a detached one may stop updating on Safari).
    bg.video.pause();
  }, [bg]);

  const closeLive = () => {
    stopCamera();
    setSensors('off');
    setBg(null);
    setShot(null);
  };

  // --- The 3D elves ------------------------------------------------------
  const live = Boolean(bg);
  const chosenKey = chosen.join(',');
  useEffect(() => {
    if (!live || !canvasRef.current) return;
    let alive = true;
    let handle: LutinsARHandle | null = null;
    setReady(false);
    (async () => {
      try {
        const { mountLutinsAR } = await import('@/games3d/lutins/ar');
        if (!alive || !canvasRef.current) return;
        const box = canvasRef.current.getBoundingClientRect();
        const [sw, sh] = bgRef.current ? sourceSize(bgRef.current) : [0, 0];
        const fov = coverFov(sw, sh, box.width, box.height);
        handle = mountLutinsAR(canvasRef.current, { elves: chosenKey.split(',') as ElfId[], reducedMotion: reduced, onSelect: setPicked, fov });
        handleRef.current = handle;
        handle.setPitch(pitch);
        const list = handle.list();
        setPresent(list.map((e) => e.id));
        setActions(Object.fromEntries(list.map((e) => [e.id, e.action])));
        requestAnimationFrame(() => alive && setReady(true));
      } catch {
        if (alive) setError(T.failed);
      }
    })();
    return () => {
      alive = false;
      handle?.dispose();
      handleRef.current = null;
      setPicked(null);
    };
    // The pitch is applied separately; remount only for a new background or new elves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, chosenKey, reduced]);

  useEffect(() => {
    if (sensors !== 'on') handleRef.current?.setPitch(pitch);
  }, [pitch, sensors, ready]);

  // Field of view follows the picture's crop.
  useEffect(() => {
    if (!bg || !ready) return;
    const fit = () => {
      const box = stageRef.current?.getBoundingClientRect();
      const [w, h] = sourceSize(bg);
      if (box && w && h) handleRef.current?.setFov(coverFov(w, h, box.width, box.height));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (stageRef.current) ro.observe(stageRef.current);
    const v = bg.kind === 'camera' ? bg.video : null;
    v?.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      v?.removeEventListener('resize', fit);
    };
  }, [bg, ready]);

  // Light: the picture's average colour, once a second (once for a photo).
  useEffect(() => {
    if (!bg || !ready) return;
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const sample = () => {
      if (document.hidden) return;
      const src = bg.kind === 'camera' ? (videoRef.current ?? bg.video) : bg.canvas;
      if (src instanceof HTMLVideoElement && src.readyState < 2) return;
      ctx.drawImage(src, 0, 0, 16, 16);
      const d = ctx.getImageData(0, 0, 16, 16).data;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
      }
      const n = d.length / 4;
      handleRef.current?.setLight(r / n, g / n, b / n);
    };
    sample();
    if (bg.kind === 'photo') return;
    const t = setInterval(sample, 1000);
    return () => clearInterval(t);
  }, [bg, ready]);

  // A gallery photo: stand the elves on the best free surface the Rust engine finds in it (floor, table…).
  useEffect(() => {
    if (!ready || bg?.kind !== 'photo') return;
    let alive = true;
    void import('@/lib/lutins/client-engine')
      .then(({ analyzePhoto }) => analyzePhoto(bg.canvas))
      .then((scene) => {
        const st = scene.stages?.[0];
        const box = stageRef.current?.getBoundingClientRect();
        if (!alive || !st || !box) return;
        const r = coverRect(bg.canvas.width, bg.canvas.height, box.width, box.height);
        const px = ((st.x + st.w / 2) * bg.canvas.width - r.sx) / r.sw;
        const py = ((st.y + st.h * 0.75) * bg.canvas.height - r.sy) / r.sh;
        // Stay clear of the controls at the bottom; the floor slider fine-tunes the rest.
        handleRef.current?.placeGroupAt(px * 2 - 1, Math.max(-0.3, 1 - py * 2));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [bg, ready]);

  useEffect(() => {
    if (!ready) return;
    setHint(true);
    const t = setTimeout(() => setHint(false), 7000);
    return () => clearTimeout(t);
  }, [ready]);

  // --- Elf controls -------------------------------------------------------
  const toggleElf = (id: ElfId) => {
    const h = handleRef.current;
    if (!h) return;
    if (present.includes(id)) {
      h.select(picked === id ? null : id);
    } else {
      h.add(id);
      setPresent(h.list().map((e) => e.id));
      setActions(Object.fromEntries(h.list().map((e) => [e.id, e.action])));
      h.select(id);
    }
  };
  const removePicked = () => {
    const h = handleRef.current;
    if (!h || !picked) return;
    h.remove(picked);
    setPresent(h.list().map((e) => e.id));
  };
  const setAction = (a: ARAction) => {
    if (!picked) return;
    handleRef.current?.setAction(picked, a);
    setActions((cur) => ({ ...cur, [picked]: a }));
  };

  // --- Capture ------------------------------------------------------------
  const compose = useCallback(
    (out: HTMLCanvasElement, hiRes: boolean) => {
      const h = handleRef.current;
      if (!h || !bg) return;
      const ctx = out.getContext('2d')!;
      const [sw, sh] = sourceSize(bg);
      const src = bg.kind === 'camera' ? (videoRef.current ?? bg.video) : bg.canvas;
      const r = coverRect(sw, sh, out.width, out.height);
      ctx.drawImage(src, r.sx, r.sy, r.sw, r.sh, 0, 0, out.width, out.height);
      h.drawTo(ctx, out.width, out.height, { hiRes });
    },
    [bg],
  );

  const outCanvas = (longSide: number) => {
    const box = stageRef.current!.getBoundingClientRect();
    const s = longSide / Math.max(box.width, box.height);
    const c = document.createElement('canvas');
    c.width = even(box.width * s);
    c.height = even(box.height * s);
    return c;
  };

  const newCaption = useCallback((ids: ElfId[], seed: number) => arCaption(ids.map((id) => nameOf(id, locale)), locale, seed), [locale]);

  const finish = (s: Shot) => {
    const seed = Math.floor(Math.random() * 1000);
    setCaptionSeed(seed);
    setCaption(newCaption(present, seed));
    setAdded(false);
    setCctvOn(false);
    setCctvState(null);
    setShot(s);
  };

  const takePhoto = async () => {
    if (busy || !handleRef.current || !stageRef.current) return;
    setBusy('photo');
    setError(null);
    if (!reduced) {
      setFlash(true);
      setTimeout(() => setFlash(false), 220);
    }
    try {
      const long = Math.min(1600, Math.round(Math.max(window.innerWidth, window.innerHeight) * Math.min(2, window.devicePixelRatio || 1)));
      const out = outCanvas(Math.max(960, long));
      compose(out, true);
      const spots = handleRef.current.spots();
      const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/jpeg', 0.9));
      if (!blob) throw new Error('encode');
      finish({ kind: 'photo', blob, url: URL.createObjectURL(blob), poster: blob, spots, ext: 'jpg' });
    } catch {
      setError(T.failed);
    } finally {
      setBusy(null);
    }
  };

  const film = async () => {
    if (busy || !handleRef.current || !stageRef.current) return;
    const { recordCanvas, canRecordVideo } = await import('@/components/santa/booth/record');
    if (!canRecordVideo()) return setError(T.noRecord);
    setBusy('clip');
    setProgress(0);
    setError(null);
    try {
      const low = (navigator.hardwareConcurrency ?? 4) <= 4;
      const out = outCanvas(low ? 960 : 1280);
      const clip = await recordCanvas(out, { seconds: 6, fps: 30, draw: () => compose(out, false), onProgress: setProgress });
      const spots = handleRef.current?.spots() ?? [];
      const poster = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/jpeg', 0.88));
      if (!poster) throw new Error('encode');
      finish({ kind: 'clip', blob: clip.blob, url: URL.createObjectURL(clip.blob), poster, spots, ext: clip.ext });
    } catch {
      setError(T.failed);
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => () => {
    if (shot) URL.revokeObjectURL(shot.url);
  }, [shot]);

  /** The journal entry this shot becomes (also what the security-camera preview shows). */
  const draft = useMemo<JournalEntry | null>(() => {
    if (!shot) return null;
    const now = new Date();
    return {
      id: Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join(''),
      createdAt: now.toISOString(),
      revealAt: nextMorning(now).toISOString(),
      caption: '',
      prankId: null,
      elves: present,
      image: shot.poster,
      video: shot.kind === 'clip' ? shot.blob : null,
      spots: shot.spots,
    };
    // A new draft per shot only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot]);

  const addToJournal = async (when: 'morning' | 'now') => {
    if (!shot || !draft) return;
    const entry: JournalEntry = { ...draft, caption, revealAt: (when === 'now' ? new Date() : nextMorning()).toISOString() };
    await journal.put(entry);
    setAdded(true);
    if (!cctvOn) return;
    // The "caught on camera" clip is recorded on the device, then stored on the entry.
    setCctvState({ p: 0 });
    try {
      const { makeCctvClip } = await import('@/lib/lutins/cctv');
      await makeCctvClip(entry, { room: tr(ROOMS[room], locale), locale, onProgress: (p) => setCctvState({ p }) });
      setCctvState('done');
    } catch {
      setCctvState('failed');
    }
  };

  // --- Render -------------------------------------------------------------
  if (!open) {
    return (
      <div className="mx-auto max-w-xl px-4 pb-24 pt-28">
        <h1 className="mb-6 text-center font-display text-4xl font-bold text-white">{tr(T.title, locale)}</h1>
        <SantaGate onPass={() => setOpen(true)} backHref="/lutins" />
      </div>
    );
  }

  if (!bg) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-28 pt-24 text-white sm:px-6 sm:pt-28">
        <header className="text-center">
          <h1 className="font-display text-4xl font-bold text-balance drop-shadow-[0_3px_0_rgba(0,0,0,0.25)] sm:text-5xl">📷 {tr(T.title, locale)}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-white/85">{tr(T.lead, locale)}</p>
        </header>
        <h2 className="mt-10 text-center font-display text-2xl font-bold">{tr(T.who, locale)}</h2>
        <ul className="mx-auto mt-5 grid max-w-xl grid-cols-3 gap-3 sm:gap-5">
          {ELVES.map((e) => {
            const on = chosen.includes(e.id);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setChosen((cur) => (on ? (cur.length > 1 ? cur.filter((x) => x !== e.id) : cur) : ALL.filter((x) => x === e.id || cur.includes(x))))}
                  className={`flex w-full flex-col items-center rounded-[1.5rem] p-3 transition-transform active:scale-95 ${on ? 'bg-white text-[#1b2150] shadow-[0_8px_0_rgba(0,0,0,0.2)]' : 'bg-white/10 text-white ring-1 ring-white/20'}`}
                >
                  <span className="relative block aspect-square w-full overflow-hidden rounded-2xl" style={{ background: `radial-gradient(circle at 50% 35%, ${e.accent}55, ${e.color}33)` }}>
                    <ElfAvatar id={e.id} className="h-full w-full object-contain" />
                    {on && <span className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-[#2fb344] text-white">✓</span>}
                  </span>
                  <span className="mt-2 font-display text-xl font-bold">{tr(e.name, locale)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {camError && <p className="mx-auto mt-6 max-w-xl rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-[#3b1f00]">{tr(T.denied, locale)}</p>}
        {error && <p className="mx-auto mt-4 max-w-xl rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-[#3b1f00]">{tr(error, locale)}</p>}
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0])} />
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button type="button" onClick={() => void startCamera()} disabled={starting} className="min-h-16 w-full rounded-full bg-gradient-to-r from-[#c92a2a] to-[#f03e3e] px-8 font-display text-xl font-bold shadow-[0_8px_0_#8a1c1c] transition-transform active:scale-95 disabled:opacity-60 sm:w-auto">
            📷 {tr(camError ? T.retryCam : T.open, locale)}
          </button>
          <button type="button" onClick={() => galleryRef.current?.click()} className="min-h-16 w-full rounded-full bg-white/15 px-7 font-display text-lg font-bold ring-1 ring-white/30 transition-transform active:scale-95 sm:w-auto">
            🖼️ {tr(T.photo, locale)}
          </button>
        </div>
        <p className="mx-auto mt-6 max-w-xl rounded-2xl bg-[#11231a]/80 px-4 py-3 text-center text-sm font-semibold text-[#9ff5b8] ring-1 ring-[#5cf08a]/30">🔒 {tr(T.privacy, locale)}</p>
        <div className="mt-8 text-center">
          <Link href="/lutins" className="inline-flex min-h-12 items-center rounded-full px-5 font-bold text-white/80">
            ← {tr(T.back, locale)}
          </Link>
        </div>
      </div>
    );
  }

  const pickedAction = picked ? actions[picked] : undefined;

  // Full screen above the site's header and backdrop (the backdrop is its own stacking context).
  return createPortal(
    <div className="fixed inset-0 z-[90] overflow-hidden bg-black text-white" role="dialog" aria-modal="true" aria-label={tr(T.title, locale)}>
      <div ref={stageRef} className="absolute inset-0">
        {bg.kind === 'camera' ? (
          <video ref={videoRef} muted playsInline autoPlay className="absolute inset-0 h-full w-full object-cover" aria-hidden="true" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bg.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <canvas
          ref={canvasRef}
          data-testid="magic-camera-canvas"
          className={`absolute inset-0 block h-full w-full touch-none transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`}
          onPointerDown={() => setHint(false)}
        />
        {!ready && <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-display text-2xl font-bold drop-shadow">{tr(T.starting, locale)}</p>}
        {flash && <div className="pointer-events-none absolute inset-0 bg-white/80" />}
      </div>

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/60 to-transparent p-3 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={closeLive} aria-label={tr(T.close, locale)} className="pointer-events-auto grid h-14 w-14 shrink-0 place-items-center rounded-full bg-black/45 text-2xl ring-1 ring-white/25 backdrop-blur">
          ✕
        </button>
        <p className="mt-2 min-w-0 truncate rounded-full bg-[#11231a]/80 px-3 py-1.5 text-xs font-bold text-[#9ff5b8] ring-1 ring-[#5cf08a]/30 backdrop-blur">🔒 {tr(T.privacyShort, locale)}</p>
        <div className="pointer-events-auto flex shrink-0 gap-2">
          {bg.kind === 'camera' && sensors !== 'unavailable' && (
            <button type="button" onClick={toggleSensors} aria-pressed={sensors === 'on'} aria-label={tr(T.sensorsOn, locale)} title={tr(T.sensorsOn, locale)} className={`grid h-14 w-14 place-items-center rounded-full text-2xl ring-1 backdrop-blur ${sensors === 'on' ? 'bg-[#5cf08a] text-[#08210f] ring-white/40' : 'bg-black/45 ring-white/25'}`}>
              📱
            </button>
          )}
          <button type="button" onClick={() => handleRef.current?.recenter()} aria-label={tr(T.recenter, locale)} title={tr(T.recenter, locale)} className="grid h-14 w-14 place-items-center rounded-full bg-black/45 text-2xl ring-1 ring-white/25 backdrop-blur">
            🎯
          </button>
        </div>
      </div>

      {hint && ready && (
        <p className="pointer-events-none absolute inset-x-4 top-20 mx-auto max-w-md rounded-2xl bg-black/55 px-4 py-3 text-center text-sm font-semibold backdrop-blur">{tr(T.hint, locale)}</p>
      )}

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/55 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10">
        <div className="mx-auto flex max-w-2xl flex-col gap-2.5">
          {error && <p className="rounded-2xl bg-amber-300 px-4 py-2 text-center text-sm font-semibold text-[#3b1f00]">{tr(error, locale)}</p>}

          {/* The elves: pick one, or add one who is missing. */}
          <div className="flex items-center justify-center gap-3">
            {ALL.map((id) => {
              const here = present.includes(id);
              const on = picked === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleElf(id)}
                  aria-pressed={on}
                  aria-label={here ? nameOf(id, locale) : `${tr(T.add, locale)} ${nameOf(id, locale)}`}
                  className={`relative h-16 w-16 overflow-hidden rounded-full bg-white/15 ring-2 transition-transform active:scale-95 ${on ? 'scale-110 ring-[#ffd43b] ring-4' : here ? 'ring-white/60' : 'opacity-60 ring-white/20'}`}
                >
                  <ElfAvatar id={id} className="h-full w-full object-cover" />
                  {!here && <span className="absolute inset-0 grid place-items-center bg-black/45 text-3xl font-bold">+</span>}
                </button>
              );
            })}
          </div>

          {picked ? (
            <>
              <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label={nameOf(picked, locale)}>
                {ACTIONS.map((a) => (
                  <button key={a.id} type="button" onClick={() => setAction(a.id)} aria-pressed={pickedAction === a.id} className={`flex min-h-14 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold ${pickedAction === a.id ? 'bg-[#ffd43b] text-[#3b1f00]' : 'bg-white/15 ring-1 ring-white/25'}`}>
                    <span aria-hidden="true" className="text-xl">
                      {a.emoji}
                    </span>
                    {tr(a.label, locale)}
                  </button>
                ))}
              </div>
              <div className="flex justify-center gap-2">
                {(
                  [
                    ['⟲', T.left, () => handleRef.current?.rotate(picked, 0.4)],
                    ['⟳', T.right, () => handleRef.current?.rotate(picked, -0.4)],
                    ['−', T.smaller, () => handleRef.current?.scaleBy(picked, 1 / 1.2)],
                    ['+', T.bigger, () => handleRef.current?.scaleBy(picked, 1.2)],
                  ] as const
                ).map(([icon, label, fn]) => (
                  <button key={icon} type="button" onClick={fn} aria-label={tr(label, locale)} title={tr(label, locale)} className="grid h-14 w-14 place-items-center rounded-full bg-white/15 text-2xl font-bold ring-1 ring-white/25 active:scale-95">
                    {icon}
                  </button>
                ))}
                <button type="button" onClick={removePicked} aria-label={tr(T.remove, locale)} title={tr(T.remove, locale)} className="grid h-14 w-14 place-items-center rounded-full bg-white/15 text-xl ring-1 ring-white/25 active:scale-95">
                  🗑️
                </button>
              </div>
            </>
          ) : (
            <p className="text-center text-sm font-semibold text-white/80">{tr(T.pick, locale)}</p>
          )}

          {sensors !== 'on' && (
            <label className="flex items-center gap-3 px-2 text-sm font-bold">
              <span className="shrink-0">{tr(T.floor, locale)}</span>
              <input type="range" min={-80} max={0} step={1} value={pitch} onChange={(e) => setPitch(Number(e.target.value))} className="h-10 w-full accent-[#ffd43b]" />
            </label>
          )}

          {/* Shutter */}
          <div className="flex items-center justify-center gap-6 pt-1">
            <button type="button" onClick={() => void film()} disabled={!!busy || !ready} className="min-h-14 min-w-28 rounded-full bg-white/15 px-4 font-display text-base font-bold ring-1 ring-white/30 disabled:opacity-50">
              {busy === 'clip' ? `${tr(T.filming, locale)} ${Math.ceil(6 - progress * 6)}` : `🎬 ${tr(T.film, locale)}`}
            </button>
            <button type="button" onClick={() => void takePhoto()} disabled={!!busy || !ready} aria-label={tr(T.shoot, locale)} className="grid h-20 w-20 place-items-center rounded-full bg-white/25 ring-4 ring-white disabled:opacity-50">
              <span className={`block h-16 w-16 rounded-full ${busy === 'clip' ? 'bg-[#f03e3e]' : 'bg-white'}`} />
            </button>
            <span className="min-w-28" aria-hidden="true" />
          </div>
          {busy === 'clip' && (
            <div className="mx-auto h-1.5 w-56 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-[#f03e3e]" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
        </div>
      </div>

      {/* Review */}
      {shot && (
        <div className="absolute inset-0 z-10 overflow-y-auto bg-[#0b0a26]/95 backdrop-blur" role="dialog" aria-label={tr(T.reviewTitle, locale)}>
          <div className="flex min-h-full flex-col items-center justify-center gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
          <h2 className="text-center font-display text-2xl font-bold sm:text-3xl">🎉 {tr(T.reviewTitle, locale)}</h2>
          {cctvOn && draft ? (
            <CctvPlayer key={`${draft.id}-${room}`} entry={draft} room={tr(ROOMS[room], locale)} locale={locale} className="max-w-md" />
          ) : (
            <div className="w-full max-w-md shrink-0 overflow-hidden rounded-[1.5rem] shadow-2xl ring-1 ring-white/20">
              {shot.kind === 'clip' ? (
                <video src={shot.url} autoPlay={!reduced} controls loop muted playsInline className="block max-h-[52vh] w-full bg-black object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shot.url} alt={caption} className="block max-h-[52vh] w-full object-contain" />
              )}
            </div>
          )}
          {!added && (
            <div className="flex w-full max-w-md flex-col items-center gap-2">
              <button type="button" aria-pressed={cctvOn} onClick={() => setCctvOn((v) => !v)} className={`min-h-14 w-full rounded-full px-5 font-bold ring-1 ${cctvOn ? 'bg-[#5cf08a] text-[#08210f] ring-white/40' : 'bg-[#11231a] text-[#9ff5b8] ring-[#5cf08a]/40'}`}>
                📹 {tr(T.cctv, locale)} {cctvOn ? '✓' : ''}
              </button>
              {cctvOn && (
                <>
                  <p className="text-center text-xs text-white/70">{tr(T.cctvHelp, locale)}</p>
                  <div className="flex flex-wrap justify-center gap-2" role="group" aria-label={tr(T.room, locale)}>
                    {ROOMS.map((r, i) => (
                      <button key={r.fr} type="button" aria-pressed={room === i} onClick={() => setRoom(i)} className={`min-h-12 rounded-full px-4 text-sm font-bold ${room === i ? 'bg-white text-[#1b2150]' : 'bg-white/10 ring-1 ring-white/25'}`}>
                        {tr(r, locale)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="flex max-w-md items-center gap-2">
            <p className="text-center font-display text-lg font-bold">« {caption} »</p>
            <button type="button" onClick={() => (setCaptionSeed(captionSeed + 1), setCaption(newCaption(present, captionSeed + 1)))} aria-label={tr(T.otherCaption, locale)} title={tr(T.otherCaption, locale)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/10 text-xl ring-1 ring-white/25">
              🔀
            </button>
          </div>
          {added ? (
            <div className="flex flex-col items-center gap-3">
              <p className="rounded-full bg-[#2fb344] px-5 py-2 font-bold">✓ {tr(T.added, locale)}</p>
              {cctvState && cctvState !== 'failed' && (
                <p className="text-center text-sm font-bold text-[#9ff5b8]" aria-live="polite">
                  📹 {cctvState === 'done' ? tr(T.cctvDone, locale) : `${tr(T.cctvMaking, locale)} ${Math.round(cctvState.p * 100)} %`}
                </p>
              )}
              {cctvState === 'failed' && <p className="text-center text-sm font-bold text-amber-300">{tr(T.noRecord, locale)}</p>}
              <Link href="/lutins/journal" className="min-h-14 rounded-full bg-white px-6 py-4 font-display text-lg font-bold text-[#1b2150]">
                📖 {tr(T.openJournal, locale)}
              </Link>
            </div>
          ) : (
            <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => void addToJournal('morning')} className="min-h-16 flex-1 rounded-full bg-gradient-to-r from-[#c92a2a] to-[#f03e3e] px-5 font-display text-lg font-bold shadow-lg">
                🌅 {tr(T.addMorning, locale)}
              </button>
              <button type="button" onClick={() => void addToJournal('now')} className="min-h-16 flex-1 rounded-full bg-white/15 px-5 font-display text-lg font-bold ring-1 ring-white/30">
                👀 {tr(T.addNow, locale)}
              </button>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => void shareOrSave(shot.blob, `lutins-farceurs.${shot.ext}`, tr(T.reviewTitle, locale))} className="min-h-14 rounded-full bg-white/10 px-5 font-bold ring-1 ring-white/25">
              ⬇️ {tr(T.share, locale)}
            </button>
            <button type="button" onClick={() => setShot(null)} className="min-h-14 rounded-full bg-white/10 px-5 font-bold ring-1 ring-white/25">
              📷 {tr(T.again, locale)}
            </button>
          </div>
          <p className="max-w-md text-center text-xs text-white/60">🔒 {tr(T.privacy, locale)}</p>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
