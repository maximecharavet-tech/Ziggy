import * as THREE from 'three';

/**
 * Child-friendly controls: tap (or click) the ground to walk there, or use the
 * arrow keys / WASD. Taps on objects are reported too (gifts, ornaments).
 */
export class Controls {
  readonly keys = new Set<string>();
  target: THREE.Vector3 | null = null;
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private down: { x: number; y: number; t: number } | null = null;

  constructor(
    private el: HTMLElement,
    private camera: THREE.Camera,
    private ground: THREE.Object3D,
    private onTapObject?: (o: THREE.Object3D) => boolean,
    private tappables: () => THREE.Object3D[] = () => []
  ) {
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointerup', this.onUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 14) return;
    const r = this.el.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const objs = this.tappables();
    if (objs.length && this.onTapObject) {
      const hit = this.ray.intersectObjects(objs, true)[0];
      if (hit) {
        let o: THREE.Object3D | null = hit.object;
        while (o && !o.userData.tappable) o = o.parent;
        if (o && this.onTapObject(o)) return;
      }
    }
    const g = this.ray.intersectObject(this.ground, false)[0];
    if (g) this.target = g.point.clone();
  };

  private onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'z', 'q'].includes(k)) {
      this.keys.add(k);
      this.target = null;
      e.preventDefault();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  /** Wanted movement on the ground plane (x, z), length 0..1, from the keys. */
  keyVector(): THREE.Vector2 {
    const v = new THREE.Vector2();
    const k = this.keys;
    if (k.has('arrowup') || k.has('w') || k.has('z')) v.y -= 1;
    if (k.has('arrowdown') || k.has('s')) v.y += 1;
    if (k.has('arrowleft') || k.has('a') || k.has('q')) v.x -= 1;
    if (k.has('arrowright') || k.has('d')) v.x += 1;
    return v.lengthSq() ? v.normalize() : v;
  }

  dispose() {
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
