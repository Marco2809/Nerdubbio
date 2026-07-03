#!/usr/bin/env python3
"""Rimuove sfondo bianco / checkerboard dalle PNG brand (solo pixel chiari)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"


def is_background(r: int, g: int, b: int, a: int) -> bool:
    if a < 10:
        return True
    # nero puro (export con sfondo nero)
    if r == 0 and g == 0 and b == 0:
        return True
    # bianco puro
    if r > 248 and g > 248 and b > 248:
        return True
    # celle grigie del checkerboard (canali quasi uguali, tono chiaro)
    if abs(r - g) <= 8 and abs(g - b) <= 8 and min(r, g, b) >= 200:
        return True
    return False


def dewhite(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_background(r, g, b, a):
                px[x, y] = (r, g, b, 0)
    return im


def resize_icon(src: Path, size: int, dest: Path) -> None:
    im = Image.open(src).convert("RGBA")
    side = min(im.size)
    x = (im.width - side) // 2
    y = (im.height - side) // 2
    im = im.crop((x, y, x + side, y + side))
    im = im.resize((size, size), Image.Resampling.LANCZOS)
    im.save(dest, "PNG")


def main() -> None:
    for name in ("icon.png", "wordmark.png"):
        path = PUBLIC / name
        if not path.exists():
            continue
        out = dewhite(Image.open(path))
        out.save(path, "PNG")
        px = list(out.getdata())
        opaque = sum(1 for p in px if p[3] > 20)
        print(f"{name}: opaque={opaque}/{len(px)} ({100*opaque/len(px):.1f}%)")

    icon = PUBLIC / "icon.png"
    if icon.exists():
        resize_icon(icon, 32, PUBLIC / "favicon.png")
        resize_icon(icon, 192, PUBLIC / "icon-192.png")
        resize_icon(icon, 512, PUBLIC / "icon-512.png")
        print("regenerated favicons")


if __name__ == "__main__":
    main()
