//! The published files: MP3 (ffmpeg + libmp3lame) and `timing.json` (v2).

use crate::kokoro::SR;
use crate::recipe::{MP3_VBR_QUALITY, RECIPE_ID};
use crate::visemes::Shape;
use anyhow::{bail, Context, Result};
use serde::Serialize;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};

/// Mono MP3 at Kokoro's 24 kHz, VBR quality `MP3_VBR_QUALITY`.
pub fn write_mp3(path: &Path, audio: &[f32]) -> Result<()> {
    if let Some(d) = path.parent() {
        std::fs::create_dir_all(d)?;
    }
    let tmp = path.with_extension("partial.mp3");
    let mut child = Command::new("ffmpeg")
        .args([
            "-hide_banner",
            "-nostdin",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "f32le",
            "-ar",
            &SR.to_string(),
            "-ac",
            "1",
            "-i",
            "-",
        ])
        .args(["-c:a", "libmp3lame", "-q:a", MP3_VBR_QUALITY, "-ar", &SR.to_string(), "-ac", "1"])
        .args(["-write_xing", "1", "-id3v2_version", "0", "-map_metadata", "-1"])
        .arg(&tmp)
        .stdin(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("cannot run ffmpeg (needed for MP3 encoding)")?;
    {
        let mut stdin = child.stdin.take().unwrap();
        let mut bytes = Vec::with_capacity(audio.len() * 4);
        for v in audio {
            bytes.extend(v.to_le_bytes());
        }
        stdin.write_all(&bytes)?;
    }
    let out = child.wait_with_output()?;
    if !out.status.success() {
        bail!("ffmpeg: {}", String::from_utf8_lossy(&out.stderr));
    }
    std::fs::rename(&tmp, path)?;
    Ok(())
}

#[derive(Serialize)]
pub struct SegmentJson {
    pub file: String,
    pub dur: f64,
    pub text: String,
    pub words: Vec<f64>,
    pub visemes: Vec<(f64, Shape)>,
}

#[derive(Serialize)]
pub struct TimingJson {
    pub v: u8,
    pub voice: &'static str,
    pub locale: String,
    pub story: String,
    pub segments: serde_json::Map<String, serde_json::Value>,
}

impl TimingJson {
    pub fn new(locale: &str, story: &str) -> Self {
        Self { v: 2, voice: RECIPE_ID, locale: locale.into(), story: story.into(), segments: Default::default() }
    }
    pub fn push(&mut self, id: &str, seg: SegmentJson) -> Result<()> {
        self.segments.insert(id.to_string(), serde_json::to_value(seg)?);
        Ok(())
    }
    pub fn write(&self, path: &Path) -> Result<()> {
        let mut s = serde_json::to_string(self)?;
        s.push('\n');
        let tmp = path.with_extension("partial");
        std::fs::write(&tmp, s)?;
        std::fs::rename(tmp, path)?;
        Ok(())
    }
}

/// Seconds, rounded to the millisecond (small JSON, plenty for lip sync).
pub fn ms(t: f64) -> f64 {
    (t * 1000.0).round() / 1000.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timing_json_shape() {
        let mut t = TimingJson::new("fr", "lili");
        t.push(
            "title",
            SegmentJson {
                file: "title.mp3".into(),
                dur: 2.5,
                text: "Bonjour".into(),
                words: vec![0.1],
                visemes: vec![(0.0, Shape::Smile), (0.12, Shape::Small)],
            },
        )
        .unwrap();
        let s = serde_json::to_string(&t).unwrap();
        assert_eq!(
            s,
            r#"{"v":2,"voice":"ziggy-v2","locale":"fr","story":"lili","segments":{"title":{"file":"title.mp3","dur":2.5,"text":"Bonjour","words":[0.1],"visemes":[[0.0,"smile"],[0.12,"small"]]}}}"#
        );
    }
}
