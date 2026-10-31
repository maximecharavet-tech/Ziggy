import * as THREE from 'three';

/**
 * Painted textures (letter signs, speech bubbles, turbo chevrons, soap
 * bubbles, the checkered finish) and two cheap particle systems: confetti
 * (one instanced mesh) and soap bubbles (sprites).
 */

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A round sign with a big letter (or sound) in the lane's colour. */
export function letterTexture(text: string, ring: string, font: string): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = 'rgba(40,20,70,0.25)';
    g.beginPath();
    g.arc(128, 136, 118, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = ring;
    g.beginPath();
    g.arc(128, 126, 118, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(128, 126, 96, 0, Math.PI * 2);
    g.fill();
    const len = Array.from(text).length;
    g.font = `bold ${len >= 3 ? 82 : len === 2 ? 112 : 150}px ${font}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 10;
    g.strokeStyle = '#ffffff';
    g.strokeText(text, 128, 138);
    g.fillStyle = '#2b2150';
    g.fillText(text, 128, 138);
  });
}

/** A comic speech bubble ("Wiii !", "Meuh !"). */
export function bubbleSprite(text: string, font: string, color = '#2b2150'): THREE.Sprite {
  const tex = canvasTex(512, 256, (g) => {
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#ffb3d1';
    g.lineWidth = 10;
    const r = 70;
    g.beginPath();
    g.moveTo(40 + r, 20);
    g.arcTo(472, 20, 472, 190, r);
    g.arcTo(472, 190, 40, 190, r);
    g.lineTo(200, 190);
    g.lineTo(150, 245);
    g.lineTo(160, 190);
    g.arcTo(40, 190, 40, 20, r);
    g.arcTo(40, 20, 472, 20, r);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = color;
    let size = 96;
    g.font = `bold ${size}px ${font}`;
    while (g.measureText(text).width > 400 && size > 40) {
      size -= 6;
      g.font = `bold ${size}px ${font}`;
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, 110);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  s.scale.set(2.6, 1.3, 1);
  s.renderOrder = 10;
  return s;
}

/** Glowing chevrons for the turbo pads (scrolls forward). */
export function turboTexture(): THREE.CanvasTexture {
  const t = canvasTex(128, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#5ce1ff');
    grad.addColorStop(1, '#b28dff');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 256);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 18;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const y of [70, 190]) {
      g.beginPath();
      g.moveTo(22, y + 30);
      g.lineTo(64, y - 22);
      g.lineTo(106, y + 30);
      g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A soap bubble: clear middle, rainbow rim, a white shine. */
export function soapTexture(): THREE.CanvasTexture {
  return canvasTex(128, 128, (g) => {
    const rim = g.createRadialGradient(64, 64, 30, 64, 64, 62);
    rim.addColorStop(0, 'rgba(255,255,255,0.05)');
    rim.addColorStop(0.7, 'rgba(190,230,255,0.35)');
    rim.addColorStop(0.88, 'rgba(255,170,230,0.85)');
    rim.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rim;
    g.beginPath();
    g.arc(64, 64, 62, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.ellipse(44, 40, 12, 7, -0.7, 0, Math.PI * 2);
    g.fill();
  });
}

/** The puddle the bubbles come from: shimmering pastel soap. */
export function puddleTexture(): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    const grad = g.createRadialGradient(128, 128, 10, 128, 128, 124);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(120,205,255,1)');
    grad.addColorStop(0.62, 'rgba(255,140,215,1)');
    grad.addColorStop(0.85, 'rgba(170,140,255,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(128, 128, 124, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [x, y, r] of [[90, 80, 14], [160, 150, 10], [120, 180, 8], [180, 90, 9]]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  });
}

export function checkerTexture(): THREE.CanvasTexture {
  const t = canvasTex(256, 64, (g) => {
    for (let x = 0; x < 16; x++)
      for (let y = 0; y < 4; y++) {
        g.fillStyle = (x + y) % 2 ? '#2b2150' : '#ffffff';
        g.fillRect(x * 16, y * 16, 16, 16);
      }
  });
  t.magFilter = THREE.NearestFilter;
  return t;
}

/** The finish banner: checkers and a big star. */
export function bannerTexture(font: string): THREE.CanvasTexture {
  return canvasTex(1024, 192, (g) => {
    for (let x = 0; x < 32; x++)
      for (let y = 0; y < 6; y++) {
        g.fillStyle = (x + y) % 2 ? '#2b2150' : '#ffffff';
        g.fillRect(x * 32, y * 32, 32, 32);
      }
    g.fillStyle = '#ffd23f';
    g.strokeStyle = '#ff7eb6';
    g.lineWidth = 10;
    for (const cx of [512]) {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const r = i % 2 ? 36 : 84;
        g.lineTo(cx + Math.cos(a) * r, 98 + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.font = `bold 40px ${font}`;
  });
}

/* ───────────────────────── Confetti ───────────────────────── */

const CONFETTI = ['#ff6fa8', '#ffd23f', '#7ed6ff', '#a98bff', '#7be495', '#ffb347', '#ffffff'];

export class Confetti {
  readonly mesh: THREE.InstancedMesh;
  private p: Float32Array;
  private v: Float32Array;
  private rot: Float32Array;
  private life: Float32Array;
  private next = 0;
  private o = new THREE.Object3D();

  constructor(private n = 260) {
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.26), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }), n);
    this.mesh.frustumCulled = false;
    this.p = new Float32Array(n * 3);
    this.v = new Float32Array(n * 3);
    this.rot = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      this.mesh.setColorAt(i, c.set(CONFETTI[i % CONFETTI.length]));
      this.hide(i);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private hide(i: number) {
    this.o.position.set(0, -9999, 0);
    this.o.scale.setScalar(0.0001);
    this.o.updateMatrix();
    this.mesh.setMatrixAt(i, this.o.matrix);
  }

  burst(at: THREE.Vector3, count: number, spread = 3, up = 6, vel?: THREE.Vector3) {
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.n;
      this.p.set([at.x + (Math.random() - 0.5) * 0.6, at.y, at.z + (Math.random() - 0.5) * 0.6], i * 3);
      this.v.set(
        [(Math.random() - 0.5) * spread * 2 + (vel?.x ?? 0), up * (0.5 + Math.random() * 0.7) + (vel?.y ?? 0), (Math.random() - 0.5) * spread * 2 + (vel?.z ?? 0)],
        i * 3
      );
      this.rot.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3);
      this.life[i] = 2.2 + Math.random() * 1.2;
    }
  }

  update(dt: number) {
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.hide(i);
        continue;
      }
      const j = i * 3;
      this.v[j + 1] -= 7 * dt;
      // Air drag: confetti floats down.
      for (let a = 0; a < 3; a++) this.v[j + a] *= 1 - Math.min(0.9, dt * 1.6);
      this.p[j] += this.v[j] * dt + Math.sin(this.life[i] * 5 + i) * dt * 0.6;
      this.p[j + 1] += this.v[j + 1] * dt;
      this.p[j + 2] += this.v[j + 2] * dt;
      this.rot[j] += dt * 5;
      this.rot[j + 1] += dt * 3;
      this.o.position.set(this.p[j], this.p[j + 1], this.p[j + 2]);
      this.o.rotation.set(this.rot[j], this.rot[j + 1], this.rot[j + 2]);
      this.o.scale.setScalar(Math.min(1, this.life[i] * 1.5));
      this.o.updateMatrix();
      this.mesh.setMatrixAt(i, this.o.matrix);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ───────────────────────── Soap bubbles ───────────────────────── */

export class Bubbles {
  readonly group = new THREE.Group();
  private items: { s: THREE.Sprite; v: THREE.Vector3; life: number; max: number; ph: number }[] = [];
  private tex = soapTexture();

  emit(at: THREE.Vector3, count: number, spread = 1.6, up = 1.6, vel?: THREE.Vector3) {
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false }));
      s.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * 0.8, (Math.random() - 0.5) * spread));
      s.scale.setScalar(0.25 + Math.random() * 0.45);
      const v = new THREE.Vector3((Math.random() - 0.5) * 1.2, up * (0.5 + Math.random()), (Math.random() - 0.5) * 1.2);
      if (vel) v.add(vel);
      const max = 1.6 + Math.random() * 1.4;
      this.items.push({ s, v, life: max, max, ph: Math.random() * 6 });
      this.group.add(s);
    }
  }

  /** Returns how many bubbles popped this frame (for the little "pop" sounds). */
  update(dt: number): number {
    let popped = 0;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const b = this.items[i];
      b.life -= dt;
      b.v.multiplyScalar(1 - Math.min(0.5, dt * 0.8));
      b.s.position.addScaledVector(b.v, dt);
      b.s.position.x += Math.sin(b.life * 4 + b.ph) * dt * 0.4;
      const k = b.life / b.max;
      (b.s.material as THREE.SpriteMaterial).opacity = Math.min(1, k * 3);
      if (b.life <= 0) {
        this.group.remove(b.s);
        b.s.material.dispose();
        this.items.splice(i, 1);
        popped++;
      }
    }
    return popped;
  }

  dispose() {
    for (const b of this.items) b.s.material.dispose();
    this.items = [];
    this.tex.dispose();
  }
}

/* ───────────────────────── Rainbow trail ───────────────────────── */

const TRAIL = ['#ff5d5d', '#ff9f43', '#ffe14d', '#5fe08a', '#4fb6ff', '#a37bff'].map((c) => new THREE.Color(c));

/** The turbo's rainbow ribbon, laid on the road behind the kart. */
export class RainbowTrail {
  readonly mesh: THREE.Mesh;
  private n = 28;
  private across = 7;
  private pts: { p: THREE.Vector3; side: THREE.Vector3 }[] = [];
  private pos: Float32Array;
  private col: Float32Array;
  strength = 0;

  constructor(private width = 1.6) {
    const n = this.n;
    const a = this.across;
    this.pos = new Float32Array(n * a * 3);
    this.col = new Float32Array(n * a * 3);
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++)
      for (let j = 0; j < a - 1; j++) {
        const v = i * a + j;
        idx.push(v, v + a, v + 1, v + 1, v + a, v + a + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  /** Add the kart's newest point (on the road, behind it) and redraw. */
  update(p: THREE.Vector3, side: THREE.Vector3, target: number, dt: number) {
    this.strength += (target - this.strength) * Math.min(1, dt * 5);
    this.pts.unshift({ p: p.clone(), side: side.clone() });
    if (this.pts.length > this.n) this.pts.length = this.n;
    this.mesh.visible = this.strength > 0.02;
    if (!this.mesh.visible) return;
    const a = this.across;
    for (let i = 0; i < this.n; i++) {
      const q = this.pts[Math.min(i, this.pts.length - 1)];
      const fade = (1 - i / (this.n - 1)) ** 1.3 * this.strength;
      const w = this.width * (0.7 + 0.3 * (1 - i / this.n));
      for (let j = 0; j < a; j++) {
        const k = (i * a + j) * 3;
        const off = (j / (a - 1) - 0.5) * w;
        this.pos[k] = q.p.x + q.side.x * off;
        this.pos[k + 1] = q.p.y + q.side.y * off;
        this.pos[k + 2] = q.p.z + q.side.z * off;
        const c = TRAIL[Math.min(TRAIL.length - 1, Math.floor((j / (a - 1)) * TRAIL.length * 0.999))];
        this.col[k] = c.r * fade;
        this.col[k + 1] = c.g * fade;
        this.col[k + 2] = c.b * fade;
      }
    }
    const g = this.mesh.geometry;
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}
