import * as THREE from 'three';
import { mat } from '../../kit/look';
import { CameraRig } from '../camera';
import type { BaseGameCommands, BaseGameEvents } from '../events';
import type { CommandOf, GameDefinition, GameHost, HostScene } from '../host';
import type { InputEvent } from '../input/actions';
import { ease } from '../tween';

/**
 * Engine demo (test harness only, no public route): a felt cube and a ball,
 * each with a DOM hotspot. Selecting one makes it hop and counts the taps.
 * Exercises the host, the scene stack, the camera rig, tweens, hotspots and
 * the event bus end to end in a real browser.
 */

export type DemoHud = { taps: Record<'cube' | 'ball', number>; focused: string | null };
export type DemoEvents = BaseGameEvents<DemoHud>;
export type DemoCommands = BaseGameCommands & { reset: void };
type Host = GameHost<DemoEvents, DemoCommands>;

class DemoScene implements HostScene<DemoEvents, DemoCommands> {
  readonly id = 'demo.room';
  view: { scene: THREE.Scene; camera: THREE.PerspectiveCamera };
  private rig = new CameraRig({ c: [0, 0.6, 0], r: 6, pitch: 0.42, yaw: 0.35 });
  private items: Record<'cube' | 'ball', THREE.Mesh> = {} as Record<'cube' | 'ball', THREE.Mesh>;
  private hud: DemoHud = { taps: { cube: 0, ball: 0 }, focused: null };
  private host!: Host;
  private t = 0;

  constructor() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#bfe3ff');
    this.view = { scene, camera: new THREE.PerspectiveCamera(45, 1, 0.1, 100) };
  }

  load(host: Host) {
    this.host = host;
    const { scene } = this.view;
    scene.add(new THREE.HemisphereLight('#fff7e8', '#8fb7d9', 1.4));
    const sun = new THREE.DirectionalLight('#fff0d6', 2);
    sun.position.set(3, 6, 4);
    scene.add(sun);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(5, 32), mat('#f4d9a8'));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat('#ec4a3f'));
    cube.position.set(-1.2, 0.5, 0);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 14), mat('#3fa7ec'));
    ball.position.set(1.4, 0.35, 0.4);
    scene.add(cube, ball);
    this.items = { cube, ball };
    this.rig.reducedMotion = host.reducedMotion;
    this.rig.addView('wide', { c: [0, 0.6, 0], r: 6, pitch: 0.42, yaw: 0.35 });
  }

  enter(host: Host) {
    host.input.hotspots.set([
      { id: 'cube', label: { fr: 'Le cube rouge', en: 'The red cube' }, at: this.items.cube.position, size: 1, order: 1, attrs: { 'data-testid': 'hotspot-cube' } },
      // A small ball: its target is still ≥ 64 px.
      { id: 'ball', label: { fr: 'La balle bleue', en: 'The blue ball' }, at: this.items.ball.position, size: 0.7, order: 2, attrs: { 'data-testid': 'hotspot-ball' } },
    ]);
    // Canvas taps resolve to the same ids through a raycast.
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    host.input.setPick((p) => {
      ndc.set(p.x, p.y);
      ray.setFromCamera(ndc, this.view.camera);
      const hit = ray.intersectObjects([this.items.cube, this.items.ball], false)[0];
      return hit ? (hit.object === this.items.cube ? 'cube' : 'ball') : null;
    });
    this.rig.goTo('wide', { cut: true });
    host.emit('hud', this.hud);
  }

  resize(w: number, h: number) {
    this.rig.aspect = w / h;
  }

  input(e: InputEvent) {
    const a = e.action;
    if (a.type === 'select' && (a.target === 'cube' || a.target === 'ball')) this.tap(a.target);
    if (a.type === 'focus' && a.target !== undefined) {
      this.hud = { ...this.hud, focused: a.target ?? null };
      const o = a.target === 'cube' || a.target === 'ball' ? this.items[a.target].position : null;
      this.rig.follow(o ? [o.x, o.y, o.z] : null, 0.25);
      this.host.emit('hud', this.hud);
      this.host.emit('focus', { id: a.target ?? null });
    }
    if (a.type === 'pan') this.rig.pan(-a.dx * 0.01);
  }

  command(c: CommandOf<DemoCommands>) {
    if (c.type === 'reset') {
      this.hud = { taps: { cube: 0, ball: 0 }, focused: this.hud.focused };
      this.host.emit('hud', this.hud);
    }
  }

  update(dt: number) {
    this.t += dt;
    this.rig.update(dt);
    this.rig.applyTo(this.view.camera);
    if (!this.host.reducedMotion) this.items.cube.rotation.y += dt * 0.4;
  }

  dispose() {
    this.host?.input.hotspots.set([]);
  }

  private tap(id: 'cube' | 'ball') {
    const o = this.items[id];
    const base = id === 'cube' ? 0.5 : 0.35;
    this.host.tween.killTweensOf(o.position);
    this.host.tween.run((k) => (o.position.y = base + k * 0.6), { duration: 0.45, ease: ease.hop });
    this.host.audio?.sfx('pick');
    this.hud = { ...this.hud, taps: { ...this.hud.taps, [id]: this.hud.taps[id] + 1 } };
    this.host.emit('hud', this.hud);
    this.host.emit('say', { id: `demo.${id}`, who: 'ziggy', lines: [id === 'cube' ? { fr: 'Hop, le cube !', en: 'Hop, the cube!' } : { fr: 'Boing, la balle !', en: 'Boing, the ball!' }] });
  }
}

export const demoGame: GameDefinition<DemoEvents, DemoCommands> = {
  id: 'engine-demo',
  async start(host) {
    await host.push(new DemoScene());
  },
};
