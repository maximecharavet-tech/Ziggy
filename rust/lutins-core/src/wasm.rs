//! WebAssembly exports (wasm-bindgen). Thin wrappers: validate sizes, call
//! the engine, serialise to JSON. Errors become JavaScript `Error`s.
//!
//! The exact JSON shapes are documented in `src/lib/lutins/types.ts`; the
//! TypeScript helpers in `src/lib/lutins/engine.ts` parse them.

use wasm_bindgen::prelude::*;

use crate::card::{CardRenderer, CardStyle};
use crate::image::{EngineError, RgbaImage, RgbaView};

fn js(e: EngineError) -> JsError {
    JsError::new(&e.to_string())
}

fn json<T: serde::Serialize>(v: &T) -> Result<String, JsError> {
    serde_json::to_string(v).map_err(|e| JsError::new(&format!("lutins-core: serialise: {e}")))
}

fn view(rgba: &[u8], w: u32, h: u32) -> Result<RgbaView<'_>, JsError> {
    RgbaView::new(rgba, w as usize, h as usize).map_err(js)
}

/// Scene analysis of a room photo → `SceneAnalysis` JSON.
#[wasm_bindgen]
pub fn analyze_scene(rgba: &[u8], w: u32, h: u32) -> Result<String, JsError> {
    json(&crate::analysis::analyze_scene(view(rgba, w, h)?).map_err(js)?)
}

/// `PromptInput` JSON → `PromptOut` JSON.
#[wasm_bindgen]
pub fn build_prompt(input_json: &str) -> Result<String, JsError> {
    json(&crate::prompt::build_prompt_json(input_json).map_err(js)?)
}

/// Verifies a generated picture against the photo → `Verification` JSON.
/// `elves_json`: `["pepin", …]` or `{"elves": [...], "mask": [{x,y,w,h}]}`.
#[wasm_bindgen]
pub fn verify(
    generated: &[u8],
    gw: u32,
    gh: u32,
    original: &[u8],
    ow: u32,
    oh: u32,
    elves_json: &str,
) -> Result<String, JsError> {
    let req = crate::verify::VerifyRequest::from_json(elves_json).map_err(js)?;
    json(&crate::verify::verify(view(generated, gw, gh)?, view(original, ow, oh)?, &req).map_err(js)?)
}

/// Like [`verify`], from encoded files (PNG / JPEG / WebP): for the Node API
/// routes, which have no image decoder.
#[cfg(feature = "decode")]
#[wasm_bindgen]
pub fn verify_encoded(generated: &[u8], original: &[u8], elves_json: &str) -> Result<String, JsError> {
    let req = crate::verify::VerifyRequest::from_json(elves_json).map_err(js)?;
    let g = crate::decode::decode(generated).map_err(js)?;
    let o = crate::decode::decode(original).map_err(js)?;
    json(&crate::verify::verify(g.view(), o.view(), &req).map_err(js)?)
}

/// An RGBA8 image returned to JavaScript. Call `free()` when done.
#[wasm_bindgen]
pub struct ImageOut {
    img: RgbaImage,
}

#[wasm_bindgen]
impl ImageOut {
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.img.w as u32
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.img.h as u32
    }

    /// The pixels (a copy).
    pub fn rgba(&self) -> Vec<u8> {
        self.img.data.clone()
    }
}

/// Downscale to fit `max_side` (never enlarges) + optional mild auto white
/// balance and levels.
#[wasm_bindgen]
pub fn prepare_photo(rgba: &[u8], w: u32, h: u32, max_side: u32, auto_fix: bool) -> Result<ImageOut, JsError> {
    Ok(ImageOut { img: crate::prepare::prepare_photo(view(rgba, w, h)?, max_side as usize, auto_fix) })
}

/// Decodes a PNG / JPEG / WebP file.
#[cfg(feature = "decode")]
#[wasm_bindgen]
pub fn decode_image(bytes: &[u8]) -> Result<ImageOut, JsError> {
    Ok(ImageOut { img: crate::decode::decode(bytes).map_err(js)? })
}

/// One frame of the magic card (RGBA8 of the style's output size, default the
/// photo's size).
#[wasm_bindgen]
pub fn render_card_frame(base: &[u8], w: u32, h: u32, t: f32, seed: u32, style_json: &str) -> Result<Vec<u8>, JsError> {
    let style = CardStyle::from_json(style_json).map_err(js)?;
    Ok(crate::card::render_card_frame(view(base, w, h)?, t, seed, style))
}

/// Stateful magic-card renderer: keeps the photo and the precomputed tables
/// in WebAssembly memory, so each frame costs only the rendering.
#[wasm_bindgen(js_name = CardRenderer)]
pub struct WasmCardRenderer {
    inner: CardRenderer,
}

#[wasm_bindgen(js_class = CardRenderer)]
impl WasmCardRenderer {
    #[wasm_bindgen(constructor)]
    pub fn new(base: &[u8], w: u32, h: u32, seed: u32, style_json: &str) -> Result<WasmCardRenderer, JsError> {
        let style = CardStyle::from_json(style_json).map_err(js)?;
        Ok(WasmCardRenderer { inner: CardRenderer::new(view(base, w, h)?, seed, style) })
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.inner.width() as u32
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.inner.height() as u32
    }

    /// Renders the frame at `t` seconds and returns a copy.
    pub fn render(&mut self, t: f32) -> Vec<u8> {
        self.inner.render(t).to_vec()
    }

    /// Renders the frame at `t` seconds in place; read it without a copy
    /// through `new Uint8ClampedArray(memory.buffer, frame_ptr(), frame_len())`
    /// (the view is valid until the next call into the engine).
    pub fn render_in_place(&mut self, t: f32) {
        self.inner.render(t);
    }

    pub fn frame_ptr(&self) -> u32 {
        self.inner.frame().as_ptr() as usize as u32
    }

    pub fn frame_len(&self) -> u32 {
        self.inner.frame().len() as u32
    }
}

/// The crate version (`0.1.0`).
#[wasm_bindgen]
pub fn engine_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// FNV-1a 32 of the embedded `bible.json` (detects a stale build).
#[wasm_bindgen]
pub fn bible_hash() -> u32 {
    crate::bible::bible_hash()
}

/// FNV-1a 32 of the embedded `pranks.json` (detects a stale build).
#[wasm_bindgen]
pub fn pranks_hash() -> u32 {
    crate::pranks::pranks_hash()
}

/// Cleans and checks a parent's own prank idea → `IdeaCheck` JSON.
#[wasm_bindgen]
pub fn check_idea(text: &str) -> Result<String, JsError> {
    json(&crate::pranks::check_idea(text))
}

/// Whether `id` is a prank of the catalogue.
#[wasm_bindgen]
pub fn is_prank_id(id: &str) -> bool {
    crate::pranks::is_prank_id(id)
}

/// The prank(s) of the night: `PlanRequest` JSON → `Plan` JSON (deterministic in the seed).
#[wasm_bindgen]
pub fn plan_pranks(request_json: &str) -> Result<String, JsError> {
    json(&crate::pranks::plan_json(request_json).map_err(js)?)
}
