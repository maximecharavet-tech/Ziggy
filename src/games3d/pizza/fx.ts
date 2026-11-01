import * as THREE from 'three';
import { canvasTex } from './util';

/**
 * Little sprite particles with gravity and spin: confetti, hearts, sparkles,
 * steam, fountain drops, crumbs. One pool, capped so phones stay smooth.
 */

let hearts: THREE.Texture | null = null;
let confetti: THREE.Texture | null = null;
let star: THREE.Texture | null = null;
let dot: THREE.Texture | null = null;

export function heartTexture(): THREE.Texture {
  hearts ??= canvasTex(128, 128, (g) => {
    g.translate(64, 70);
    g.beginPath();
    g.moveTo(0, 38);
    g.bezierCurveTo(-60, -2, -42, -58, 0, -26);
    g.bezierCurveTo(42, -58, 60, -2, 0, 38);
    g.closePath();
    g.fillStyle = '#ff5c8a';
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = '#ffffff';
    g.stroke();
    g.beginPath();
    g.ellipse(-18, -20, 9, 6, -0.6, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fill();
  });
  return hearts;
}

export function confettiTexture(): THREE.Texture {
  confetti ??= canvasTex(32, 32, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(4, 10, 24, 12);
  });
  return confetti;
}

export function starTexture(): THREE.Texture {
  star ??= canvasTex(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#ffffff';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 ? 7 : 30;
      g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  });
  return star;
}

export function dotTexture(): THREE.Texture {
  dot ??= canvasTex(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
  return dot;
}

export function disposeFxTextures() {
  for (const t of [hearts, confetti, star, dot]) t?.dispose();
  hearts = confetti = star = dot = null;
}

interface P {
  s: THREE.Sprite;
  v: THREE.Vector3;
  life: number;
  max: number;
  spin: number;
  grav: number;
  grow: number;
  fade: number;
  size: number;
}

export interface EmitOptions {
  tex: THREE.Texture;
  color?: THREE.ColorRepresentation | THREE.ColorRepresentation[];
  count?: number;
  spread?: number;
  up?: number;
  life?: number;
  size?: number;
  gravity?: number;
  spin?: number;
  additive?: boolean;
  grow?: number;
  opacity?: number;
}

export class Particles {
  readonly group = new THREE.Group();
  private items: P[] = [];
  constructor(private cap = 260) {}

  emit(at: THREE.Vector3, o: EmitOptions) {
    const n = o.count ?? 8;
    for (let i = 0; i < n; i++) {
      if (this.items.length >= this.cap) {
        const old = this.items.shift()!;
        this.group.remove(old.s);
        old.s.material.dispose();
      }
      const cols = Array.isArray(o.color) ? o.color : [o.color ?? '#ffffff'];
      const m = new THREE.SpriteMaterial({
        map: o.tex,
        color: cols[Math.floor(Math.random() * cols.length)],
        transparent: true,
        opacity: o.opacity ?? 1,
        depthWrite: false,
        blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        rotation: Math.random() * Math.PI * 2,
      });
      const s = new THREE.Sprite(m);
      const size = (o.size ?? 0.3) * (0.7 + Math.random() * 0.6);
      s.scale.setScalar(size);
      s.position.copy(at);
      const sp = o.spread ?? 1;
      const v = new THREE.Vector3((Math.random() - 0.5) * sp, (o.up ?? 2) * (0.6 + Math.random() * 0.8), (Math.random() - 0.5) * sp);
      const max = (o.life ?? 1.5) * (0.7 + Math.random() * 0.6);
      this.items.push({ s, v, life: max, max, spin: (Math.random() - 0.5) * (o.spin ?? 0), grav: o.gravity ?? 0, grow: o.grow ?? 0, fade: o.opacity ?? 1, size });
      this.group.add(s);
    }
  }

  update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      p.v.y -= p.grav * dt;
      p.s.position.addScaledVector(p.v, dt);
      const m = p.s.material as THREE.SpriteMaterial;
      m.rotation += p.spin * dt;
      if (p.grow) p.s.scale.setScalar(p.size * (1 + (1 - p.life / p.max) * p.grow));
      m.opacity = Math.min(1, (p.life / p.max) * 2.5) * p.fade;
      if (p.life <= 0) {
        this.group.remove(p.s);
        m.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const p of this.items) {
      this.group.remove(p.s);
      p.s.material.dispose();
    }
    this.items = [];
  }
}
