#!/usr/bin/env node
// Store screenshots of the Ziggy apps, from the real site in app mode.
//
//   1. serve a production build of the site, e.g.
//        NEXT_DIST_DIR=.next-apps npx next build && NEXT_DIST_DIR=.next-apps npx next start -p 3320
//   2. node apps/ziggy-app/scripts/store-screenshots.mjs [http://localhost:3320] [--only=3-jeux]
//
// Each page is opened with the app's user agent (ZiggyApp/1.0.0 (android) / (android; tv) /
// (ios)), so the site shows its app mode. Phones and tablets get a framed picture with a short
// French caption on a soft gradient (same style everywhere); TV screenshots stay full screen,
// as Google Play asks for Android TV. Output: apps/ziggy-app/store/{google-play,app-store}/.

import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '..');
const repo = resolve(app, '../..');
const base = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'http://localhost:3320';
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7); // e.g. --only=3-jeu

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch {
    return require(join(execSync('npm root -g').toString().trim(), 'playwright'));
  }
}
const { chromium } = loadPlaywright();

const UA = {
  phone:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36 ZiggyApp/1.0.0 (android)',
  tablet:
    'Mozilla/5.0 (Linux; Android 15; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Safari/537.36 ZiggyApp/1.0.0 (android)',
  tv: 'Mozilla/5.0 (Linux; Android 14; BRAVIA 4K VH2) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Safari/537.36 ZiggyApp/1.0.0 (android; tv)',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ZiggyApp/1.0.0 (ios)',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) ZiggyApp/1.0.0 (ios)',
};

// Store sizes: canvas = the picture uploaded; screen = the device viewport (CSS px) and density.
const PROFILES = [
  { id: 'phone', store: 'google-play', dir: 'phone', canvas: [1080, 1920], screen: [360, 640], dpr: 3, ua: UA.phone, frame: 'phone' },
  { id: 'tablet-7', store: 'google-play', dir: 'tablet-7in', canvas: [1200, 1920], screen: [600, 960], dpr: 2, ua: UA.tablet, frame: 'tablet' },
  { id: 'tablet-10', store: 'google-play', dir: 'tablet-10in', canvas: [1600, 2560], screen: [800, 1280], dpr: 2, ua: UA.tablet, frame: 'tablet' },
  { id: 'tv', store: 'google-play', dir: 'tv', canvas: [1920, 1080], screen: [960, 540], dpr: 2, ua: UA.tv, frame: null },
  { id: 'iphone', store: 'app-store', dir: 'iphone-6.9in', canvas: [1320, 2868], screen: [440, 956], dpr: 3, ua: UA.iphone, frame: 'phone' },
  { id: 'ipad', store: 'app-store', dir: 'ipad-13in', canvas: [2064, 2752], screen: [1032, 1376], dpr: 2, ua: UA.ipad, frame: 'tablet' },
];

// The five screens, with their caption (French store listing) and background tone.
const SHOTS = [
  { name: '1-accueil', path: '/', caption: 'Ziggy, ton copain pour apprendre', tone: 'peach' },
  { name: '2-monde', path: '/monde', caption: 'Un monde entier à explorer', tone: 'mint', pickAge: true },
  { name: '3-jeux', path: '/monde/arcade', caption: 'Joue, apprends, progresse', tone: 'sky' },
  { name: '4-creer', path: '/creer', caption: 'Dessine, compose, invente', tone: 'blush' },
  { name: '5-dodo', path: '/dodo/lili', caption: 'Une histoire douce avant de dormir', tone: 'night' },
];

const TONES = {
  peach: ['#FFF7E6', '#FFE2C2', '#1A1A2E'],
  mint: ['#F0FBF2', '#CFF2D9', '#1A1A2E'],
  sky: ['#F0F7FF', '#CFE6FB', '#1A1A2E'],
  blush: ['#FFF3F4', '#FBD3D8', '#1A1A2E'],
  night: ['#2B3A86', '#0E1440', '#FFFFFF'],
};

const font = readFileSync(join(repo, 'node_modules/@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2')).toString('base64');

async function capture(browser, profile, shot) {
  const context = await browser.newContext({
    viewport: { width: profile.screen[0], height: profile.screen[1] },
    deviceScaleFactor: profile.dpr,
    isMobile: profile.id !== 'tv',
    hasTouch: profile.id !== 'tv',
    userAgent: profile.ua,
    locale: 'fr-FR',
    extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
  });
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem('ziggy:intro', '1');
      localStorage.setItem('cookie-consent', 'seen');
    } catch {
      /* private mode */
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + shot.path, { waitUntil: 'networkidle', timeout: 60000 });
  if (shot.pickAge) {
    const choice = page.getByText(/apprends à lire/i).first();
    if (await choice.isVisible().catch(() => false)) {
      await choice.click();
      await page.waitForLoadState('networkidle');
    }
  }
  await page.waitForTimeout(3500);
  const png = await page.screenshot({ type: 'png' });
  await context.close();
  if (errors.length) console.warn(`   ${profile.id} ${shot.path}: page errors: ${errors.join(' | ')}`);
  return png;
}

function frameHtml(profile, shot, png) {
  const [W, H] = profile.canvas;
  const [c1, c2, ink] = TONES[shot.tone];
  const phone = profile.frame === 'phone';
  const captionSize = Math.round(W * (phone ? 0.066 : 0.052));
  const top = Math.round(H * 0.045);
  const captionBlock = Math.round(captionSize * 2.9);
  // The device keeps the screen's aspect ratio and fits under the caption.
  const bezel = Math.round(W * (phone ? 0.022 : 0.018));
  const maxH = H - top - captionBlock - Math.round(H * 0.045);
  const ratio = profile.screen[0] / profile.screen[1];
  let screenH = maxH - 2 * bezel;
  let screenW = Math.round(screenH * ratio);
  const maxW = Math.round(W * (phone ? 0.8 : 0.84)) - 2 * bezel;
  if (screenW > maxW) {
    screenW = maxW;
    screenH = Math.round(screenW / ratio);
  }
  const radius = Math.round(screenW * (phone ? 0.11 : 0.045));
  const stars =
    shot.tone === 'night'
      ? Array.from({ length: 40 }, (_, i) => {
          const x = (i * 197) % 100;
          const y = (i * 61) % 30;
          const s = 2 + (i % 3);
          return `<i style="left:${x}%;top:${y}%;width:${s}px;height:${s}px"></i>`;
        }).join('')
      : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Fredoka;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:300 700}
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
body{background:radial-gradient(120% 80% at 50% 0%,${c1} 0%,${c2} 100%);font-family:Fredoka,sans-serif;position:relative}
.stars i{position:absolute;border-radius:50%;background:#fff;opacity:.55}
h1{position:absolute;left:6%;right:6%;top:${top}px;margin:0;text-align:center;color:${ink};font-weight:700;font-size:${captionSize}px;line-height:1.12;letter-spacing:-0.01em}
.device{position:absolute;left:50%;top:${top + captionBlock}px;transform:translateX(-50%);padding:${bezel}px;border-radius:${radius + bezel}px;
  background:linear-gradient(145deg,#2c2c3e,#111119);box-shadow:0 ${Math.round(W * 0.03)}px ${Math.round(W * 0.07)}px rgba(26,26,46,.28),inset 0 0 0 2px rgba(255,255,255,.08)}
.device img{display:block;width:${screenW}px;height:${screenH}px;border-radius:${radius}px}
</style></head><body><div class="stars">${stars}</div><h1>${shot.caption}</h1>
<div class="device"><img src="data:image/png;base64,${png.toString('base64')}"></div></body></html>`;
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const composer = await browser.newPage();
for (const profile of PROFILES) {
  const outDir = join(app, 'store', profile.store, profile.dir);
  mkdirSync(outDir, { recursive: true });
  for (const shot of SHOTS.filter((s) => !only || s.name === only)) {
    const png = await capture(browser, profile, shot);
    const out = join(outDir, `${shot.name}.jpg`);
    if (!profile.frame) {
      // Full-screen TV capture, re-encoded as JPEG.
      await composer.setViewportSize({ width: profile.canvas[0], height: profile.canvas[1] });
      await composer.setContent(
        `<style>html,body{margin:0}</style><img style="display:block;width:${profile.canvas[0]}px;height:${profile.canvas[1]}px" src="data:image/png;base64,${png.toString('base64')}">`,
      );
    } else {
      await composer.setViewportSize({ width: profile.canvas[0], height: profile.canvas[1] });
      await composer.setContent(frameHtml(profile, shot, png));
      await composer.evaluate(() => document.fonts.ready);
    }
    await composer.waitForTimeout(100);
    await composer.screenshot({ path: out, type: 'jpeg', quality: 86 });
    console.log('  ', out.replace(repo + '/', ''));
  }
}
await browser.close();
