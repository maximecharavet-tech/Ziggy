use sandbox_core::gen::*;
use sandbox_core::sim::*;
use sandbox_core::table::*;
fn show(s: &World) {
    for y in 0..s.h as i32 {
        let row: String = (0..s.w as i32).map(|x| { let t = s.get(x, y); if t == 0 { '.' } else { char::from_digit((t % 36) as u32, 36).unwrap() } }).collect();
        println!("{row}");
    }
}
fn main() {
    let mut s = World::new(40, 40, 7, GARDEN);
    for x in 0..40 { s.set(x, 39, STONE); }
    for y in 35..=38 { s.set(13, y, STONE); s.set(27, y, STONE); }
    for y in 36..=38 { for x in 14..=26 { s.set(x, y, WATER); } }
    s.set(20, 30, SEED);
    for t in 0..3000 { s.step(); if t % 500 == 0 {
        let mut v = vec![];
        for y in 0..40 { for x in 0..40 { let i = y*40+x; if sp(s.cells[i]) == PLANT { v.push((x, y, ca(s.cells[i]), cb(s.cells[i]))); } } }
        println!("t{t} {:?} awake {}", v, s.awake_chunks());
    } }
    show(&s);
}
