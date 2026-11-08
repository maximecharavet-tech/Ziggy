//! PNG / JPEG / WebP decoding to RGBA8 (feature `decode`, on by default).
//!
//! The Node API routes have no image decoder (no canvas; sharp ships libvips,
//! which is LGPL), so the server decodes the generated picture and the
//! uploaded photo here before calling the verifier. Pure-Rust, permissively
//! licensed decoders: `png`, `jpeg-decoder`, `image-webp`.
//!
//! Limits: the declared size is checked against [`crate::image`]'s limits
//! *before* the pixel buffer is allocated (decompression bombs). EXIF
//! orientation is ignored (the device re-encodes the photo upright and strips
//! EXIF before upload; generated pictures carry none). Animated PNG/WebP give
//! their first frame. CMYK JPEGs are converted naively (no ICC profile).

use std::io::Cursor;

use crate::image::{check_size, EngineError, Result, RgbaImage, MAX_PIXELS};

fn err(e: impl std::fmt::Display) -> EngineError {
    EngineError::Decode(e.to_string())
}

/// The detected container format.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Format {
    Png,
    Jpeg,
    WebP,
}

/// Sniffs the format from the magic bytes.
pub fn sniff(bytes: &[u8]) -> Option<Format> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some(Format::Png)
    } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        Some(Format::Jpeg)
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some(Format::WebP)
    } else {
        None
    }
}

/// Decodes a PNG, JPEG or WebP file to RGBA8.
pub fn decode(bytes: &[u8]) -> Result<RgbaImage> {
    match sniff(bytes) {
        Some(Format::Png) => decode_png(bytes),
        Some(Format::Jpeg) => decode_jpeg(bytes),
        Some(Format::WebP) => decode_webp(bytes),
        None => Err(EngineError::Decode("unknown format (expected PNG, JPEG or WebP)".into())),
    }
}

fn decode_png(bytes: &[u8]) -> Result<RgbaImage> {
    let limits = png::Limits { bytes: MAX_PIXELS * 4 + (1 << 20) };
    let mut dec = png::Decoder::new_with_limits(Cursor::new(bytes), limits);
    dec.set_transformations(png::Transformations::normalize_to_color8());
    let mut reader = dec.read_info().map_err(err)?;
    let (w, h) = {
        let info = reader.info();
        (info.width as usize, info.height as usize)
    };
    check_size(w, h)?;
    let size = reader.output_buffer_size().ok_or_else(|| err("PNG too large"))?;
    let mut buf = vec![0u8; size];
    let out = reader.next_frame(&mut buf).map_err(err)?;
    let (w, h) = (out.width as usize, out.height as usize);
    let channels = match out.color_type {
        png::ColorType::Grayscale => 1,
        png::ColorType::GrayscaleAlpha => 2,
        png::ColorType::Rgb => 3,
        png::ColorType::Rgba => 4,
        png::ColorType::Indexed => return Err(err("unexpanded palette")),
    };
    let mut img = RgbaImage::new(w, h);
    for y in 0..h {
        let row = &buf[y * out.line_size..y * out.line_size + w * channels];
        for x in 0..w {
            let p = &row[x * channels..(x + 1) * channels];
            let px = match channels {
                1 => [p[0], p[0], p[0], 255],
                2 => [p[0], p[0], p[0], p[1]],
                3 => [p[0], p[1], p[2], 255],
                _ => [p[0], p[1], p[2], p[3]],
            };
            img.set(x, y, px);
        }
    }
    Ok(img)
}

fn decode_jpeg(bytes: &[u8]) -> Result<RgbaImage> {
    let mut dec = jpeg_decoder::Decoder::new(Cursor::new(bytes));
    dec.read_info().map_err(err)?;
    let info = dec.info().ok_or_else(|| err("JPEG without header"))?;
    let (w, h) = (info.width as usize, info.height as usize);
    check_size(w, h)?;
    dec.set_max_decoding_buffer_size(MAX_PIXELS * 4);
    let px = dec.decode().map_err(err)?;
    let mut img = RgbaImage::new(w, h);
    let out = img.data.chunks_exact_mut(4);
    match info.pixel_format {
        jpeg_decoder::PixelFormat::L8 => {
            for (o, &l) in out.zip(px.iter()) {
                o.copy_from_slice(&[l, l, l, 255]);
            }
        }
        jpeg_decoder::PixelFormat::L16 => {
            for (o, l) in out.zip(px.chunks_exact(2)) {
                // Big-endian 16-bit → 8-bit.
                o.copy_from_slice(&[l[0], l[0], l[0], 255]);
            }
        }
        jpeg_decoder::PixelFormat::RGB24 => {
            for (o, p) in out.zip(px.chunks_exact(3)) {
                o.copy_from_slice(&[p[0], p[1], p[2], 255]);
            }
        }
        jpeg_decoder::PixelFormat::CMYK32 => {
            for (o, p) in out.zip(px.chunks_exact(4)) {
                let k = p[3] as u32;
                let c = |v: u8| ((v as u32 * k + 127) / 255) as u8;
                o.copy_from_slice(&[c(p[0]), c(p[1]), c(p[2]), 255]);
            }
        }
    }
    Ok(img)
}

fn decode_webp(bytes: &[u8]) -> Result<RgbaImage> {
    let mut dec = image_webp::WebPDecoder::new(Cursor::new(bytes)).map_err(err)?;
    let (w, h) = dec.dimensions();
    let (w, h) = (w as usize, h as usize);
    check_size(w, h)?;
    let alpha = dec.has_alpha();
    let size = dec.output_buffer_size().ok_or_else(|| err("WebP too large"))?;
    let mut buf = vec![0u8; size];
    dec.read_image(&mut buf).map_err(err)?;
    if alpha {
        return Ok(RgbaImage { data: buf, w, h });
    }
    let mut img = RgbaImage::new(w, h);
    for (o, p) in img.data.chunks_exact_mut(4).zip(buf.chunks_exact(3)) {
        o.copy_from_slice(&[p[0], p[1], p[2], 255]);
    }
    Ok(img)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A tiny PNG built with the `png` encoder (feature-free part of the crate).
    fn png_bytes(w: u32, h: u32, color: png::ColorType, data: &[u8]) -> Vec<u8> {
        let mut out = Vec::new();
        {
            let mut enc = png::Encoder::new(&mut out, w, h);
            enc.set_color(color);
            enc.set_depth(png::BitDepth::Eight);
            let mut wr = enc.write_header().unwrap();
            wr.write_image_data(data).unwrap();
        }
        out
    }

    #[test]
    fn sniffs_formats() {
        assert_eq!(sniff(b"\x89PNG\r\n\x1a\nxxxx"), Some(Format::Png));
        assert_eq!(sniff(&[0xff, 0xd8, 0xff, 0xe0]), Some(Format::Jpeg));
        assert_eq!(sniff(b"RIFF\0\0\0\0WEBPVP8 "), Some(Format::WebP));
        assert_eq!(sniff(b"GIF89a"), None);
        assert!(decode(b"GIF89a").is_err());
        assert!(decode(b"\x89PNG\r\n\x1a\ngarbage").is_err());
    }

    #[test]
    fn decodes_png_rgb_rgba_gray() {
        let rgb = png_bytes(2, 1, png::ColorType::Rgb, &[255, 0, 0, 0, 0, 255]);
        let img = decode(&rgb).unwrap();
        assert_eq!((img.w, img.h), (2, 1));
        assert_eq!(img.data, [255, 0, 0, 255, 0, 0, 255, 255]);
        let rgba = png_bytes(1, 1, png::ColorType::Rgba, &[1, 2, 3, 4]);
        assert_eq!(decode(&rgba).unwrap().data, [1, 2, 3, 4]);
        let gray = png_bytes(1, 2, png::ColorType::Grayscale, &[7, 9]);
        assert_eq!(decode(&gray).unwrap().data, [7, 7, 7, 255, 9, 9, 9, 255]);
    }

    /// Fixtures made once with ImageMagick (`tests/data/`).
    #[test]
    fn decodes_baseline_jpegs() {
        let img = decode(include_bytes!("../tests/data/grey8.jpg")).unwrap();
        assert_eq!((img.w, img.h), (8, 8));
        assert!(img.data.chunks(4).all(|p| (p[0] as i32 - 128).abs() <= 2 && p[0] == p[2] && p[3] == 255));
        let img = decode(include_bytes!("../tests/data/red16.jpg")).unwrap();
        assert_eq!((img.w, img.h), (16, 16));
        for p in img.data.chunks(4) {
            assert!(
                (p[0] as i32 - 200).abs() <= 4 && (p[1] as i32 - 40).abs() <= 4 && (p[2] as i32 - 40).abs() <= 4,
                "{p:?}"
            );
        }
    }

    #[test]
    fn decodes_a_lossless_webp() {
        let img = decode(include_bytes!("../tests/data/pattern4x3.webp")).unwrap();
        assert_eq!((img.w, img.h), (4, 3));
        assert_eq!(&img.data[..16], &[255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
        assert_eq!(&img.data[16..20], &[0, 0, 0, 255]);
    }

    #[test]
    fn refuses_oversized_declared_sizes() {
        // A valid PNG header declaring 100 000 × 100 000 px.
        let mut bytes = png_bytes(1, 1, png::ColorType::Rgb, &[0, 0, 0]);
        bytes[16..20].copy_from_slice(&100_000u32.to_be_bytes());
        bytes[20..24].copy_from_slice(&100_000u32.to_be_bytes());
        // Recompute the IHDR chunk CRC (over type + data, bytes 12..29).
        let crc = crc32(&bytes[12..29]);
        bytes[29..33].copy_from_slice(&crc.to_be_bytes());
        let e = decode(&bytes).unwrap_err();
        assert!(e.to_string().contains("too large") || e.to_string().contains("limit"), "{e}");
    }

    fn crc32(data: &[u8]) -> u32 {
        let mut c = 0xffff_ffffu32;
        for &b in data {
            c ^= b as u32;
            for _ in 0..8 {
                c = if c & 1 != 0 { 0xedb8_8320 ^ (c >> 1) } else { c >> 1 };
            }
        }
        !c
    }
}
