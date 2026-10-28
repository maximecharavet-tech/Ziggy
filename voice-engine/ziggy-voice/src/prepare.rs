//! `ziggy-voice prepare`: fetch everything the engine needs, offline-ready.
//!
//! * Kokoro-82M from **npm** (Hugging Face is not needed): `kokoro-js@1.2.1`
//!   (the 54 voice style packs) and `kokoro-fp32{a,b,c}-shards@1.0.0` (the fp32
//!   ONNX graph of onnx-community/Kokoro-82M-v1.0-ONNX in 19 parts), joined in
//!   order and checked (size + sha256), then patched (see `onnx_patch`).
//! * Three wheels from **PyPI**, only as archives of files (no Python runs):
//!   `onnxruntime` (its `libonnxruntime.so`, loaded by `ort`), `espeakng-loader`
//!   (`libespeak-ng.so` + `espeak-ng-data`, GPL-3.0, build-time only) and
//!   `misaki` (Kokoro's English pronunciation dictionaries, Apache-2.0).
//!
//! Downloads go through the `npm` and `curl` command-line tools so that the
//! machine's proxy and certificates apply.

use crate::onnx_patch::{patch_model, Patch};
use crate::paths::Cache;
use anyhow::{bail, Context, Result};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;

pub const NPM_PACKAGES: [&str; 4] =
    ["kokoro-js@1.2.1", "kokoro-fp32a-shards@1.0.0", "kokoro-fp32b-shards@1.0.0", "kokoro-fp32c-shards@1.0.0"];
pub const PARTS: usize = 19;
pub const MODEL_SIZE: u64 = 325_532_232;
pub const MODEL_SHA256: &str = "8fbea51ea711f2af382e88c833d9e288c6dc82ce5e98421ea61c058ce21a34cb";

/// (name, version, member prefixes to extract)
pub const WHEELS: [(&str, &str); 3] = [("onnxruntime", "1.31.1"), ("espeakng-loader", "0.2.4"), ("misaki", "0.9.4")];

pub fn sha256_file(path: &Path) -> Result<String> {
    let mut f = fs::File::open(path).with_context(|| format!("open {}", path.display()))?;
    let mut h = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(hex(&h.finalize()))
}

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

fn run(cmd: &mut Command) -> Result<String> {
    let out = cmd.output().with_context(|| format!("cannot run {cmd:?}"))?;
    if !out.status.success() {
        bail!("{cmd:?} failed: {}", String::from_utf8_lossy(&out.stderr));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// `npm pack` a package into `dir/<name>/package/…`.
fn npm_package(dir: &Path, spec: &str) -> Result<PathBuf> {
    let name = spec.rsplit_once('@').map(|(n, _)| n).unwrap_or(spec);
    let dest = dir.join(name);
    let pkg = dest.join("package");
    if pkg.is_dir() {
        return Ok(pkg);
    }
    fs::create_dir_all(dir)?;
    // Reuse a tarball already in the folder (e.g. copied from another machine).
    let tgz_name = format!("{}-{}.tgz", name, spec.rsplit_once('@').map(|(_, v)| v).unwrap_or(""));
    let mut tgz = dir.join(&tgz_name);
    if !tgz.exists() {
        eprintln!("  npm pack {spec}");
        let out = run(Command::new("npm").args(["pack", spec, "--silent"]).current_dir(dir))?;
        tgz = dir.join(out.trim().lines().last().context("npm pack printed nothing")?);
    }
    let tmp = dir.join(format!("{name}.partial"));
    let _ = fs::remove_dir_all(&tmp);
    fs::create_dir_all(&tmp)?;
    let mut ar = tar::Archive::new(flate2::read::GzDecoder::new(fs::File::open(&tgz)?));
    ar.unpack(&tmp).with_context(|| format!("unpack {}", tgz.display()))?;
    fs::rename(&tmp, &dest)?;
    fs::remove_file(&tgz)?;
    Ok(pkg)
}

/// Download a wheel from PyPI (checked against the sha256 PyPI publishes).
fn wheel(dir: &Path, name: &str, version: &str) -> Result<PathBuf> {
    fs::create_dir_all(dir)?;
    if let Some(found) = fs::read_dir(dir)?.flatten().map(|e| e.path()).find(|p| {
        p.file_name()
            .and_then(|n| n.to_str())
            .is_some_and(|n| n.starts_with(&format!("{}-{}-", name.replace('-', "_"), version)) && n.ends_with(".whl"))
    }) {
        return Ok(found);
    }
    let meta = run(Command::new("curl").args(["-sSfL", &format!("https://pypi.org/pypi/{name}/{version}/json")]))?;
    let meta: serde_json::Value = serde_json::from_str(&meta)?;
    let files = meta["urls"].as_array().context("no files on PyPI")?;
    let score = |f: &str| -> i32 {
        let mut s = 0;
        if f.contains("py3-none-any") {
            s += 50;
        }
        if f.contains("manylinux") && f.contains("x86_64") {
            s += 40;
        }
        if f.contains("cp311") {
            s += 5;
        }
        if !f.ends_with(".whl") {
            s -= 1000;
        }
        s
    };
    let best = files
        .iter()
        .filter_map(|f| Some((f["filename"].as_str()?, f["url"].as_str()?, f["digests"]["sha256"].as_str()?)))
        .max_by_key(|(f, _, _)| score(f))
        .context("no wheel")?;
    if score(best.0) < 40 {
        bail!("no Linux x86_64 wheel for {name} {version}");
    }
    let path = dir.join(best.0);
    eprintln!("  pypi {}", best.0);
    run(Command::new("curl").args(["-sSfL", "-o"]).arg(&path).arg(best.1))?;
    let got = sha256_file(&path)?;
    if got != best.2 {
        fs::remove_file(&path)?;
        bail!("{}: sha256 {got} != {}", best.0, best.2);
    }
    Ok(path)
}

/// Extract the members of a wheel whose path starts with `prefix` into `dest`
/// (the prefix removed). Returns the extracted paths.
fn extract(wheel: &Path, prefix: &str, dest: &Path) -> Result<Vec<PathBuf>> {
    let mut z = zip::ZipArchive::new(fs::File::open(wheel)?)?;
    let mut out = Vec::new();
    for i in 0..z.len() {
        let mut f = z.by_index(i)?;
        let Some(name) = f.enclosed_name() else { continue };
        let Ok(rel) = name.strip_prefix(prefix) else { continue };
        if f.is_dir() || rel.as_os_str().is_empty() {
            continue;
        }
        let to = dest.join(rel);
        fs::create_dir_all(to.parent().unwrap())?;
        let mut buf = Vec::with_capacity(f.size() as usize);
        f.read_to_end(&mut buf)?;
        fs::File::create(&to)?.write_all(&buf)?;
        out.push(to);
    }
    if out.is_empty() {
        bail!("{prefix} not found in {}", wheel.display());
    }
    Ok(out)
}

pub fn prepare(cache: &Cache) -> Result<()> {
    fs::create_dir_all(&cache.root)?;
    eprintln!("cache: {}", cache.root.display());

    // 1. Kokoro from npm: the voices, then the graph (19 shards, joined and
    //    checked; the shard packages are deleted once the model is verified)
    if !cache.voices().is_dir() {
        let js = npm_package(&cache.npm(), NPM_PACKAGES[0])?;
        let src = js.join("voices");
        let tmp = cache.root.join("voices.partial");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp)?;
        for e in fs::read_dir(&src)? {
            let e = e?;
            fs::copy(e.path(), tmp.join(e.file_name()))?;
        }
        fs::rename(&tmp, cache.voices())?;
    }
    // only the voices are needed: drop the package (its JS/.d.ts files would
    // otherwise sit inside the repository tree)
    let _ = fs::remove_dir_all(cache.npm().join("kokoro-js"));
    let base = cache.base_model();
    let valid = |p: &Path| -> Result<bool> {
        Ok(p.exists() && fs::metadata(p)?.len() == MODEL_SIZE && sha256_file(p)? == MODEL_SHA256)
    };
    if !valid(&base)? {
        let mut pkgs = Vec::new();
        for spec in &NPM_PACKAGES[1..] {
            pkgs.push(npm_package(&cache.npm(), spec)?);
        }
        let tmp = base.with_extension("partial");
        {
            let mut out = fs::File::create(&tmp)?;
            for i in 0..PARTS {
                let name = format!("kokoro-fp32.part{i}.bin");
                let part = pkgs
                    .iter()
                    .map(|p| p.join(&name))
                    .find(|p| p.exists())
                    .with_context(|| format!("{name} missing"))?;
                std::io::copy(&mut fs::File::open(part)?, &mut out)?;
            }
        }
        let size = fs::metadata(&tmp)?.len();
        let digest = sha256_file(&tmp)?;
        if size != MODEL_SIZE || digest != MODEL_SHA256 {
            bail!("unexpected model: {size} bytes, sha256 {digest}");
        }
        fs::rename(&tmp, &base)?;
        for spec in &NPM_PACKAGES[1..] {
            let name = spec.rsplit_once('@').map(|(n, _)| n).unwrap_or(spec);
            let _ = fs::remove_dir_all(cache.npm().join(name));
        }
    }
    eprintln!("  model ok {MODEL_SHA256}");
    if !cache.model().exists() {
        let bytes = fs::read(&base)?;
        let patched = patch_model(&bytes, Patch::Full)?;
        let tmp = cache.model().with_extension("partial");
        fs::write(&tmp, patched)?;
        fs::rename(&tmp, cache.model())?;
    }
    eprintln!("  patched graph: {}", cache.model().display());

    // 2. Libraries and dictionaries from PyPI wheels
    for (name, version) in WHEELS {
        let w = wheel(&cache.wheels(), name, version)?;
        match name {
            "onnxruntime" if !cache.onnxruntime().exists() => {
                let tmp = cache.root.join("ort.partial");
                let files = extract(&w, "onnxruntime/capi/", &tmp)?;
                let lib = files
                    .iter()
                    .find(|p| {
                        p.file_name().and_then(|n| n.to_str()).is_some_and(|n| n.starts_with("libonnxruntime.so"))
                    })
                    .context("libonnxruntime.so not in the wheel")?;
                fs::create_dir_all(cache.lib())?;
                fs::rename(lib, cache.onnxruntime())?;
                fs::remove_dir_all(tmp)?;
            }
            "espeakng-loader" if !cache.espeak_lib().exists() => {
                let tmp = cache.root.join("espeak.partial");
                let _ = fs::remove_dir_all(&tmp);
                extract(&w, "espeakng_loader/", &tmp)?;
                let lib = fs::read_dir(&tmp)?
                    .flatten()
                    .map(|e| e.path())
                    .filter(|p| {
                        p.file_name().and_then(|n| n.to_str()).is_some_and(|n| n.starts_with("libespeak-ng.so"))
                    })
                    .max_by_key(|p| fs::metadata(p).map(|m| m.len()).unwrap_or(0))
                    .context("libespeak-ng.so not in the wheel")?;
                fs::create_dir_all(cache.lib())?;
                fs::rename(&lib, cache.espeak_lib())?;
                let _ = fs::remove_dir_all(cache.espeak_data());
                fs::rename(tmp.join("espeak-ng-data"), cache.espeak_data())?;
                fs::remove_dir_all(tmp)?;
            }
            "misaki" if !cache.misaki().join("us_gold.json").exists() => {
                let tmp = cache.root.join("misaki.partial");
                let _ = fs::remove_dir_all(&tmp);
                extract(&w, "misaki/data/", &tmp)?;
                fs::create_dir_all(cache.misaki())?;
                for f in ["us_gold.json", "us_silver.json"] {
                    fs::rename(tmp.join(f), cache.misaki().join(f))?;
                }
                fs::remove_dir_all(tmp)?;
            }
            _ => {}
        }
    }
    eprintln!("ready: {}", cache.root.display());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_of_known_bytes() {
        let dir = std::env::temp_dir().join(format!("zv-sha-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let p = dir.join("x");
        fs::write(&p, b"abc").unwrap();
        assert_eq!(sha256_file(&p).unwrap(), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        fs::remove_dir_all(dir).unwrap();
    }
}
