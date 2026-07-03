#!/usr/bin/env python3
"""Rimuove sfondo bianco/grigio/nero dalle PNG brand (flood-fill + decontaminate)."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ASSETS = ROOT / "assets"


def luminance(r: int, g: int, b: int) -> float:
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0


def saturation(r: int, g: int, b: int) -> float:
    mx, mn = max(r, g, b), min(r, g, b)
    if mx == 0:
        return 0.0
    return (mx - mn) / mx


def is_background(r: int, g: int, b: int, a: int) -> bool:
    if a < 16:
        return True
    if max(r, g, b) <= 14:
        return True
    if min(r, g, b) >= 235:
        return True
    if luminance(r, g, b) >= 0.78 and saturation(r, g, b) <= 0.14:
        return True
    # Frange semi-trasparenti su matte bianco (causa alone bianco in app)
    if a < 240 and min(r, g, b) >= 210 and saturation(r, g, b) <= 0.2:
        return True
    return False


def flood_remove_background(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    seen = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            q.append((x, y))

    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            continue
        seen[y][x] = True
        r, g, b, a = px[x, y]
        if not is_background(r, g, b, a):
            continue
        px[x, y] = (0, 0, 0, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    return im


def clean_transparent_rgb(im: Image.Image) -> Image.Image:
    """Alpha 0 deve avere RGB=0 (evita alone bianco/nero al resize)."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16:
                px[x, y] = (0, 0, 0, 0)
    return im


def decontaminate_white_matte(im: Image.Image, white: int = 255) -> Image.Image:
    """Rimuove il matte bianco dalle semi-trasparenze ai bordi del logo."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                px[x, y] = (0, 0, 0, 0)
                continue
            if a == 255 and min(r, g, b) >= 248:
                px[x, y] = (0, 0, 0, 0)
                continue
            if a < 255:
                alpha = a / 255.0
                if alpha <= 0:
                    px[x, y] = (0, 0, 0, 0)
                    continue
                nr = int((r - white * (1.0 - alpha)) / alpha)
                ng = int((g - white * (1.0 - alpha)) / alpha)
                nb = int((b - white * (1.0 - alpha)) / alpha)
                px[x, y] = (
                    max(0, min(255, nr)),
                    max(0, min(255, ng)),
                    max(0, min(255, nb)),
                    a,
                )
    return im


def trim_transparent(im: Image.Image, pad: int = 2) -> Image.Image:
    im = im.convert("RGBA")
    bbox = im.getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(im.width, x1 + pad)
    y1 = min(im.height, y1 + pad)
    return im.crop((x0, y0, x1, y1))


def resize_icon(src: Path, size: int, dest: Path) -> None:
    im = Image.open(src).convert("RGBA")
    side = min(im.size)
    x = (im.width - side) // 2
    y = (im.height - side) // 2
    im = im.crop((x, y, x + side, y + side))
    im = im.resize((size, size), Image.Resampling.LANCZOS)
    im = decontaminate_white_matte(im)
    im = remove_edge_halo(im)
    clean_transparent_rgb(im)
    im.save(dest, "PNG", optimize=True)


def remove_edge_halo(im: Image.Image) -> Image.Image:
    """Rimuove alone chiaro/bianco/rosa adiacente a pixel trasparenti."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size

    def touches_transparent(x: int, y: int) -> bool:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] < 30:
                return True
        return False

    changed = True
    while changed:
        changed = False
        to_clear: list[tuple[int, int]] = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a < 40 or not touches_transparent(x, y):
                    continue
                lum = luminance(r, g, b)
                sat = saturation(r, g, b)
                spread = max(r, g, b) - min(r, g, b)
                # Frange bianco/rosa su matte (es. icona sfera)
                if lum >= 0.62 and spread <= 55:
                    to_clear.append((x, y))
                elif lum >= 0.72 and sat <= 0.35:
                    to_clear.append((x, y))
                elif min(r, g, b) >= 200 and a < 250:
                    to_clear.append((x, y))
        for x, y in to_clear:
            px[x, y] = (0, 0, 0, 0)
            changed = True
    return im


def process(path: Path) -> None:
    im = Image.open(path).convert("RGBA")
    im = flood_remove_background(im)
    im = decontaminate_white_matte(im)
    im = flood_remove_background(im)
    im = remove_edge_halo(im)
    im = clean_transparent_rgb(im)
    im = trim_transparent(im)
    im.save(path, "PNG", optimize=True)
    px = list(im.getdata())
    opaque = sum(1 for p in px if p[3] > 20)
    white_trans = sum(1 for r, g, b, a in px if a < 20 and min(r, g, b) > 200)
    print(
        f"{path.name}: {im.size[0]}x{im.size[1]} "
        f"opaque={100 * opaque / len(px):.1f}% white_trans={white_trans}"
    )


def restore_from_assets() -> None:
    if not ASSETS.exists():
        return
    patterns = [
        ("*logo*nerdubbio*.png", "wordmark.png"),
        ("*icona*nerdubbio*.png", "icon.png"),
    ]
    for glob_pat, dest_name in patterns:
        matches = sorted(ASSETS.glob(glob_pat))
        if matches:
            src = matches[-1]
            dest = PUBLIC / dest_name
            Image.open(src).convert("RGBA").save(dest, "PNG")
            print(f"restored {dest_name} from {src.name}")


def main() -> None:
    restore_from_assets()
    for name in ("icon.png", "wordmark.png"):
        path = PUBLIC / name
        if path.exists():
            process(path)

    icon = PUBLIC / "icon.png"
    if icon.exists():
        resize_icon(icon, 32, PUBLIC / "favicon.png")
        resize_icon(icon, 192, PUBLIC / "icon-192.png")
        resize_icon(icon, 512, PUBLIC / "icon-512.png")
        print("regenerated favicons")


if __name__ == "__main__":
    main()
