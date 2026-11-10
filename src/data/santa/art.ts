export type SantaArtSlot = { id: string; path: string; ratio: string; prompt: string; kind: 'image' | 'video'; poster?: string; available: boolean };

/** Asset manifest. Flip `available` only after the corresponding public file is added. */
export const SANTA_ART = [
  { id: 'hero-landing', path: '/santa/art/hero-landing.webp', ratio: '16:9', prompt: 'Santa in a warm North Pole office, vintage red phone, aurora window, friendly premium 3D animation, no text.', kind: 'image', available: false },
  { id: 'appel-entrant', path: '/santa/art/appel-entrant.webp', ratio: '9:16', prompt: 'A child-safe phone glowing with golden magic on a winter bed, no child visible, no text.', kind: 'image', available: false },
  { id: 'bureau-fond-appel', path: '/santa/art/bureau-fond-appel.webp', ratio: '16:9', prompt: 'Santa office webcam view, empty red chair, fireplace, tree, no character, no text.', kind: 'image', available: false },
  { id: 'grand-livre', path: '/santa/art/grand-livre.webp', ratio: '3:2', prompt: 'Open antique golden storybook on a lectern, quill and stardust, blank photo frame, no text.', kind: 'image', available: false },
  { id: 'atelier-lutins', path: '/santa/art/atelier-lutins.webp', ratio: '16:9', prompt: 'Joyful North Pole toy workshop, elves wrapping gifts, warm lights, no text.', kind: 'image', available: false },
  { id: 'traineau-nuit', path: '/santa/art/traineau-nuit.webp', ratio: '21:9', prompt: 'Santa sleigh and nine reindeer above a snowy French village at night, no text.', kind: 'image', available: false },
  { id: 'mere-noel', path: '/santa/art/mere-noel.webp', ratio: '3:4', prompt: 'Kind Mrs Claus baking in a cozy wooden kitchen, no text.', kind: 'image', available: false },
  { id: 'certificat-cadre', path: '/santa/art/certificat-cadre.webp', ratio: '4:3', prompt: 'Ornate red and gold diploma frame, holly and wax seal, blank parchment center, no text.', kind: 'image', available: false },
  { id: 'carte-cadeau', path: '/santa/art/carte-cadeau.webp', ratio: '16:10', prompt: 'Premium red velvet gift envelope with gold ribbon and snowflakes, no text.', kind: 'image', available: false },
  { id: 'calendrier-avent', path: '/santa/art/calendrier-avent.webp', ratio: '1:1', prompt: 'North Pole house facade with 24 varied little doors and warm windows, no numbers, no text.', kind: 'image', available: false },
  { id: 'og-image', path: '/santa/art/og-image.webp', ratio: '1200:630', prompt: 'Santa video-calling an anonymous child seen from behind in a festive living room, no text.', kind: 'image', available: false },
  { id: 'offres-3-cadeaux', path: '/santa/art/offres-3-cadeaux.webp', ratio: '16:9', prompt: 'Three gift boxes of increasing size under a Christmas tree, warm magical light, no text.', kind: 'image', available: false },
  { id: 'hero-loop', path: '/santa/art/hero-loop.mp4', ratio: '16:9', prompt: 'Santa smiles, laughs, winks and waves in his North Pole office, gentle seamless loop, no text.', kind: 'video', poster: '/santa/art/hero-landing.webp', available: false },
  { id: 'appel-entrant-video', path: '/santa/art/appel-entrant.mp4', ratio: '9:16', prompt: 'A phone glows on a bed as golden sparks and snowflakes fill the room, no child, no text.', kind: 'video', available: false },
  { id: 'traineau-decollage', path: '/santa/art/traineau-decollage.mp4', ratio: '21:9', prompt: 'Santa sleigh launches into aurora sky with a trail of stars, no text.', kind: 'video', available: false },
  { id: 'lettre-envoyee', path: '/santa/art/lettre-envoyee.mp4', ratio: '1:1', prompt: 'A sealed red envelope flies from a snowy mailbox to Santa office, no text.', kind: 'video', available: false },
  { id: 'atelier-video', path: '/santa/art/atelier.mp4', ratio: '16:9', prompt: 'Gentle camera move through an elf workshop, toys and gift wrapping, no text.', kind: 'video', available: false },
  { id: 'grand-livre-video', path: '/santa/art/grand-livre.mp4', ratio: '3:2', prompt: 'An old storybook opens and golden stardust rises, no text.', kind: 'video', available: false },
  { id: 'tiktok-teaser', path: '/santa/art/tiktok-teaser.mp4', ratio: '9:16', prompt: 'Close view of Santa whispering a secret then laughing warmly, no text.', kind: 'video', available: false },
] satisfies readonly SantaArtSlot[];

export function santaArt(id: string) { return SANTA_ART.find((asset) => asset.id === id); }
