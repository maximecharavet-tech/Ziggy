//! Numbers said in words (FR / EN), for the phonemizer only: the page keeps
//! showing the digits, the teleprompter lights the whole number at once.

/// French cardinal (0 ≤ n < 10^12), with the 1990 spelling reform's rules
/// left aside (classic hyphenation, "et un", "quatre-vingts", "cents").
pub fn fr_cardinal(n: u64) -> String {
    if n == 0 {
        return "zéro".into();
    }
    let mut parts: Vec<String> = Vec::new();
    let scales = [(1_000_000_000u64, "milliard"), (1_000_000, "million")];
    let mut rest = n;
    for (v, name) in scales {
        if rest >= v {
            let q = rest / v;
            rest %= v;
            parts.push(format!("{} {}{}", fr_below_1000(q, false), name, if q > 1 { "s" } else { "" }));
        }
    }
    if rest >= 1000 {
        let q = rest / 1000;
        rest %= 1000;
        parts.push(if q == 1 { "mille".to_string() } else { format!("{} mille", fr_below_1000(q, true)) });
    }
    if rest > 0 {
        parts.push(fr_below_1000(rest, false));
    }
    parts.join(" ")
}

/// `before_mille`: "quatre-vingt mille", "deux cent mille" (no plural s).
fn fr_below_1000(n: u64, before_mille: bool) -> String {
    let h = n / 100;
    let r = n % 100;
    let mut s = String::new();
    if h > 0 {
        if h > 1 {
            s.push_str(UNITS_FR[h as usize]);
            s.push(' ');
        }
        s.push_str("cent");
        if h > 1 && r == 0 && !before_mille {
            s.push('s');
        }
    }
    if r > 0 {
        if !s.is_empty() {
            s.push(' ');
        }
        s.push_str(&fr_below_100(r, before_mille));
    }
    s
}

const UNITS_FR: [&str; 20] = [
    "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize",
    "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
];
const TENS_FR: [&str; 7] = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

fn fr_below_100(n: u64, before_mille: bool) -> String {
    let n = n as usize;
    if n < 20 {
        return UNITS_FR[n].into();
    }
    let (t, u) = (n / 10, n % 10);
    match t {
        2..=6 => match u {
            0 => TENS_FR[t].into(),
            1 => format!("{} et un", TENS_FR[t]),
            _ => format!("{}-{}", TENS_FR[t], UNITS_FR[u]),
        },
        7 => match u {
            1 => "soixante et onze".into(),
            _ => format!("soixante-{}", UNITS_FR[10 + u]),
        },
        8 => match u {
            0 => {
                if before_mille {
                    "quatre-vingt".into()
                } else {
                    "quatre-vingts".into()
                }
            }
            _ => format!("quatre-vingt-{}", UNITS_FR[u]),
        },
        _ => format!("quatre-vingt-{}", UNITS_FR[10 + u]),
    }
}

pub fn fr_ordinal(n: u64, feminine: bool) -> String {
    if n == 1 {
        return if feminine { "première" } else { "premier" }.into();
    }
    let c = fr_cardinal(n);
    let stem = if let Some(s) = c.strip_suffix("cinq") {
        format!("{s}cinqu")
    } else if let Some(s) = c.strip_suffix("neuf") {
        format!("{s}neuv")
    } else if let Some(s) = c.strip_suffix("quatre-vingts") {
        format!("{s}quatre-vingt")
    } else if let Some(s) = c.strip_suffix("cents") {
        format!("{s}cent")
    } else if let Some(s) = c.strip_suffix('e') {
        s.to_string()
    } else {
        c
    };
    format!("{stem}ième")
}

const UNITS_EN: [&str; 20] = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
];
const TENS_EN: [&str; 10] = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

fn en_below_100(n: u64) -> String {
    let n = n as usize;
    if n < 20 {
        return UNITS_EN[n].into();
    }
    let (t, u) = (n / 10, n % 10);
    if u == 0 {
        TENS_EN[t].into()
    } else {
        format!("{}-{}", TENS_EN[t], UNITS_EN[u])
    }
}

fn en_below_1000(n: u64) -> String {
    let (h, r) = (n / 100, n % 100);
    match (h, r) {
        (0, r) => en_below_100(r),
        (h, 0) => format!("{} hundred", UNITS_EN[h as usize]),
        (h, r) => format!("{} hundred {}", UNITS_EN[h as usize], en_below_100(r)),
    }
}

/// English cardinal (US, no "and", as misaki reads numbers).
pub fn en_cardinal(n: u64) -> String {
    if n == 0 {
        return "zero".into();
    }
    let mut parts = Vec::new();
    let mut rest = n;
    for (v, name) in [(1_000_000_000u64, "billion"), (1_000_000, "million"), (1_000, "thousand")] {
        if rest >= v {
            parts.push(format!("{} {name}", en_below_1000(rest / v)));
            rest %= v;
        }
    }
    if rest > 0 {
        parts.push(en_below_1000(rest));
    }
    parts.join(" ")
}

/// Four-digit numbers that read as years ("nineteen ninety").
pub fn en_year(n: u64) -> Option<String> {
    if !(1100..=2099).contains(&n) || (2000..2010).contains(&n) {
        return None;
    }
    let (hi, lo) = (n / 100, n % 100);
    Some(match lo {
        0 => format!("{} hundred", en_below_100(hi)),
        1..=9 => format!("{} oh {}", en_below_100(hi), UNITS_EN[lo as usize]),
        _ => format!("{} {}", en_below_100(hi), en_below_100(lo)),
    })
}

pub fn en_ordinal(n: u64) -> String {
    let c = en_cardinal(n);
    let irregular = [
        ("one", "first"),
        ("two", "second"),
        ("three", "third"),
        ("five", "fifth"),
        ("eight", "eighth"),
        ("nine", "ninth"),
        ("twelve", "twelfth"),
    ];
    for (a, b) in irregular {
        if let Some(s) = c.strip_suffix(a) {
            if s.is_empty() || s.ends_with(' ') || s.ends_with('-') {
                return format!("{s}{b}");
            }
        }
    }
    if let Some(s) = c.strip_suffix('y') {
        return format!("{s}ieth");
    }
    format!("{c}th")
}

fn digits_value(d: &str) -> Option<u64> {
    if d.len() > 12 {
        return None;
    }
    d.parse().ok()
}

/// The spoken form of a token: digit runs become words; letters and
/// punctuation stay. `12` → `douze`, `1er` → `premier`, `3,5` → `trois virgule cinq`.
pub fn spoken(tok: &str, locale: &str) -> String {
    if !tok.chars().any(|c| c.is_ascii_digit()) {
        return tok.to_string();
    }
    let cs: Vec<char> = tok.chars().collect();
    let mut out = String::new();
    let mut i = 0;
    while i < cs.len() {
        if !cs[i].is_ascii_digit() {
            out.push(cs[i]);
            i += 1;
            continue;
        }
        let mut j = i;
        while j < cs.len() && cs[j].is_ascii_digit() {
            j += 1;
        }
        let int: String = cs[i..j].iter().collect();
        // decimal part: "3,5" (fr) / "3.5" (en)
        let sep = if locale == "fr" { ',' } else { '.' };
        let mut frac = String::new();
        if j + 1 < cs.len() && cs[j] == sep && cs[j + 1].is_ascii_digit() {
            let mut k = j + 1;
            while k < cs.len() && cs[k].is_ascii_digit() {
                k += 1;
            }
            frac = cs[j + 1..k].iter().collect();
            j = k;
        }
        let rest: String = cs[j..].iter().collect::<String>().to_lowercase();
        let Some(v) = digits_value(&int) else {
            out.push_str(&int);
            i = j;
            continue;
        };
        let said_frac = |f: &str| -> String {
            let n: u64 = f.parse().unwrap_or(0);
            if f.starts_with('0') {
                f.chars()
                    .map(|c| if locale == "fr" { fr_cardinal(c as u64 - 48) } else { en_cardinal(c as u64 - 48) })
                    .collect::<Vec<_>>()
                    .join(" ")
            } else if locale == "fr" {
                fr_cardinal(n)
            } else {
                f.chars().map(|c| en_cardinal(c as u64 - 48)).collect::<Vec<_>>().join(" ")
            }
        };
        if locale == "fr" {
            let ord = ["ère", "re", "er", "ème", "e", "è"]
                .iter()
                .find(|s| rest.starts_with(**s) && !rest[s.len()..].starts_with(char::is_alphabetic));
            if frac.is_empty() {
                if let Some(s) = ord {
                    out.push_str(&fr_ordinal(v, matches!(*s, "ère" | "re")));
                    i = j + s.chars().count();
                    continue;
                }
                out.push_str(&fr_cardinal(v));
            } else {
                out.push_str(&format!("{} virgule {}", fr_cardinal(v), said_frac(&frac)));
            }
        } else {
            let ord = ["st", "nd", "rd", "th"]
                .iter()
                .find(|s| rest.starts_with(**s) && !rest[s.len()..].starts_with(char::is_alphabetic));
            if frac.is_empty() {
                if let Some(s) = ord {
                    out.push_str(&en_ordinal(v));
                    i = j + s.len();
                    continue;
                }
                let year = if int.len() == 4 { en_year(v) } else { None };
                out.push_str(&year.unwrap_or_else(|| en_cardinal(v)));
            } else {
                out.push_str(&format!("{} point {}", en_cardinal(v), said_frac(&frac)));
            }
        }
        i = j;
    }
    if locale == "fr" {
        out = out.replace('%', " pour cent");
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn french_cardinals() {
        let cases = [
            (0, "zéro"),
            (1, "un"),
            (17, "dix-sept"),
            (21, "vingt et un"),
            (22, "vingt-deux"),
            (71, "soixante et onze"),
            (77, "soixante-dix-sept"),
            (80, "quatre-vingts"),
            (81, "quatre-vingt-un"),
            (91, "quatre-vingt-onze"),
            (100, "cent"),
            (101, "cent un"),
            (200, "deux cents"),
            (230, "deux cent trente"),
            (1000, "mille"),
            (1999, "mille neuf cent quatre-vingt-dix-neuf"),
            (80_000, "quatre-vingt mille"),
            (200_000, "deux cent mille"),
            (2_000_000, "deux millions"),
        ];
        for (n, w) in cases {
            assert_eq!(fr_cardinal(n), w, "{n}");
        }
    }

    #[test]
    fn english_cardinals() {
        assert_eq!(en_cardinal(0), "zero");
        assert_eq!(en_cardinal(13), "thirteen");
        assert_eq!(en_cardinal(42), "forty-two");
        assert_eq!(en_cardinal(100), "one hundred");
        assert_eq!(en_cardinal(123), "one hundred twenty-three");
        assert_eq!(en_cardinal(1_005), "one thousand five");
        assert_eq!(en_cardinal(2_500_000), "two million five hundred thousand");
        assert_eq!(en_year(1990).as_deref(), Some("nineteen ninety"));
        assert_eq!(en_year(1905).as_deref(), Some("nineteen oh five"));
        assert_eq!(en_year(2005), None);
    }

    #[test]
    fn ordinals() {
        assert_eq!(fr_ordinal(1, false), "premier");
        assert_eq!(fr_ordinal(1, true), "première");
        assert_eq!(fr_ordinal(4, false), "quatrième");
        assert_eq!(fr_ordinal(5, false), "cinquième");
        assert_eq!(fr_ordinal(9, false), "neuvième");
        assert_eq!(fr_ordinal(21, false), "vingt et unième");
        assert_eq!(en_ordinal(1), "first");
        assert_eq!(en_ordinal(12), "twelfth");
        assert_eq!(en_ordinal(20), "twentieth");
        assert_eq!(en_ordinal(23), "twenty-third");
        assert_eq!(en_ordinal(100), "one hundredth");
    }

    #[test]
    fn spoken_tokens() {
        assert_eq!(spoken("12", "fr"), "douze");
        assert_eq!(spoken("(3", "fr"), "(trois");
        assert_eq!(spoken("1er", "fr"), "premier");
        assert_eq!(spoken("2e,", "fr"), "deuxième,");
        assert_eq!(spoken("3,5", "fr"), "trois virgule cinq");
        assert_eq!(spoken("50%", "fr"), "cinquante pour cent");
        assert_eq!(spoken("21st", "en"), "twenty-first");
        assert_eq!(spoken("3.5", "en"), "three point five");
        assert_eq!(spoken("7,", "en"), "seven,");
        assert_eq!(spoken("chat", "fr"), "chat");
    }
}
