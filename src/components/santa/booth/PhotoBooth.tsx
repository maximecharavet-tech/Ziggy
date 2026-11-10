'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from '@/i18n/navigation';
import { tr } from '@/lib/i18n-text';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { SayButton, useAutoSay } from '@/components/arcade/read-aloud';
import { activeChild, cleanName, useSantaFamily } from '@/lib/santa/store';
import { useSantaPass } from '@/lib/santa/pass-client';
import type { BoothSceneId, SantaSceneHandle } from '@/lib/santa/types';
import { BACKDROP_SIZE, BoothBackdrop } from './Backdrop';
import { REF, displayFontFamily, drawComposite, makeCanvas, makeSnow, makeSparkles, prepareCutout, renderFrame, type Cutout } from './compose';
import { ding, scheduleJingle } from './jingle';
import { applyAdjust, boothOutput, christmasYear, clampAdjust, coverTransform, fitInSlot, mapRect, NO_ADJUST, pinchAdjust, sanitizeSlot, VIDEO_SECONDS, VIDEO_SIZE, type Adjust, type Rect } from './layout';
import { alphaToRGBA, maskBox, ovalMask, quickMatte, refineMask } from './matte';
import { canRecordVideo, recordCanvas, type Clip } from './record';
import { prefetchQualityModel, segmentFrame, segmentStill, warmSegmenter } from './segmenter';
import { shareOrSave } from './share';
import { SCENES, T, photoTitle } from './text';

/**
 * "Photo avec le Père Noël": the child picks a scene, takes a selfie (or picks
 * a photo), is cut out ON THE DEVICE (MediaPipe) and placed next to Santa,
 * adjusts with a finger, then gets a framed PNG — and, with a pass, a 6 s clip
 * with snow, music and Santa waving. Nothing about the picture leaves the
 * device: no upload, no third-party request (see segmenter.ts).
 */
export type PhotoBoothProps = {
  /** Scene selected at first (default: the fireplace). */
  initialScene?: BoothSceneId;
  /** Name written on the photo (default: the active child of the device store). */
  childName?: string;
  /** Grown-up page with the offer (behind the grown-up gate). */
  parentsHref?: string;
  className?: string;
};

type Step = 'scene' | 'camera' | 'working' | 'adjust' | 'result';
type Cam = 'idle' | 'asking' | 'live' | 'off';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function grabFrame(v: HTMLVideoElement, mirror: boolean, maxSide = 1600): HTMLCanvasElement {
  const k = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight));
  const c = makeCanvas(v.videoWidth * k, v.videoHeight * k);
  const x = c.getContext('2d')!;
  if (mirror) {
    x.translate(c.width, 0);
    x.scale(-1, 1);
  }
  x.drawImage(v, 0, 0, c.width, c.height);
  return c;
}

function downscale(src: HTMLCanvasElement, maxSide: number): HTMLCanvasElement {
  const k = Math.min(1, maxSide / Math.max(src.width, src.height));
  if (k === 1) return src;
  const c = makeCanvas(src.width * k, src.height * k);
  const x = c.getContext('2d')!;
  x.imageSmoothingQuality = 'high';
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

async function fileToCanvas(file: File, maxSide = 1600): Promise<HTMLCanvasElement> {
  let source: CanvasImageSource & { width: number; height: number };
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      source = img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const k = Math.min(1, maxSide / Math.max(source.width, source.height));
  const c = makeCanvas(source.width * k, source.height * k);
  const x = c.getContext('2d')!;
  x.imageSmoothingQuality = 'high';
  x.drawImage(source, 0, 0, c.width, c.height);
  if ('close' in source && typeof source.close === 'function') source.close();
  return c;
}

let audioCtx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === 'closed') audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

export function PhotoBooth({ initialScene = 'cheminee', childName, parentsHref = '/pere-noel/parents', className = '' }: PhotoBoothProps) {
  const locale = useLocale();
  const t = (l: { fr: string; en: string }) => tr(l, locale);
  const reduce = useReducedMotion();
  const family = useSantaFamily();
  const pass = useSantaPass();

  const [step, setStep] = useState<Step>('scene');
  const [scene, setScene] = useState<BoothSceneId>(initialScene);
  const [cam, setCam] = useState<Cam>('idle');
  const [camError, setCamError] = useState<'denied' | 'none'>('denied');
  const [liveOn, setLiveOn] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [ovalTip, setOvalTip] = useState(false);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [clip, setClip] = useState<(Clip & { url: string }) | null>(null);
  const [recording, setRecording] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [stageW, setStageW] = useState(0);
  const [videoOk, setVideoOk] = useState(true);
  const [busy, setBusy] = useState(false);
  /** For end-to-end checks: which model ran, how much of the picture is the child, how long it took. */
  const [segInfo, setSegInfo] = useState('');

  const stageRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recHostRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const nativeCamRef = useRef<HTMLInputElement>(null);
  const handleRef = useRef<SantaSceneHandle | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hadCamera = useRef(false);
  const stillRef = useRef<{ still: HTMLCanvasElement; alpha: Float32Array; mw: number; mh: number; oval: boolean } | null>(null);
  const cutoutRef = useRef<Cutout | null>(null);
  const adjustRef = useRef<Adjust>(NO_ADJUST);
  const liveRef = useRef<{ canvas: HTMLCanvasElement; rect: Rect } | null>(null);
  const snowRef = useRef({ flakes: makeSnow(42, 110), sparkles: makeSparkles(7, 16) });
  const frameCache = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);
  const fontRef = useRef('ui-rounded, system-ui, sans-serif');
  const [fontV, setFontV] = useState(0);

  const tier = pass.tier;
  const out = boothOutput(tier);
  const finalName = cleanName(name);
  const title = photoTitle(finalName, locale);
  const subtitle = `${t(T.christmas)} ${christmasYear()} · ziggy-ai.fr`;

  // Live values for the animation loop (no re-render per frame)
  const live = useRef({ step, cam, liveOn, reduce, title, subtitle, watermark: out.watermark, fontV });
  live.current = { step, cam, liveOn, reduce, title, subtitle, watermark: out.watermark, fontV };

  // Name: from the props, else the active child on this device (until the user types).
  const storeName = childName ?? activeChild(family)?.name ?? '';
  useEffect(() => {
    if (!nameTouched) setName(storeName);
  }, [storeName, nameTouched]);

  // Font for the canvas text (Fredoka, via next/font)
  useEffect(() => {
    fontRef.current = displayFontFamily();
    let alive = true;
    document.fonts
      ?.load(`700 40px ${fontRef.current}`)
      .catch(() => undefined)
      .then(() => alive && setFontV((v) => v + 1));
    return () => {
      alive = false;
    };
  }, []);

  // Stage size → backdrop scale
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageW(el.clientWidth));
    ro.observe(el);
    setStageW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const showToast = useCallback((s: string) => {
    setToast(s);
    setTimeout(() => setToast((cur) => (cur === s ? null : cur)), 2200);
  }, []);

  /** The slot, in REF units (800 × 1000 photo). */
  const slotRef = useCallback((): Rect => {
    const h = handleRef.current;
    const cw = h?.canvas.width || BACKDROP_SIZE.w;
    const ch = h?.canvas.height || BACKDROP_SIZE.h;
    const slot = sanitizeSlot(h?.getSlot(), { w: cw, h: ch });
    return mapRect(slot, coverTransform({ w: cw, h: ch }, REF));
  }, []);

  const baseRect = useCallback((): Rect | null => {
    const c = cutoutRef.current;
    if (!c) return null;
    return fitInSlot(c.person, slotRef(), REF);
  }, [slotRef]);

  const currentRect = useCallback((): Rect | null => {
    const b = baseRect();
    return b ? applyAdjust(b, adjustRef.current) : null;
  }, [baseRect]);

  const frameFor = useCallback((W: number, H: number, watermark: boolean, cache = true): HTMLCanvasElement => {
    const L = live.current;
    const key = `${W}x${H}|${L.title}|${L.subtitle}|${watermark}|${L.fontV}`;
    if (cache && frameCache.current?.key === key) return frameCache.current.canvas;
    const canvas = renderFrame(W, H, { title: L.title, subtitle: L.subtitle, watermark: watermark ? tr(T.watermark, locale) : null, font: fontRef.current });
    if (cache) frameCache.current = { key, canvas };
    return canvas;
  }, [locale]);

  const backdrop = () => {
    const h = handleRef.current;
    return h ? { canvas: h.canvas, w: h.canvas.width, h: h.canvas.height } : null;
  };

  // ——— the preview loop ———
  useEffect(() => {
    let raf = 0;
    const frozenT = 2.2;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const cv = previewRef.current;
      const L = live.current;
      if (!cv) return;
      if (L.step === 'result') return;
      if (L.step === 'camera' && L.cam === 'live' && !L.liveOn) return; // the camera video is shown
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(cv.clientWidth * dpr);
      const H = Math.round(cv.clientHeight * dpr);
      if (W < 10 || H < 10) return;
      if (cv.width !== W || cv.height !== H) {
        cv.width = W;
        cv.height = H;
      }
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      const showChild = L.step === 'adjust' || L.step === 'working';
      const liveCut = L.step === 'camera' && L.liveOn ? liveRef.current : null;
      drawComposite(ctx, W, H, {
        backdrop: backdrop(),
        cutout: showChild ? cutoutRef.current : null,
        rect: showChild ? currentRect() : null,
        live: liveCut,
        flakes: snowRef.current.flakes,
        sparkles: snowRef.current.sparkles,
        frame: frameFor(W, H, L.watermark),
        t: L.reduce ? frozenT : now / 1000,
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [currentRect, frameFor]);

  // ——— camera ———
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    liveRef.current = null;
    setLiveOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = async () => {
    void warmSegmenter('fast', 'VIDEO');
    audio();
    setCam('asking');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no camera'), { name: 'NotFoundError' });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => undefined);
      }
      hadCamera.current = true;
      setCam('live');
    } catch (e) {
      const n = (e as DOMException)?.name;
      setCamError(n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'NotReadableError' ? 'none' : 'denied');
      setCam('off');
    }
  };

  // Live cut-out preview (throttled; switched off when the device is too slow)
  useEffect(() => {
    if (step !== 'camera' || cam !== 'live') return;
    let stop = false;
    const small = makeCanvas(320, 240);
    const frameC = makeCanvas(480, 360);
    const maskC = makeCanvas(1, 1);
    const times: number[] = [];
    (async () => {
      while (!stop) {
        const v = videoRef.current;
        if (v && v.readyState >= 2 && v.videoWidth) {
          const ar = v.videoHeight / v.videoWidth;
          if (small.height !== Math.round(320 * ar)) small.height = Math.round(320 * ar);
          if (frameC.height !== Math.round(480 * ar)) frameC.height = Math.round(480 * ar);
          for (const [c, w] of [
            [small, 320],
            [frameC, 480],
          ] as const) {
            const x = c.getContext('2d')!;
            x.setTransform(-1, 0, 0, 1, w, 0);
            x.drawImage(v, 0, 0, c.width, c.height);
            x.setTransform(1, 0, 0, 1, 0, 0);
          }
          let res = null;
          try {
            res = await segmentFrame(small, performance.now());
          } catch {
            return; // no segmentation: the plain camera stays
          }
          if (stop) return;
          if (res) {
            times.push(res.ms);
            if (times.length >= 4) {
              const avg = times.slice(-6).reduce((a, b) => a + b, 0) / Math.min(6, times.length);
              if (avg > 140) {
                liveRef.current = null;
                setLiveOn(false);
                return;
              }
            }
            const a = quickMatte(res.conf, 0.5, 0.85);
            const box = maskBox(a, res.w, res.h, 0.5);
            if (box && box.coverage > 0.01) {
              if (maskC.width !== res.w || maskC.height !== res.h) {
                maskC.width = res.w;
                maskC.height = res.h;
              }
              maskC.getContext('2d')!.putImageData(new ImageData(alphaToRGBA(a), res.w, res.h), 0, 0);
              const sx = frameC.width / res.w;
              const sy = frameC.height / res.h;
              const cut = liveRef.current?.canvas ?? makeCanvas(1, 1);
              cut.width = Math.max(1, Math.round(box.w * sx));
              cut.height = Math.max(1, Math.round(box.h * sy));
              const x = cut.getContext('2d')!;
              x.drawImage(frameC, box.x * sx, box.y * sy, box.w * sx, box.h * sy, 0, 0, cut.width, cut.height);
              x.globalCompositeOperation = 'destination-in';
              x.drawImage(maskC, box.x, box.y, box.w, box.h, 0, 0, cut.width, cut.height);
              x.globalCompositeOperation = 'source-over';
              liveRef.current = { canvas: cut, rect: fitInSlot({ w: cut.width, h: cut.height, touchesBottom: box.touchesBottom }, slotRef(), REF) };
              if (times.length >= 2) setLiveOn(true);
            } else {
              liveRef.current = null;
            }
          }
        }
        await sleep(55);
      }
    })();
    return () => {
      stop = true;
    };
  }, [step, cam, slotRef]);

  // ——— processing a still ———
  const processStill = useCallback(
    async (still: HTMLCanvasElement) => {
      setStep('working');
      setOvalTip(false);
      const t0 = performance.now();
      let alpha: Float32Array;
      let mw: number;
      let mh: number;
      let oval = false;
      try {
        const r = await segmentStill(downscale(still, 512));
        mw = r.w;
        mh = r.h;
        alpha = refineMask(r.conf, mw, mh, { erode: 1, feather: mw >= 400 ? 2 : 1 });
        const b = maskBox(alpha, mw, mh, 0.5);
        setSegInfo(`${r.model} ${mw}x${mh} ${b ? b.coverage.toFixed(3) : 0} ${Math.round(r.ms)}ms`);
        if (!b || b.coverage < 0.02) throw new Error('nobody');
      } catch {
        mw = 200;
        mh = Math.max(1, Math.round((200 * still.height) / still.width));
        alpha = ovalMask(mw, mh);
        oval = true;
      }
      stillRef.current = { still, alpha, mw, mh, oval };
      cutoutRef.current = prepareCutout(still, alpha, mw, mh, scene, { maxHeight: 1800, oval });
      adjustRef.current = NO_ADJUST;
      const wait = 1100 - (performance.now() - t0);
      if (wait > 0) await sleep(wait);
      setOvalTip(oval);
      setStep('adjust');
      handleRef.current?.setExpression('laugh');
      setTimeout(() => handleRef.current?.setExpression('idle'), 1800);
    },
    [scene],
  );

  // Re-grade the child when the scene changes after the photo
  useEffect(() => {
    const s = stillRef.current;
    if (!s) return;
    cutoutRef.current = prepareCutout(s.still, s.alpha, s.mw, s.mh, scene, { maxHeight: 1800, oval: s.oval });
  }, [scene]);

  const shoot = async () => {
    if (countdown !== null) return;
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const ac = audio();
    handleRef.current?.setExpression('wave');
    for (const n of [3, 2, 1]) {
      setCountdown(n);
      await sleep(reduce ? 650 : 850);
    }
    setCountdown(null);
    const still = grabFrame(v, true);
    setFlashKey((k) => k + 1);
    if (ac) ding(ac);
    handleRef.current?.setExpression('idle');
    stopCamera();
    setCam('idle');
    await processStill(still);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    audio();
    stopCamera();
    setCam('idle');
    try {
      const still = await fileToCanvas(file);
      await processStill(still);
    } catch {
      setStep('camera');
      setCam('off');
      setCamError('none');
    }
  };

  // ——— adjusting ———
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ start: Adjust; p0: { x: number; y: number }; d0: number } | null>(null);
  const toRef = (e: ReactPointerEvent) => {
    const r = previewRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * REF.w, y: ((e.clientY - r.top) / r.height) * REF.h };
  };
  const regrip = () => {
    const ps = [...pointers.current.values()];
    if (!ps.length) return void (gesture.current = null);
    const mid = ps.length >= 2 ? { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 } : ps[0];
    gesture.current = { start: adjustRef.current, p0: mid, d0: ps.length >= 2 ? Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) : 0 };
  };
  const setAdjust = (a: Adjust) => {
    const b = baseRect();
    adjustRef.current = b ? clampAdjust(a, b, REF) : a;
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (step !== 'adjust') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, toRef(e));
    regrip();
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (step !== 'adjust' || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, toRef(e));
    const g = gesture.current;
    if (!g) return;
    const ps = [...pointers.current.values()];
    if (ps.length >= 2) {
      const mid = { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 };
      setAdjust(pinchAdjust(g.start, g.d0, Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), g.p0, mid));
    } else {
      setAdjust({ ...g.start, dx: g.start.dx + ps[0].x - g.p0.x, dy: g.start.dy + ps[0].y - g.p0.y });
    }
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    regrip();
  };
  const zoomBy = (k: number) => setAdjust({ ...adjustRef.current, zoom: adjustRef.current.zoom * k });

  // ——— export ———
  const renderPhoto = async () => {
    setBusy(true);
    try {
      const cv = makeCanvas(out.width, out.height);
      const ctx = cv.getContext('2d')!;
      drawComposite(ctx, out.width, out.height, {
        backdrop: backdrop(),
        cutout: cutoutRef.current,
        rect: currentRect(),
        flakes: snowRef.current.flakes,
        sparkles: snowRef.current.sparkles,
        frame: frameFor(out.width, out.height, out.watermark, false),
        t: 2.2,
      });
      const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/png'));
      if (!blob) return;
      setPhoto((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { blob, url: URL.createObjectURL(blob) };
      });
      setClip((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return null;
      });
      setVideoOk(canRecordVideo());
      setStep('result');
      handleRef.current?.setExpression('wink');
      setTimeout(() => handleRef.current?.setExpression('idle'), 1500);
    } finally {
      setBusy(false);
    }
  };

  const makeVideo = async () => {
    if (recording !== null || !out.video) return;
    const ac = audio();
    const cv = makeCanvas(VIDEO_SIZE.w, VIDEO_SIZE.h);
    cv.className = 'block h-full w-full';
    recHostRef.current?.replaceChildren(cv);
    const ctx = cv.getContext('2d')!;
    const frame = frameFor(VIDEO_SIZE.w, VIDEO_SIZE.h, false, false);
    let dest: MediaStreamAudioDestinationNode | null = null;
    if (ac) {
      dest = ac.createMediaStreamDestination();
      const mix = ac.createGain();
      mix.connect(dest);
      mix.connect(ac.destination);
      scheduleJingle(ac, mix, ac.currentTime + 0.12);
    }
    handleRef.current?.setExpression('wave');
    setRecording(0);
    try {
      const c = await recordCanvas(cv, {
        seconds: VIDEO_SECONDS,
        audio: dest?.stream ?? null,
        onProgress: (p) => setRecording(p),
        draw: (tt) =>
          drawComposite(ctx, VIDEO_SIZE.w, VIDEO_SIZE.h, {
            backdrop: backdrop(),
            cutout: cutoutRef.current,
            rect: currentRect(),
            flakes: snowRef.current.flakes,
            sparkles: snowRef.current.sparkles,
            frame,
            t: tt + 0.5,
          }),
      });
      setClip((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { ...c, url: URL.createObjectURL(c.blob) };
      });
    } catch {
      setVideoOk(false);
    } finally {
      handleRef.current?.setExpression('idle');
      setRecording(null);
      recHostRef.current?.replaceChildren();
    }
  };

  const retake = () => {
    setPhoto((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return null;
    });
    setClip((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return null;
    });
    stillRef.current = null;
    cutoutRef.current = null;
    adjustRef.current = NO_ADJUST;
    setStep('camera');
    setCam('idle');
    // The camera worked before: switch it back on straight away.
    if (hadCamera.current) void startCamera();
  };

  const year = christmasYear();
  const doShare = async (blob: Blob, ext: string) => {
    const r = await shareOrSave(blob, `photo-pere-noel-${year}.${ext}`, t(T.shareTitle));
    if (r !== 'cancelled') showToast(t(r === 'shared' ? T.shared : T.saved));
  };
  const doSave = async (blob: Blob, ext: string) => {
    const { saveBlob } = await import('./share');
    saveBlob(blob, `photo-pere-noel-${year}.${ext}`);
    showToast(t(T.saved));
  };

  // ——— read-aloud ———
  const instruction =
    step === 'scene'
      ? T.chooseScene
      : step === 'camera'
        ? cam === 'live'
          ? T.lookAndSmile
          : cam === 'off'
            ? camError === 'none'
              ? T.camOffNone
              : T.camOffDenied
            : T.privacy
        : step === 'working'
          ? T.magic
          : step === 'adjust'
            ? T.adjust
            : T.bravo;
  useAutoSay(`booth-${step}-${cam}`, [t(instruction)]);

  // On a phone the panel sits under the stage: bring the stage back into view when something happens on it.
  useEffect(() => {
    if (!(step === 'adjust' || step === 'result' || (step === 'camera' && cam === 'live'))) return;
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 64 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [step, cam, reduce]);

  const backdropScale = stageW ? stageW / BACKDROP_SIZE.w : 1;
  const camVisible = step === 'camera' && cam === 'live';

  // ——— UI ———
  const btnPrimary =
    'inline-flex min-h-16 items-center justify-center gap-3 rounded-full bg-gradient-to-b from-[#ffd76a] to-[#f2a93b] px-8 text-xl font-bold text-[#5a1a10] shadow-[0_8px_24px_rgba(242,169,59,0.45)] ring-2 ring-white/60 transition active:scale-[0.97] disabled:opacity-60';
  const btnSecondary =
    'inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-white/12 px-6 text-lg font-semibold text-white ring-1 ring-white/35 backdrop-blur transition hover:bg-white/20 active:scale-[0.97]';
  const roundBtn = 'grid h-16 w-16 place-items-center rounded-full bg-white/15 text-3xl font-bold text-white ring-1 ring-white/40 transition hover:bg-white/25 active:scale-95';

  return (
    <section className={`relative w-full text-white ${className}`} data-booth-step={step} data-booth-seg={segInfo} data-booth-live={liveOn ? '1' : '0'}>
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-28 pt-24 sm:px-6 sm:pt-28">
        <header className="flex items-center gap-3">
          <span aria-hidden="true" className="text-4xl sm:text-5xl">
            🎅
          </span>
          <h1 className="min-w-0 flex-1 font-display text-3xl font-bold leading-tight text-[#fff3d6] drop-shadow sm:text-4xl">{t(T.title)}</h1>
        </header>

        <div className="mt-4 grid gap-5 lg:mt-6 lg:grid-cols-[auto_minmax(340px,1fr)] lg:items-start lg:gap-8">
          {/* Stage */}
          <div
            ref={stageRef}
            className="relative mx-auto aspect-[4/5] w-full overflow-hidden rounded-[28px] bg-[#1b1f5c] shadow-[0_20px_60px_rgba(0,0,0,0.45),0_0_0_4px_rgba(243,211,138,0.55)] lg:mx-0 lg:w-[min(520px,calc((100dvh-230px)*0.8))]"
            style={{ maxWidth: 'min(100%, calc((100dvh - 200px) * 0.8))' }}
          >
            <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0" style={{ width: BACKDROP_SIZE.w, height: BACKDROP_SIZE.h, transform: `scale(${backdropScale})`, transformOrigin: '0 0' }}>
              <BoothBackdrop scene={scene} onReady={(h) => (handleRef.current = h)} />
            </div>
            <canvas
              ref={previewRef}
              role="img"
              aria-label={t(T.previewAria)}
              className="absolute inset-0 h-full w-full"
              style={{ touchAction: step === 'adjust' ? 'none' : 'auto', cursor: step === 'adjust' ? 'grab' : 'default' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            {/* Camera (mirrored), shown until the live cut-out runs */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover transition-opacity duration-500"
              style={{ opacity: camVisible && !liveOn ? 1 : 0 }}
            />
            {camVisible && !liveOn && <OvalGuide />}
            {camVisible && (
              <div className="absolute inset-x-0 bottom-5 flex justify-center">
                <button
                  type="button"
                  aria-label={t(T.shutter)}
                  title={t(T.shutter)}
                  onClick={shoot}
                  disabled={countdown !== null}
                  className="grid h-24 w-24 place-items-center rounded-full bg-white/25 shadow-[0_6px_30px_rgba(0,0,0,0.4)] ring-4 ring-white backdrop-blur transition active:scale-95 disabled:opacity-60"
                >
                  <span className="h-[4.5rem] w-[4.5rem] rounded-full bg-gradient-to-b from-[#ff5a5a] to-[#c81726] shadow-[0_0_30px_rgba(255,90,90,0.7)]" />
                </button>
              </div>
            )}
            {step === 'result' && photo && (
              // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, made on this device
              <img src={photo.url} alt={t(T.photoAlt)} className="absolute inset-0 h-full w-full object-cover" />
            )}
            <div ref={recHostRef} className={`absolute inset-0 ${recording !== null ? '' : 'pointer-events-none'}`} />
            {clip && step === 'result' && recording === null && (
              <video src={clip.url} controls playsInline loop autoPlay={!reduce} muted={!reduce} className="absolute inset-0 h-full w-full bg-black object-cover" />
            )}
            {recording !== null && (
              <div className="pointer-events-none absolute inset-x-6 bottom-6 h-3 overflow-hidden rounded-full bg-white/25">
                <div className="h-full origin-left rounded-full bg-gradient-to-r from-[#ffd76a] to-[#ff8a5a]" style={{ transform: `scaleX(${recording})` }} />
              </div>
            )}
            <AnimatePresence>
              {countdown !== null && (
                <motion.div
                  key={countdown}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.6 }}
                  transition={{ duration: reduce ? 0.15 : 0.35 }}
                  className="pointer-events-none absolute inset-0 grid place-items-center"
                >
                  <span className="grid h-36 w-36 place-items-center rounded-full bg-[#fff3d6]/90 font-display text-8xl font-bold text-[#c81726] shadow-[0_0_60px_rgba(255,215,106,0.9)]">{countdown}</span>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {flashKey > 0 && (
                <motion.div
                  key={flashKey}
                  initial={{ opacity: reduce ? 0.5 : 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0.25 : 0.6 }}
                  className="pointer-events-none absolute inset-0 bg-white"
                />
              )}
            </AnimatePresence>
            {step === 'working' && <MagicOverlay reduce={reduce} label={t(T.magic)} />}
            {toast && (
              <div role="status" className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
                <span className="rounded-full bg-[#1d6b3a] px-5 py-2 text-lg font-bold text-white shadow-lg ring-2 ring-white/60">✓ {toast}</span>
              </div>
            )}
          </div>

          {/* Panel */}
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex items-start gap-3 rounded-3xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
              <SayButton texts={[t(instruction)]} locale={locale} size="lg" />
              <p className="min-w-0 flex-1 self-center text-lg font-semibold leading-snug text-[#fff3d6] sm:text-xl">{t(instruction)}</p>
            </div>

            {step === 'scene' && (
              <>
                <div role="radiogroup" aria-label={t(T.sceneAria)} className="grid grid-cols-2 gap-3">
                  {SCENES.map((s) => (
                    <SceneButton key={s.id} s={s} active={scene === s.id} label={t(s.label)} onClick={() => setScene(s.id)} />
                  ))}
                </div>
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => {
                    prefetchQualityModel();
                    setStep('camera');
                  }}
                >
                  <span aria-hidden="true">📸</span> {t(T.go)}
                </button>
                <p className="flex items-center gap-2 text-base text-white/80">
                  <span aria-hidden="true">🔒</span> {t(T.privacy)}
                </p>
              </>
            )}

            {step === 'camera' && (cam === 'idle' || cam === 'asking') && (
              <>
                <div className="rounded-3xl bg-[#fff3d6] p-5 text-[#3a1a12] shadow-lg">
                  <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#a5541c]">
                    <span aria-hidden="true">🔒</span> {t(T.cameraNoteTitle)}
                  </p>
                  <p className="mt-2 text-base leading-relaxed">{t(T.cameraNote)}</p>
                </div>
                <button type="button" className={btnPrimary} disabled={cam === 'asking'} onClick={startCamera}>
                  <span aria-hidden="true">📷</span> {t(T.cameraOn)}
                </button>
                <button type="button" className={btnSecondary} onClick={() => galleryRef.current?.click()}>
                  <span aria-hidden="true">🖼️</span> {t(T.pickPhoto)}
                </button>
              </>
            )}

            {step === 'camera' && cam === 'live' && (
              <div className="flex flex-col items-center gap-4">
                <button type="button" className={btnSecondary} onClick={() => galleryRef.current?.click()}>
                  <span aria-hidden="true">🖼️</span> {t(T.pickPhoto)}
                </button>
              </div>
            )}

            {step === 'camera' && cam === 'off' && (
              <>
                <div className="rounded-3xl bg-[#fff3d6] p-5 text-[#3a1a12] shadow-lg">
                  <p className="text-xl font-bold">
                    <span aria-hidden="true">🎄 </span>
                    {t(T.camOff)}
                  </p>
                </div>
                <button type="button" className={btnPrimary} onClick={() => galleryRef.current?.click()}>
                  <span aria-hidden="true">🖼️</span> {t(T.pickPhoto)}
                </button>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className={`${btnSecondary} flex-1`} onClick={() => nativeCamRef.current?.click()}>
                    <span aria-hidden="true">📷</span> {t(T.nativeCamera)}
                  </button>
                  <button type="button" className={`${btnSecondary} flex-1`} onClick={startCamera}>
                    <span aria-hidden="true">🔄</span> {t(T.retry)}
                  </button>
                </div>
              </>
            )}

            {step === 'working' && <p className="text-center text-lg text-white/85">{t(T.magicSub)}</p>}

            {step === 'adjust' && (
              <>
                {ovalTip && <p className="rounded-2xl bg-white/10 px-4 py-3 text-base text-white/90">💡 {t(T.ovalTip)}</p>}
                <div className="flex items-center justify-center gap-4">
                  <button type="button" aria-label={t(T.smaller)} title={t(T.smaller)} className={roundBtn} onClick={() => zoomBy(1 / 1.12)}>
                    −
                  </button>
                  <button type="button" aria-label={t(T.recenter)} title={t(T.recenter)} className={roundBtn} onClick={() => (adjustRef.current = NO_ADJUST)}>
                    <span aria-hidden="true" className="text-2xl">
                      🎯
                    </span>
                  </button>
                  <button type="button" aria-label={t(T.bigger)} title={t(T.bigger)} className={roundBtn} onClick={() => zoomBy(1.12)}>
                    +
                  </button>
                </div>
                <div className="flex justify-center gap-2" role="radiogroup" aria-label={t(T.sceneAria)}>
                  {SCENES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={scene === s.id}
                      aria-label={t(s.label)}
                      title={t(s.label)}
                      onClick={() => setScene(s.id)}
                      className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br text-2xl transition active:scale-95 ${s.bg} ${scene === s.id ? 'ring-4 ring-[#ffd76a]' : 'opacity-80 ring-1 ring-white/30'}`}
                    >
                      <span aria-hidden="true">{s.emoji}</span>
                    </button>
                  ))}
                </div>
                <label className="flex flex-col gap-1 text-base font-semibold text-white/85">
                  {t(T.nameLabel)}
                  <input
                    value={name}
                    maxLength={24}
                    autoComplete="off"
                    placeholder={t(T.namePlaceholder)}
                    onChange={(e) => {
                      setNameTouched(true);
                      setName(e.target.value);
                    }}
                    className="min-h-14 rounded-2xl bg-white px-4 text-xl font-bold text-[#3a1a12] outline-none ring-2 ring-transparent placeholder:font-normal placeholder:text-[#3a1a12]/40 focus:ring-[#ffd76a]"
                  />
                </label>
                <button type="button" className={btnPrimary} disabled={busy} onClick={renderPhoto}>
                  <span aria-hidden="true">✨</span> {t(T.perfect)}
                </button>
                <button type="button" className={btnSecondary} onClick={retake}>
                  <span aria-hidden="true">↩️</span> {t(T.retake)}
                </button>
              </>
            )}

            {step === 'result' && photo && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" className={btnPrimary} onClick={() => doShare(photo.blob, 'png')}>
                    <span aria-hidden="true">💌</span> {t(T.share)}
                  </button>
                  <button type="button" className={`${btnSecondary} min-h-16`} onClick={() => doSave(photo.blob, 'png')}>
                    <span aria-hidden="true">⬇️</span> {t(T.save)}
                  </button>
                </div>

                {out.video ? (
                  <div className="rounded-3xl bg-white/10 p-4 ring-1 ring-white/15">
                    {clip ? (
                      <>
                        <p className="text-lg font-bold text-[#fff3d6]">🎬 {t(T.videoReady)}</p>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <button type="button" className={`${btnPrimary} px-4 text-lg`} onClick={() => doShare(clip.blob, clip.ext)}>
                            {t(T.shareVideo)}
                          </button>
                          <button type="button" className={`${btnSecondary} min-h-16 px-4`} onClick={() => doSave(clip.blob, clip.ext)}>
                            {t(T.saveVideo)}
                          </button>
                        </div>
                      </>
                    ) : videoOk ? (
                      <>
                        <p className="text-base text-white/85">{t(T.videoHint)}</p>
                        <button type="button" className={`${btnPrimary} mt-3 w-full`} disabled={recording !== null} onClick={makeVideo}>
                          <span aria-hidden="true">🎬</span> {recording !== null ? t(T.recording) : t(T.makeVideo)}
                        </button>
                      </>
                    ) : (
                      <p className="text-base text-white/85">{t(T.videoUnsupported)}</p>
                    )}
                  </div>
                ) : (
                  !pass.loading && (
                    <div className="rounded-3xl bg-[#fff3d6]/95 p-4 text-[#3a1a12]">
                      <p className="text-lg font-bold">
                        <span aria-hidden="true">🎁 </span>
                        {t(T.upsellTitle)}
                      </p>
                      <p className="mt-1 text-base leading-relaxed">{t(T.upsell)}</p>
                      <Link href={parentsHref} className="mt-3 inline-flex min-h-14 items-center rounded-full bg-[#c81726] px-6 text-lg font-bold text-white">
                        {t(T.upsellLink)}
                      </Link>
                    </div>
                  )
                )}

                <button type="button" className={btnSecondary} onClick={retake}>
                  <span aria-hidden="true">↩️</span> {t(T.retake)}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onFile} data-testid="booth-gallery" />
      <input ref={nativeCamRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onFile} />
    </section>
  );
}

function SceneButton({ s, active, label, onClick }: { s: (typeof SCENES)[number]; active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`relative flex min-h-24 flex-col items-center justify-center gap-1 overflow-hidden rounded-3xl bg-gradient-to-br p-3 text-white shadow-lg transition active:scale-[0.97] ${s.bg} ${active ? 'ring-4 ring-[#ffd76a]' : 'ring-1 ring-white/25'}`}
    >
      <span aria-hidden="true" className="text-4xl drop-shadow">
        {s.emoji}
      </span>
      <span className="text-lg font-bold drop-shadow">{label}</span>
      {active && (
        <span aria-hidden="true" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-[#ffd76a] text-sm font-bold text-[#5a1a10]">
          ✓
        </span>
      )}
    </button>
  );
}

function OvalGuide() {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 500" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
      <defs>
        <mask id="booth-oval">
          <rect width="400" height="500" fill="white" />
          <ellipse cx="200" cy="230" rx="130" ry="170" fill="black" />
        </mask>
      </defs>
      <rect width="400" height="500" fill="rgba(18,24,69,0.45)" mask="url(#booth-oval)" />
      <ellipse cx="200" cy="230" rx="130" ry="170" fill="none" stroke="#ffd76a" strokeWidth="4" strokeDasharray="10 10" />
    </svg>
  );
}

function MagicOverlay({ reduce, label }: { reduce: boolean; label: string }) {
  const stars = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#121845]/45" role="status" aria-label={label}>
      <div className="relative h-40 w-40">
        {stars.map((i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 -ml-4 -mt-4 text-3xl"
            style={{ rotate: i * 45 }}
            animate={reduce ? { opacity: 1 } : { rotate: [i * 45, i * 45 + 360], opacity: [0.4, 1, 0.4] }}
            transition={reduce ? undefined : { duration: 2.4, repeat: Infinity, ease: 'linear', delay: i * 0.05 }}
          >
            <span className="block -translate-y-16">✨</span>
          </motion.span>
        ))}
        <span aria-hidden="true" className="absolute inset-0 grid place-items-center text-6xl">
          🪄
        </span>
      </div>
    </div>
  );
}

export default PhotoBooth;
