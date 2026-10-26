import * as THREE from 'three';
import { glowTex, hillHeight, mat } from './look';

const PALETTE_SNOW = { light: '#dfe7ff', shade: '#9fb0e0' };

/** Snowy ground: a gently rolling plane with painted vertex colours (snow, blue shade). */
export function makeSnowGround(size = 120, flatRadius = 22): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size, size, 60, 60);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors: number[] = [];
  const snow = new THREE.Color(PALETTE_SNOW.light);
  const shade = new THREE.Color(PALETTE_SNOW.shade);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const d = Math.hypot(x, z);
    // The village square stays flat; hills rise around it.
    const k = Math.max(0, Math.min(1, (d - flatRadius) / 14));
    const y = hillHeight(x, z) * k + k * k * 3;
    pos.setY(i, y);
    const c = snow.clone().lerp(shade, Math.max(0, Math.min(1, 0.15 + Math.sin(x * 0.7) * Math.cos(z * 0.6) * 0.12 + k * 0.25)));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, mat('#ffffff', { vertexColors: true }));
  ground.receiveShadow = true;
  ground.name = 'ground';
  return ground;
}

/** Falling snow: one Points cloud recycled around the camera. */
export class Snowfall {
  readonly points: THREE.Points;
  private speeds: Float32Array;
  constructor(count: number, private area = 40, private height = 22) {
    const pos = new Float32Array(count * 3);
    this.speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * area;
      pos[i * 3 + 1] = Math.random() * height;
      pos[i * 3 + 2] = (Math.random() - 0.5) * area;
      this.speeds[i] = 0.6 + Math.random() * 1.1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: '#ffffff', map: glowTex(), size: 0.28, transparent: true, opacity: 0.95, depthWrite: false })
    );
    this.points.frustumCulled = false;
  }
  update(dt: number, t: number, center: THREE.Vector3) {
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < this.speeds.length; i++) {
      arr[i * 3 + 1] -= this.speeds[i] * dt;
      arr[i * 3] += Math.sin(t * 0.7 + i) * 0.15 * dt;
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = this.height;
        arr[i * 3] = center.x + (Math.random() - 0.5) * this.area;
        arr[i * 3 + 2] = center.z + (Math.random() - 0.5) * this.area;
      }
    }
    pos.needsUpdate = true;
  }
}

/** Puffs of chimney smoke / sparkles: short-lived sprites that rise and fade. */
export class Puffs {
  readonly group = new THREE.Group();
  private items: { s: THREE.Sprite; v: THREE.Vector3; life: number; max: number; grow: number }[] = [];
  constructor(private texture: THREE.Texture) {}
  emit(at: THREE.Vector3, opts: { color?: THREE.ColorRepresentation; count?: number; spread?: number; up?: number; life?: number; size?: number; additive?: boolean } = {}) {
    for (let i = 0; i < (opts.count ?? 6); i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.texture,
          color: opts.color ?? '#e8eefc',
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
          blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        })
      );
      s.position.copy(at);
      s.scale.setScalar(opts.size ?? 0.6);
      const sp = opts.spread ?? 0.6;
      const v = new THREE.Vector3((Math.random() - 0.5) * sp, (opts.up ?? 1.2) * (0.6 + Math.random() * 0.8), (Math.random() - 0.5) * sp);
      const max = (opts.life ?? 1.8) * (0.7 + Math.random() * 0.6);
      this.items.push({ s, v, life: max, max, grow: 0.8 + Math.random() * 0.6 });
      this.group.add(s);
    }
  }
  update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      p.s.position.addScaledVector(p.v, dt);
      p.s.scale.multiplyScalar(1 + p.grow * dt * 0.5);
      (p.s.material as THREE.SpriteMaterial).opacity = Math.max(0, p.life / p.max) * 0.8;
      if (p.life <= 0) {
        this.group.remove(p.s);
        p.s.material.dispose();
        this.items.splice(i, 1);
      }
    }
  }
}
