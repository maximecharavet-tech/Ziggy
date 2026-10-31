import * as THREE from 'three';
import { glow } from '../kit/look';

/**
 * Ziggy's detective outfit, built in code: a little checked deerstalker cap
 * (it sits between his antennas) and a magnifying glass for his hand.
 */

function plaidTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b07a48';
  g.fillRect(0, 0, 64, 64);
  // A bold check, readable even when Ziggy is small on screen.
  g.fillStyle = 'rgba(70,40,22,0.75)';
  for (let i = 0; i < 2; i++) {
    g.fillRect(i * 32 + 4, 0, 10, 64);
    g.fillRect(0, i * 32 + 4, 64, 10);
  }
  g.fillStyle = 'rgba(255,226,170,0.7)';
  for (let i = 0; i < 2; i++) {
    g.fillRect(i * 32 + 22, 0, 3, 64);
    g.fillRect(0, i * 32 + 22, 64, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 1.5);
  return t;
}

/** The deerstalker: a round checked crown, a peak at the front and one at the back, a bow on top. */
export function makeDetectiveCap(): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ map: plaidTex(), roughness: 0.9, color: '#ffffff' });
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), m);
  crown.scale.set(1, 1.05, 1.1);
  crown.castShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.268, 0.032, 8, 28), new THREE.MeshStandardMaterial({ color: '#6b4226', roughness: 0.85 }));
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1, 1.1, 1);
  rim.position.y = 0.01;
  g.add(crown, rim);
  // Peaks at the front and the back: the deerstalker look.
  for (const s of [1, -1]) {
    const peak = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.03, 20, 1, false, -Math.PI / 2, Math.PI), m);
    peak.scale.set(0.95, 1, 0.85);
    peak.position.set(0, 0.0, s * 0.26);
    peak.rotation.x = s * 0.32;
    if (s < 0) peak.rotation.y = Math.PI;
    peak.castShadow = true;
    g.add(peak);
  }
  const brown = new THREE.MeshStandardMaterial({ color: '#6b4226', roughness: 0.85 });
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), brown);
  button.position.y = 0.285;
  // A little bow on top (the tied ear flaps).
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.13, 4), brown);
    loop.rotation.z = (s * Math.PI) / 2;
    loop.position.set(s * 0.07, 0.27, -0.02);
    loop.scale.z = 0.5;
    g.add(loop);
  }
  g.add(button);
  g.position.y = -0.035;
  g.rotation.x = -0.1;
  return g;
}

export interface Magnifier {
  group: THREE.Group;
  lens: THREE.Mesh;
  shine: THREE.Sprite;
}

export function makeMagnifier(): Magnifier {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#8a5530', roughness: 0.6 });
  const gold = new THREE.MeshStandardMaterial({ color: '#ffcf4a', metalness: 0.7, roughness: 0.3, emissive: '#5a3b00', emissiveIntensity: 0.3 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.26, 10), wood);
  handle.castShadow = true;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.05, 10), gold);
  collar.position.y = 0.15;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.024, 10, 28), gold);
  ring.position.y = 0.31;
  ring.castShadow = true;
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.135, 24),
    new THREE.MeshPhongMaterial({ color: '#cfeeff', transparent: true, opacity: 0.35, shininess: 140, specular: '#ffffff', side: THREE.DoubleSide, depthWrite: false })
  );
  lens.position.y = 0.31;
  const shine = glow('#ffffff', 0.35, 0.0);
  shine.position.set(0.05, 0.36, 0.02);
  group.add(handle, collar, ring, lens, shine);
  return { group, lens, shine };
}
