import type { ZiggyAccessory, ZiggyCue, ZiggyFraming, ZiggyIdle, ZiggyMood } from './types';

export interface StageOptions {
  framing: ZiggyFraming;
  accessory: ZiggyAccessory;
  idle: ZiggyIdle;
  mood: ZiggyMood;
  followPointer: boolean;
  reduceMotion: boolean;
}

/** Placeholder while the real stage is being built: the component keeps the picture. */
export class ZiggyStage {
  constructor(_canvas: HTMLCanvasElement, _opts: StageOptions) {
    throw new Error('3D Ziggy not ready yet');
  }
  setSize(_w: number, _h: number) {}
  start() {}
  stop() {}
  dispose() {}
  setMood(_m: ZiggyMood) {}
  setIdle(_i: ZiggyIdle) {}
  setTalking(_t: boolean) {}
  cue(_c: ZiggyCue) {}
  pointer(_x: number, _y: number) {}
  tap(_x: number, _y: number): boolean {
    return true;
  }
}
