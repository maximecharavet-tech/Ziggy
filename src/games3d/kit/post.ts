import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';

/** Film look after tone mapping: warm grade, soft vignette, a touch of grain. */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.32 }, uWarm: { value: 0.06 }, uGrain: { value: 0.025 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uVignette; uniform float uWarm; uniform float uGrain;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // warm highlights, slightly cooler shadows (fireplace and night window)
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb += uWarm * vec3(0.9, 0.35, -0.35) * smoothstep(0.25, 0.9, l);
      c.rgb += uWarm * vec3(-0.25, -0.05, 0.35) * (1.0 - smoothstep(0.0, 0.3, l)) * 0.5;
      // gentle S-curve
      c.rgb = mix(c.rgb, c.rgb * c.rgb * (3.0 - 2.0 * c.rgb), 0.18);
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      c.rgb += (hash(vUv * 731.0) - 0.5) * uGrain;
      gl_FragColor = c;
    }`,
};

/**
 * Soft cinematic glow: only what shines brighter than white (lamps, lit
 * windows, garland bulbs, Ziggy's heart) blooms, like in an animated film.
 * Weak devices skip it and render directly.
 */
export class Post {
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    opts: { enabled: boolean; strength?: number; radius?: number; threshold?: number; grade?: boolean; dof?: { aperture: number; maxblur: number } | null }
  ) {
    if (!opts.enabled) return;
    const size = renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 }));
    this.composer.addPass(new RenderPass(scene, camera));
    if (opts.dof) {
      // Depth of field: the room behind Santa goes soft, like a real webcam close-up.
      this.dof = new BokehPass(scene, camera, { focus: 4, aperture: opts.dof.aperture, maxblur: opts.dof.maxblur });
      this.composer.addPass(this.dof);
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), opts.strength ?? 0.55, opts.radius ?? 0.6, opts.threshold ?? 1);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    if (opts.grade) {
      this.grade = new ShaderPass(GradeShader);
      this.composer.addPass(this.grade);
    }
  }

  private grade: ShaderPass | null = null;
  private dof: BokehPass | null = null;
  private time = 0;

  /** Drops the heavy passes (depth of field first, then the film grade). */
  lighten() {
    if (this.dof?.enabled) this.dof.enabled = false;
    else if (this.grade?.enabled) this.grade.enabled = false;
  }

  /** Where the depth of field is sharp (distance from the camera). */
  setFocus(distance: number) {
    const u = this.dof?.uniforms as { focus?: { value: number } } | undefined;
    if (u?.focus) u.focus.value = distance;
  }

  setSize(w: number, h: number) {
    if (!this.composer) return;
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  render(dt?: number) {
    if (this.grade) this.grade.uniforms.uTime.value = (this.time = (this.time + (dt ?? 0.016)) % 100);
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.bloom?.dispose();
    this.dof?.dispose();
    this.grade?.dispose();
    this.composer?.dispose();
  }
}
