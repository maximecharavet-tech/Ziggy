//! The album (« La Parade »): reading it back safely, and the family share code
//! (a short text a parent can copy and paste: nothing is sent anywhere).

use crate::creature::{clean_name, full_list, sanitize, Creature, ALL_FIELDS};
use serde_json::{json, Value};

pub const ALBUM_MAX: usize = 60;
const THUMB_MAX: usize = 60_000;

/// Anything broken is dropped, never a crash. Returns the cleaned array.
pub fn parse_album(raw: &str) -> Vec<Value> {
    let data: Value = match serde_json::from_str(raw) {
        Ok(v) => v,
        Err(_) => return vec![],
    };
    let Some(arr) = data.as_array() else { return vec![] };
    let mut out = vec![];
    let mut seen = std::collections::BTreeSet::new();
    for x in arr {
        let Some(c) = sanitize(x) else { continue };
        if c.id.is_empty() || !seen.insert(c.id.clone()) {
            continue;
        }
        let mut v = serde_json::to_value(&c).unwrap_or(Value::Null);
        let saved_at = x.get("savedAt").and_then(Value::as_f64).filter(|f| f.is_finite()).unwrap_or(0.0);
        v["savedAt"] = json!(saved_at);
        if let Some(t) = x.get("thumb").and_then(Value::as_str) {
            if t.starts_with("data:image/") && t.encode_utf16().count() <= THUMB_MAX {
                v["thumb"] = json!(t);
            }
        }
        out.push(v);
        if out.len() >= ALBUM_MAX {
            break;
        }
    }
    out
}

/* ───────── Share code ───────── */

const ALPHABET: &[u8] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const VERSION: u8 = 2;

fn fnv16(bytes: &[u8]) -> u16 {
    let mut h: u32 = 0x811c_9dc5;
    for b in bytes {
        h ^= u32::from(*b);
        h = h.wrapping_mul(0x0100_0193);
    }
    ((h >> 16) ^ (h & 0xffff)) as u16
}

fn index_of(field: &str, c: &Creature) -> u8 {
    let v = c.get(field);
    full_list(field).iter().position(|x| *x == v).unwrap_or(0) as u8
}

pub fn encode_code(c: &Creature) -> String {
    let mut bytes = vec![VERSION];
    for f in ALL_FIELDS {
        bytes.push(index_of(f, c));
    }
    let name = clean_name(&c.name);
    let nb = name.as_bytes();
    bytes.push(nb.len() as u8);
    bytes.extend_from_slice(nb);
    let sum = fnv16(&bytes);
    bytes.extend_from_slice(&sum.to_be_bytes());
    // Base32, 5 bits at a time.
    let mut out = String::new();
    let (mut acc, mut bits) = (0u32, 0u32);
    for b in bytes {
        acc = (acc << 8) | u32::from(b);
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            out.push(ALPHABET[((acc >> bits) & 31) as usize] as char);
        }
    }
    if bits > 0 {
        out.push(ALPHABET[((acc << (5 - bits)) & 31) as usize] as char);
    }
    let groups: Vec<String> = out.as_bytes().chunks(5).map(|c| String::from_utf8_lossy(c).into_owned()).collect();
    format!("ZC2-{}", groups.join("-"))
}

pub fn decode_code(code: &str) -> Option<Creature> {
    let s = code.trim().to_uppercase();
    let s = s.strip_prefix("ZC2").unwrap_or(&s);
    let mut bytes = vec![];
    let (mut acc, mut bits) = (0u32, 0u32);
    for ch in s.chars() {
        if ch == '-' || ch.is_whitespace() {
            continue;
        }
        // Crockford: look-alikes are forgiven.
        let ch = match ch {
            'O' => '0',
            'I' | 'L' => '1',
            'U' => 'V',
            c => c,
        };
        let v = ALPHABET.iter().position(|a| *a as char == ch)? as u32;
        acc = (acc << 5) | v;
        bits += 5;
        if bits >= 8 {
            bits -= 8;
            bytes.push(((acc >> bits) & 255) as u8);
        }
        if bytes.len() > 120 {
            return None;
        }
    }
    let n = ALL_FIELDS.len();
    if bytes.len() < n + 4 || bytes[0] != VERSION {
        return None;
    }
    let name_len = bytes[n + 1] as usize;
    let end = n + 2 + name_len;
    if bytes.len() < end + 2 {
        return None;
    }
    let sum = u16::from_be_bytes([bytes[end], bytes[end + 1]]);
    if fnv16(&bytes[..end]) != sum {
        return None;
    }
    let mut c = crate::creature::starter();
    for (i, f) in ALL_FIELDS.iter().enumerate() {
        let list = full_list(f);
        let v = list.get(bytes[i + 1] as usize)?;
        c.set(f, v);
    }
    let name = clean_name(&String::from_utf8(bytes[n + 2..end].to_vec()).ok()?);
    if !name.is_empty() {
        c.name = name;
    }
    c.id = String::new();
    Some(c)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::creature::random_creature;

    #[test]
    fn code_round_trips_for_any_creature() {
        for s in 0..300 {
            let mut c = random_creature(f64::from(s) * 13.0);
            c.name = clean_name(&c.name);
            let code = encode_code(&c);
            assert!(code.starts_with("ZC2-"));
            assert_eq!(decode_code(&code), Some(c), "{code}");
        }
    }

    #[test]
    fn a_typo_is_refused_or_forgiven() {
        let c = random_creature(5.0);
        let code = encode_code(&c);
        // Lower case and spaces instead of dashes are fine.
        assert_eq!(decode_code(&code.to_lowercase().replace('-', " ")).map(|x| x.body), Some(c.body.clone()));
        // A changed character fails the checksum.
        let mut bad: Vec<char> = code.chars().collect();
        let i = bad.len() - 3;
        bad[i] = if bad[i] == '2' { '3' } else { '2' };
        assert_eq!(decode_code(&bad.into_iter().collect::<String>()), None);
        assert_eq!(decode_code("hello"), None);
        assert_eq!(decode_code(""), None);
    }

    #[test]
    fn album_drops_broken_entries_and_caps_it() {
        let mut items = vec![json!({"id":"a","name":"A","savedAt":5,"thumb":"data:image/png;base64,xx"}), json!({"id":"a","name":"dup"}), json!(3), json!({"name":"no id"}), json!({"id":"b","thumb":"http://evil/x.png"})];
        for i in 0..80 {
            items.push(json!({"id": format!("z{i}")}));
        }
        let out = parse_album(&Value::Array(items).to_string());
        assert_eq!(out.len(), ALBUM_MAX);
        assert_eq!(out[0]["thumb"], "data:image/png;base64,xx");
        assert_eq!(out[0]["savedAt"], 5.0);
        assert!(out[1].get("thumb").is_none());
        assert!(parse_album("not json").is_empty());
        assert!(parse_album("{}").is_empty());
    }
}
