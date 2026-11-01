/** Shared vocabulary of the 3D Ziggy (model, stage and React component). */

/** One-shot animations. */
export type ZiggyCue = 'wave' | 'cheer' | 'jump' | 'nod' | 'oops' | 'think' | 'love' | 'giggle';
/** What Ziggy does on his own between cues. */
export type ZiggyIdle = 'calm' | 'wave' | 'dance' | 'sleep';
/** Face: the eyes and mouth. Ziggy is never sad. */
export type ZiggyMood = 'happy' | 'excited' | 'calm' | 'sleepy' | 'curious';
/** Camera framing in the stage. */
export type ZiggyFraming = 'full' | 'bust' | 'face';
/** Little outfits for themed games and pages. */
export type ZiggyAccessory = 'none' | 'santa' | 'scarf' | 'beret' | 'crown' | 'nightcap';
