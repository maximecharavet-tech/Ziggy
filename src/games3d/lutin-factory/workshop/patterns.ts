import * as THREE from 'three';

/**
 * The toys' felt material with a per-instance PATTERN (colour-blind safe,
 * design doc B5): every paint colour also gets a soft pattern on the toy,
 * and wrapping paper gets a bold white pattern. One material for every toy
 * primitive, so the shader compiles once; the pattern code rides in the
 * instanced attribute `aPat` (palette.ts: paints 1–7, papers 11–15, 0 none).
 * Patterns are drawn in object space (box-projected by the face normal).
 */

const VERT_HEAD = /* glsl */ `
attribute float aPat;
varying vec3 vPatPos;
varying vec3 vPatN;
varying float vPat;
`;

const FRAG_HEAD = /* glsl */ `
varying vec3 vPatPos;
varying vec3 vPatN;
varying float vPat;
float zgDisc(vec2 g, float r) { return 1.0 - smoothstep(r - 0.03, r + 0.03, length(g)); }
`;

const FRAG_BODY = /* glsl */ `
if (vPat > 0.5) {
  vec3 an = abs(normalize(vPatN));
  vec2 uv = an.x > an.y && an.x > an.z ? vPatPos.zy : (an.y > an.z ? vPatPos.xz : vPatPos.xy);
  float m = 0.0;
  if (vPat < 10.0) {
    float k = 7.0;
    if (vPat < 1.5) m = step(0.5, fract((uv.x + uv.y) * k));
    else if (vPat < 2.5) m = zgDisc(fract(uv * k) - 0.5, 0.2);
    else if (vPat < 3.5) m = step(0.5, fract(uv.y * k + sin(uv.x * 9.0) * 0.3));
    else if (vPat < 4.5) { vec2 c = step(0.5, fract(uv * k * 0.6)); m = abs(c.x - c.y); }
    else if (vPat < 5.5) m = step(0.5, fract(uv.x * k));
    else if (vPat < 6.5) { float r = length(fract(uv * k * 0.8) - 0.5); m = step(0.16, r) * step(r, 0.3); }
    diffuseColor.rgb *= 1.0 - 0.17 * m;
  } else {
    vec2 g = fract(uv * 4.0) - 0.5;
    if (vPat < 11.5) m = step(0.62, fract((uv.x - uv.y) * 3.0));
    else if (vPat < 12.5) m = zgDisc(g, 0.17);
    else if (vPat < 13.5) { float d = abs(g.x) + abs(g.y); float c = min(abs(g.x), abs(g.y)); m = step(d + c * 3.0, 0.3); }
    else if (vPat < 14.5) { float r = step(length(g), 0.3); m = r * clamp(step(abs(g.x), 0.035) + step(abs(g.y), 0.035) + step(abs(g.x - g.y), 0.05) + step(abs(g.x + g.y), 0.05), 0.0, 1.0); }
    else { vec2 h = vec2(abs(g.x), g.y + 0.08); float lobe = zgDisc(h - vec2(0.09, 0.06), 0.1); float tip = step(0.0, h.y + 0.14) * step(h.x, (h.y + 0.14) * 0.75) * step(h.y, 0.08); m = clamp(lobe + tip, 0.0, 1.0); }
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.98, 0.94), 0.9 * m);
  }
}
`;

export function patternMaterial(): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = VERT_HEAD + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vPatPos = position; vPatN = normal; vPat = aPat;');
    shader.fragmentShader = FRAG_HEAD + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_BODY}`);
  };
  m.customProgramCacheKey = () => 'zg-factory-pattern-v1';
  return m;
}
