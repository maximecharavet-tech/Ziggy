/**
 * Photo booth — a 2D stand-in for the 3D booth scene (same SantaSceneHandle
 * contract as src/components/santa/SantaScene.tsx). Used while the 3D scene
 * loads and on devices where WebGL is not available: a festive painted room
 * per scene and a friendly code-drawn Santa who breathes, laughs and waves.
 * Santa stands on the left; the child's slot is the right side.
 */
import type { BoothSceneId, BoothSlot, SantaSceneHandle } from '@/lib/santa/types';

type Expression = Parameters<SantaSceneHandle['setExpression']>[0];

const TAU = Math.PI * 2;

export function createFallbackBackdrop(host: HTMLElement, scene: BoothSceneId): SantaSceneHandle {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  let current: BoothSceneId = scene;
  let expr: Expression = 'idle';
  let exprAt = performance.now();
  let raf = 0;
  let alive = true;
  let lastDraw = 0;

  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(160, Math.round(host.clientWidth * dpr));
    const h = Math.max(200, Math.round(host.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };

  const slot = (): BoothSlot => {
    const W = canvas.width;
    const H = canvas.height;
    return { x: W * 0.5, y: H * 0.3, w: W * 0.44, h: H * 0.6 };
  };

  const frame = (now: number) => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (now - lastDraw < 33) return; // ~30 fps is plenty for a painted backdrop
    lastDraw = now;
    resize();
    const t = now / 1000;
    paintScene(ctx, canvas.width, canvas.height, current, t);
    paintSanta(ctx, canvas.width, canvas.height, expr, t, (now - exprAt) / 1000);
  };
  resize();
  raf = requestAnimationFrame(frame);

  return {
    canvas,
    setTalk() {},
    setExpression(e) {
      expr = e;
      exprAt = performance.now();
    },
    setScene(id) {
      current = id;
    },
    getSlot: slot,
    resize,
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      canvas.remove();
    },
  };
}

// ——— painting ———

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function vgrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

function paintScene(ctx: CanvasRenderingContext2D, W: number, H: number, scene: BoothSceneId, t: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const floorY = H * 0.78;
  if (scene === 'cheminee' || scene === 'atelier') {
    // Wall
    ctx.fillStyle = scene === 'cheminee' ? vgrad(ctx, 0, floorY, [[0, '#5b1424'], [1, '#8a2433']]) : vgrad(ctx, 0, floorY, [[0, '#5a3418'], [1, '#8a5428']]);
    ctx.fillRect(0, 0, W, floorY);
    if (scene === 'cheminee') {
      // Wallpaper stripes
      ctx.fillStyle = 'rgba(255,220,180,0.05)';
      for (let x = 0; x < W; x += W / 14) ctx.fillRect(x, 0, W / 28, floorY);
    } else {
      // Planks
      ctx.strokeStyle = 'rgba(40,20,5,0.35)';
      ctx.lineWidth = Math.max(1, W * 0.003);
      for (let x = 0; x < W; x += W / 9) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, floorY);
        ctx.stroke();
      }
    }
    // Floor
    ctx.fillStyle = vgrad(ctx, floorY, H, [[0, '#4a2a17'], [1, '#2a170c']]);
    ctx.fillRect(0, floorY, W, H - floorY);
    if (scene === 'cheminee') {
      // Fireplace (centre-right, behind the child slot edge)
      const fx = W * 0.56;
      const fw = W * 0.4;
      const fy = H * 0.42;
      ctx.fillStyle = '#d9c7b0';
      ctx.fillRect(fx - fw / 2, fy, fw, floorY - fy);
      ctx.fillStyle = '#efe2cf';
      ctx.fillRect(fx - fw * 0.58, fy - H * 0.035, fw * 1.16, H * 0.04);
      ctx.fillStyle = '#1b0d08';
      const ow = fw * 0.62;
      const oh = (floorY - fy) * 0.66;
      ctx.beginPath();
      ctx.moveTo(fx - ow / 2, floorY);
      ctx.lineTo(fx - ow / 2, floorY - oh * 0.7);
      ctx.quadraticCurveTo(fx, floorY - oh * 1.15, fx + ow / 2, floorY - oh * 0.7);
      ctx.lineTo(fx + ow / 2, floorY);
      ctx.fill();
      // Fire
      const flick = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3);
      glow(ctx, fx, floorY - oh * 0.25, W * 0.35 * flick, 'rgba(255,140,40,0.55)');
      for (let i = 0; i < 5; i++) {
        const x = fx + (i - 2) * ow * 0.12;
        const hh = oh * (0.45 + 0.15 * Math.sin(t * (6 + i) + i));
        ctx.fillStyle = i % 2 ? '#ffb02e' : '#ff7a1a';
        ctx.beginPath();
        ctx.moveTo(x - ow * 0.08, floorY - oh * 0.05);
        ctx.quadraticCurveTo(x, floorY - hh * 1.3, x + ow * 0.08, floorY - oh * 0.05);
        ctx.fill();
      }
      // Stockings
      const cols = ['#d61f2c', '#1f7a3a', '#d61f2c'];
      for (let i = 0; i < 3; i++) {
        const sx = fx - fw * 0.35 + i * fw * 0.35;
        const sy = fy + H * 0.005;
        ctx.fillStyle = cols[i];
        ctx.beginPath();
        ctx.roundRect(sx - W * 0.022, sy, W * 0.044, H * 0.08, W * 0.01);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(sx + W * 0.005, sy + H * 0.08, W * 0.034, H * 0.018, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx - W * 0.026, sy - H * 0.004, W * 0.052, H * 0.018);
      }
    } else {
      // Workshop shelves with toys
      const r = rng(7);
      for (let s = 0; s < 3; s++) {
        const y = H * (0.2 + s * 0.17);
        ctx.fillStyle = '#3d2210';
        ctx.fillRect(W * 0.04, y, W * 0.92, H * 0.014);
        for (let x = W * 0.06; x < W * 0.92; x += W * (0.07 + r() * 0.05)) {
          const bw = W * (0.04 + r() * 0.04);
          const bh = H * (0.04 + r() * 0.05);
          ctx.fillStyle = ['#e94b4b', '#3aa0e8', '#f6c445', '#58c06a', '#b07ce8'][Math.floor(r() * 5)];
          ctx.beginPath();
          ctx.roundRect(x, y - bh, bw, bh, W * 0.006);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillRect(x + bw / 2 - W * 0.003, y - bh, W * 0.006, bh);
        }
      }
      glow(ctx, W * 0.75, H * 0.12, W * 0.5, 'rgba(255,200,120,0.45)');
    }
    // Garland of lights
    for (let i = 0; i <= 12; i++) {
      const x = (i / 12) * W;
      const y = H * 0.07 + Math.sin((i / 12) * Math.PI) * H * 0.04;
      const on = 0.6 + 0.4 * Math.sin(t * 2 + i * 1.7);
      glow(ctx, x, y, W * 0.05, ['rgba(255,80,80,0.9)', 'rgba(255,210,90,0.9)', 'rgba(90,220,120,0.9)', 'rgba(110,170,255,0.9)'][i % 4], on);
    }
  } else {
    // Outdoors: night (sleigh) or dusk (reindeer)
    ctx.fillStyle =
      scene === 'traineau'
        ? vgrad(ctx, 0, floorY, [[0, '#0b1240'], [0.6, '#2b2a72'], [1, '#6a4a9a']])
        : vgrad(ctx, 0, floorY, [[0, '#1d2a6b'], [0.55, '#8b5fa8'], [1, '#f2a3a0']]);
    ctx.fillRect(0, 0, W, floorY + 2);
    const r = rng(scene === 'traineau' ? 3 : 5);
    for (let i = 0; i < 70; i++) {
      const x = r() * W;
      const y = r() * floorY * 0.7;
      const a = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.5 + r()) + i));
      ctx.fillStyle = `rgba(255,250,230,${a * (scene === 'traineau' ? 0.9 : 0.5)})`;
      ctx.fillRect(x, y, Math.max(1, W * 0.003), Math.max(1, W * 0.003));
    }
    if (scene === 'traineau') {
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath();
      ctx.arc(W * 0.8, H * 0.14, W * 0.07, 0, TAU);
      ctx.fill();
      glow(ctx, W * 0.8, H * 0.14, W * 0.3, 'rgba(255,240,200,0.35)');
    }
    // Hills of snow
    ctx.fillStyle = '#dfe8f7';
    ctx.beginPath();
    ctx.moveTo(0, floorY - H * 0.06);
    ctx.quadraticCurveTo(W * 0.3, floorY - H * 0.14, W * 0.6, floorY - H * 0.05);
    ctx.quadraticCurveTo(W * 0.85, floorY - H * 0.1, W, floorY - H * 0.07);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
    // Pines
    for (let i = 0; i < 6; i++) {
      const x = W * (0.05 + i * 0.19 + (i % 2) * 0.04);
      const base = floorY - H * (0.06 + (i % 3) * 0.015);
      const th = H * (0.16 + (i % 3) * 0.05);
      ctx.fillStyle = '#1d4d3a';
      for (let k = 0; k < 3; k++) {
        const y0 = base - th * (k * 0.3);
        const ww = W * 0.07 * (1 - k * 0.25);
        ctx.beginPath();
        ctx.moveTo(x - ww, y0);
        ctx.lineTo(x, y0 - th * 0.45);
        ctx.lineTo(x + ww, y0);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.arc(x, base - th * 0.85, W * 0.012, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = vgrad(ctx, floorY, H, [[0, '#eef3fb'], [1, '#c9d6ec']]);
    ctx.fillRect(0, floorY, W, H - floorY);
    if (scene === 'traineau') {
      // Sleigh behind Santa
      ctx.fillStyle = '#b3131f';
      ctx.beginPath();
      ctx.moveTo(W * 0.02, floorY - H * 0.02);
      ctx.lineTo(W * 0.02, floorY - H * 0.2);
      ctx.quadraticCurveTo(W * 0.12, floorY - H * 0.26, W * 0.16, floorY - H * 0.16);
      ctx.lineTo(W * 0.5, floorY - H * 0.14);
      ctx.quadraticCurveTo(W * 0.56, floorY - H * 0.02, W * 0.44, floorY - H * 0.02);
      ctx.fill();
      ctx.strokeStyle = '#f2c14e';
      ctx.lineWidth = W * 0.008;
      ctx.beginPath();
      ctx.moveTo(0, floorY + H * 0.005);
      ctx.lineTo(W * 0.52, floorY + H * 0.005);
      ctx.quadraticCurveTo(W * 0.6, floorY, W * 0.58, floorY - H * 0.05);
      ctx.stroke();
    } else {
      // A reindeer in the distance, with a glowing nose
      const rx = W * 0.36;
      const ry = floorY - H * 0.09;
      const s = W * 0.0011;
      ctx.fillStyle = '#7a4a2a';
      ctx.beginPath();
      ctx.ellipse(rx, ry, 60 * s, 30 * s, 0, 0, TAU);
      ctx.fill();
      ctx.fillRect(rx - 50 * s, ry, 10 * s, 50 * s);
      ctx.fillRect(rx + 40 * s, ry, 10 * s, 50 * s);
      ctx.beginPath();
      ctx.ellipse(rx + 70 * s, ry - 45 * s, 22 * s, 18 * s, 0, 0, TAU);
      ctx.fill();
      ctx.fillRect(rx + 50 * s, ry - 40 * s, 18 * s, 40 * s);
      ctx.strokeStyle = '#5a361d';
      ctx.lineWidth = 6 * s;
      ctx.beginPath();
      ctx.moveTo(rx + 65 * s, ry - 60 * s);
      ctx.lineTo(rx + 55 * s, ry - 100 * s);
      ctx.moveTo(rx + 58 * s, ry - 85 * s);
      ctx.lineTo(rx + 40 * s, ry - 95 * s);
      ctx.moveTo(rx + 78 * s, ry - 60 * s);
      ctx.lineTo(rx + 92 * s, ry - 100 * s);
      ctx.stroke();
      ctx.fillStyle = '#ff2b2b';
      ctx.beginPath();
      ctx.arc(rx + 92 * s, ry - 42 * s, 7 * s, 0, TAU);
      ctx.fill();
      glow(ctx, rx + 92 * s, ry - 42 * s, 40 * s * (1 + 0.2 * Math.sin(t * 3)), 'rgba(255,60,60,0.7)');
    }
  }
  ctx.restore();
}

function paintSanta(ctx: CanvasRenderingContext2D, W: number, H: number, expr: Expression, t: number, since: number) {
  const s = Math.min(W / 800, H / 1000) * 0.82;
  const cx = W * 0.28;
  const feet = H * 0.95;
  const breathe = Math.sin(t * 2) * 4 * s;
  const laugh = expr === 'laugh' ? Math.abs(Math.sin(since * 12)) * 10 * s : 0;
  ctx.save();
  ctx.translate(cx, feet);
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 190 * s, 26 * s, 0, 0, TAU);
  ctx.fill();
  ctx.translate(0, -laugh);
  // Boots
  ctx.fillStyle = '#1d1414';
  ctx.beginPath();
  ctx.roundRect(-110 * s, -60 * s, 95 * s, 60 * s, 18 * s);
  ctx.roundRect(15 * s, -60 * s, 95 * s, 60 * s, 18 * s);
  ctx.fill();
  // Body (coat)
  const bodyTop = -520 * s + breathe;
  const coat = ctx.createLinearGradient(-200 * s, 0, 200 * s, 0);
  coat.addColorStop(0, '#9e0f1c');
  coat.addColorStop(0.5, '#e02a36');
  coat.addColorStop(1, '#a3101d');
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.moveTo(-120 * s, bodyTop + 40 * s);
  ctx.quadraticCurveTo(-240 * s, -200 * s, -190 * s, -50 * s);
  ctx.lineTo(190 * s, -50 * s);
  ctx.quadraticCurveTo(240 * s, -200 * s, 120 * s, bodyTop + 40 * s);
  ctx.quadraticCurveTo(0, bodyTop - 10 * s, -120 * s, bodyTop + 40 * s);
  ctx.fill();
  // Fur hem and front
  ctx.fillStyle = '#fbf6ee';
  ctx.beginPath();
  ctx.roundRect(-200 * s, -80 * s, 400 * s, 44 * s, 22 * s);
  ctx.fill();
  ctx.fillRect(-22 * s, bodyTop + 60 * s, 44 * s, -bodyTop - 140 * s);
  // Belt
  ctx.fillStyle = '#1d1414';
  ctx.fillRect(-212 * s, -230 * s + breathe * 0.5, 424 * s, 46 * s);
  ctx.fillStyle = '#f2c14e';
  ctx.fillRect(-36 * s, -238 * s + breathe * 0.5, 72 * s, 62 * s);
  ctx.fillStyle = '#1d1414';
  ctx.fillRect(-20 * s, -222 * s + breathe * 0.5, 40 * s, 30 * s);
  // Left arm (resting)
  ctx.fillStyle = '#c81e2b';
  ctx.beginPath();
  ctx.ellipse(-185 * s, -300 * s + breathe, 48 * s, 130 * s, 0.25, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fbf6ee';
  ctx.beginPath();
  ctx.ellipse(-210 * s, -190 * s + breathe, 46 * s, 22 * s, 0.25, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2f6b3a';
  ctx.beginPath();
  ctx.arc(-218 * s, -160 * s + breathe, 34 * s, 0, TAU);
  ctx.fill();
  // Right arm (waves)
  // The arm hangs along +y; rotating by a negative angle swings the hand outwards and up.
  const lift = expr === 'wave' ? Math.min(1, since * 3) : 0;
  const angle = -(0.25 + lift * (2.25 + Math.sin(since * 7) * 0.35)) - (expr === 'wink' ? 0.3 : 0);
  ctx.save();
  ctx.translate(165 * s, bodyTop + 110 * s);
  ctx.rotate(angle);
  ctx.fillStyle = '#c81e2b';
  ctx.beginPath();
  ctx.roundRect(-40 * s, -10 * s, 80 * s, 230 * s, 40 * s);
  ctx.fill();
  ctx.fillStyle = '#fbf6ee';
  ctx.beginPath();
  ctx.roundRect(-46 * s, 200 * s, 92 * s, 40 * s, 20 * s);
  ctx.fill();
  ctx.fillStyle = '#2f6b3a';
  ctx.beginPath();
  ctx.arc(0, 270 * s, 38 * s, 0, TAU);
  ctx.fill();
  ctx.restore();
  // Head
  const headY = bodyTop - 70 * s;
  ctx.fillStyle = '#f6cfb5';
  ctx.beginPath();
  ctx.arc(0, headY, 92 * s, 0, TAU);
  ctx.fill();
  // Beard
  ctx.fillStyle = '#ffffff';
  const r = rng(11);
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * (0.05 + (i / 15) * 0.9);
    const rr = (95 + r() * 30) * s;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 80 * s, headY + 20 * s + Math.sin(a) * rr * 0.9, (45 + r() * 15) * s, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(0, headY + 120 * s, 95 * s, 70 * s, 0, 0, TAU);
  ctx.fill();
  // Cheeks, nose, eyes
  ctx.fillStyle = 'rgba(240,110,110,0.45)';
  ctx.beginPath();
  ctx.arc(-48 * s, headY + 10 * s, 20 * s, 0, TAU);
  ctx.arc(48 * s, headY + 10 * s, 20 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ec9a8a';
  ctx.beginPath();
  ctx.arc(0, headY + 8 * s, 18 * s, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#3a2620';
  ctx.lineWidth = 7 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(-34 * s, headY - 14 * s, 13 * s, Math.PI * 1.1, Math.PI * 1.9);
  if (expr === 'wink') {
    ctx.moveTo(22 * s, headY - 20 * s);
    ctx.lineTo(46 * s, headY - 20 * s);
  } else ctx.arc(34 * s, headY - 14 * s, 13 * s, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  // Moustache + smile
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(-30 * s, headY + 34 * s, 36 * s, 18 * s, -0.25, 0, TAU);
  ctx.ellipse(30 * s, headY + 34 * s, 36 * s, 18 * s, 0.25, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#8a2a2a';
  ctx.beginPath();
  ctx.ellipse(0, headY + 58 * s, (expr === 'laugh' ? 22 : 16) * s, (expr === 'laugh' ? 16 : 8) * s, 0, 0, Math.PI);
  ctx.fill();
  // Hat
  ctx.fillStyle = '#d4202d';
  ctx.beginPath();
  ctx.moveTo(-92 * s, headY - 50 * s);
  ctx.quadraticCurveTo(-10 * s, headY - 230 * s, 130 * s, headY - 150 * s + Math.sin(t * 2.2) * 6 * s);
  ctx.quadraticCurveTo(40 * s, headY - 140 * s, 92 * s, headY - 50 * s);
  ctx.fill();
  ctx.fillStyle = '#fbf6ee';
  ctx.beginPath();
  ctx.roundRect(-104 * s, headY - 78 * s, 208 * s, 46 * s, 23 * s);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(134 * s, headY - 146 * s + Math.sin(t * 2.2) * 6 * s, 26 * s, 0, TAU);
  ctx.fill();
  ctx.restore();
}
