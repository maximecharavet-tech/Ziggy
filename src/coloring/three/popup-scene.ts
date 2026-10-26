import * as THREE from 'three';
import { disposeTree, glow } from '@/games3d/kit/look';

/**
 * "Mon dessin prend vie !": the child's drawing printed on a thick pop-up
 * card that springs up from a little stage, sways gently, can be spun with a
 * finger, with soft lights, twinkling glows and confetti. Loaded on demand.
 */

export type PopupScene = { burst(): void; dispose(): void };

const CARD = 3.3;
const ART = 2.92;
const DEPTH = 0.14;
const BEVEL = 0.05;
const PASTELS = ['#FF8FC7', '#FFD84D', '#7FD04B', '#6FC8FF', '#B79BFF', '#FF9F5A', '#5EE0C2'];

function roundedShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  s.moveTo(x + r, 0);
  s.lineTo(x + w - r, 0);
  s.quadraticCurveTo(x + w, 0, x + w, r);
  s.lineTo(x + w, h - r);
  s.quadraticCurveTo(x + w, h, x + w - r, h);
  s.lineTo(x + r, h);
  s.quadraticCurveTo(x, h, x, h - r);
  s.lineTo(x, r);
  s.quadraticCurveTo(x, 0, x + r, 0);
  return s;
}

function canvasTexture(draw: (g: CanvasRenderingContext2D, size: number) => void, size = 512): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function sparkleTexture(): THREE.CanvasTexture {
  return canvasTexture((g, s) => {
    const m = s / 2;
    const grad = g.createRadialGradient(m, m, 0, m, m, m);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.2, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(m, 4);
    g.quadraticCurveTo(m + 10, m - 10, s - 4, m);
    g.quadraticCurveTo(m + 10, m + 10, m, s - 4);
    g.quadraticCurveTo(m - 10, m + 10, 4, m);
    g.quadraticCurveTo(m - 10, m - 10, m, 4);
    g.fill();
  }, 128);
}

function backTexture(label: string): THREE.CanvasTexture {
  return canvasTexture((g, s) => {
    const grad = g.createLinearGradient(0, 0, s, s);
    grad.addColorStop(0, '#FFE3F1');
    grad.addColorStop(0.5, '#E6E0FF');
    grad.addColorStop(1, '#D9F6FF');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 26; i++) {
      const x = (i * 97) % s;
      const y = (i * 151) % s;
      g.beginPath();
      g.arc(x, y, 6 + (i % 4) * 3, 0, Math.PI * 2);
      g.fill();
    }
    // Heart
    g.save();
    g.translate(s / 2, s * 0.42);
    g.scale(s / 512, s / 512);
    g.fillStyle = '#FF6FA8';
    g.beginPath();
    g.moveTo(0, 80);
    g.bezierCurveTo(-30, 50, -110, 10, -110, -40);
    g.bezierCurveTo(-110, -100, -30, -110, 0, -55);
    g.bezierCurveTo(30, -110, 110, -100, 110, -40);
    g.bezierCurveTo(110, 10, 30, 50, 0, 80);
    g.fill();
    g.restore();
    g.fillStyle = '#5B3FA8';
    g.font = `bold ${Math.round(s * 0.085)}px Fredoka, ui-rounded, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText(label, s / 2, s * 0.78);
  });
}

export function createPopupScene(canvas: HTMLCanvasElement, art: HTMLCanvasElement, opts: { reduced: boolean; backLabel: string }): PopupScene {
  const reduced = opts.reduced;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const target = new THREE.Vector3(0, 1.85, 0);

  // Lights: warm key with soft shadows, sky/ground fill, pink and blue rims.
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0xc6e6ff, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(3.5, 7, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 6;
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -3;
  scene.add(key);
  const rimA = new THREE.PointLight(0xff8fc7, 22, 14);
  rimA.position.set(-3.5, 3.5, -2.5);
  const rimB = new THREE.PointLight(0x7fd4ff, 22, 14);
  rimB.position.set(3.5, 2.5, -3);
  scene.add(rimA, rimB);

  // Ground: soft glowing disc + shadow catcher + Ziggy-green stage.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(5, 64),
    new THREE.MeshBasicMaterial({
      map: canvasTexture((g, s) => {
        const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        grad.addColorStop(0, 'rgba(255,248,230,1)');
        grad.addColorStop(0.55, 'rgba(255,236,250,0.75)');
        grad.addColorStop(1, 'rgba(255,236,250,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, s, s);
      }),
      transparent: true,
      depthWrite: false,
    })
  );
  disc.rotation.x = -Math.PI / 2;
  scene.add(disc);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.ShadowMaterial({ opacity: 0.16 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  shadow.receiveShadow = true;
  scene.add(shadow);
  const stage = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.9, 0.32, 64), new THREE.MeshStandardMaterial({ color: '#7FD04B', roughness: 0.55 }));
  stage.position.y = 0.16;
  stage.castShadow = true;
  stage.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.76, 0.05, 12, 80), new THREE.MeshStandardMaterial({ color: '#FFD84D', roughness: 0.3, metalness: 0.4 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.32;
  scene.add(stage, rim);

  // The card: thick rounded frame, the drawing on the front, a pretty back.
  const yaw = new THREE.Group();
  yaw.position.y = 0.32;
  scene.add(yaw);
  const pivot = new THREE.Group();
  yaw.add(pivot);
  const shape = roundedShape(CARD, CARD, 0.3);
  const frameGeo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 4, curveSegments: 10 });
  frameGeo.translate(0, 0, -DEPTH / 2);
  const frame = new THREE.Mesh(frameGeo, [new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.45 }), new THREE.MeshStandardMaterial({ color: '#FFC93C', roughness: 0.35, metalness: 0.25 })]);
  frame.castShadow = true;
  pivot.add(frame);
  const tex = new THREE.CanvasTexture(art);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const front = new THREE.Mesh(new THREE.PlaneGeometry(ART, ART), new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, toneMapped: false }));
  front.position.set(0, CARD / 2, DEPTH / 2 + BEVEL + 0.004);
  pivot.add(front);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(ART, ART), new THREE.MeshStandardMaterial({ map: backTexture(opts.backLabel), roughness: 0.8 }));
  back.rotation.y = Math.PI;
  back.position.set(0, CARD / 2, -(DEPTH / 2 + BEVEL + 0.004));
  pivot.add(back);

  // Twinkling glows orbiting the card.
  const sparkTex = sparkleTexture();
  const sparks: { s: THREE.Sprite; r: number; a: number; y: number; speed: number; phase: number; base: number }[] = [];
  const n = reduced ? 10 : 24;
  for (let i = 0; i < n; i++) {
    const color = PASTELS[i % PASTELS.length];
    const soft = i % 4 === 3;
    const s = soft ? glow(color, 0.42, 0.4) : new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    if (!soft) s.scale.setScalar(0.2 + (i % 4) * 0.07);
    const entry = { s, r: 2.4 + ((i * 37) % 10) / 12, a: (i / n) * Math.PI * 2, y: 1.1 + ((i * 53) % 30) / 10, speed: 0.12 + ((i * 13) % 7) / 40, phase: i * 1.7, base: s.scale.x };
    s.position.set(Math.cos(entry.a) * entry.r, entry.y, Math.sin(entry.a) * entry.r);
    sparks.push(entry);
    scene.add(s);
  }

  // Confetti (instanced).
  const N = reduced ? 0 : 220;
  const confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.1, 0.17), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6 }), Math.max(1, N));
  confetti.frustumCulled = false;
  confetti.count = 0;
  scene.add(confetti);
  const bits = Array.from({ length: N }, (_, i) => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), phase: i, landed: false }));
  const color = new THREE.Color();
  for (let i = 0; i < N; i++) confetti.setColorAt(i, color.set(PASTELS[i % PASTELS.length]));
  const dummy = new THREE.Object3D();

  function burst() {
    if (!N) {
      flash = 1;
      return;
    }
    confetti.count = N;
    for (const b of bits) {
      b.p.set((Math.random() - 0.5) * 2.5, 4.4 + Math.random() * 2.5, (Math.random() - 0.5) * 2);
      b.v.set((Math.random() - 0.5) * 3.2, Math.random() * 2.5, (Math.random() - 0.5) * 2.4);
      b.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      b.spin.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
      b.landed = false;
    }
  }

  // Interaction: drag to spin, with inertia; gentle sway when left alone.
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let vel = 0;
  let tilt = 0;
  let idleFor = 10;
  let angle = 0;
  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    angle += dx * 0.012;
    vel = dx * 0.012 * 60;
    tilt = Math.max(-0.35, Math.min(0.35, tilt + dy * 0.004));
    idleFor = 0;
  };
  const onUp = () => {
    dragging = false;
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  const fit = () => {
    const parent = canvas.parentElement;
    const w = parent?.clientWidth || canvas.clientWidth || 300;
    const h = parent?.clientHeight || canvas.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vis = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(5.4 / vis, 5.6 / (vis * camera.aspect));
    camera.position.set(0, target.y + dist * 0.16, dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  };
  fit();
  const ro = new ResizeObserver(fit);
  if (canvas.parentElement) ro.observe(canvas.parentElement);

  // Pop-up spring: lying flat → standing, with a happy overshoot.
  let pop = reduced ? 0.0001 : -Math.PI / 2;
  let popVel = 0;
  let popScale = reduced ? 1 : 0.35;
  let scaleVel = 0;
  let flash = 0;
  pivot.rotation.x = pop;
  pivot.scale.setScalar(popScale);
  let t = 0;
  let raf = 0;
  let last = performance.now();
  let started = false;

  const frameLoop = (now: number) => {
    // Real time, even on a slow device: the springs are integrated in small sub-steps.
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    t += dt;
    if (!started && t > (reduced ? 0 : 0.25)) {
      started = true;
      if (!reduced) burst();
    }
    if (started) {
      const k = 70;
      const c = 6.5;
      for (let left = dt; left > 0; left -= 1 / 120) {
        const h = Math.min(1 / 120, left);
        popVel += (-k * pop - c * popVel) * h;
        pop += popVel * h;
        scaleVel += (-k * 1.2 * (popScale - 1) - c * scaleVel) * h;
        popScale += scaleVel * h;
      }
      if (reduced) {
        pop = 0;
        popScale = 1;
      }
    }
    pivot.rotation.x = pop;
    pivot.scale.setScalar(Math.max(0.01, popScale));
    if (!reduced) pivot.position.y = Math.sin(t * 1.6) * 0.035;

    idleFor += dt;
    if (!dragging) {
      angle += vel * dt;
      vel *= Math.pow(0.04, dt);
      if (idleFor > 2.5) {
        const sway = reduced ? 0 : Math.sin(t * 0.55) * 0.5;
        const nearest = Math.round(angle / (Math.PI * 2)) * Math.PI * 2;
        angle += (nearest + sway - angle) * Math.min(1, dt * 0.9);
        tilt *= Math.pow(0.2, dt);
      }
    }
    yaw.rotation.y = angle;
    yaw.rotation.x = tilt * 0.4;

    for (const s of sparks) {
      if (!reduced) s.a += s.speed * dt;
      s.s.position.set(Math.cos(s.a) * s.r, s.y + (reduced ? 0 : Math.sin(t * 0.9 + s.phase) * 0.15), Math.sin(s.a) * s.r);
      const tw = reduced ? 0.6 : 0.45 + 0.4 * Math.sin(t * 1.4 + s.phase);
      (s.s.material as THREE.SpriteMaterial).opacity = Math.min(1, Math.max(0.1, tw + flash * 0.5));
      s.s.scale.setScalar(s.base * (1 + flash * 0.4));
    }
    flash = Math.max(0, flash - dt * 1.2);

    if (confetti.count) {
      for (let i = 0; i < N; i++) {
        const b = bits[i];
        if (!b.landed) {
          const h = Math.min(dt, 0.05);
          b.v.y -= 3.2 * h;
          b.v.multiplyScalar(Math.pow(0.35, h));
          b.p.addScaledVector(b.v, h);
          b.p.x += Math.sin(t * 3 + b.phase) * 0.25 * dt;
          b.rot.x += b.spin.x * dt;
          b.rot.y += b.spin.y * dt;
          b.rot.z += b.spin.z * dt;
          const floor = Math.hypot(b.p.x, b.p.z) < 1.85 ? 0.34 : 0.02;
          if (b.p.y <= floor) {
            b.p.y = floor;
            b.landed = true;
            b.rot.set(-Math.PI / 2, 0, b.rot.z);
          }
        }
        dummy.position.copy(b.p);
        dummy.rotation.copy(b.rot);
        dummy.updateMatrix();
        confetti.setMatrixAt(i, dummy.matrix);
      }
      confetti.instanceMatrix.needsUpdate = true;
    }

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frameLoop);
  };
  raf = requestAnimationFrame(frameLoop);

  return {
    burst() {
      flash = 1;
      burst();
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      disposeTree(scene);
      sparkTex.dispose();
      renderer.dispose();
    },
  };
}
