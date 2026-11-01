//! End-to-end checks against the real model, espeak-ng and dictionaries.
//! They need `ziggy-voice prepare` (the cache); without it they are skipped.

use ziggy_voice::espeak::Espeak;
use ziggy_voice::g2p_en::EnglishG2P;
use ziggy_voice::g2p_fr::FrenchG2P;
use ziggy_voice::intonation::StoryContext;
use ziggy_voice::kokoro::{encode, Blend, Controls, Kokoro, PitchCtl, F0_HOP, SR};
use ziggy_voice::paths::Cache;
use ziggy_voice::prosody::{plan_segment, Cast};
use ziggy_voice::render::{G2p, Renderer};
use ziggy_voice::text::tokenize;

fn ready(cache: &Cache) -> bool {
    let ok = cache.model().exists() && cache.onnxruntime().exists() && cache.espeak_lib().exists();
    if !ok {
        eprintln!("skipped: run `ziggy-voice prepare` first");
    }
    ok
}

fn toks(s: &str) -> Vec<String> {
    tokenize(s)
}

/// One test function: ONNX Runtime allows a single environment per process.
#[test]
fn engine_end_to_end() {
    let cache = Cache::new();
    if !ready(&cache) {
        return;
    }
    let es = Espeak::load(&cache.espeak_lib(), &cache.espeak_data()).unwrap();
    let lex = ziggy_voice::stories::lexicon().unwrap();

    // French: same phonemes as Kokoro's own front-end (misaki + espeak-ng)
    let fr = FrenchG2P::new(&es, lex["fr"].clone());
    let p = fr.utterance(&toks("Il était une fois, tout en haut des montagnes bleues, un château.")).unwrap();
    assert_eq!(p.ps, "il etˈɛt yn fwˈa, tut ɑ̃ ˈo de mɔ̃tˈanj blˈø, œ̃ ʃatˈo.");
    assert_eq!(p.starts[0], Some(0));
    assert!(p.starts.iter().all(|s| s.is_some()));
    // liaison kept across words, lexicon names inserted
    let p = fr.utterance(&toks("« Oh ! » chuchota Lili.")).unwrap();
    assert_eq!(p.ps, "“ ˈɔ ! ” ʃyʃotˈa lilˈi.");
    let p = fr.utterance(&toks("Léopold dort.")).unwrap();
    assert!(p.ps.starts_with("leɔpˈɔld"), "{}", p.ps);

    // English: misaki's dictionaries, stress and context rules
    let en = EnglishG2P::new(&es, &cache.misaki(), lex["en"].clone()).unwrap();
    let p = en.utterance(&toks("In the garden, under the moon, they found the first secret.")).unwrap();
    assert_eq!(p.ps, "ɪn ðə ɡˈɑɹdən, ˈʌndəɹ ðə mˈun, ðA fˈWnd ðə fˈɜɹst sˈikɹət.");
    let p = en.utterance(&toks("“Oh!” whispered Lili.")).unwrap();
    assert_eq!(p.ps, "“ˈO!” wˈɪspəɹd lˈili.");
    let p = en.utterance(&toks("Lili’s eyes lit up.")).unwrap();
    assert!(p.ps.starts_with("lˈiliz"), "{}", p.ps);

    // Kokoro through ort, with the patched graph's outputs and pitch controls
    let k = Kokoro::new(&cache, 2).unwrap();
    let (ids, _, _) = encode("bɔ̃ʒˈuʁ, mɔ̃ pətˈi kˈœʁ.");
    let style = k.style(&Blend::single("ff_siwis"), ids.len()).unwrap();
    let a = k.synth(&ids, &style, 0.8, PitchCtl::default()).unwrap();
    assert!(a.audio.len() > SR as usize / 2);
    assert_eq!(a.edges.len(), ids.len() + 2);
    assert!(a.edges.windows(2).all(|w| w[1] >= w[0]));
    assert_eq!(a.f0.len(), a.audio.len() / F0_HOP);
    assert_eq!(a.f0, a.f0_pred, "identity controls leave the pitch untouched");
    let b = k.synth(&ids, &style, 0.8, PitchCtl { scale: 1.2, gamma: 1.0, reference: 200.0 }).unwrap();
    let voiced: Vec<f32> = a.f0.iter().zip(&b.f0).filter(|(x, _)| **x > 10.0).map(|(x, y)| y / x).collect();
    let mean = voiced.iter().sum::<f32>() / voiced.len() as f32;
    assert!((mean - 1.2).abs() < 0.01, "in-network pitch ×{mean}");
    assert_eq!(a.edges, b.edges, "pitch does not change the durations");
    // slower speed → longer audio
    let c = k.synth(&ids, &style, 0.6, PitchCtl::default()).unwrap();
    assert!(c.audio.len() > a.audio.len());

    // v3 controls: the predictor pass sees what the full graph would do;
    // exact durations and a pitch contour are then followed as given
    let pred = k.predict(&ids, &style, 0.8, &[]).unwrap();
    assert_eq!(pred.durations, a.durations, "predictor pass = full graph");
    assert_eq!(pred.f0, a.f0_pred);
    let mut frames: Vec<f32> = pred.durations.iter().map(|&d| d as f32).collect();
    frames[3] += 4.0; // one phoneme 100 ms longer
    let total: usize = frames.iter().map(|&d| d as usize).sum();
    let f0: Vec<f32> =
        (0..total * 2).map(|j| if j < pred.f0.len() && pred.f0[j] > 10.0 { pred.f0[j] * 1.1 } else { 0.0 }).collect();
    let d = k
        .synth_with(
            &ids,
            &style,
            0.8,
            PitchCtl::default(),
            &Controls { dur_frames: frames.clone(), f0: f0.clone(), ..Default::default() },
        )
        .unwrap();
    assert_eq!(d.durations, frames.iter().map(|&x| x as i64).collect::<Vec<_>>());
    assert_eq!(d.f0, f0, "the pitch override reaches the decoder");

    // a whole segment: words, visemes, loudness
    let g2p = G2p::Fr(fr);
    let r = Renderer { kokoro: &k, g2p: &g2p, take_cache: None };
    let text = "« Oh ! » chuchota Lili. Le chat dort.";
    let plan = plan_segment("fr", "s3", text, &mut Cast::default(), &mut StoryContext::default());
    let seg = r.render_segment(&plan).unwrap();
    let dur = seg.audio.len() as f64 / SR as f64;
    assert_eq!(seg.words.len(), tokenize(text).len());
    assert!(seg.words.windows(2).all(|w| w[1] >= w[0]));
    assert!(*seg.words.last().unwrap() < dur);
    assert!(seg.visemes.windows(2).all(|w| w[1].0 > w[0].0));
    let (m, rep) = ziggy_voice::master::master(&seg.audio, SR);
    assert_eq!(m.len(), seg.audio.len());
    assert!((rep.lufs + 18.0).abs() < 0.3, "{}", rep.lufs);
    assert!(rep.true_peak_db <= -1.5 + 0.05, "{}", rep.true_peak_db);
}
