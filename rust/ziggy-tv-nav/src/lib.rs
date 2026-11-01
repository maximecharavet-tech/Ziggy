//! Ziggy on TV: where the remote's arrow keys move the focus.
//!
//! The page sends the rectangles of everything focusable (and which row or
//! section each one belongs to); this crate answers which one the focus goes
//! to for a press of ↑ → ↓ ←. Compiled to WebAssembly and loaded only on TVs
//! (`src/lib/tv/wasm/`); `src/lib/tv/spatial-nav.ts` is the same algorithm in
//! TypeScript, used until the WebAssembly is ready (a test keeps them equal).
//!
//! The scoring is a port of the ideas of Norigin Spatial Navigation
//! (<https://github.com/NoriginMedia/Norigin-Spatial-Navigation>, MIT License,
//! Copyright (c) 2022 NoriginMedia), proven on Tizen, webOS and Android TV:
//! - only elements entirely past the edge being left are candidates (cut-off);
//! - an element whose side overlaps the current one's by 20 % sits in the
//!   "adjacent slice" (same row or column) and is strongly preferred;
//! - priority = (5 × main distance + other distance + 1), divided by 5 for the
//!   adjacent slice; the main distance is along the move for the adjacent
//!   slice and sideways otherwise (so a far diagonal never wins over a
//!   neighbour);
//! - navigation stays inside the current container (row) first; when nothing
//!   is left there, the container itself moves among its siblings, and
//!   entering a container restores its last focused child;
//! - a container can be a boundary for some directions.
//!
//! Ziggy's additions: the 20 % overlap is measured on the smaller of the two
//! sides (rows of different sizes), a small tolerance for the focused
//! element's 1.06 scale, and rows that wrap around.

use wasm_bindgen::prelude::*;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

impl Rect {
    pub const fn new(x: f64, y: f64, w: f64, h: f64) -> Rect {
        Rect { x, y, w, h }
    }
    fn left(&self) -> f64 {
        self.x
    }
    fn right(&self) -> f64 {
        self.x + self.w
    }
    fn top(&self) -> f64 {
        self.y
    }
    fn bottom(&self) -> f64 {
        self.y + self.h
    }
    fn cx(&self) -> f64 {
        self.x + self.w / 2.0
    }
    fn cy(&self) -> f64 {
        self.y + self.h / 2.0
    }
    fn union(&self, o: &Rect) -> Rect {
        let x = self.x.min(o.x);
        let y = self.y.min(o.y);
        Rect::new(x, y, self.right().max(o.right()) - x, self.bottom().max(o.bottom()) - y)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Dir {
    Up = 0,
    Right = 1,
    Down = 2,
    Left = 3,
}

impl Dir {
    pub fn from_code(code: u8) -> Option<Dir> {
        match code {
            0 => Some(Dir::Up),
            1 => Some(Dir::Right),
            2 => Some(Dir::Down),
            3 => Some(Dir::Left),
            _ => None,
        }
    }
    fn vertical(self) -> bool {
        matches!(self, Dir::Up | Dir::Down)
    }
    fn boundary_bit(self) -> u8 {
        1 << (self as u8)
    }
}

/// Group flags: the group stops the focus from leaving it in that direction.
pub const BOUNDARY_UP: u8 = 1;
pub const BOUNDARY_RIGHT: u8 = 2;
pub const BOUNDARY_DOWN: u8 = 4;
pub const BOUNDARY_LEFT: u8 = 8;
/// Group flags: at the end of the row, ← / → go round to the other end.
pub const WRAP_X: u8 = 16;
/// Group flags: at the end of the column, ↑ / ↓ go round to the other end.
pub const WRAP_Y: u8 = 32;

/// The edge of `r` facing the move (`sibling = false`, the element being
/// left) or facing back (`sibling = true`, a candidate), as Norigin's
/// "ref corners": (coordinate along the move, slice start, slice end).
fn edge(r: &Rect, dir: Dir, sibling: bool) -> (f64, f64, f64) {
    match dir {
        Dir::Up => (if sibling { r.bottom() } else { r.top() }, r.left(), r.right()),
        Dir::Down => (if sibling { r.top() } else { r.bottom() }, r.left(), r.right()),
        Dir::Right => (if sibling { r.left() } else { r.right() }, r.top(), r.bottom()),
        Dir::Left => (if sibling { r.right() } else { r.left() }, r.top(), r.bottom()),
    }
}

/// Is `to` past the edge of `from` in `dir`? A little overlap is forgiven
/// (the focused element is drawn 6 % bigger), as long as `to` is clearly
/// further along.
pub fn is_ahead(from: &Rect, to: &Rect, dir: Dir) -> bool {
    let (cut, _, _) = edge(from, dir, false);
    let (side, _, _) = edge(to, dir, true);
    let ext = if dir.vertical() { from.h.min(to.h) } else { from.w.min(to.w) };
    let tol = 1.0 + 0.04 * ext.max(0.0);
    match dir {
        Dir::Down => side >= cut - tol && to.cy() > from.cy(),
        Dir::Up => side <= cut + tol && to.cy() < from.cy(),
        Dir::Right => side >= cut - tol && to.cx() > from.cx(),
        Dir::Left => side <= cut + tol && to.cx() < from.cx(),
    }
}

/// Same row or column: the sides overlap by at least 20 % of the smaller side.
fn adjacent_slice(from: &Rect, to: &Rect, dir: Dir) -> bool {
    let (_, u, c) = edge(from, dir, false);
    let (_, l, d) = edge(to, dir, true);
    let overlap = (c.min(d) - u.max(l)).max(0.0);
    let size = (c - u).min(d - l).max(0.0);
    size > 0.0 && overlap >= 0.2 * size
}

/// How good a move from `from` to `to` is (lower is better); None when `to`
/// is not in that direction.
pub fn priority(from: &Rect, to: &Rect, dir: Dir) -> Option<f64> {
    if !is_ahead(from, to, dir) {
        return None;
    }
    let (cp, u, c) = edge(from, dir, false);
    let (sp, l, d) = edge(to, dir, true);
    let primary = (sp - cp).abs();
    let secondary = (l - u).abs().min((l - c).abs()).min((d - u).abs()).min((d - c).abs());
    let adjacent = adjacent_slice(from, to, dir);
    let (main, other) = if adjacent { (primary, secondary) } else { (secondary, primary) };
    Some((5.0 * main + other + 1.0) / if adjacent { 5.0 } else { 1.0 })
}

fn best_of(rects: &[Rect], from: &Rect, dir: Dir, mut keep: impl FnMut(usize) -> bool) -> Option<usize> {
    let mut best: Option<(f64, usize)> = None;
    for (i, r) in rects.iter().enumerate() {
        if !keep(i) {
            continue;
        }
        if let Some(p) = priority(from, r, dir) {
            // Ties keep the first in document order.
            if best.map_or(true, |(bp, _)| p < bp) {
                best = Some((p, i));
            }
        }
    }
    best.map(|(_, i)| i)
}

fn group_rect(rects: &[Rect], groups: &[u32], g: u32) -> Option<Rect> {
    rects.iter().zip(groups).filter(|(_, &gg)| gg == g).map(|(r, _)| *r).reduce(|a, b| a.union(&b))
}

/// At the end of a wrapping row: the member at the other end, the nearest
/// sideways to where the focus was.
fn far_end(rects: &[Rect], groups: &[u32], g: u32, current: usize, dir: Dir) -> Option<usize> {
    let cur = rects[current];
    let mut best: Option<((f64, f64), usize)> = None;
    for (i, r) in rects.iter().enumerate() {
        if i == current || groups[i] != g {
            continue;
        }
        // Smaller is better: how far along the "back" side it is, then how far sideways.
        let key = match dir {
            Dir::Right => (r.left(), (r.cy() - cur.cy()).abs()),
            Dir::Left => (-r.right(), (r.cy() - cur.cy()).abs()),
            Dir::Down => (r.top(), (r.cx() - cur.cx()).abs()),
            Dir::Up => (-r.bottom(), (r.cx() - cur.cx()).abs()),
        };
        if best.map_or(true, |(bk, _)| key.0 < bk.0 - 0.5 || ((key.0 - bk.0).abs() <= 0.5 && key.1 < bk.1)) {
            best = Some((key, i));
        }
    }
    best.map(|(_, i)| i)
}

/// Entering group `h`: its last focused child if it still exists, else the
/// best child seen from the element being left, else the nearest one.
fn enter(rects: &[Rect], groups: &[u32], memory: &[i32], h: u32, cur: &Rect, dir: Dir) -> Option<usize> {
    if let Some(&m) = memory.get(h as usize) {
        if m >= 0 && (m as usize) < rects.len() && groups[m as usize] == h {
            return Some(m as usize);
        }
    }
    if let Some(i) = best_of(rects, cur, dir, |i| groups[i] == h) {
        return Some(i);
    }
    let dist = |r: &Rect| (r.cx() - cur.cx()).powi(2) + (r.cy() - cur.cy()).powi(2);
    rects
        .iter()
        .enumerate()
        .filter(|(i, _)| groups[*i] == h)
        .min_by(|a, b| dist(a.1).total_cmp(&dist(b.1)))
        .map(|(i, _)| i)
}

/// The element the focus moves to from `current` in `dir`, or None to stay.
///
/// - `rects[i]`: where element i is on screen (any coordinate space, same for all);
/// - `groups[i]`: its row or section, 0 for none (ids are small integers);
/// - `flags[g]`: BOUNDARY_* and WRAP_* bits of group g;
/// - `memory[g]`: index of the last focused child of group g, or -1.
pub fn next_focus(rects: &[Rect], groups: &[u32], current: usize, dir: Dir, flags: &[u8], memory: &[i32]) -> Option<usize> {
    if current >= rects.len() || groups.len() != rects.len() {
        return None;
    }
    let cur = rects[current];
    let g = groups[current];
    let mut from = cur;
    if g != 0 {
        // 1. Inside the row first.
        if let Some(i) = best_of(rects, &cur, dir, |i| i != current && groups[i] == g) {
            return Some(i);
        }
        let f = flags.get(g as usize).copied().unwrap_or(0);
        let wraps = if dir.vertical() { f & WRAP_Y != 0 } else { f & WRAP_X != 0 };
        if wraps {
            return far_end(rects, groups, g, current, dir);
        }
        if f & dir.boundary_bit() != 0 {
            return None;
        }
        // 2. Then the row as a whole moves among its siblings.
        from = group_rect(rects, groups, g).unwrap_or(cur);
    }

    let mut best: Option<(f64, usize, u32)> = None; // (priority, index, group entered or 0)
    for (i, r) in rects.iter().enumerate() {
        if i == current || groups[i] != 0 {
            continue;
        }
        if let Some(p) = priority(&from, r, dir) {
            if best.map_or(true, |(bp, _, _)| p < bp) {
                best = Some((p, i, 0));
            }
        }
    }
    let mut seen: Vec<u32> = Vec::new();
    for (i, &h) in groups.iter().enumerate() {
        if h == 0 || h == g || seen.contains(&h) {
            continue;
        }
        seen.push(h);
        if let Some(r) = group_rect(rects, groups, h) {
            if let Some(p) = priority(&from, &r, dir) {
                if best.map_or(true, |(bp, _, _)| p < bp) {
                    best = Some((p, i, h));
                }
            }
        }
    }
    match best {
        None => None,
        Some((_, i, 0)) => Some(i),
        Some((_, _, h)) => enter(rects, groups, memory, h, &cur, dir),
    }
}

fn rects_from(flat: &[f64]) -> Vec<Rect> {
    flat.chunks_exact(4).map(|c| Rect::new(c[0], c[1], c[2], c[3])).collect()
}

/// WebAssembly entry: `rects` is [x, y, w, h, x, y, w, h, …]; returns the
/// index to focus, or -1 to stay.
#[wasm_bindgen(js_name = nextFocus)]
pub fn next_focus_flat(rects: &[f64], groups: &[u32], current: u32, dir: u8, flags: &[u8], memory: &[i32]) -> i32 {
    let Some(dir) = Dir::from_code(dir) else { return -1 };
    let rects = rects_from(rects);
    match next_focus(&rects, groups, current as usize, dir, flags, memory) {
        Some(i) => i as i32,
        None => -1,
    }
}

/// WebAssembly entry: the priority of one move (lower is better), -1 when
/// `to` is not in that direction. For tests and the debugger.
#[wasm_bindgen(js_name = priority)]
pub fn priority_flat(from: &[f64], to: &[f64], dir: u8) -> f64 {
    let (Some(dir), [fx, fy, fw, fh], [tx, ty, tw, th]) = (Dir::from_code(dir), from, to) else { return -1.0 };
    priority(&Rect::new(*fx, *fy, *fw, *fh), &Rect::new(*tx, *ty, *tw, *th), dir).unwrap_or(-1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tile(col: f64, row: f64) -> Rect {
        // 300 × 200 tiles, 40 px apart.
        Rect::new(col * 340.0, row * 260.0, 300.0, 200.0)
    }

    #[test]
    fn only_elements_past_the_edge_are_candidates() {
        let a = tile(0.0, 0.0);
        assert!(priority(&a, &tile(1.0, 0.0), Dir::Right).is_some());
        assert!(priority(&a, &tile(1.0, 0.0), Dir::Left).is_none());
        assert!(priority(&a, &tile(0.0, 1.0), Dir::Down).is_some());
        assert!(priority(&a, &tile(0.0, 1.0), Dir::Up).is_none());
        // Overlapping on the move axis: not "to the right".
        assert!(priority(&a, &Rect::new(150.0, 0.0, 300.0, 200.0), Dir::Right).is_none());
    }

    #[test]
    fn the_scaled_focus_ring_does_not_hide_a_close_neighbour() {
        // Focused tile drawn 6 % bigger: its right edge now passes the neighbour's left edge by 2 px.
        let focused = Rect::new(-9.0, -6.0, 318.0, 212.0);
        let next = Rect::new(307.0, 0.0, 300.0, 200.0);
        assert!(priority(&focused, &next, Dir::Right).is_some());
    }

    #[test]
    fn the_next_in_the_row_beats_a_diagonal_just_below() {
        let from = tile(0.0, 0.0);
        let same_row = Rect::new(340.0, 20.0, 300.0, 200.0);
        let diagonal = Rect::new(320.0, 230.0, 300.0, 200.0);
        let a = priority(&from, &same_row, Dir::Right).unwrap();
        let b = priority(&from, &diagonal, Dir::Right).unwrap();
        assert!(a < b, "same row {a} should beat diagonal {b}");
    }

    #[test]
    fn among_diagonals_the_least_sideways_wins() {
        let from = Rect::new(0.0, 0.0, 100.0, 100.0);
        let slightly = Rect::new(300.0, 130.0, 100.0, 100.0);
        let very = Rect::new(150.0, 400.0, 100.0, 100.0);
        assert!(priority(&from, &slightly, Dir::Right).unwrap() < priority(&from, &very, Dir::Right).unwrap());
    }

    #[test]
    fn a_plain_grid() {
        // 3 × 2 grid, no groups.
        let rects: Vec<Rect> = (0..6).map(|i| tile((i % 3) as f64, (i / 3) as f64)).collect();
        let groups = vec![0; 6];
        let go = |from: usize, dir: Dir| next_focus(&rects, &groups, from, dir, &[], &[]);
        assert_eq!(go(0, Dir::Right), Some(1));
        assert_eq!(go(1, Dir::Right), Some(2));
        assert_eq!(go(2, Dir::Right), None);
        assert_eq!(go(1, Dir::Down), Some(4));
        assert_eq!(go(4, Dir::Up), Some(1));
        assert_eq!(go(5, Dir::Left), Some(4));
        assert_eq!(go(3, Dir::Up), Some(0));
    }

    /// The TV home: a button, then two rows of tiles (the first scrolled sideways).
    fn home() -> (Vec<Rect>, Vec<u32>) {
        let mut rects = vec![Rect::new(100.0, 100.0, 300.0, 80.0)]; // 0: "Listen" button
        let mut groups = vec![0];
        for i in 0..6 {
            rects.push(Rect::new(100.0 + i as f64 * 380.0 - 760.0, 300.0, 350.0, 220.0)); // 1–6: stories (scrolled by 2)
            groups.push(1);
        }
        for i in 0..4 {
            rects.push(Rect::new(100.0 + i as f64 * 380.0, 600.0, 350.0, 220.0)); // 7–10: games
            groups.push(2);
        }
        (rects, groups)
    }

    #[test]
    fn rows_move_inside_first_then_as_a_whole() {
        let (rects, groups) = home();
        let flags = [0, 0, 0];
        let none = [-1, -1, -1];
        // Inside the stories row.
        assert_eq!(next_focus(&rects, &groups, 3, Dir::Right, &flags, &none), Some(4));
        // Down from a story: into the games row, the game under it.
        assert_eq!(next_focus(&rects, &groups, 3, Dir::Down, &flags, &none), Some(7));
        assert_eq!(next_focus(&rects, &groups, 5, Dir::Down, &flags, &none), Some(9));
        // Up from the games: back into the stories row, then up to the button.
        assert_eq!(next_focus(&rects, &groups, 8, Dir::Up, &flags, &none), Some(4));
        assert_eq!(next_focus(&rects, &groups, 4, Dir::Up, &flags, &none), Some(0));
        // The button goes down into the stories row.
        assert!(matches!(next_focus(&rects, &groups, 0, Dir::Down, &flags, &none), Some(i) if groups[i] == 1));
    }

    #[test]
    fn entering_a_row_restores_its_last_focused_child() {
        let (rects, groups) = home();
        let memory = [-1, 6, -1]; // the stories row was left on its last tile
        assert_eq!(next_focus(&rects, &groups, 8, Dir::Up, &[0, 0, 0], &memory), Some(6));
        // A stale memory (not in that row) is ignored.
        assert_eq!(next_focus(&rects, &groups, 8, Dir::Up, &[0, 0, 0], &[-1, 9, -1]), Some(4));
    }

    #[test]
    fn rows_wrap_around() {
        let (rects, groups) = home();
        let flags = [0, WRAP_X, WRAP_X];
        let none = [-1, -1, -1];
        assert_eq!(next_focus(&rects, &groups, 10, Dir::Right, &flags, &none), Some(7));
        assert_eq!(next_focus(&rects, &groups, 7, Dir::Left, &flags, &none), Some(10));
        assert_eq!(next_focus(&rects, &groups, 1, Dir::Left, &flags, &none), Some(6));
        // Without wrapping, the end of the row stays put (nothing beside it).
        assert_eq!(next_focus(&rects, &groups, 10, Dir::Right, &[0, 0, 0], &none), None);
    }

    #[test]
    fn a_boundary_keeps_the_focus_in() {
        let (rects, groups) = home();
        let flags = [0, 0, BOUNDARY_UP];
        assert_eq!(next_focus(&rects, &groups, 8, Dir::Up, &flags, &[-1, -1, -1]), None);
        assert_eq!(next_focus(&rects, &groups, 8, Dir::Right, &flags, &[-1, -1, -1]), Some(9));
    }

    #[test]
    fn a_lone_row_member_with_nothing_around_stays() {
        let rects = [Rect::new(0.0, 0.0, 10.0, 10.0)];
        assert_eq!(next_focus(&rects, &[1], 0, Dir::Down, &[0, 0], &[-1, -1]), None);
        assert_eq!(next_focus(&rects, &[1], 0, Dir::Right, &[0, WRAP_X], &[-1, -1]), None);
    }

    #[test]
    fn bad_input_is_harmless() {
        assert_eq!(next_focus(&[], &[], 0, Dir::Up, &[], &[]), None);
        assert_eq!(next_focus_flat(&[0.0, 0.0, 1.0, 1.0], &[0], 0, 9, &[], &[]), -1);
        assert_eq!(next_focus_flat(&[0.0, 0.0, 1.0, 1.0], &[0, 0], 0, 1, &[], &[]), -1);
        assert_eq!(priority_flat(&[0.0, 0.0, 1.0], &[0.0, 0.0, 1.0, 1.0], 1), -1.0);
    }

    #[test]
    fn flat_entry_matches_the_rust_api() {
        let (rects, groups) = home();
        let flat: Vec<f64> = rects.iter().flat_map(|r| [r.x, r.y, r.w, r.h]).collect();
        for cur in 0..rects.len() {
            for code in 0..4u8 {
                let dir = Dir::from_code(code).unwrap();
                let a = next_focus(&rects, &groups, cur, dir, &[0, WRAP_X, 0], &[-1, -1, -1]).map_or(-1, |i| i as i32);
                assert_eq!(next_focus_flat(&flat, &groups, cur as u32, code, &[0, WRAP_X, 0], &[-1, -1, -1]), a);
            }
        }
    }
}
