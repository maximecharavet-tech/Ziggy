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
    let mut s = World::new(60, 30, 7, MOUNTAIN);
    for x in 0..60 { s.set(x, 29, STONE); s.set(x, 28, SAND); s.set(x, 27, SAND); }
    for t in 0..400 { s.set(30, 20, WATER); s.step(); if t % 50 == 0 { println!("t{t} water {} tick {}", s.count(WATER), s.tick); } }
    show(&s);
    let mut s = World::new(40, 30, 7, MOON);
    for x in 0..40 { s.set(x, 29, STONE); }
    s.set(20, 20, BUBBLE);
    for t in 0..30 { s.step(); println!("t{t} bubble {} pops {}", s.count(BUBBLE), s.counts[R_SILENT_POP as usize]); if s.count(BUBBLE)==0 {break;} }
    let mut s = World::new(40, 40, 7, MOON);
    for x in 0..40 { s.set(x, 39, STONE); for y in 32..39 { s.set(x, y, MOONDUST); } }
    s.set(20, 8, METEORITE);
    for t in 0..400 { s.step(); for y in 0..40 { for x in 0..40 { if s.get(x,y)==METEORITE && t % 10 == 0 { println!("t{t} met at {x},{y} aux {}", s.aux[y as usize*40+x as usize]); } } } }
}
