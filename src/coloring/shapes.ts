/**
 * Tiny geometry kit to draw coloring pages in code: every helper returns an
 * SVG path `d` string (closed shapes for regions, open ones for details).
 * Coordinates are rounded to 0.1 so the data stays small and readable.
 */

export type P = [number, number];

const f = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) ? '0' : String(r);
};
const pt = (p: P) => `${f(p[0])} ${f(p[1])}`;
const rad = (deg: number) => (deg * Math.PI) / 180;

export const polar = (cx: number, cy: number, r: number, deg: number): P => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];

export function circle(cx: number, cy: number, r: number): string {
  return `M${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)}Z`;
}

/** Ellipse, optionally rotated (degrees). */
export function ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0): string {
  const a = polar(cx, cy, rx, rot + 180);
  const b = polar(cx, cy, rx, rot);
  return `M${pt(a)}A${f(rx)} ${f(ry)} ${f(rot)} 1 0 ${pt(b)}A${f(rx)} ${f(ry)} ${f(rot)} 1 0 ${pt(a)}Z`;
}

/** Rectangle with rounded corners. */
export function rect(x: number, y: number, w: number, h: number, r = 0): string {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  if (k === 0) return `M${f(x)} ${f(y)}H${f(x + w)}V${f(y + h)}H${f(x)}Z`;
  return (
    `M${f(x + k)} ${f(y)}H${f(x + w - k)}A${f(k)} ${f(k)} 0 0 1 ${f(x + w)} ${f(y + k)}` +
    `V${f(y + h - k)}A${f(k)} ${f(k)} 0 0 1 ${f(x + w - k)} ${f(y + h)}` +
    `H${f(x + k)}A${f(k)} ${f(k)} 0 0 1 ${f(x)} ${f(y + h - k)}` +
    `V${f(y + k)}A${f(k)} ${f(k)} 0 0 1 ${f(x + k)} ${f(y)}Z`
  );
}

export const poly = (pts: P[]): string => `M${pts.map(pt).join('L')}Z`;
export const polyline = (pts: P[]): string => `M${pts.map(pt).join('L')}`;

/** Smooth curve through points (Catmull-Rom → cubic Bézier). */
export function smooth(pts: P[], closed = true, tension = 1): string {
  const n = pts.length;
  if (n < 3) return closed ? poly(pts) : polyline(pts);
  const get = (i: number): P => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pt(pts[0])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c1: P = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2: P = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return closed ? `${d}Z` : d;
}

/** Star with n points. */
export function star(cx: number, cy: number, R: number, r: number, n = 5, rot = -90): string {
  const pts: P[] = [];
  for (let i = 0; i < n * 2; i++) pts.push(polar(cx, cy, i % 2 ? r : R, rot + (i * 180) / n));
  return poly(pts);
}

/** Star with soft, rounded points (friendlier for little ones). */
export function softStar(cx: number, cy: number, R: number, r: number, n = 5, rot = -90): string {
  const pts: P[] = [];
  for (let i = 0; i < n * 2; i++) pts.push(polar(cx, cy, i % 2 ? r : R, rot + (i * 180) / n));
  return smooth(pts, true, 0.45);
}

/** Heart of width w, centred on (cx, cy). */
export function heart(cx: number, cy: number, w: number): string {
  const s = w / 2;
  const P2 = (dx: number, dy: number) => `${f(cx + dx * s)} ${f(cy + dy * s)}`;
  return (
    `M${P2(0, 0.88)}C${P2(-0.25, 0.62)} ${P2(-1, 0.22)} ${P2(-1, -0.3)}` +
    `C${P2(-1, -0.86)} ${P2(-0.3, -1.02)} ${P2(0, -0.5)}` +
    `C${P2(0.3, -1.02)} ${P2(1, -0.86)} ${P2(1, -0.3)}` +
    `C${P2(1, 0.22)} ${P2(0.25, 0.62)} ${P2(0, 0.88)}Z`
  );
}

/** Open arc (details: smiles, eyebrows). Angles in degrees, clockwise on screen. */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const s = polar(cx, cy, r, a0);
  const e = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M${pt(s)}A${f(r)} ${f(r)} 0 ${large} ${sweep} ${pt(e)}`;
}

/** Closed annular sector between radii r0 < r1, from angle a0 to a1 (degrees). */
export function ringSegment(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const large = a1 - a0 > 180 ? 1 : 0;
  const o0 = polar(cx, cy, r1, a0);
  const o1 = polar(cx, cy, r1, a1);
  const i1 = polar(cx, cy, r0, a1);
  const i0 = polar(cx, cy, r0, a0);
  return `M${pt(o0)}A${f(r1)} ${f(r1)} 0 ${large} 1 ${pt(o1)}L${pt(i1)}A${f(r0)} ${f(r0)} 0 ${large} 0 ${pt(i0)}Z`;
}

/** Leaf / petal from radius r0 to r1 along `deg`, bulging by `width` on each side. */
export function petal(cx: number, cy: number, r0: number, r1: number, deg: number, width: number): string {
  const b = polar(cx, cy, r0, deg);
  const t = polar(cx, cy, r1, deg);
  const nx = -Math.sin(rad(deg));
  const ny = Math.cos(rad(deg));
  const along = (k: number, side: number, wk: number): P => [b[0] + (t[0] - b[0]) * k + nx * width * wk * side, b[1] + (t[1] - b[1]) * k + ny * width * wk * side];
  const c1 = along(0.2, 1, 1.25);
  const c2 = along(0.82, 1, 0.75);
  const c3 = along(0.82, -1, 0.75);
  const c4 = along(0.2, -1, 1.25);
  return `M${pt(b)}C${pt(c1)} ${pt(c2)} ${pt(t)}C${pt(c3)} ${pt(c4)} ${pt(b)}Z`;
}

/** Leaf between two points, bulging by `width`. */
export function leaf(a: P, b: P, width: number): string {
  const deg = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  return petal(a[0], a[1], 0, Math.hypot(b[0] - a[0], b[1] - a[1]), deg, width);
}

/**
 * Outline of overlapping circles sitting on a flat bottom line, left to right
 * (clouds, bushes, smoke). Consecutive circles must overlap.
 */
export function blob(circles: [number, number, number][], bottom: number): string {
  const ang = (c: [number, number, number], p: P) => (Math.atan2(p[1] - c[1], p[0] - c[0]) * 180) / Math.PI;
  const onBottom = (c: [number, number, number], side: -1 | 1): P => {
    const dy = bottom - c[1];
    const dx = Math.sqrt(Math.max(0, c[2] * c[2] - dy * dy));
    return [c[0] + side * dx, Math.min(bottom, c[1] + c[2])];
  };
  const meet = (a: [number, number, number], b: [number, number, number]): P => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy);
    if (d >= a[2] + b[2] || d <= Math.abs(a[2] - b[2]) || d === 0) return [(a[0] + b[0]) / 2, Math.min(a[1] - a[2] * 0.6, b[1] - b[2] * 0.6)];
    const l = (a[2] * a[2] - b[2] * b[2] + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, a[2] * a[2] - l * l));
    const mx = a[0] + (dx * l) / d;
    const my = a[1] + (dy * l) / d;
    const p1: P = [mx + (dy * h) / d, my - (dx * h) / d];
    const p2: P = [mx - (dy * h) / d, my + (dx * h) / d];
    return p1[1] < p2[1] ? p1 : p2;
  };
  const first = circles[0];
  let cur = onBottom(first, -1);
  let d = `M${pt(cur)}`;
  for (let i = 0; i < circles.length; i++) {
    const c = circles[i];
    const next = i + 1 < circles.length ? meet(c, circles[i + 1]) : onBottom(c, 1);
    const span = (((ang(c, next) - ang(c, cur)) % 360) + 360) % 360;
    d += `A${f(c[2])} ${f(c[2])} 0 ${span > 180 ? 1 : 0} 1 ${pt(next)}`;
    cur = next;
  }
  return `${d}Z`;
}

/** A fluffy cloud with a flat bottom. */
export function cloud(cx: number, cy: number, w: number, h: number): string {
  const x0 = cx - w / 2;
  const yb = cy + h / 2;
  return blob(
    [
      [x0 + w * 0.17, yb - h * 0.3, h * 0.32],
      [x0 + w * 0.4, yb - h * 0.52, h * 0.48],
      [x0 + w * 0.64, yb - h * 0.48, h * 0.42],
      [x0 + w * 0.84, yb - h * 0.3, h * 0.31],
    ],
    yb
  );
}

/** Round scalloped shape: flower heads, tree crowns, bushes seen from the front. */
export function flower(cx: number, cy: number, r: number, petals = 6, rot = -90): string {
  const step = 360 / petals;
  const pr = r * Math.sin(rad(step / 2)) * 1.08;
  let d = `M${pt(polar(cx, cy, r, rot - step / 2))}`;
  for (let i = 0; i < petals; i++) d += `A${f(pr)} ${f(pr)} 0 1 1 ${pt(polar(cx, cy, r, rot + i * step + step / 2))}`;
  return `${d}Z`;
}

/** A thick line with round ends (arms, stems, sticks) as a closed region. */
export function capsule(x1: number, y1: number, x2: number, y2: number, w: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1) || 0.001;
  const nx = (-(y2 - y1) / len) * (w / 2);
  const ny = ((x2 - x1) / len) * (w / 2);
  const r = f(w / 2);
  return `M${f(x1 + nx)} ${f(y1 + ny)}L${f(x2 + nx)} ${f(y2 + ny)}A${r} ${r} 0 0 0 ${f(x2 - nx)} ${f(y2 - ny)}L${f(x1 - nx)} ${f(y1 - ny)}A${r} ${r} 0 0 0 ${f(x1 + nx)} ${f(y1 + ny)}Z`;
}

/** Short lines across a capsule (springy robot arms, rings on a stick). */
export function ringsAlong(x1: number, y1: number, x2: number, y2: number, w: number, n: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (-(y2 - y1) / len) * (w / 2);
  const ny = ((x2 - x1) / len) * (w / 2);
  let d = '';
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    d += `M${f(x + nx)} ${f(y + ny)}L${f(x - nx)} ${f(y - ny)}`;
  }
  return d;
}

/** Region whose top edge is a gentle wave (grass, water, sand). */
export function waveTop(x: number, y: number, w: number, h: number, amp: number, waves: number, phase = 0): string {
  const pts: P[] = [];
  const n = waves * 8;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push([x + w * u, y + Math.sin(u * waves * Math.PI * 2 + phase) * amp]);
  }
  return `${smooth(pts, false).replace(/^M/, `M${f(x)} ${f(y + h)}L`)}L${f(x + w)} ${f(y + h)}Z`;
}

/** Rolling hill: from (x0, y0) to (x1, y1) peaking at `peak`, closed down to the bottom. */
export function hill(x0: number, y0: number, peak: P, x1: number, y1: number, bottom: number): string {
  return `M${f(x0)} ${f(bottom)}L${f(x0)} ${f(y0)}Q${pt(peak)} ${f(x1)} ${f(y1)}L${f(x1)} ${f(bottom)}Z`;
}

/** Half of an elliptical band (front or back part of a planet ring). */
export function ellipseBand(cx: number, cy: number, rxO: number, ryO: number, rxI: number, ryI: number, rot: number, front: boolean): string {
  const at = (rx: number, ry: number, deg: number): P => {
    const a = rad(deg);
    const x = rx * Math.cos(a);
    const y = ry * Math.sin(a);
    const c = Math.cos(rad(rot));
    const s = Math.sin(rad(rot));
    return [cx + x * c - y * s, cy + x * s + y * c];
  };
  const lo = at(rxO, ryO, 180);
  const ro = at(rxO, ryO, 0);
  const ri = at(rxI, ryI, 0);
  const li = at(rxI, ryI, 180);
  const s1 = front ? 0 : 1;
  const s2 = front ? 1 : 0;
  return `M${pt(lo)}A${f(rxO)} ${f(ryO)} ${f(rot)} 0 ${s1} ${pt(ro)}L${pt(ri)}A${f(rxI)} ${f(ryI)} ${f(rot)} 0 ${s2} ${pt(li)}Z`;
}

/** Mirror points around the vertical line x = cx. */
export const mirrorX = (pts: P[], cx: number): P[] => pts.map(([x, y]) => [2 * cx - x, y]);

/** Translate points. */
export const move = (pts: P[], dx: number, dy: number): P[] => pts.map(([x, y]) => [x + dx, y + dy]);

/** Rotate points around (cx, cy). */
export function rotate(pts: P[], cx: number, cy: number, deg: number): P[] {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
}

/** Snowflake / sparkle asterisk (detail). */
export function asterisk(cx: number, cy: number, r: number, n = 6, rot = 90): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = polar(cx, cy, r, rot + (i * 360) / n);
    d += `M${f(cx)} ${f(cy)}L${pt(a)}`;
  }
  return d;
}

/** Curve through a few points (details). */
export const curve = (pts: P[]): string => smooth(pts, false);

/** A quadratic line from a to b bending through control c (details). */
export const quad = (a: P, c: P, b: P): string => `M${pt(a)}Q${pt(c)} ${pt(b)}`;

/** Arch (door / window): flat bottom, round top. */
export function arch(x: number, y: number, w: number, h: number): string {
  const r = w / 2;
  return `M${f(x)} ${f(y + h)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h)}Z`;
}

/** Wall with a crenellated top (castles). */
export function battlement(x: number, y: number, w: number, h: number, merlons: number, mh: number): string {
  const pts: P[] = [[x, y + h]];
  const step = w / (merlons * 2 - 1);
  for (let i = 0; i < merlons * 2 - 1; i++) {
    const top = i % 2 === 0 ? y : y + mh;
    pts.push([x + i * step, top], [x + (i + 1) * step, top]);
  }
  pts.push([x + w, y + h]);
  return poly(pts);
}
