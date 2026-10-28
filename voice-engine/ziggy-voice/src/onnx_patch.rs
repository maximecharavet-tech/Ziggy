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

use anyhow::{bail, Context, Result};

/// Tensor holding the per-token durations (frames of 600 samples at 24 kHz).
pub const DURATION_TENSOR: &str = "/encoder/Gather_output_0";
/// Pitch curve given to the decoder (Hz, 2 values per duration frame).
pub const F0_TENSOR: &str = "/encoder/Reshape_output_0";
/// The decoder node that consumes [`F0_TENSOR`] (F0_conv + harmonic source).
pub const F0_CONSUMER: &str = "/decoder/decoder/Unsqueeze";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Patch {
    DurationOnly,
    Full,
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
fn f0_nodes() -> Vec<Vec<u8>> {
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
        node("Where", "zv_f0", &["zv_is_voiced", "zv_scaled", F0_TENSOR], &["f0"], &[]),
        node("Identity", "expose_f0_pred", &[F0_TENSOR], &["f0_pred"], &[]),
    ]
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

    let mut g = Vec::with_capacity(graph.payload.len() + 4096);
    for (k, f) in gf.iter().enumerate() {
        if patch == Patch::Full && f.num == 1 && get_str(f.payload, 3)?.first() == Some(&F0_CONSUMER) {
            for n in f0_nodes() {
                put_len(&mut g, 1, &n);
            }
            put_len(&mut g, 1, &rename_input(f.payload, F0_TENSOR, "f0")?);
        } else {
            g.extend_from_slice(f.raw);
        }
        if k == last_node {
            put_len(&mut g, 1, &node("Identity", "expose_duration", &[DURATION_TENSOR], &["duration"], &[]));
        }
        if k == last_input && patch == Patch::Full {
            for name in ["f0_scale", "f0_gamma", "f0_ref"] {
                put_len(&mut g, 11, &value_info(name, FLOAT, &[Dim::Fixed(1)]));
            }
        }
        if k == last_output {
            put_len(&mut g, 12, &value_info("duration", INT64, &[Dim::Param("sequence_length")]));
            if patch == Patch::Full {
                put_len(&mut g, 12, &value_info("f0", FLOAT, &[Dim::Fixed(1), Dim::Param("f0_frames")]));
                put_len(&mut g, 12, &value_info("f0_pred", FLOAT, &[Dim::Fixed(1), Dim::Param("f0_frames")]));
            }
        }
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
