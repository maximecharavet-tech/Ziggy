import * as THREE from 'three';

/**
 * The machines' little signs (dial at a glance): one canvas atlas of
 * 8 × 8 cells, each a felt badge with an icon string (🍓, 🪵×3, 🔁×5, A…).
 * Cells are allocated on demand and reused; every sign of the workshop is a
 * quad of one merged mesh that samples this atlas (one draw call).
 */
const N = 8;
const CELL = 128;

export class IconAtlas {
  readonly texture: THREE.CanvasTexture;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private cells = new Map<string, number>();
  private used = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = N * CELL;
    this.g = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 2;
  }

  /** UV rect [u0, v0, u1, v1] of a sign with this text (drawn on first use). */
  uv(text: string): [number, number, number, number] {
    let i = this.cells.get(text);
    if (i === undefined) {
      if (this.used >= N * N) {
        // Full (sandbox with many different dials): start over, the board redraws every sign anyway.
        this.cells.clear();
        this.used = 0;
        this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
      i = this.used++;
      this.cells.set(text, i);
      this.draw(i, text);
      this.texture.needsUpdate = true;
    }
    const cx = i % N;
    const cy = Math.floor(i / N);
    const pad = 1 / (N * CELL);
    return [cx / N + pad, 1 - (cy + 1) / N + pad, (cx + 1) / N - pad, 1 - cy / N - pad];
  }

  /** Forget every cell (a new level). */
  reset(): void {
    this.cells.clear();
    this.used = 0;
    this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.texture.needsUpdate = true;
  }

  private draw(i: number, text: string) {
    const g = this.g;
    const x = (i % N) * CELL;
    const y = Math.floor(i / N) * CELL;
    g.clearRect(x, y, CELL, CELL);
    const r = 26;
    const m = 6;
    g.save();
    g.beginPath();
    g.roundRect(x + m, y + m, CELL - 2 * m, CELL - 2 * m, r);
    g.fillStyle = '#fff6e6';
    g.fill();
    g.lineWidth = 7;
    g.strokeStyle = '#8a5530';
    g.stroke();
    // Stitched felt edge.
    g.setLineDash([7, 6]);
    g.lineWidth = 2.5;
    g.strokeStyle = '#d9a066';
    g.beginPath();
    g.roundRect(x + m + 9, y + m + 9, CELL - 2 * m - 18, CELL - 2 * m - 18, r - 9);
    g.stroke();
    g.setLineDash([]);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#4a2a12';
    const chars = [...text].length;
    let size = chars <= 1 ? 74 : chars === 2 ? 60 : chars <= 4 ? 44 : 32;
    g.font = `bold ${size}px Fredoka, "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", system-ui, sans-serif`;
    while (g.measureText(text).width > CELL - 26 && size > 16) {
      size -= 4;
      g.font = `bold ${size}px Fredoka, "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", system-ui, sans-serif`;
    }
    g.fillText(text, x + CELL / 2, y + CELL / 2 + size * 0.06);
    g.restore();
  }

  dispose(): void {
    this.texture.dispose();
  }
}
