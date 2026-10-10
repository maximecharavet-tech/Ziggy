/**
 * The avatar prompt is built ONLY from validated enum values — no free text,
 * no photo, nothing the child typed. It always asks for a young child,
 * fully and appropriately dressed, in a friendly cartoon style.
 */
import type { AvatarRequest } from '@/lib/hyper-engine/schemas';
import { WORLDS } from '@/data/worlds';

const STYLE: Record<AvatarRequest['style'], string> = {
  plush: 'soft plush toy style, felt texture, like a cuddly stuffed doll',
  cartoon: 'bright modern 3D cartoon style, rounded shapes, big friendly eyes',
  watercolor: "gentle watercolour children's book illustration",
  clay: 'claymation style, soft modelling clay, rounded and cute',
  pixel: 'cute pixel-art game character, clean outlines',
};

const OUTFIT: Record<AvatarRequest['outfit'], string> = {
  explorer: 'explorer outfit with a little backpack and shorts or trousers',
  astronaut: 'white and orange kids astronaut suit',
  wizard: 'long colourful wizard robe with stars and a pointy hat',
  chef: 'chef jacket and a tall white chef hat',
  artist: 'paint-splattered overalls and a beret',
  pirate: 'friendly pirate costume with a striped shirt and bandana (no weapons)',
  princess: 'sparkly long gown and a small tiara',
  hero: 'colourful superhero costume with a cape and mask',
  scientist: 'lab coat over a t-shirt and safety goggles on the forehead',
  sporty: 't-shirt, shorts and sneakers',
};

const HAIR_COLOR: Record<string, string> = {
  black: 'black', dark_brown: 'dark brown', brown: 'brown', auburn: 'auburn', red: 'red', blond: 'blond',
  light_blond: 'light blond', grey: 'silver grey', blue: 'blue', pink: 'pink',
};
const SKIN: Record<string, string> = {
  tone1: 'very light', tone2: 'light', tone3: 'light-medium', tone4: 'medium', tone5: 'medium-deep', tone6: 'deep',
};

export function avatarPrompt(r: AvatarRequest): string {
  const b = r.blueprint;
  const world = WORLDS.find((w) => w.id === r.worldId);
  const hair = b.hairStyle === 'covered' ? 'hair covered by a soft headscarf' : `${b.hairLength.replace('_', ' ')} ${b.hairStyle} ${HAIR_COLOR[b.hairColor]} hair`;
  return [
    `Full-body character portrait of a young child (about 7 years old), ${STYLE[r.style]}.`,
    `${SKIN[b.skinTone]} skin tone, ${hair}, ${b.eyeColor.replace('_', ' ')} eyes${b.glasses ? ', round glasses' : ''}${b.freckles ? ', a few freckles' : ''}.`,
    `Wearing a ${OUTFIT[r.outfit]}, fully and modestly dressed, age-appropriate.`,
    `Happy, curious pose, waving. Background: ${world ? world.name.en : 'a magical land'} with soft pastel colours.`,
    'Wholesome, safe for young children, no text, no logos, no weapons.',
  ].join(' ');
}
