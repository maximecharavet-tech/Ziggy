/**
 * Lutin Factory pure logic: public API (see README.md in this folder).
 * NO three.js, NO DOM, NO React: safe for Node tests and for the runtime.
 */
export * from './types';
export { mixColors, isColor, primariesOf, COLOR_ICON } from './colors';
export {
  DELTA,
  cw,
  ccw,
  opposite,
  relToDir,
  dirToRel,
  step,
  key,
  sameCell,
  inGrid,
  isBlocked,
  cellLabel,
  pieceAt,
  isDialLocked,
  place,
  remove,
  rotate,
  setDir,
  setDial,
  autoBeltDir,
  emptyLayout,
  normalizeLayout,
  type EditResult,
  type EditRefusal,
} from './grid';
export { getMachine, machineIds, isMachineId, registerMachine } from './machines/registry';
export { defineMachine, type MachineDef, type AnyMachine, type MachineCtx, type EnterResult } from './machines/types';
export { flattenProgram, parseCard, type Card, type ProgramEntry } from './machines/arm';
export { TOYS, getToy, isToyId, recipe, identifyToy, type ToyDef } from './toys';
export { FactorySim, simulate, fnv1a, TICK_SECONDS, MAX_TICKS, type Speed, type SimEvent, type SimItem, type TickReport } from './simulator';
export { check, differences, type CheckResult, type CheckOptions, type DiffKey, type Match, type ShelfToy, type OrderProgress } from './check';
export { lookOf, lookOfSpec, phrase, surpriseName, capitalize, type Look } from './names';
export {
  LEVELS,
  getLevel,
  levelBand,
  hallLevels,
  startLayout,
  applyPlacements,
  referenceLayout,
  runAndCheck,
  validateLevel,
  validateLevelSet,
  machinesUsed,
  BAND_CAP,
  type FactoryLevel,
  type BandLevel,
  type Letter,
  type Slot,
  type SlotChoice,
  type Idea,
  type LevelIssue,
} from './levels';
export { suggestNextStep, followHints, applyHint, dialText, type Hint, type HintKind } from './hints';
export { encodeLayout, decodeLayout, SHARE_VERSION, type DecodeResult } from './share';
export { createHistory, push, undo, redo, canUndo, canRedo, type History } from './history';
export { LINES, WRITERS, linesFor, pickLine, getWriter, type Line, type Moment, type Writer } from './lines';
export * as texts from './texts';
