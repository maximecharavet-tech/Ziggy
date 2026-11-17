//! Little reaction and power animations as pure functions of progress `p` in 0..1.
//! Returns `[lift, squash, roll, yaw, pitch]` (metres, ratio, radians): the 3D actor
//! just adds them to its own motion. Mirrors `pose` in `src/lib/creatures/core.ts`.

use std::f64::consts::PI;

fn env(p: f64) -> f64 {
    (p.clamp(0.0, 1.0) * PI).sin()
}

fn smooth(t: f64) -> f64 {
    let t = t.clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

pub fn pose(kind: &str, p: f64) -> [f64; 5] {
    let p = p.clamp(0.0, 1.0);
    let e = env(p);
    match kind {
        // Three springy hops, a squash at every landing.
        "bounce" => {
            let ph = (p * 3.0).fract();
            let up = (ph * PI).sin();
            [up * 0.5 * (1.0 - 0.25 * p), if ph < 0.12 || ph > 0.9 { -0.2 } else { 0.08 * up }, 0.0, 0.0, 0.0]
        }
        // Rises like a balloon, wobbles, comes down softly.
        "float" => [env(p).powf(0.6) * 0.7, 0.04 * (p * 12.0).sin() * e, (p * 9.0).sin() * 0.06 * e, 0.0, 0.0],
        // A forward roll.
        "roll" => [(p * PI).sin() * 0.28, -0.12 * e, 0.0, 0.0, smooth(p) * PI * 2.0],
        // Stretches tall and wobbles.
        "stretch" => [0.0, 0.38 * e, (p * 14.0).sin() * 0.05 * e, 0.0, 0.0],
        // A happy wiggle dance.
        "dance" => [(p * PI * 8.0).sin().abs() * 0.12 * e, (p * PI * 8.0).cos() * 0.06 * e, (p * PI * 8.0).sin() * 0.18 * e, (p * PI * 4.0).sin() * 0.5 * e, 0.0],
        // A jump back with wide eyes.
        "surprised" => {
            let a = smooth(p * 4.0);
            [(a * PI).sin() * 0.3 * (1.0 - p), 0.22 * a * (1.0 - p), 0.0, 0.0, -0.3 * a * (1.0 - smooth((p - 0.4) * 2.0))]
        }
        // Clapping: little squeezes.
        "clap" => [0.0, -0.05 * (p * PI * 10.0).sin().abs() * e, 0.0, 0.0, 0.0],
        // Giggling shoulders.
        "giggle" => [(p * PI * 7.0).sin().abs() * 0.06 * e, -0.05 * (p * PI * 14.0).sin().abs() * e, (p * PI * 14.0).sin() * 0.07 * e, 0.0, 0.0],
        // Zip-zap: a quick jitter.
        "zap" => [0.0, 0.0, (p * 60.0).sin() * 0.06 * e, (p * 47.0).sin() * 0.08 * e, 0.0],
        // Hold still, then a tiny wobble when blending back in.
        "camo" => [0.0, -0.03 * e, 0.0, 0.0, 0.0],
        // A dizzy spin.
        "dizzy" => [0.0, 0.0, (p * PI * 6.0).sin() * 0.15 * (1.0 - p), p * PI * 2.0, 0.0],
        _ => [0.0; 5],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn poses_start_and_end_at_rest() {
        for k in ["bounce", "float", "roll", "stretch", "dance", "surprised", "clap", "giggle", "zap", "camo", "dizzy"] {
            for p in [0.0, 1.0] {
                let v = pose(k, p);
                assert!(v[0].abs() < 1e-9, "{k} lift at {p}");
                assert!(v[2].abs() < 1e-9 && v[1].abs() < 0.21, "{k} at {p}: {v:?}");
            }
            for i in 0..=100 {
                assert!(pose(k, f64::from(i) / 100.0).iter().all(|x| x.is_finite() && x.abs() < 7.0), "{k}");
            }
        }
    }
}
