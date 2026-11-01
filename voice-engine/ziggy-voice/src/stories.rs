//! The bedtime stories, exactly as the site shows them (dumped by Node from
//! `src/data/dodo`, see `voice-engine/dump-stories.mjs`), and the lexicon.

use crate::paths;
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

#[derive(Deserialize, Clone, Debug)]
pub struct Story {
    pub id: String,
    /// locale → segment id → text
    pub segments: HashMap<String, serde_json::Map<String, serde_json::Value>>,
}

impl Story {
    /// `title, s1 … sN, outro`, in reading order.
    pub fn segment_ids(&self, locale: &str) -> Vec<String> {
        let Some(seg) = self.segments.get(locale) else { return vec![] };
        let mut scenes: Vec<(u32, String)> = seg
            .keys()
            .filter_map(|k| k.strip_prefix('s').and_then(|n| n.parse().ok()).map(|n: u32| (n, k.clone())))
            .collect();
        scenes.sort();
        let mut ids = vec!["title".to_string()];
        ids.extend(scenes.into_iter().map(|(_, k)| k));
        ids.push("outro".into());
        ids
    }
    pub fn text(&self, locale: &str, seg: &str) -> Option<&str> {
        self.segments.get(locale)?.get(seg)?.as_str()
    }
}

#[derive(Deserialize)]
struct Dump {
    stories: Vec<Story>,
}

/// Run the Node dump (or read a saved one).
pub fn load(json: Option<&Path>) -> Result<Vec<Story>> {
    let text = match json {
        Some(p) => std::fs::read_to_string(p).with_context(|| format!("read {}", p.display()))?,
        None => {
            let script = paths::engine_dir().join("dump-stories.mjs");
            let out = Command::new("node")
                .arg(&script)
                .current_dir(paths::repo_root())
                .output()
                .context("cannot run node (needed to read the TypeScript stories)")?;
            if !out.status.success() {
                bail!("dump-stories failed: {}", String::from_utf8_lossy(&out.stderr));
            }
            String::from_utf8(out.stdout)?
        }
    };
    let d: Dump = serde_json::from_str(&text)?;
    Ok(d.stories)
}

/// `voice-engine/lexicon.json`: locale → written word → phonemes.
pub fn lexicon() -> Result<HashMap<String, HashMap<String, String>>> {
    let p = paths::engine_dir().join("lexicon.json");
    let v: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&p)?)?;
    let mut out = HashMap::new();
    for loc in ["fr", "en"] {
        let mut m = HashMap::new();
        if let Some(o) = v.get(loc).and_then(|x| x.as_object()) {
            for (k, ps) in o {
                if let Some(s) = ps.as_str() {
                    m.insert(k.clone(), s.to_string());
                }
            }
        }
        out.insert(loc.to_string(), m);
    }
    Ok(out)
}
