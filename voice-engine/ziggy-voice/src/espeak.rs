//! espeak-ng through its C API (`libloading`), exactly as phonemizer drives
//! it for Kokoro: IPA output with a tie character, one clause per call.
//!
//! espeak-ng is GPL-3.0: it is only a local build tool here (it turns the
//! stories into phonemes on the build machine); nothing of it is shipped.

use anyhow::{bail, Context, Result};
use libloading::{Library, Symbol};
use std::ffi::{c_char, c_int, c_void, CStr, CString};
use std::path::Path;
use std::sync::Mutex;

type InitFn = unsafe extern "C" fn(c_int, c_int, *const c_char, c_int) -> c_int;
type SetVoiceFn = unsafe extern "C" fn(*const c_char) -> c_int;
type TextToPhonemesFn = unsafe extern "C" fn(*mut *const c_void, c_int, c_int) -> *const c_char;

const AUDIO_OUTPUT_SYNCHRONOUS: c_int = 0x02;
const ESPEAK_CHARS_UTF8: c_int = 1;
/// IPA (bit 1) + tie character (bit 7) U+0361 in bits 8..23.
const PHONEME_MODE: c_int = 0x02 | (1 << 7) | (0x361 << 8);

pub struct Espeak {
    lib: Library,
    state: Mutex<Option<String>>, // current voice
}

impl Espeak {
    pub fn load(lib_path: &Path, data_dir: &Path) -> Result<Self> {
        // SAFETY: loading a C library whose initializers have no preconditions.
        let lib = unsafe { Library::new(lib_path) }.with_context(|| format!("load {}", lib_path.display()))?;
        let data = CString::new(data_dir.to_string_lossy().as_bytes())?;
        // SAFETY: the symbol has this C signature (speak_lib.h).
        let rc = unsafe {
            let init: Symbol<InitFn> = lib.get(b"espeak_Initialize\0")?;
            init(AUDIO_OUTPUT_SYNCHRONOUS, 0, data.as_ptr(), 0)
        };
        if rc <= 0 {
            bail!("espeak_Initialize failed ({rc}) with data {}", data_dir.display());
        }
        Ok(Self { lib, state: Mutex::new(None) })
    }

    /// Phonemes of a text without punctuation, in `voice` (e.g. `roa/fr`,
    /// `gmw/en-US`). Clauses are joined with a space, like phonemizer does.
    pub fn phonemize(&self, voice: &str, text: &str) -> Result<String> {
        let mut state = self.state.lock().unwrap();
        if state.as_deref() != Some(voice) {
            let v = CString::new(voice)?;
            // SAFETY: C signature from speak_lib.h; the string outlives the call.
            let rc = unsafe {
                let set: Symbol<SetVoiceFn> = self.lib.get(b"espeak_SetVoiceByName\0")?;
                set(v.as_ptr())
            };
            if rc != 0 {
                bail!("espeak voice {voice}: error {rc}");
            }
            *state = Some(voice.to_string());
        }
        let c = CString::new(text)?;
        let mut ptr: *const c_void = c.as_ptr().cast();
        let mut parts = Vec::new();
        // SAFETY: espeak advances `ptr` through our NUL-terminated buffer and
        // sets it to NULL at the end; the returned string is valid until the
        // next call, so it is copied at once. Access is serialized by the mutex.
        unsafe {
            let t2p: Symbol<TextToPhonemesFn> = self.lib.get(b"espeak_TextToPhonemes\0")?;
            while !ptr.is_null() {
                let out = t2p(&mut ptr, ESPEAK_CHARS_UTF8, PHONEME_MODE);
                if !out.is_null() {
                    let s = CStr::from_ptr(out).to_string_lossy().into_owned();
                    if !s.is_empty() {
                        parts.push(s);
                    }
                }
            }
        }
        Ok(parts.join(" "))
    }
}
