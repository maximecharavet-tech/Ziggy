/**
 * L'appli du Père Noël — shared types (see docs/PERE_NOEL.md).
 *
 * Everything about the child stays on the device (localStorage): first name,
 * age, wish list, chosen "proud moment". Nothing here is sent to a server,
 * except the first name, spoken by Santa's voice (a cached audio clip of the
 * name alone, never linked to anything else).
 */

/** What a family bought. `null` = the free part only. */
export type SantaTier = 'essentiel' | 'magique';

export type SantaChild = {
  id: string;
  /** First name only (validated: letters, spaces, hyphens, apostrophes; ≤ 24 characters). */
  name: string;
  age: number;
  /** Gift ids from SANTA_GIFTS, in the order the child picked them. */
  wishes: string[];
  /** A proud-moment id from SANTA_PROUD, chosen by the parent (never free text). */
  proud: string | null;
  /** Drawing / signature on the letter, as a small data URL (stays on the device). */
  signature?: string | null;
  /** When the letter was sent to the North Pole (ISO date). */
  letterSentAt?: string | null;
};

export type SantaFamily = {
  children: SantaChild[];
  activeChildId: string | null;
  /**
   * The parent switched on the live AI call (Pack magique only) after reading
   * what it does. Kept on the device; the server also checks the pass.
   */
  aiConsentAt: string | null;
};

/** Booth scenes rendered by the 3D module (src/games3d/santa). */
export type BoothSceneId = 'cheminee' | 'traineau' | 'rennes' | 'atelier';

/** Modes of the 3D Santa scene. */
export type SantaSceneMode = 'village' | 'call' | 'booth';

/** Rectangle where the child's cut-out goes in a booth scene, in canvas pixels. */
export type BoothSlot = { x: number; y: number; w: number; h: number };

/**
 * The 3D scene handle returned by `mountSantaScene` (src/games3d/santa/index.ts).
 * - `setTalk(level)`: 0–1 mouth opening, driven by the voice's loudness (call mode).
 * - `setExpression(e)`: Santa's face/gesture of the moment (always happy: never sad).
 * - `setScene(id)`: switch booth backdrop.
 * - `getSlot()`: where to draw the child in the current booth scene.
 * - `canvas`: the WebGL canvas (preserveDrawingBuffer on in booth mode, so it can be composited).
 */
export type SantaSceneHandle = {
  canvas: HTMLCanvasElement;
  setTalk(level: number): void;
  setExpression(e: 'idle' | 'laugh' | 'wave' | 'listen' | 'write' | 'wink'): void;
  setScene(id: BoothSceneId): void;
  getSlot(): BoothSlot;
  resize(): void;
  dispose(): void;
};
