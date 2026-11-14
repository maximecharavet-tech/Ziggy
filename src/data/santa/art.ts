/**
 * A Christmas visual. Images ship as AVIF + WebP (full ≤1600 px and a `-800`
 * variant); videos as H.264 MP4 + VP9 WebM, muted, with a WebP poster.
 * Visuals: ChatGPT (images) and Grok Imagine (videos), made for Ziggy.
 */
export type SantaArtSlot = { id: string; path: string; ratio: string; prompt: string; kind: 'image' | 'video'; poster?: string; available: boolean };

/** `/santa/art/x.webp` → `/santa/art/x` (no extension). */
export const artBase = (path: string) => path.replace(/\.[a-z0-9]+$/i, '');
/** Responsive sources for an image slot. */
export function imageSources(path: string) {
  const b = artBase(path);
  return { avif: `${b}-800.avif 800w, ${b}.avif 1600w`, webp: `${b}-800.webp 800w, ${b}.webp 1600w`, src: `${b}.webp` };
}
/** The two encodings of a video slot (MP4 first: smaller here, and plays everywhere). */
export function videoSources(path: string) {
  const b = artBase(path);
  return [{ src: `${b}.mp4`, type: 'video/mp4' }, { src: `${b}.webm`, type: 'video/webm' }];
}

/** Asset manifest. `available` is true when the files are in public/santa/art (tiktok-teaser is a social-media asset kept out of the site). */
export const SANTA_ART = [
  { id: 'hero-landing', path: '/santa/art/hero-landing.webp', ratio: '16:9', prompt: 'Santa in a warm North Pole office, vintage red phone, aurora window, friendly premium 3D animation, no text.', kind: 'image', available: true },
  { id: 'appel-entrant', path: '/santa/art/appel-entrant.webp', ratio: '9:16', prompt: 'A child-safe phone glowing with golden magic on a winter bed, no child visible, no text.', kind: 'image', available: true },
  { id: 'bureau-fond-appel', path: '/santa/art/bureau-fond-appel.webp', ratio: '16:9', prompt: 'Santa office webcam view, empty red chair, fireplace, tree, no character, no text.', kind: 'image', available: true },
  { id: 'grand-livre', path: '/santa/art/grand-livre.webp', ratio: '3:2', prompt: 'Open antique golden storybook on a lectern, quill and stardust, blank photo frame, no text.', kind: 'image', available: true },
  { id: 'atelier-lutins', path: '/santa/art/atelier-lutins.webp', ratio: '16:9', prompt: 'Joyful North Pole toy workshop, elves wrapping gifts, warm lights, no text.', kind: 'image', available: true },
  { id: 'traineau-nuit', path: '/santa/art/traineau-nuit.webp', ratio: '21:9', prompt: 'Santa sleigh and nine reindeer above a snowy French village at night, no text.', kind: 'image', available: true },
  { id: 'mere-noel', path: '/santa/art/mere-noel.webp', ratio: '3:4', prompt: 'Kind Mrs Claus baking in a cozy wooden kitchen, no text.', kind: 'image', available: true },
  { id: 'certificat-cadre', path: '/santa/art/certificat-cadre.webp', ratio: '4:3', prompt: 'Ornate red and gold diploma frame, holly and wax seal, blank parchment center, no text.', kind: 'image', available: true },
  { id: 'carte-cadeau', path: '/santa/art/carte-cadeau.webp', ratio: '16:10', prompt: 'Premium red velvet gift envelope with gold ribbon and snowflakes, no text.', kind: 'image', available: true },
  { id: 'calendrier-avent', path: '/santa/art/calendrier-avent.webp', ratio: '1:1', prompt: 'North Pole house facade with 24 varied little doors and warm windows, no numbers, no text.', kind: 'image', available: true },
  { id: 'og-image', path: '/santa/art/og-image.webp', ratio: '1200:630', prompt: 'Santa video-calling an anonymous child seen from behind in a festive living room, no text.', kind: 'image', available: true },
  { id: 'offres-3-cadeaux', path: '/santa/art/offres-3-cadeaux.webp', ratio: '16:9', prompt: 'Three gift boxes of increasing size under a Christmas tree, warm magical light, no text.', kind: 'image', available: true },
  { id: 'home-village-hero', path: '/santa/art/home-village-hero.webp', ratio: '16:9', prompt: 'Snowy North Pole village at night, aurora and full moon, Santa waving from his porch, Ziggy the green plush robot in the foreground, no text.', kind: 'image', available: true },
  { id: 'home-door-village', path: '/santa/art/home-door-village.webp', ratio: '4:3', prompt: 'Santa and Ziggy welcoming you at the workshop door, Santa reaching out, warm lights, no text.', kind: 'image', available: true },
  { id: 'home-door-lutins', path: '/santa/art/home-door-lutins.webp', ratio: '4:3', prompt: 'Pepin, Noisette, Grelotte and Ziggy wrapping gifts in the elves’ workshop, official felt costumes, no text.', kind: 'image', available: true },
  { id: 'home-door-jeux', path: '/santa/art/home-door-jeux.webp', ratio: '4:3', prompt: 'Pepin, Noisette, Grelotte and Ziggy playing with a wooden train and blocks on a red rug, no text.', kind: 'image', available: true },
  { id: 'hero-loop', path: '/santa/art/hero-loop.mp4', ratio: '16:9', prompt: 'Santa smiles, laughs, winks and waves in his North Pole office, gentle seamless loop, no text.', kind: 'video', poster: '/santa/art/hero-loop-poster.webp', available: true },
  { id: 'appel-entrant-video', path: '/santa/art/appel-entrant-video.mp4', ratio: '9:16', prompt: 'A phone glows on a bed as golden sparks and snowflakes fill the room, no child, no text.', kind: 'video', poster: '/santa/art/appel-entrant-video-poster.webp', available: true },
  { id: 'traineau-decollage', path: '/santa/art/traineau-decollage.mp4', ratio: '21:9', prompt: 'Santa sleigh launches into aurora sky with a trail of stars, no text.', kind: 'video', poster: '/santa/art/traineau-decollage-poster.webp', available: true },
  { id: 'lettre-envoyee', path: '/santa/art/lettre-envoyee.mp4', ratio: '1:1', prompt: 'A sealed red envelope flies from a snowy mailbox to Santa office, no text.', kind: 'video', poster: '/santa/art/lettre-envoyee-poster.webp', available: true },
  { id: 'atelier-video', path: '/santa/art/atelier.mp4', ratio: '16:9', prompt: 'Gentle camera move through an elf workshop, toys and gift wrapping, no text.', kind: 'video', poster: '/santa/art/atelier-poster.webp', available: true },
  { id: 'grand-livre-video', path: '/santa/art/grand-livre.mp4', ratio: '3:2', prompt: 'An old storybook opens and golden stardust rises, no text.', kind: 'video', poster: '/santa/art/grand-livre-poster.webp', available: true },
  { id: 'tiktok-teaser', path: '/santa/art/tiktok-teaser.mp4', ratio: '9:16', prompt: 'Close view of Santa whispering a secret then laughing warmly, no text.', kind: 'video', available: false },
] satisfies readonly SantaArtSlot[];

export function santaArt(id: string) { return SANTA_ART.find((asset) => asset.id === id); }
