/**
 * Server helpers around the Rust engine (./engine.ts) for the Node API routes.
 *
 * The route must ship the WebAssembly file (Vercel output tracing), in
 * next.config.ts:
 *   outputFileTracingIncludes: { '/api/lutins/**': ['./src/lib/lutins/wasm/lutins_core_full_bg.wasm'] }
 */
import 'server-only';
import { loadEngine } from './engine';
import type { ElfId, IdeaCheck, PromptOut, Rect, SceneAnalysis, Verification } from './types';

export type ServerPromptInput = {
  locale: string;
  elves: string[];
  /** From the server's catalogue by id (never the client's action text). `title` gives a nicer caption. */
  prank: { id: string; action: string; title?: { fr?: string; en?: string } } | null;
  /** Already cleaned and ChildShield-checked. */
  parentText?: string | null;
  /** The client's scene analysis, untrusted: the engine validates and clamps it. */
  scene?: unknown;
  strict?: boolean;
  attempt?: number;
  /** Reasons of the failed verification, for the retry prompt. */
  failed?: string[];
};

/** Prompt, negative prompt, seed and the child's caption. Throws on invalid elves. */
export async function serverBuildPrompt(input: ServerPromptInput): Promise<PromptOut> {
  const engine = await loadEngine();
  return engine.buildPrompt({
    locale: input.locale,
    elves: input.elves as ElfId[],
    prank: input.prank,
    parent_text: input.parentText ?? '',
    scene: input.scene && typeof input.scene === 'object' ? (input.scene as never) : null,
    strict: input.strict === true,
    attempt: input.attempt,
    failed: input.failed,
  });
}

/** Verifies an encoded generated picture (PNG / JPEG / WebP) against the encoded photo. */
export async function serverVerify(generated: Uint8Array, photo: Uint8Array, elves: string[], mask?: Rect[]): Promise<Verification> {
  const engine = await loadEngine();
  return engine.verifyEncoded(generated, photo, { elves: elves as ElfId[], mask });
}

/** The parent's own idea, cleaned and checked by the engine (gentle-words gate; ChildShield still runs after). */
export async function serverCheckIdea(text: string): Promise<IdeaCheck> {
  const engine = await loadEngine();
  return engine.checkIdea(text);
}

/** Scene analysis of an encoded photo (when the client did not send one). */
export async function serverAnalyze(photo: Uint8Array): Promise<SceneAnalysis> {
  const engine = await loadEngine();
  return engine.analyzeScene(engine.decodeImage(photo));
}
