import bible from '@/data/lutins/bible.json';

/**
 * The elves' canonical pictures, made once with Agnes by the owner (panel at
 * /lutins/portraits) and stored in the public `ziggy-dodo` bucket:
 *   lutins/sheet.png        — the three elves side by side, front view, white background:
 *                             the reference sent with every parent's photo;
 *   lutins/<id>.png         — one cheerful portrait per elf (the app's avatars).
 * Candidates go to lutins/candidates/ until the owner approves one.
 * The sheet is made first; each portrait then uses it as its reference, so the
 * three portraits and every prank picture share one design.
 */

export const PORTRAIT_TARGETS = ['sheet', 'pepin', 'grelotte', 'noisette'] as const;
export type PortraitTarget = (typeof PORTRAIT_TARGETS)[number];
export const LUTINS_BUCKET = 'ziggy-dodo';
export const canonicalPath = (t: PortraitTarget) => `lutins/${t}.png`;

const elf = (id: string) => bible.elves.find((e) => e.id === id)!;

const PHOTO =
  'Professional studio product photograph of handmade wool-felt plush dolls: soft visible felt fibres and fuzz, tiny hand stitches and seams, glossy black bead eyes with a white highlight, rosy felt cheeks, natural colours, soft diffused key light and fill, shallow depth of field, crisp focus on the dolls. Original handmade designs.';
const NO = 'No text, no letters, no logo, no watermark, no people, no hands, no background objects.';

export function portraitPrompt(target: PortraitTarget, withSheet: boolean): { prompt: string; size: string } {
  if (target === 'sheet') {
    const [p, g, n] = ['pepin', 'grelotte', 'noisette'].map(elf);
    return {
      size: '1536x1024',
      prompt: [
        PHOTO,
        'Three felt elf dolls standing side by side in one row, full body, front view, facing the camera, evenly spaced and centred, all fully visible with space around them, on a pure white seamless background, no floor line, no cast shadow.',
        `From left to right: ${p.look} ${g.look} ${n.look}`,
        'Pépin and Grelotte are the same height (about 25 cm); Noisette is half their height. Friendly happy expressions.',
        NO,
      ].join(' '),
    };
  }
  const e = elf(target);
  const position = { pepin: 'left', grelotte: 'middle', noisette: 'right (the smallest)' }[target];
  return {
    size: '1024x1024',
    prompt: [
      withSheet ? `Use the ${position} felt elf doll of the reference image and keep its design exactly (same colours, hat, clothes, face, materials).` : '',
      PHOTO,
      `A cheerful bust portrait of one felt elf doll, three-quarter view, centred, head and shoulders filling most of the square, big happy smile, a little mischievous: ${e.look}`,
      `Plain soft pastel background, gently tinted ${e.color}, with a faint glow behind the doll.`,
      NO,
    ]
      .filter(Boolean)
      .join(' '),
  };
}

/** Public address of a stored picture (the bucket is public). `v` busts caches after a new approval. */
export function lutinsPublicUrl(path: string, v?: string | number): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}/storage/v1/object/public/${LUTINS_BUCKET}/${path}${v ? `?v=${v}` : ''}`;
}
