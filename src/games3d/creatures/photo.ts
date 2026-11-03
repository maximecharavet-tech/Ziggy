/**
 * Souvenirs of the factory, made on the device (nothing leaves it): the framed
 * photo, the printable colouring page of the creature, and the helpers that
 * save or print them (behind the grown-up gate in the app).
 */

const FONT = 'Fredoka, ui-rounded, system-ui, sans-serif';
const RAINBOW = ['#ff5c7a', '#ff9f43', '#ffd93d', '#6bdc6b', '#4fc3f7', '#8b7bff', '#ff7ad9'];

function load(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null);
    i.src = src;
  });
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function fitText(g: CanvasRenderingContext2D, text: string, max: number, size: number, weight = 700) {
  let s = size;
  do {
    g.font = `${weight} ${s}px ${FONT}`;
    s -= 4;
  } while (g.measureText(text).width > max && s > 20);
}

/** The photo with a party frame, the name and the date. */
export async function framedPhoto(shot: string, name: string, caption: string, date: string): Promise<string> {
  const W = 1080;
  const H = 1260;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#ffe3f1');
  bg.addColorStop(0.5, '#fff4d6');
  bg.addColorStop(1, '#dff3ff');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // Confetti around the frame.
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    g.save();
    g.translate(rnd() * W, rnd() * H);
    g.rotate(rnd() * Math.PI);
    g.fillStyle = RAINBOW[i % RAINBOW.length];
    if (i % 3) g.fillRect(-10, -5, 20, 10);
    else {
      g.beginPath();
      g.arc(0, 0, 8, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  const img = await load(shot);
  const P = 70;
  const S = W - P * 2;
  g.save();
  g.shadowColor = 'rgba(80,40,120,0.25)';
  g.shadowBlur = 30;
  g.shadowOffsetY = 10;
  rr(g, P - 18, P - 18, S + 36, S + 36, 54);
  g.fillStyle = '#ffffff';
  g.fill();
  g.restore();
  g.save();
  rr(g, P, P, S, S, 40);
  g.clip();
  if (img) g.drawImage(img, P, P, S, S);
  g.restore();
  // The name, in big round letters.
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitText(g, name, W - 120, 92);
  g.lineWidth = 16;
  g.strokeStyle = '#ffffff';
  g.lineJoin = 'round';
  const ny = P + S + 70;
  g.strokeText(name, W / 2, ny);
  g.fillStyle = '#6a3fd1';
  g.fillText(name, W / 2, ny);
  g.font = `600 34px ${FONT}`;
  g.fillStyle = '#8a5a7a';
  g.fillText(`${caption} · ${date}`, W / 2, ny + 72);
  return c.toDataURL('image/jpeg', 0.92);
}

/** An A4 colouring page: the creature's outlines and its name in hollow letters. */
export async function coloringPage(lines: string, name: string, title: string, footer: string): Promise<string> {
  const W = 1240;
  const H = 1754;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  // Hollow letters to colour in too.
  fitText(g, name, W - 140, 120);
  g.lineWidth = 6;
  g.strokeStyle = '#1e1e2a';
  g.strokeText(name, W / 2, 170);
  g.font = `600 44px ${FONT}`;
  g.fillStyle = '#1e1e2a';
  g.fillText(title, W / 2, 290);
  const img = await load(lines);
  if (img) {
    const S = W - 140;
    g.drawImage(img, 70, 360, S, S);
  }
  // A frame of little stars and dots to colour.
  g.lineWidth = 4;
  for (let i = 0; i < 14; i++) {
    const x = 90 + i * ((W - 180) / 13);
    for (const y of [H - 110]) {
      g.beginPath();
      if (i % 2) g.arc(x, y, 22, 0, Math.PI * 2);
      else
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
          const r = k % 2 ? 11 : 26;
          g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
      g.closePath();
      g.stroke();
    }
  }
  g.font = `500 28px ${FONT}`;
  g.fillStyle = '#666';
  g.fillText(footer, W / 2, H - 40);
  return c.toDataURL('image/png');
}

/** Save a picture on the device (download). */
export async function saveImage(dataUrl: string, filename: string): Promise<void> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.setAttribute('data-gate-skip', '');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch {
    /* nothing to do: the picture stays on screen */
  }
}

/** Print a full page (only the picture shows on paper). */
export async function printImage(src: string, title: string): Promise<void> {
  document.querySelector('.ziggy-creature-print')?.remove();
  const root = document.createElement('div');
  root.className = 'ziggy-creature-print';
  const style = document.createElement('style');
  style.textContent = `
    .ziggy-creature-print { display: none; }
    @media print {
      @page { size: A4 portrait; margin: 8mm; }
      html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
      body > *:not(.ziggy-creature-print) { display: none !important; }
      .ziggy-creature-print { display: block !important; }
      .ziggy-creature-print img { width: 100%; max-height: 277mm; object-fit: contain; }
    }`;
  const img = document.createElement('img');
  img.alt = title;
  root.append(style, img);
  document.body.appendChild(root);
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
  const cleanup = () => root.remove();
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  setTimeout(cleanup, 60_000);
}

export const photoName = (name: string, kind: 'photo' | 'coloriage') =>
  `ziggy-${kind}-${name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'creature'}-${new Date().toISOString().slice(0, 10)}.${kind === 'photo' ? 'jpg' : 'png'}`;
