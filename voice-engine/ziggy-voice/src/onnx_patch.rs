//! A tiny protobuf editor for Kokoro's ONNX graph (no protoc, no Python).
//!
//! The weights are left untouched: only a few small messages are added to the
//! `GraphProto` (and one node gets a new input), then the graph's length prefix
//! is rewritten. Two patches exist:
//!
//! * [`Patch::DurationOnly`] — exactly what the old `prepare_model.py` did with
//!   the `onnx` Python package (an `Identity` exposing the predicted phoneme
//!   durations). Its output is byte-identical to the Python file, which is how
//!   this writer was validated.
//! * [`Patch::Full`] — durations, plus the voice controls of Ziggy v2: the
//!   pitch curve the predictor produced (`f0_pred`) is transformed **inside**
//!   the network before the decoder renders it — `f0 = ref·(f0_pred/ref)^γ·scale`
//!   on voiced frames — so the neural vocoder itself sings the melody (no
//!   pitch-shifting artefact). The rendered curve is exposed as `f0`.
//! * [`Patch::V3`] — v2 plus explicit prosody: per-phoneme duration scales
//!   (`dur_scale`) or exact frame counts (`dur_frames`, `dur_mix`), and the
//!   pitch and energy curves given to the decoder (`f0_override`/`f0_mix`,
//!   `n_override`/`n_mix`); the predicted energy is exposed as `n_pred`.
//!   [`prune`] then cuts a predictor-only graph (durations, `f0_pred`,
//!   `n_pred`) for the planning pass, without the costly decoder.

use anyhow::{bail, Context, Result};

/// Tensor holding the per-token durations (frames of 600 samples at 24 kHz).
pub const DURATION_TENSOR: &str = "/encoder/Gather_output_0";
/// Pitch curve given to the decoder (Hz, 2 values per duration frame).
pub const F0_TENSOR: &str = "/encoder/Reshape_output_0";
/// The decoder node that consumes [`F0_TENSOR`] (F0_conv + harmonic source).
pub const F0_CONSUMER: &str = "/decoder/decoder/Unsqueeze";
/// Predicted durations (frames, float, after `speed`), before rounding.
pub const DUR_FLOAT: &str = "/encoder/Div_output_0";
/// The node that rounds them.
pub const DUR_CONSUMER: &str = "/encoder/Round";
/// Energy curve given to the decoder (2 values per duration frame).
pub const N_TENSOR: &str = "/encoder/Reshape_1_output_0";
pub const N_CONSUMER: &str = "/decoder/decoder/Unsqueeze_1";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Patch {
    DurationOnly,
    Full,
    V3,
}

// ── wire format ────────────────────────────────────────────────────────────

pub fn read_varint(buf: &[u8], pos: &mut usize) -> Result<u64> {
    let mut v: u64 = 0;
    let mut shift = 0;
    loop {
        let Some(&b) = buf.get(*pos) else { bail!("truncated varint") };
        *pos += 1;
        v |= u64::from(b & 0x7f) << shift;
        if b & 0x80 == 0 {
            return Ok(v);
        }
        shift += 7;
        if shift > 63 {
            bail!("varint too long");
        }
    }
}

pub fn write_varint(out: &mut Vec<u8>, mut v: u64) {
    loop {
        let b = (v & 0x7f) as u8;
        v >>= 7;
        if v == 0 {
            out.push(b);
            return;
        }
        out.push(b | 0x80);
    }
}

/// One field of a message: number, wire type, payload (for length-delimited
/// fields, the bytes inside) and the whole entry as it was encoded.
#[derive(Clone, Copy, Debug)]
pub struct Field<'a> {
    pub num: u32,
    pub wire: u8,
    pub payload: &'a [u8],
    pub raw: &'a [u8],
}

pub fn fields(buf: &[u8]) -> Result<Vec<Field<'_>>> {
    let mut out = Vec::new();
    let mut pos = 0;
    while pos < buf.len() {
        let start = pos;
        let key = read_varint(buf, &mut pos)?;
        let num = (key >> 3) as u32;
        let wire = (key & 7) as u8;
        let payload_start;
        match wire {
            0 => {
                payload_start = pos;
                read_varint(buf, &mut pos)?;
            }
            1 => {
                payload_start = pos;
                pos += 8;
            }
            2 => {
                let len = read_varint(buf, &mut pos)? as usize;
                payload_start = pos;
                pos += len;
            }
            5 => {
                payload_start = pos;
                pos += 4;
            }
            _ => bail!("unsupported wire type {wire} at byte {start}"),
        }
        if pos > buf.len() {
            bail!("truncated field {num}");
        }
        out.push(Field { num, wire, payload: &buf[payload_start..pos], raw: &buf[start..pos] });
    }
    Ok(out)
}

fn put_len(out: &mut Vec<u8>, num: u32, payload: &[u8]) {
    write_varint(out, (u64::from(num) << 3) | 2);
    write_varint(out, payload.len() as u64);
    out.extend_from_slice(payload);
}

fn put_varint(out: &mut Vec<u8>, num: u32, v: u64) {
    write_varint(out, u64::from(num) << 3);
    write_varint(out, v);
}

fn put_str(out: &mut Vec<u8>, num: u32, s: &str) {
    put_len(out, num, s.as_bytes());
}

fn get_str(msg: &[u8], num: u32) -> Result<Vec<&str>> {
    let mut v = Vec::new();
    for f in fields(msg)? {
        if f.num == num && f.wire == 2 {
            v.push(std::str::from_utf8(f.payload).context("non-utf8 string")?);
        }
    }
    Ok(v)
}

// ── ONNX messages we write ────────────────────────────────────────────────

const FLOAT: u64 = 1;
const INT64: u64 = 7;
const BOOL_ATTR_TENSOR: u64 = 4; // AttributeProto.AttributeType.TENSOR

/// NodeProto { input=1, output=2, name=3, op_type=4, attribute=5 }.
pub fn node(op: &str, name: &str, inputs: &[&str], outputs: &[&str], attrs: &[Vec<u8>]) -> Vec<u8> {
    let mut m = Vec::new();
    for i in inputs {
        put_str(&mut m, 1, i);
    }
    for o in outputs {
        put_str(&mut m, 2, o);
    }
    put_str(&mut m, 3, name);
    put_str(&mut m, 4, op);
    for a in attrs {
        put_len(&mut m, 5, a);
    }
    m
}

/// AttributeProto `value` holding a float tensor of shape [1].
fn attr_float_tensor(v: f32) -> Vec<u8> {
    let mut t = Vec::new();
    put_varint(&mut t, 1, 1); // dims = [1]
    put_varint(&mut t, 2, FLOAT); // data_type
    put_len(&mut t, 9, &v.to_le_bytes()); // raw_data
    let mut a = Vec::new();
    put_str(&mut a, 1, "value");
    put_len(&mut a, 5, &t);
    put_varint(&mut a, 20, BOOL_ATTR_TENSOR);
    a
}

/// ValueInfoProto for a tensor with symbolic or fixed dims.
pub fn value_info(name: &str, elem: u64, dims: &[Dim<'_>]) -> Vec<u8> {
    let mut shape = Vec::new();
    for d in dims {
        let mut dim = Vec::new();
        match d {
            Dim::Fixed(n) => put_varint(&mut dim, 1, *n),
            Dim::Param(p) => put_str(&mut dim, 2, p),
        }
        put_len(&mut shape, 1, &dim);
    }
    let mut tensor = Vec::new();
    put_varint(&mut tensor, 1, elem);
    put_len(&mut tensor, 2, &shape);
    let mut ty = Vec::new();
    put_len(&mut ty, 1, &tensor);
    let mut vi = Vec::new();
    put_str(&mut vi, 1, name);
    put_len(&mut vi, 2, &ty);
    vi
}

pub enum Dim<'a> {
    Fixed(u64),
    Param(&'a str),
}

/// The nodes that turn `f0_pred` into the rendered `f0`.
fn f0_nodes(out: &str) -> Vec<Vec<u8>> {
    let c = |name: &str, v: f32| node("Constant", name, &[], &[name], &[attr_float_tensor(v)]);
    vec![
        c("zv_one", 1.0),
        c("zv_floor", 0.01),
        c("zv_voiced", 10.0), // Kokoro's SineGen treats f0 <= 10 Hz as unvoiced
        node("Div", "zv_ratio", &[F0_TENSOR, "f0_ref"], &["zv_ratio"], &[]),
        node("Max", "zv_ratio_floor", &["zv_ratio", "zv_floor"], &["zv_ratio_floor"], &[]),
        node("Sub", "zv_gamma_m1", &["f0_gamma", "zv_one"], &["zv_gamma_m1"], &[]),
        node("Pow", "zv_widen", &["zv_ratio_floor", "zv_gamma_m1"], &["zv_widen"], &[]),
        node("Mul", "zv_wide", &[F0_TENSOR, "zv_widen"], &["zv_wide"], &[]),
        node("Mul", "zv_scaled", &["zv_wide", "f0_scale"], &["zv_scaled"], &[]),
        node("Greater", "zv_is_voiced", &[F0_TENSOR, "zv_voiced"], &["zv_is_voiced"], &[]),
        node("Where", "zv_f0", &["zv_is_voiced", "zv_scaled", F0_TENSOR], &[out], &[]),
        node("Identity", "expose_f0_pred", &[F0_TENSOR], &["f0_pred"], &[]),
    ]
}

/// `out = a·(1 − mix) + b·mix` (b may be [1, 1]: then nothing changes at mix 0).
fn mix_nodes(tag: &str, a: &str, b: &str, mix: &str, out: &str) -> Vec<Vec<u8>> {
    let one = format!("zv_{tag}_one");
    let inv = format!("zv_{tag}_inv");
    let keep = format!("zv_{tag}_keep");
    let take = format!("zv_{tag}_take");
    vec![
        node("Constant", &one, &[], &[&one], &[attr_float_tensor(1.0)]),
        node("Sub", &inv, &[&one, mix], &[&inv], &[]),
        node("Mul", &keep, &[a, &inv], &[&keep], &[]),
        node("Mul", &take, &[b, mix], &[&take], &[]),
        node("Add", &format!("zv_{tag}_mix"), &[&keep, &take], &[out], &[]),
    ]
}

/// v3 duration control: `frames = dur_frames·mix + predicted·dur_scale·(1 − mix)`,
/// then the model's own rounding and ≥ 1 clip.
fn dur_nodes() -> Vec<Vec<u8>> {
    let mut v = vec![node("Mul", "zv_dur_scaled", &[DUR_FLOAT, "dur_scale"], &["zv_dur_scaled"], &[])];
    v.extend(mix_nodes("dur", "zv_dur_scaled", "dur_frames", "dur_mix", "zv_dur"));
    v
}

/// Rewrite one input name of a serialized NodeProto.
fn rename_input(node_msg: &[u8], from: &str, to: &str) -> Result<Vec<u8>> {
    let mut out = Vec::with_capacity(node_msg.len() + 8);
    let mut hit = false;
    for f in fields(node_msg)? {
        if f.num == 1 && f.wire == 2 && f.payload == from.as_bytes() {
            put_str(&mut out, 1, to);
            hit = true;
        } else {
            out.extend_from_slice(f.raw);
        }
    }
    if !hit {
        bail!("input {from} not found");
    }
    Ok(out)
}

/// Patch a serialized ModelProto.
pub fn patch_model(model: &[u8], patch: Patch) -> Result<Vec<u8>> {
    let top = fields(model)?;
    let graph = top.iter().find(|f| f.num == 7 && f.wire == 2).context("no graph in the model")?;
    let gf = fields(graph.payload)?;

    let mut has_dur_tensor = false;
    let mut has_consumer = false;
    for f in gf.iter().filter(|f| f.num == 1) {
        let outs = get_str(f.payload, 2)?;
        if outs.contains(&DURATION_TENSOR) {
            has_dur_tensor = true;
        }
        if get_str(f.payload, 3)?.first() == Some(&F0_CONSUMER) {
            has_consumer = true;
        }
        if outs.contains(&"duration") {
            bail!("the graph is already patched");
        }
    }
    if !has_dur_tensor {
        bail!("{DURATION_TENSOR} not found in the graph");
    }
    if patch == Patch::Full && !has_consumer {
        bail!("{F0_CONSUMER} not found in the graph");
    }

    let last_node = gf.iter().rposition(|f| f.num == 1).context("no node")?;
    let last_input = gf.iter().rposition(|f| f.num == 11).context("no input")?;
    let last_output = gf.iter().rposition(|f| f.num == 12).context("no output")?;
    let v3 = patch == Patch::V3;
    let controls = patch != Patch::DurationOnly;

    let mut g = Vec::with_capacity(graph.payload.len() + 4096);
    let mut seen = [false; 3];
    for (k, f) in gf.iter().enumerate() {
        let name = if f.num == 1 { get_str(f.payload, 3)?.first().map(|s| s.to_string()) } else { None };
        match name.as_deref() {
            Some(n) if controls && n == F0_CONSUMER => {
                seen[0] = true;
                let f0_v2 = if v3 { "zv_f0_v2" } else { "f0" };
                for x in f0_nodes(f0_v2) {
                    put_len(&mut g, 1, &x);
                }
                if v3 {
                    for x in mix_nodes("f0o", "zv_f0_v2", "f0_override", "f0_mix", "f0") {
                        put_len(&mut g, 1, &x);
                    }
                }
                put_len(&mut g, 1, &rename_input(f.payload, F0_TENSOR, "f0")?);
            }
            Some(n) if v3 && n == DUR_CONSUMER => {
                seen[1] = true;
                for x in dur_nodes() {
                    put_len(&mut g, 1, &x);
                }
                put_len(&mut g, 1, &rename_input(f.payload, DUR_FLOAT, "zv_dur")?);
            }
            Some(n) if v3 && n == N_CONSUMER => {
                seen[2] = true;
                for x in mix_nodes("n", N_TENSOR, "n_override", "n_mix", "zv_n") {
                    put_len(&mut g, 1, &x);
                }
                put_len(&mut g, 1, &node("Identity", "expose_n_pred", &[N_TENSOR], &["n_pred"], &[]));
                put_len(&mut g, 1, &rename_input(f.payload, N_TENSOR, "zv_n")?);
            }
            _ => g.extend_from_slice(f.raw),
        }
        if k == last_node {
            put_len(&mut g, 1, &node("Identity", "expose_duration", &[DURATION_TENSOR], &["duration"], &[]));
        }
        if k == last_input && controls {
            for name in ["f0_scale", "f0_gamma", "f0_ref"] {
                put_len(&mut g, 11, &value_info(name, FLOAT, &[Dim::Fixed(1)]));
            }
            if v3 {
                // each input has its own symbolic length: a control left
                // out is fed as [1, 1] while another one is full length
                for (name, per) in [
                    ("dur_scale", Some("dur_scale_len")),
                    ("dur_frames", Some("dur_frames_len")),
                    ("dur_mix", None),
                    ("f0_override", Some("f0_override_len")),
                    ("f0_mix", None),
                    ("n_override", Some("n_override_len")),
                    ("n_mix", None),
                ] {
                    let dims: Vec<Dim> = match per {
                        Some(p) => vec![Dim::Fixed(1), Dim::Param(p)],
                        None => vec![Dim::Fixed(1)],
                    };
                    put_len(&mut g, 11, &value_info(name, FLOAT, &dims));
                }
            }
        }
        if k == last_output {
            put_len(&mut g, 12, &value_info("duration", INT64, &[Dim::Param("sequence_length")]));
            if controls {
                put_len(&mut g, 12, &value_info("f0", FLOAT, &[Dim::Fixed(1), Dim::Param("f0_frames")]));
                put_len(&mut g, 12, &value_info("f0_pred", FLOAT, &[Dim::Fixed(1), Dim::Param("f0_frames")]));
            }
            if v3 {
                put_len(&mut g, 12, &value_info("n_pred", FLOAT, &[Dim::Fixed(1), Dim::Param("f0_frames")]));
            }
        }
    }
    if controls && !seen[0] || v3 && !(seen[1] && seen[2]) {
        bail!("an expected node of Kokoro's graph was not found");
    }

    let mut out = Vec::with_capacity(model.len() + g.len() - graph.payload.len() + 16);
    for f in &top {
        if std::ptr::eq(f.raw.as_ptr(), graph.raw.as_ptr()) {
            put_len(&mut out, 7, &g);
        } else {
            out.extend_from_slice(f.raw);
        }
    }
    Ok(out)
}

/// Keep only what computes `outputs` (backward reachability; Kokoro's graph
/// has no control flow, so no subgraph captures outer tensors). Unused
/// initializers, inputs and value infos are dropped.
pub fn prune(model: &[u8], outputs: &[&str]) -> Result<Vec<u8>> {
    let top = fields(model)?;
    let graph = top.iter().find(|f| f.num == 7 && f.wire == 2).context("no graph in the model")?;
    let gf = fields(graph.payload)?;
    let mut needed: std::collections::HashSet<String> = outputs.iter().map(|s| s.to_string()).collect();
    let mut keep = vec![false; gf.len()];
    for (k, f) in gf.iter().enumerate().rev() {
        if f.num != 1 {
            continue;
        }
        let outs = get_str(f.payload, 2)?;
        if outs.iter().any(|o| needed.contains(*o)) {
            keep[k] = true;
            for i in get_str(f.payload, 1)? {
                if !i.is_empty() {
                    needed.insert(i.to_string());
                }
            }
        }
    }
    let mut g = Vec::with_capacity(graph.payload.len());
    let mut found = 0;
    for (k, f) in gf.iter().enumerate() {
        let named =
            |num: u32| -> Result<Option<String>> { Ok(get_str(f.payload, num)?.first().map(|s| s.to_string())) };
        let take = match f.num {
            1 => keep[k],
            5 => named(8)?.is_some_and(|n| needed.contains(&n)), // initializer (TensorProto.name = 8)
            11 | 13 => named(1)?.is_some_and(|n| needed.contains(&n)), // input, value_info
            12 => {
                let ok = named(1)?.is_some_and(|n| outputs.contains(&n.as_str()));
                found += usize::from(ok);
                ok
            }
            _ => true,
        };
        if take {
            g.extend_from_slice(f.raw);
        }
    }
    if found != outputs.len() {
        bail!("prune: {} of {} outputs found", found, outputs.len());
    }
    let mut out = Vec::with_capacity(g.len() + 1024);
    for f in &top {
        if std::ptr::eq(f.raw.as_ptr(), graph.raw.as_ptr()) {
            put_len(&mut out, 7, &g);
        } else {
            out.extend_from_slice(f.raw);
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn varint_round_trip() {
        for v in [0u64, 1, 127, 128, 300, 1 << 35, u64::MAX >> 1] {
            let mut b = Vec::new();
            write_varint(&mut b, v);
            let mut p = 0;
            assert_eq!(read_varint(&b, &mut p).unwrap(), v);
            assert_eq!(p, b.len());
        }
    }

    /// A miniature model: graph { node(dur producer), node(F0 consumer), input, output }.
    fn toy_model() -> Vec<u8> {
        let mut g = Vec::new();
        put_len(&mut g, 1, &node("Gather", "/encoder/Gather", &["a", "b"], &[DURATION_TENSOR], &[]));
        put_len(&mut g, 1, &node("Reshape", "/encoder/Reshape", &["c", "d"], &[F0_TENSOR], &[]));
        put_len(&mut g, 1, &node("Unsqueeze", F0_CONSUMER, &[F0_TENSOR, "k"], &["u"], &[]));
        put_str(&mut g, 2, "main_graph");
        put_len(&mut g, 11, &value_info("input_ids", INT64, &[Dim::Fixed(1), Dim::Param("n")]));
        put_len(&mut g, 12, &value_info("waveform", FLOAT, &[Dim::Param("t")]));
        let mut m = Vec::new();
        put_varint(&mut m, 1, 8);
        put_len(&mut m, 7, &g);
        m
    }

    /// The v3 toy: durations rounded, F0 and N both reaching the decoder.
    fn toy_v3() -> Vec<u8> {
        let mut g = Vec::new();
        put_len(&mut g, 1, &node("Div", "/encoder/Div", &["sum", "speed"], &[DUR_FLOAT], &[]));
        put_len(&mut g, 1, &node("Round", DUR_CONSUMER, &[DUR_FLOAT], &["r"], &[]));
        put_len(&mut g, 1, &node("Gather", "/encoder/Gather", &["r", "b"], &[DURATION_TENSOR], &[]));
        put_len(&mut g, 1, &node("Reshape", "/encoder/Reshape", &[DURATION_TENSOR, "d"], &[F0_TENSOR], &[]));
        put_len(&mut g, 1, &node("Reshape", "/encoder/Reshape_1", &[DURATION_TENSOR, "d"], &[N_TENSOR], &[]));
        put_len(&mut g, 1, &node("Unsqueeze", F0_CONSUMER, &[F0_TENSOR, "k"], &["u"], &[]));
        put_len(&mut g, 1, &node("Unsqueeze", N_CONSUMER, &[N_TENSOR, "k"], &["u2"], &[]));
        put_len(&mut g, 1, &node("Add", "/decoder/out", &["u", "u2"], &["waveform"], &[]));
        put_str(&mut g, 2, "main_graph");
        let mut init = Vec::new();
        put_varint(&mut init, 1, 1);
        put_str(&mut init, 8, "decoder.weight");
        put_len(&mut g, 5, &init);
        put_len(&mut g, 11, &value_info("input_ids", INT64, &[Dim::Fixed(1), Dim::Param("n")]));
        put_len(&mut g, 12, &value_info("waveform", FLOAT, &[Dim::Param("t")]));
        let mut m = Vec::new();
        put_varint(&mut m, 1, 8);
        put_len(&mut m, 7, &g);
        m
    }

    fn graph_of(m: &[u8]) -> Vec<(u32, Vec<String>)> {
        let top = fields(m).unwrap();
        let g = top.iter().find(|f| f.num == 7).unwrap();
        fields(g.payload)
            .unwrap()
            .iter()
            .map(|f| {
                let key = match f.num {
                    1 => 3,
                    5 => 8,
                    _ => 1,
                };
                (f.num, get_str(f.payload, key).unwrap_or_default().iter().map(|s| s.to_string()).collect())
            })
            .collect()
    }

    #[test]
    fn v3_patch_and_predictor_prune() {
        let p = patch_model(&toy_v3(), Patch::V3).unwrap();
        let g = graph_of(&p);
        let names: Vec<String> = g.iter().filter(|x| x.0 == 1).filter_map(|x| x.1.first().cloned()).collect();
        let pos = |n: &str| names.iter().position(|x| x == n).unwrap();
        assert!(pos("zv_dur_mix") < pos(DUR_CONSUMER));
        assert!(pos("zv_f0o_mix") < pos(F0_CONSUMER));
        assert!(pos("zv_n_mix") < pos(N_CONSUMER));
        let inputs: Vec<String> = g.iter().filter(|x| x.0 == 11).filter_map(|x| x.1.first().cloned()).collect();
        for i in ["dur_scale", "dur_frames", "dur_mix", "f0_override", "f0_mix", "n_override", "n_mix"] {
            assert!(inputs.iter().any(|x| x == i), "{i}");
        }
        // prune to the planning outputs: the decoder goes, its weights too
        let q = prune(&p, &["duration", "f0_pred", "n_pred"]).unwrap();
        let g = graph_of(&q);
        let names: Vec<String> = g.iter().filter(|x| x.0 == 1).filter_map(|x| x.1.first().cloned()).collect();
        assert!(!names.iter().any(|n| n == "/decoder/out" || n == F0_CONSUMER || n == N_CONSUMER));
        assert!(names.iter().any(|n| n == "zv_dur_mix"));
        assert!(!g.iter().any(|x| x.0 == 5), "unused initializer dropped");
        let outs: Vec<String> = g.iter().filter(|x| x.0 == 12).filter_map(|x| x.1.first().cloned()).collect();
        assert_eq!(outs, ["duration", "f0_pred", "n_pred"]);
        assert!(prune(&p, &["nope"]).is_err());
    }

    #[test]
    fn full_patch_rewires_f0_and_adds_io() {
        let m = toy_model();
        let p = patch_model(&m, Patch::Full).unwrap();
        let top = fields(&p).unwrap();
        let g = top.iter().find(|f| f.num == 7).unwrap();
        let gf = fields(g.payload).unwrap();
        let nodes: Vec<_> = gf.iter().filter(|f| f.num == 1).collect();
        let names: Vec<String> = nodes.iter().map(|n| get_str(n.payload, 3).unwrap()[0].to_string()).collect();
        // f0 nodes come before the consumer, which now reads "f0"
        let ci = names.iter().position(|n| n == F0_CONSUMER).unwrap();
        let wi = names.iter().position(|n| n == "zv_f0").unwrap();
        assert!(wi < ci);
        assert_eq!(get_str(nodes[ci].payload, 1).unwrap(), vec!["f0", "k"]);
        assert_eq!(names.last().unwrap(), "expose_duration");
        let outs: Vec<String> =
            gf.iter().filter(|f| f.num == 12).map(|f| get_str(f.payload, 1).unwrap()[0].to_string()).collect();
        assert_eq!(outs, ["waveform", "duration", "f0", "f0_pred"]);
        let ins = gf.iter().filter(|f| f.num == 11).count();
        assert_eq!(ins, 4);
        // patching twice is refused
        assert!(patch_model(&p, Patch::Full).is_err());
    }

    #[test]
    fn duration_patch_only_appends() {
        let m = toy_model();
        let p = patch_model(&m, Patch::DurationOnly).unwrap();
        assert!(p.len() > m.len());
        let g = fields(&p).unwrap().into_iter().find(|f| f.num == 7).unwrap();
        let n = fields(g.payload).unwrap().iter().filter(|f| f.num == 1).count();
        assert_eq!(n, 4);
    }
}
