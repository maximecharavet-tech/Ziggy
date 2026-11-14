/**
 * Lutin Chaos pure logic: public API for the runtime (three.js scenes) and the
 * React HUD. No three.js, no React, no storage, no network. See README.md.
 */
export * from './types';
export { makeRng, mixSeed, type Rng } from './rand';
export { WORDS, COLORS, SHAPES, BRIGHT, word, wordById, colorById, type Word, type ColorDef } from './vocab';
export { UI, PRAISE, HINT, ELF_BLAME, GAME_TITLE, elfName, fill } from './texts';
export { LINES, MOMENTS, linesFor, pickLine, validateLines, type Line, type Moment, type Speaker } from './lines';
export { applyChanges, revertChanges, diffRoom, sameRoom } from './room-state';
export { PRANK_TYPES, PRANK_TYPE_IDS, applyPrank, undoPrank, undoStep, type PrankDef, type PrankRecord } from './pranks';
export { CLUES, CLUE_COUNT, makeClues, cluesValid, suspects, eliminationGrid, clueById, type Clue, type ClueKind } from './clues';
export { tickle, tapSpot, PEEK_AFTER, type CatchResult, type SpotTap, type HidingSpot } from './catch';
export { FIXES, FIX_IDS, makePuzzle, checkAnswer, validateFixParams, isFixId, type FixId, type Puzzle, type FixCheck, type FixCtx } from './fixes';
export { FINALE_STEPS, startFinale, tapFinale, predictFinale, expectedStep, type FinaleRun, type FinaleTap } from './finale';
export { GOAL_SKILL, A9_MAIN, GOAL_BY_BAND, INHERENT_GOALS } from './goals';
export { referenceState, type RoomDef, type RoomPrank, type RoomBand, type RoomSlot, type RoomProp, type RoomHidingSpot, type RoomFinaleStep } from './room-def';
export { ROOMS, ROOM_IDS, RAW_ROOMS, roomById, roomByNumber, roomsForNightPrank, validateRoom, validateRooms, FORBIDDEN_KEYS, BAND_CAPS, type RoomIssue } from './rooms';
export {
  startRoom,
  reduce,
  resumeRoom,
  snapshot,
  roomResult,
  nextFinaleStep,
  type RoomSession,
  type PrankRun,
  type PrankPhase,
  type ChaosAction,
  type ChaosEvent,
  type RoomResult,
  type RoomSnapshot,
  type StartOptions,
} from './session';
export { playSeed, replay, perfectRun, sessionHash } from './replay';
export { startSandbox, reduceSandbox, sandboxLayout, loadLayout, nextLook, type SandboxState, type SandboxAction, type SandboxEvent, type SandboxLayout } from './sandbox';
export {
  SAVE_KEY,
  SAVE_VERSION,
  freshSave,
  parseSave,
  serializeSave,
  saveProgress,
  recordRoomDone,
  saveLayout,
  openRooms,
  costumeFor,
  type ChaosSave,
  type RoomProgress,
  type AlbumPhoto,
} from './save';
