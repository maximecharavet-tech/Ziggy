/**
 * Frame delta clock for the games' render loops (THREE.Clock is deprecated since
 * three r183). Same `getDelta()` contract: seconds since the previous call.
 */
export class FrameClock {
  private last = typeof performance !== 'undefined' ? performance.now() : Date.now();
  /** Seconds accumulated by getDelta() calls (like THREE.Clock.elapsedTime). */
  elapsedTime = 0;

  /** Seconds since the previous call (or since creation). */
  getDelta(): number {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const d = (now - this.last) / 1000;
    this.last = now;
    this.elapsedTime += d;
    return d;
  }

  /** Total seconds so far (updates the delta like THREE.Clock.getElapsedTime). */
  getElapsedTime(): number {
    this.getDelta();
    return this.elapsedTime;
  }
}
