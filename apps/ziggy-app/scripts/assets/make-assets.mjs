#!/usr/bin/env node
// Generates every picture of the native apps from the official Ziggy plush pictures
// (public/mascot/*): Android launcher icons (adaptive + themed + legacy), Android TV
// banner, splash marks, iOS app icon and launch marks, store icons and graphics.
//
//   node apps/ziggy-app/scripts/assets/make-assets.mjs
//
// Needs Playwright with Chromium (`npx playwright install chromium`); the pictures are
// drawn in a canvas (see art.js), so the result is the same on every machine.

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');
const app = resolve(here, '../..');
const res = join(app, 'src-tauri/gen/android/app/src/main/res');

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim();
    return require(join(globalRoot, 'playwright'));
  }
}

const { chromium } = loadPlaywright();
const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();
await page.route('http://ziggy.assets/**', (route) => {
  const path = decodeURIComponent(new URL(route.request().url()).pathname);
  const file = join(repo, path);
  if (!existsSync(file)) return route.fulfill({ status: 404 });
  const type = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.woff2') ? 'font/woff2' : path.endsWith('.webp') ? 'image/webp' : 'text/html';
  return route.fulfill({ body: readFileSync(file), contentType: type });
});
await page.goto('http://ziggy.assets/apps/ziggy-app/scripts/assets/blank.html');

/** Runs `fn(art, ziggy)` in the page; it returns {name: dataURL}. */
async function draw(fn, arg) {
  return page.evaluate(
    async ([source, arg]) => {
      const art = await import('/apps/ziggy-app/scripts/assets/art.js');
      window.__z ??= await art.loadZiggy('/public/mascot');
      const font = new FontFace('Fredoka', 'url(/node_modules/@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2)', { weight: '300 700' });
      document.fonts.add(await font.load());
      // eslint-disable-next-line no-new-func
      const f = new Function('art', 'z', 'arg', `return (${source})(art, z, arg);`);
      return f(art, window.__z, arg);
    },
    [fn.toString(), arg],
  );
}

function save(path, dataUrl, { opaque = false } = {}) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(dataUrl.split(',')[1], 'base64'));
  // Store icons and graphics must be 24-bit (no alpha channel): re-encode with FFmpeg.
  if (opaque) {
    execSync(`ffmpeg -v error -y -i "${path}" -pix_fmt rgb24 "${path}.rgb.png" && mv "${path}.rgb.png" "${path}"`);
  }
  console.log('  ', path.replace(repo + '/', ''));
}

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

console.log('Android launcher icons');
for (const [name, scale] of Object.entries(densities)) {
  const out = await draw(
    (art, z, { legacy, adaptive }) => {
      const full = art.icon(z, legacy, 'full');
      // Legacy icon: rounded square with the standard 1/24 margin; round icon: a circle.
      const square = art.canvas(legacy, legacy);
      const sq = square.getContext('2d');
      const m = legacy / 24;
      sq.beginPath();
      sq.roundRect(m, m, legacy - 2 * m, legacy - 2 * m, legacy * 0.2);
      sq.clip();
      sq.drawImage(full, 0, 0);
      const round = art.canvas(legacy, legacy);
      const rd = round.getContext('2d');
      rd.beginPath();
      rd.arc(legacy / 2, legacy / 2, legacy / 2 - m, 0, Math.PI * 2);
      rd.clip();
      rd.drawImage(full, 0, 0);
      return {
        legacy: square.toDataURL('image/png'),
        round: round.toDataURL('image/png'),
        foreground: art.icon(z, adaptive, 'foreground').toDataURL('image/png'),
        monochrome: art.icon(z, adaptive, 'monochrome').toDataURL('image/png'),
      };
    },
    { legacy: Math.round(48 * scale), adaptive: Math.round(108 * scale) },
  );
  save(join(res, `mipmap-${name}/ic_launcher.png`), out.legacy);
  save(join(res, `mipmap-${name}/ic_launcher_round.png`), out.round);
  save(join(res, `mipmap-${name}/ic_launcher_foreground.png`), out.foreground);
  save(join(res, `mipmap-${name}/ic_launcher_monochrome.png`), out.monochrome);
}

console.log('Splash marks (Android 12+ splash icon, launch page, iOS launch screen)');
{
  const out = await draw((art, z) => ({
    light: art.splash(z, 864, false).toDataURL('image/webp', 0.9),
    dark: art.splash(z, 864, true).toDataURL('image/webp', 0.9),
    // iOS launch screen: on the exact LaunchBackground colour, so JPEG (small) is fine.
    ...Object.fromEntries(
      [2, 3].flatMap((s) =>
        [false, true].map((dark) => {
          const c = art.canvas(288 * s, 288 * s);
          const g = c.getContext('2d');
          g.fillStyle = dark ? '#0A0A1A' : '#FAFBFC';
          g.fillRect(0, 0, c.width, c.height);
          g.drawImage(art.splash(z, 288 * s, dark), 0, 0);
          return [`${dark ? 'dark' : 'light'}${s}`, c.toDataURL('image/jpeg', 0.9)];
        }),
      ),
    ),
  }));
  save(join(res, 'drawable-nodpi/splash_ziggy.webp'), out.light);
  save(join(res, 'drawable-night-nodpi/splash_ziggy.webp'), out.dark);
  save(join(app, 'www/splash-light.webp'), out.light);
  save(join(app, 'www/splash-dark.webp'), out.dark);
  for (const s of [2, 3]) {
    save(join(app, `src-tauri/ios/LaunchZiggy.imageset/launch-light@${s}x.jpg`), out[`light${s}`]);
    save(join(app, `src-tauri/ios/LaunchZiggy.imageset/launch-dark@${s}x.jpg`), out[`dark${s}`]);
  }
}

console.log('App icons (iOS, stores, Tauri bundle)');
{
  const out = await draw((art, z) => {
    const opaque = (size) => art.icon(z, size, 'full').toDataURL('image/png');
    return { i1024: opaque(1024), i512: opaque(512), i256: opaque(256), i128: opaque(128), i32: opaque(32) };
  });
  // The App Store takes its icon from this asset (no separate upload).
  save(join(app, 'src-tauri/ios/AppIcon.appiconset/AppIcon-1024.png'), out.i1024, { opaque: true });
  save(join(app, 'src-tauri/icons/icon.png'), out.i512);
  save(join(app, 'src-tauri/icons/128x128@2x.png'), out.i256);
  save(join(app, 'src-tauri/icons/128x128.png'), out.i128);
  save(join(app, 'src-tauri/icons/32x32.png'), out.i32);
  save(join(app, 'store/google-play/icon-512.png'), out.i512);
}

console.log('Android TV banners and Play feature graphic');
{
  const out = await draw((art, z) => {
    // "Ziggy" in the colours of the clay ZIGGY letters, "AI" in ink, white outline.
    const letters = [
      ['Z', '#E8475F'],
      ['i', '#F08A00'],
      ['g', '#2F8FD0'],
      ['g', '#1FA89E'],
      ['y', '#4E9F2E'],
      [' ', null],
      ['A', '#1A1A2E'],
      ['I', '#1A1A2E'],
    ];
    const wordmarkWidth = (g, size) => {
      g.font = `700 ${size}px Fredoka`;
      return letters.reduce((w, [ch]) => w + g.measureText(ch).width + size * 0.01, 0);
    };
    const wordmark = (g, x, y, size) => {
      g.font = `700 ${size}px Fredoka`;
      g.textBaseline = 'alphabetic';
      g.lineJoin = 'round';
      let cx = x;
      for (const [ch, color] of letters) {
        if (color) {
          g.lineWidth = size * 0.14;
          g.strokeStyle = 'rgba(255,255,255,0.95)';
          g.strokeText(ch, cx, y);
          g.fillStyle = color;
          g.fillText(ch, cx, y);
        }
        cx += g.measureText(ch).width + size * 0.01;
      }
      return cx;
    };
    const banner = (w, h, type = 'image/png') => {
      const c = art.canvas(w, h);
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      art.gradientBg(g, w, art.PEACH, w, h);
      // Ziggy on the left, cut by the bottom edge like a friend peeking in;
      // the wordmark fills the rest, as large as it fits.
      art.drawHead(g, z.heart, h * 0.47, h * 0.56, h * 0.78);
      const x = h * 0.94;
      const room = w - x - h * 0.09;
      const size = Math.min(h * 0.34, (h * 0.3 * room) / wordmarkWidth(g, h * 0.3));
      wordmark(g, x, h * 0.5 + size * 0.36, size);
      return c.toDataURL(type, 0.92);
    };
    const feature = () => {
      const w = 1024;
      const h = 500;
      const c = art.canvas(w, h);
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      art.gradientBg(g, w, art.PEACH, w, h);
      const s = 470 / z.wave.height;
      g.drawImage(z.wave, w - z.wave.width * s - 70, h - z.wave.height * s + 6, z.wave.width * s, z.wave.height * s);
      wordmark(g, 64, 200, 104);
      g.font = '600 38px Fredoka';
      g.fillStyle = '#1A1A2E';
      g.fillText('Jeux, histoires et dodo', 68, 284);
      g.fillText('avec Ziggy', 68, 330);
      g.font = '500 25px Fredoka';
      g.fillStyle = '#5B4A3F';
      g.fillText('Pour les 4 à 12 ans · sans publicité', 70, 392);
      return c.toDataURL('image/jpeg', 0.92);
    };
    return { banner: banner(320, 180), tv: banner(1280, 720, 'image/jpeg'), feature: feature() };
  });
  save(join(res, 'drawable-xhdpi/banner.png'), out.banner);
  save(join(app, 'store/google-play/tv-banner-1280x720.jpg'), out.tv);
  save(join(app, 'store/google-play/feature-graphic-1024x500.jpg'), out.feature);
}

await browser.close();
console.log('Done.');
