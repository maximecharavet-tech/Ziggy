#!/usr/bin/env python3
"""Ziggy-as-an-elf art for the Santa call: cut out the plain background, write
transparent WebPs to public/santa/art/ziggy-lutin/<pose>.webp and the manifest
src/data/santa/ziggy-lutin.ts.

    python scripts/santa-ziggy-lutin.py /workspace/pere-noel/art/ziggy-lutin

Inputs: idle.png, wave.png, laugh.png, talk.png (ChatGPT images made for Ziggy,
plain light background). The background is the region connected to the image
border whose colour is close to the corners' colour; its edge is feathered.
Needs numpy, scipy, Pillow.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

POSES = {"idle": "idle", "wave": "waving", "laugh": "laughing", "talk": "talking"}
WIDTH = 480


def cut(path: Path) -> Image.Image:
    im = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    h, w, _ = im.shape
    corners = np.concatenate([im[:8, :8].reshape(-1, 3), im[:8, -8:].reshape(-1, 3), im[-8:, :8].reshape(-1, 3), im[-8:, -8:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    dist = np.sqrt(((im - bg) ** 2).sum(-1))
    near = dist < 28
    lab, _ = ndimage.label(near)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    back = np.isin(lab, border[border > 0])
    # Soft shadows on the background (a little darker cream) go too.
    back |= ndimage.binary_dilation(back, iterations=2) & (dist < 45)
    # The soft floor shadow under the feet: pale, unsaturated, touching the background.
    mx, mn = im.max(-1), im.min(-1)
    pale = ((mx - mn) / np.maximum(mx, 1) < 0.22) & (mx > 110) & (dist < 140)
    pale[: int(h * 0.9)] = False  # only the floor (the white socks stay)
    lab2, _ = ndimage.label(pale | back)
    edge = np.unique(np.concatenate([lab2[0], lab2[-1], lab2[:, 0], lab2[:, -1]]))
    back |= np.isin(lab2, edge[edge > 0])
    fg = ~back
    fg = ndimage.binary_opening(fg, iterations=1)
    # Fill only small holes (specks); larger enclosed gaps (between the legs) are background.
    holes = ndimage.binary_fill_holes(fg) & ~fg
    hl, hn = ndimage.label(holes)
    if hn:
        hs = ndimage.sum(holes, hl, range(1, hn + 1))
        small = np.isin(hl, 1 + np.nonzero(hs < 0.0005 * fg.size)[0])
        enclosed_bg = holes & ~small & (dist < 45)
        fg = fg | (holes & ~enclosed_bg)
    # Keep the largest piece (the character).
    lab, n = ndimage.label(fg)
    if n > 1:
        sizes = ndimage.sum(fg, lab, range(1, n + 1))
        fg = lab == (1 + int(np.argmax(sizes)))
    alpha = ndimage.gaussian_filter(fg.astype(np.float32), 1.2)
    # Remove the cream fringe: un-mix the background colour from edge pixels.
    a = np.clip(alpha, 1e-3, 1)[..., None]
    rgb = np.where(a < 0.999, (im - bg * (1 - a)) / a, im)
    rgba = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    out = Image.fromarray(rgba, "RGBA")
    box = out.getbbox()
    out = out.crop(box)
    ratio = WIDTH / out.width
    return out.resize((WIDTH, round(out.height * ratio)), Image.LANCZOS)


def main() -> None:
    src = Path(sys.argv[1] if len(sys.argv) > 1 else "/workspace/pere-noel/art/ziggy-lutin")
    dst = Path("public/santa/art/ziggy-lutin")
    dst.mkdir(parents=True, exist_ok=True)
    poses = {}
    for name, pose in POSES.items():
        p = src / f"{name}.png"
        if not p.exists():
            continue
        cut(p).save(dst / f"{pose}.webp", "WEBP", quality=86, method=6)
        poses[pose] = f"/santa/art/ziggy-lutin/{pose}.webp"
        print(pose, (dst / f"{pose}.webp").stat().st_size // 1024, "kB")
    ts = Path("src/data/santa/ziggy-lutin.ts")
    s = ts.read_text(encoding="utf-8")
    start = s.index("export const ZIGGY_LUTIN")
    end = s.index("};", start) + 2
    entries = "".join(f"\n    {k}: '{v}'," for k, v in poses.items())
    block = f"export const ZIGGY_LUTIN: {{ available: boolean; poses: Partial<Record<ZiggyPose, string>> }} = {{\n  available: {'true' if 'idle' in poses else 'false'},\n  poses: {{{entries}\n  }},\n}};"
    ts.write_text(s[:start] + block + s[end:], encoding="utf-8")


if __name__ == "__main__":
    main()
