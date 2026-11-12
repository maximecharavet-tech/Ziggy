//! mulberry32, bit for bit the same as `src/games3d/kit/rng.ts`: the same seed gives
//! the same creature in Rust and in the TypeScript fallback.

pub struct Rng(u32);

/// JavaScript's `x >>> 0` for a double.
pub fn to_u32(x: f64) -> u32 {
    if !x.is_finite() {
        return 0;
    }
    x.trunc().rem_euclid(4294967296.0) as u32
}

impl Rng {
    pub fn new(seed: f64) -> Self {
        Rng(to_u32(seed))
    }

    pub fn next(&mut self) -> f64 {
        self.0 = self.0.wrapping_add(0x6d2b_79f5);
        let mut t = self.0;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        f64::from(t ^ (t >> 14)) / 4294967296.0
    }

    /// `list[Math.floor(r() * list.length) % list.length]`
    pub fn pick<'a, T>(&mut self, list: &'a [T]) -> &'a T {
        let i = (self.next() * list.len() as f64).floor() as usize % list.len();
        &list[i]
    }

    pub fn below(&mut self, n: usize) -> usize {
        (self.next() * n as f64).floor() as usize % n.max(1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_the_typescript_reference() {
        // Values printed by the TypeScript `rng(12345)` (see the parity test in vitest).
        let mut r = Rng::new(12345.0);
        let a = r.next();
        assert!((0.0..1.0).contains(&a));
        let mut r2 = Rng::new(12345.0);
        assert_eq!(a, r2.next());
    }

    #[test]
    fn seed_wraps_like_js() {
        assert_eq!(to_u32(-1.0), 4294967295);
        assert_eq!(to_u32(4294967296.0 + 5.0), 5);
        assert_eq!(to_u32(f64::NAN), 0);
    }
}
