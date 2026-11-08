//! Image buffers shared by every module: borrowed RGBA input views, owned RGBA
//! outputs and single-channel `f32` planes, plus the input validation that every
//! public entry point runs first (the server also feeds us client data).

use std::fmt;

/// Longest side we accept, in pixels. Larger inputs are refused instead of
/// risking an out-of-memory abort in WebAssembly (a 8192² RGBA is 256 MB).
pub const MAX_SIDE: usize = 8192;
/// Largest pixel count we accept (≈ 40 MP: a 12 MP phone photo is fine).
pub const MAX_PIXELS: usize = 40_000_000;

/// Every error the engine reports. Shown to JavaScript as `Error(message)`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EngineError {
    /// The pixel buffer does not match its declared size, or is too large.
    BadImage(String),
    /// A JSON input could not be parsed or failed validation.
    BadInput(String),
    /// An encoded image (PNG/JPEG/WebP) could not be decoded.
    Decode(String),
}

impl fmt::Display for EngineError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            EngineError::BadImage(m) => write!(f, "lutins-core: bad image: {m}"),
            EngineError::BadInput(m) => write!(f, "lutins-core: bad input: {m}"),
            EngineError::Decode(m) => write!(f, "lutins-core: cannot decode image: {m}"),
        }
    }
}

impl std::error::Error for EngineError {}

pub type Result<T> = std::result::Result<T, EngineError>;

/// Checks a declared size (used before allocating anything).
pub fn check_size(w: usize, h: usize) -> Result<()> {
    if w == 0 || h == 0 {
        return Err(EngineError::BadImage(format!("empty image ({w}×{h})")));
    }
    if w > MAX_SIDE || h > MAX_SIDE || w * h > MAX_PIXELS {
        return Err(EngineError::BadImage(format!("image too large ({w}×{h})")));
    }
    Ok(())
}

/// A borrowed, validated RGBA8 image (row-major, no padding, unpremultiplied,
/// exactly what `CanvasRenderingContext2D.getImageData` returns).
#[derive(Clone, Copy, Debug)]
pub struct RgbaView<'a> {
    pub data: &'a [u8],
    pub w: usize,
    pub h: usize,
}

impl<'a> RgbaView<'a> {
    /// Validates `data.len() == w × h × 4` and the size limits.
    pub fn new(data: &'a [u8], w: usize, h: usize) -> Result<Self> {
        check_size(w, h)?;
        if data.len() != w * h * 4 {
            return Err(EngineError::BadImage(format!(
                "buffer has {} bytes, expected {}×{}×4 = {}",
                data.len(),
                w,
                h,
                w * h * 4
            )));
        }
        Ok(RgbaView { data, w, h })
    }

    #[inline]
    pub fn px(&self, x: usize, y: usize) -> [u8; 4] {
        let i = (y * self.w + x) * 4;
        [self.data[i], self.data[i + 1], self.data[i + 2], self.data[i + 3]]
    }
}

/// An owned RGBA8 image.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RgbaImage {
    pub data: Vec<u8>,
    pub w: usize,
    pub h: usize,
}

impl RgbaImage {
    pub fn new(w: usize, h: usize) -> Self {
        RgbaImage { data: vec![0; w * h * 4], w, h }
    }

    pub fn view(&self) -> RgbaView<'_> {
        RgbaView { data: &self.data, w: self.w, h: self.h }
    }

    #[inline]
    pub fn set(&mut self, x: usize, y: usize, p: [u8; 4]) {
        let i = (y * self.w + x) * 4;
        self.data[i..i + 4].copy_from_slice(&p);
    }
}

/// A single-channel `f32` image (luminance, edge map, …).
#[derive(Clone, Debug, PartialEq)]
pub struct Plane {
    pub data: Vec<f32>,
    pub w: usize,
    pub h: usize,
}

impl Plane {
    pub fn new(w: usize, h: usize) -> Self {
        Plane { data: vec![0.0; w * h], w, h }
    }

    pub fn from_fn(w: usize, h: usize, mut f: impl FnMut(usize, usize) -> f32) -> Self {
        let mut data = Vec::with_capacity(w * h);
        for y in 0..h {
            for x in 0..w {
                data.push(f(x, y));
            }
        }
        Plane { data, w, h }
    }

    #[inline]
    pub fn get(&self, x: usize, y: usize) -> f32 {
        self.data[y * self.w + x]
    }

    /// Clamped access (replicates the border), for kernels.
    #[inline]
    pub fn get_clamped(&self, x: isize, y: isize) -> f32 {
        let x = x.clamp(0, self.w as isize - 1) as usize;
        let y = y.clamp(0, self.h as isize - 1) as usize;
        self.data[y * self.w + x]
    }

    pub fn mean(&self) -> f32 {
        (self.data.iter().map(|&v| v as f64).sum::<f64>() / self.data.len().max(1) as f64) as f32
    }

    /// Population standard deviation.
    pub fn std(&self) -> f32 {
        let m = self.mean() as f64;
        let v = self.data.iter().map(|&v| (v as f64 - m).powi(2)).sum::<f64>() / self.data.len().max(1) as f64;
        v.sqrt() as f32
    }

    /// The `q`-quantile (0–1) of the values (by sorting a copy).
    pub fn quantile(&self, q: f32) -> f32 {
        if self.data.is_empty() {
            return 0.0;
        }
        let mut v = self.data.clone();
        let k = ((v.len() - 1) as f32 * q.clamp(0.0, 1.0)).round() as usize;
        let (_, kth, _) = v.select_nth_unstable_by(k, |a, b| a.total_cmp(b));
        *kth
    }
}

/// Rounds to 4 decimals and replaces non-finite values: keeps the JSON small,
/// stable across platforms and free of `null`s.
#[inline]
pub fn r4(v: f32) -> f32 {
    if v.is_finite() {
        (v * 10_000.0).round() / 10_000.0
    } else {
        0.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn view_validates_length_and_size() {
        assert!(RgbaView::new(&[0; 16], 2, 2).is_ok());
        assert!(matches!(RgbaView::new(&[0; 15], 2, 2), Err(EngineError::BadImage(_))));
        assert!(RgbaView::new(&[], 0, 0).is_err());
        assert!(check_size(MAX_SIDE + 1, 1).is_err());
        assert!(check_size(8000, 8000).is_err()); // > MAX_PIXELS
    }

    #[test]
    fn plane_stats() {
        let p = Plane::from_fn(4, 1, |x, _| x as f32);
        assert_eq!(p.mean(), 1.5);
        assert!((p.std() - 1.118034).abs() < 1e-5);
        assert_eq!(p.quantile(0.0), 0.0);
        assert_eq!(p.quantile(1.0), 3.0);
        assert_eq!(p.get_clamped(-3, 5), 0.0);
    }

    #[test]
    fn r4_rounds_and_sanitises() {
        assert_eq!(r4(0.123_456), 0.1235);
        assert_eq!(r4(f32::NAN), 0.0);
        assert_eq!(r4(f32::INFINITY), 0.0);
    }
}
