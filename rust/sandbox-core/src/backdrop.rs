//! Painted backdrops, made in code: for each world a far layer (sky, sun,
//! distant shapes) and a near layer with see-through parts that slides a
//! little (parallax). Baked once per world, size and day/night; gradients are
//! dithered with a 4×4 Bayer pattern so they never band.

use crate::table::*;

const BAYER: [f32; 16] = [0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0];

type Rgb = [f32; 3];

fn hex(c: u32) -> Rgb {
    [(c >> 16) as f32, ((c >> 8) & 255) as f32, (c & 255) as f32]
}

fn lerp(a: Rgb, b: Rgb, t: f32) -> Rgb {
    let t = t.clamp(0.0, 1.0);
    [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

fn add(a: Rgb, b: Rgb, k: f32) -> Rgb {
    [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
}

/// A gradient through several stops, `t` from 0 (top) to 1 (bottom).
fn ramp(stops: &[(f32, u32)], t: f32) -> Rgb {
    for k in 1..stops.len() {
        if t <= stops[k].0 {
            let (t0, c0) = stops[k - 1];
            let (t1, c1) = stops[k];
            return lerp(hex(c0), hex(c1), (t - t0) / (t1 - t0).max(1e-6));
        }
    }
    hex(stops[stops.len() - 1].1)
}

fn hash(x: i32, y: i32, seed: u32) -> f32 {
    let mut h =
        (x as u32).wrapping_mul(374_761_393) ^ (y as u32).wrapping_mul(668_265_263) ^ seed.wrapping_mul(2_246_822_519);
    h = (h ^ (h >> 13)).wrapping_mul(1_274_126_177);
    ((h ^ (h >> 16)) & 0xffff) as f32 / 65535.0
}

/// Smooth value noise, 0..1 (also used by the renderer for the ground's blotches).
pub fn soft_noise(x: f32, y: f32, seed: u32) -> f32 {
    noise(x, y, seed)
}

/// Smooth value noise, 0..1.
fn noise(x: f32, y: f32, seed: u32) -> f32 {
    let (xi, yi) = (x.floor() as i32, y.floor() as i32);
    let (fx, fy) = (x - xi as f32, y - yi as f32);
    let (sx, sy) = (fx * fx * (3.0 - 2.0 * fx), fy * fy * (3.0 - 2.0 * fy));
    let a = hash(xi, yi, seed) + (hash(xi + 1, yi, seed) - hash(xi, yi, seed)) * sx;
    let b = hash(xi, yi + 1, seed) + (hash(xi + 1, yi + 1, seed) - hash(xi, yi + 1, seed)) * sx;
    a + (b - a) * sy
}

fn fbm(x: f32, y: f32, seed: u32) -> f32 {
    noise(x, y, seed) * 0.55 + noise(x * 2.1, y * 2.1, seed + 7) * 0.3 + noise(x * 4.3, y * 4.3, seed + 13) * 0.15
}

/// A soft round light at (cx, cy), radius r (all in units of the picture height).
fn halo(u: f32, v: f32, cx: f32, cy: f32, r: f32) -> f32 {
    let d = ((u - cx) * (u - cx) + (v - cy) * (v - cy)).sqrt() / r;
    (1.0 - d).clamp(0.0, 1.0).powi(2)
}

fn stars(px: i32, py: i32, seed: u32, density: f32) -> f32 {
    let h = hash(px, py, seed);
    if h > 1.0 - density {
        0.4 + hash(px, py, seed + 1) * 0.6
    } else {
        0.0
    }
}

/// The far layer: colour of the pixel at (u, v), u in picture heights from the left, v from 0 (top) to 1.
#[allow(clippy::too_many_arguments)]
fn far(world: u8, night: bool, u: f32, v: f32, aspect: f32, px: i32, py: i32, unit: i32) -> Rgb {
    let (sx, sy) = (px / unit.max(1), py / unit.max(1));
    let mut c;
    match world {
        GARDEN => {
            c = if night {
                ramp(&[(0.0, 0x141a4a), (0.6, 0x2c3a7a), (1.0, 0x53508a)], v)
            } else {
                ramp(&[(0.0, 0x6fb0f0), (0.45, 0xa9d6f8), (0.75, 0xdaf0fb), (1.0, 0xfde6cc)], v)
            };
            if night {
                c = add(c, [255.0, 255.0, 240.0], stars(sx, sy, 5, 0.012) * (1.0 - v));
                c = add(
                    c,
                    [220.0, 230.0, 255.0],
                    halo(u, v, aspect * 0.84, 0.13, 0.055) * 3.0 + halo(u, v, aspect * 0.84, 0.13, 0.3) * 0.25,
                );
            } else {
                c = add(
                    c,
                    [255.0, 244.0, 200.0],
                    halo(u, v, aspect * 0.84, 0.12, 0.07) * 3.0 + halo(u, v, aspect * 0.84, 0.12, 0.42) * 0.42,
                );
            }
            // Two rows of soft hills.
            let h1 = 0.66 + (u * 2.3).sin() * 0.035 + (u * 5.1 + 1.0).sin() * 0.015;
            let h2 = 0.72 + (u * 3.1 + 2.0).sin() * 0.03 + (u * 7.3).sin() * 0.012;
            if v > h1 {
                c = lerp(c, hex(if night { 0x2a4a6a } else { 0xa8dca0 }), 0.75);
            }
            if v > h2 {
                c = lerp(c, hex(if night { 0x24405a } else { 0x86cc86 }), 0.8);
            }
        }
        MOUNTAIN => {
            c = if night {
                ramp(&[(0.0, 0x10143c), (0.6, 0x2a2f6a), (1.0, 0x4a3f7a)], v)
            } else {
                ramp(&[(0.0, 0x7f8fe0), (0.4, 0xb0b4f0), (0.68, 0xf2c4dc), (1.0, 0xfde0d0)], v)
            };
            if night {
                c = add(c, [255.0, 255.0, 240.0], stars(sx, sy, 9, 0.014) * (1.0 - v));
            }
            c = add(c, [255.0, 220.0, 200.0], halo(u, v, aspect * 0.2, 0.2, 0.5) * if night { 0.08 } else { 0.25 });
            // Jagged far peaks with pink snow.
            for (k, base) in [(0u32, 0.5f32), (1, 0.62)] {
                let ridge = base
                    - (noise(u * 3.0 + k as f32 * 9.0, 0.0, 21 + k) - 0.5) * 0.3
                    - ((u * 2.0 + k as f32).sin().abs()) * 0.08;
                if v > ridge {
                    let snow = v < ridge + 0.05 + noise(u * 14.0, 3.0, 40) * 0.03;
                    let rock = if night {
                        [0x3a, 0x3f, 0x7a]
                    } else if k == 0 {
                        [0x9a, 0x9c, 0xd8]
                    } else {
                        [0x84, 0x86, 0xc8]
                    };
                    let col = if snow {
                        if night {
                            hex(0x8a90c8)
                        } else {
                            hex(0xffe4ee)
                        }
                    } else {
                        [rock[0] as f32, rock[1] as f32, rock[2] as f32]
                    };
                    c = lerp(c, col, 0.85);
                }
            }
        }
        ISLANDS => {
            c = if night {
                ramp(&[(0.0, 0x0e1a4a), (0.6, 0x1e4a7a), (1.0, 0x2a6a8a)], v)
            } else {
                ramp(&[(0.0, 0x38b8e8), (0.4, 0x7fdcf0), (0.62, 0xd8f8f4), (1.0, 0xbdf0e6)], v)
            };
            if night {
                c = add(c, [255.0, 255.0, 240.0], stars(sx, sy, 3, 0.012) * (1.0 - v));
            } else {
                c = add(
                    c,
                    [255.0, 250.0, 215.0],
                    halo(u, v, aspect * 0.5, 0.06, 0.06) * 3.0 + halo(u, v, aspect * 0.5, 0.06, 0.5) * 0.4,
                );
            }
            // The far sea with a bright horizon, and two tiny islands.
            if v > 0.58 {
                let sea = ramp(
                    &[(0.58, if night { 0x2a5a8a } else { 0x8fe8e8 }), (1.0, if night { 0x163a6a } else { 0x34b8d4 })],
                    v,
                );
                let sparkle = if !night && hash(sx, sy, 77) > 0.985 { 0.5 } else { 0.0 };
                c = add(lerp(c, sea, 0.9), [255.0, 255.0, 255.0], sparkle);
            }
            for (ix, iw) in [(aspect * 0.12, 0.08f32), (aspect * 0.9, 0.05)] {
                let d = (u - ix).abs() / iw;
                if d < 1.0 && v > 0.58 - (1.0 - d * d) * 0.035 && v < 0.585 {
                    c = hex(if night { 0x1e4a4a } else { 0x5ac88a });
                }
            }
        }
        VOLCANO => {
            c = ramp(&[(0.0, 0x1a0f33), (0.5, 0x3a1848), (0.8, 0x6a2448), (1.0, 0xa83a3a)], v);
            c = add(c, [255.0, 240.0, 230.0], stars(sx, sy, 11, 0.01) * (1.0 - v * 1.3).max(0.0));
            // A far cone with a glowing mouth and a plume of smoke.
            let (vx, top) = (aspect * 0.22, 0.42f32);
            c = add(c, [255.0, 130.0, 40.0], halo(u, v, vx, top, 0.3) * 0.5);
            let smoke = fbm(u * 5.0 + v * 2.0, v * 7.0, 31);
            let plume =
                (1.0 - ((u - vx - (top - v) * 0.25).abs() / (0.03 + (top - v).max(0.0) * 0.35))).clamp(0.0, 1.0);
            if v < top {
                c = lerp(c, hex(0x6a4a6a), plume * smoke * 0.8);
            }
            let cone = top + (u - vx).abs() * 0.9 - 0.035 + (noise(u * 30.0, 1.0, 5) - 0.5) * 0.012;
            if v > cone.max(top) {
                c = lerp(hex(0x2a1436), hex(0x1a0c26), (v - cone) * 3.0);
                if (u - vx).abs() < 0.035 && v < top + 0.02 {
                    c = hex(0xffa040);
                }
            }
            if night {
                c = lerp(c, hex(0x08041a), 0.25);
            }
        }
        UNDERSEA => {
            c = ramp(&[(0.0, 0x2fd0c8), (0.3, 0x1c9fc0), (0.7, 0x1c5aa8), (1.0, 0x1a2f78)], v);
            // God-rays from the surface.
            let ray = ((u * 9.0 - v * 3.5).sin() * 0.5 + 0.5).powi(3) * (1.0 - v).powi(2);
            c = add(c, [200.0, 255.0, 240.0], ray * 0.3);
            // Far rocks.
            let r = 0.82 - noise(u * 2.2, 0.0, 61) * 0.22;
            if v > r {
                c = lerp(c, hex(0x1a3a80), 0.6);
            }
            if night {
                c = lerp(c, hex(0x050a2a), 0.6);
            }
        }
        SPACE => {
            c = ramp(&[(0.0, 0x100a30), (0.5, 0x1c0f44), (1.0, 0x2a0f4a)], v);
            let n1 = fbm(u * 2.2, v * 2.2, 81);
            let n2 = fbm(u * 3.0 + 9.0, v * 3.0, 91);
            c = add(c, [200.0, 60.0, 190.0], (n1 - 0.45).max(0.0) * 1.1);
            c = add(c, [60.0, 110.0, 230.0], (n2 - 0.5).max(0.0) * 1.0);
            c = add(c, [255.0, 255.0, 255.0], stars(sx, sy, 17, 0.02));
            // A far ringed planet.
            let (cx, cy, r) = (aspect * 0.84, 0.2f32, 0.07f32);
            let d = ((u - cx).powi(2) + (v - cy).powi(2)).sqrt();
            let ring = ((u - cx) / (r * 2.0)).powi(2) + ((v - cy + (u - cx) * 0.25) / (r * 0.35)).powi(2);
            if ring < 1.0 && ring > 0.55 {
                c = lerp(c, hex(0xf2d6a8), 0.8);
            }
            if d < r {
                c = lerp(hex(0xf5b86a), hex(0xb86a5a), ((v - cy) / r + (u - cx) / r * 0.5 + 1.0) * 0.5);
                c = add(c, [40.0, 20.0, 0.0], ((v * 90.0).sin() * 0.5 + 0.5) * 0.4);
            }
        }
        MOON => {
            c = ramp(&[(0.0, 0x05060f), (0.7, 0x0c1024), (1.0, 0x1a2038)], v);
            c = add(c, [255.0, 255.0, 255.0], stars(sx, sy, 23, 0.02));
            // The Earth, blue and white, with a soft blue light.
            let (cx, cy, r) = (aspect * 0.78, 0.2f32, 0.11f32);
            let d = ((u - cx).powi(2) + (v - cy).powi(2)).sqrt();
            c = add(c, [70.0, 130.0, 255.0], halo(u, v, cx, cy, 0.38) * 0.4);
            if d < r {
                let land = fbm(u * 16.0, v * 16.0, 51);
                let cloud = fbm(u * 22.0 + 4.0, v * 22.0, 53);
                let mut e = if land > 0.52 { hex(0x4ab86a) } else { hex(0x2a78e0) };
                if cloud > 0.58 {
                    e = hex(0xffffff);
                }
                let shadow = (((u - cx) + (v - cy) * 0.6) / r * 0.5 + 0.6).clamp(0.15, 1.0);
                c = [e[0] * shadow, e[1] * shadow, e[2] * shadow];
            }
            // Far grey hills on the horizon.
            let hl = 0.7 + (u * 3.0).sin() * 0.02 + noise(u * 8.0, 0.0, 57) * 0.03;
            if v > hl {
                c = lerp(hex(0x5a5e72), hex(0x3a3e52), (v - hl) * 4.0);
            }
        }
        _ => {
            c = if night {
                ramp(&[(0.0, 0x1a1030), (0.6, 0x3a2040), (1.0, 0x5a3040)], v)
            } else {
                ramp(&[(0.0, 0xd8a060), (0.5, 0xf0c080), (0.8, 0xf8d8a0), (1.0, 0xf0c8a0)], v)
            };
            // A small pale sun with a blue halo (sunsets are blue on Mars).
            c = lerp(c, hex(0x9ac8f0), halo(u, v, aspect * 0.24, 0.3, 0.32) * 0.6);
            c = add(c, [255.0, 255.0, 255.0], halo(u, v, aspect * 0.24, 0.3, 0.035) * 3.0);
            if night {
                c = add(c, [255.0, 240.0, 230.0], stars(sx, sy, 29, 0.012) * (1.0 - v));
            }
            // Mesas far away.
            let m = 0.66 - ((noise(u * 2.5, 0.0, 71) * 3.0).floor() / 3.0) * 0.1 - noise(u * 9.0, 0.0, 73) * 0.012;
            if v > m {
                c = lerp(c, hex(if night { 0x4a2838 } else { 0xd08858 }), 0.8);
            }
            let m2 = 0.74 + (u * 4.0).sin() * 0.015;
            if v > m2 {
                c = lerp(c, hex(if night { 0x3a2030 } else { 0xc87848 }), 0.85);
            }
        }
    }
    c
}

/// The near layer: colour and opacity (0..1) of the pixel, or nothing.
fn near(world: u8, night: bool, u: f32, v: f32, aspect: f32) -> Option<(Rgb, f32)> {
    match world {
        GARDEN | ISLANDS | MOUNTAIN => {
            // Painted clouds drifting behind the play field.
            let n = fbm(u * 3.2 + world as f32 * 5.0, v * 9.0, 101 + world as u32);
            let band = (1.0 - ((v - 0.26) / 0.2).abs()).clamp(0.0, 1.0);
            let a = ((n - 0.56) * 5.0).clamp(0.0, 1.0) * band;
            if a > 0.02 {
                let col = if night {
                    hex(0x5a6aa8)
                } else if world == MOUNTAIN {
                    hex(0xfff0f6)
                } else {
                    hex(0xffffff)
                };
                return Some((col, a * if night { 0.35 } else { 0.6 }));
            }
            None
        }
        VOLCANO => {
            // Dark spires at the bottom corners, and embers of light in the haze.
            let spire =
                0.9 - (noise(u * 6.0, 0.0, 111) - 0.4).max(0.0) * 0.5 * ((u / aspect - 0.5).abs() * 2.0).powi(2);
            if v > spire {
                return Some((hex(0x140a20), 0.9));
            }
            None
        }
        UNDERSEA => {
            // Seaweed silhouettes swaying at the bottom.
            let stalk = ((u * 14.0).sin() * 0.5 + 0.5) * noise(u * 5.0, 1.0, 121);
            let top = 1.0 - stalk * 0.26;
            let wob = ((v * 30.0 + u * 8.0).sin() * 0.004).abs();
            if v > top && ((u * 14.0 + (v * 22.0).sin() * 0.3).sin()).abs() > 0.72 - wob {
                return Some((hex(if night { 0x061a3a } else { 0x124a80 }), 0.55));
            }
            None
        }
        SPACE => {
            // Brighter foreground stars.
            let (gx, gy) = ((u * 26.0).floor() as i32, (v * 26.0).floor() as i32);
            if hash(gx, gy, 131) > 0.9 {
                let (fx, fy) = (u * 26.0 - gx as f32 - 0.5, v * 26.0 - gy as f32 - 0.5);
                let d = fx.abs().min(fy.abs()) * 8.0 + (fx * fx + fy * fy).sqrt() * 2.2;
                if d < 1.0 {
                    return Some((hex(0xfff6d8), (1.0 - d) * 0.9));
                }
            }
            None
        }
        _ => None,
    }
}

/// Bakes both layers for a picture of `fw` × `fh` pixels. `span` receives, per row, the extent of the near layer.
pub fn bake(
    world: u8,
    night: bool,
    fw: usize,
    fh: usize,
    sky: &mut [u32],
    near_buf: &mut [u32],
    span: &mut [(u16, u16)],
) {
    let aspect = fw as f32 / fh as f32;
    let unit = (fh / 192).max(1) as i32;
    for py in 0..fh {
        let v = (py as f32 + 0.5) / fh as f32;
        let (mut x0, mut x1) = (fw, 0);
        for px in 0..fw {
            let u = (px as f32 + 0.5) / fh as f32;
            let c = far(world, night, u, v, aspect, px as i32, py as i32, unit);
            let d = (BAYER[(py & 3) * 4 + (px & 3)] - 7.5) / 16.0;
            let q = |x: f32| (x + d).round().clamp(0.0, 255.0) as u32;
            sky[py * fw + px] = 0xff00_0000 | (q(c[2]) << 16) | (q(c[1]) << 8) | q(c[0]);
            let n = match near(world, night, u, v, aspect) {
                Some((c, a)) => {
                    x0 = x0.min(px);
                    x1 = x1.max(px + 1);
                    (((a * 255.0) as u32).min(255) << 24) | (q(c[2]) << 16) | (q(c[1]) << 8) | q(c[0])
                }
                None => 0,
            };
            near_buf[py * fw + px] = n;
        }
        span[py] = if x1 > x0 { (x0 as u16, x1 as u16) } else { (0, 0) };
    }
}
