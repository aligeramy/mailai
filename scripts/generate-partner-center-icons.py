#!/usr/bin/env python3
"""Generate Partner Center / unified-manifest package icons (root.icons).

- color: 192x192 full-color PNG (Microsoft Teams store requirement).
- outline: 32x32 PNG, only #FFFFFF or fully transparent (no off-white / low-alpha RGB).
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"
LOGO = ROOT / "public" / "logo.png"


def build_color_192(src: Image.Image) -> Image.Image:
    """192x192 RGBA, scaled from logo, centered on transparent canvas."""
    src_rgba = src.convert("RGBA")
    w, h = src_rgba.size
    side = 192
    scale = min(side / w, side / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    resized = src_rgba.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    x0 = (side - nw) // 2
    y0 = (side - nh) // 2
    out.paste(resized, (x0, y0), resized)
    return out


def build_outline_32(src: Image.Image) -> Image.Image:
    """32x32: only (255,255,255,255) or (0,0,0,0). Drop near-white background."""
    src_rgba = src.convert("RGBA")
    w, h = src_rgba.size
    side = 32
    scale = min(side / w, side / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    small = src_rgba.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    x0 = (side - nw) // 2
    y0 = (side - nh) // 2
    canvas.paste(small, (x0, y0), small)

    pixels = canvas.load()
    assert pixels is not None
    for y in range(side):
        for x in range(side):
            r, g, b, a = pixels[x, y]
            # Treat light pixels as background (logo sits on white / light artboard).
            if a < 200 or (r > 248 and g > 248 and b > 248):
                pixels[x, y] = (0, 0, 0, 0)
            else:
                pixels[x, y] = (255, 255, 255, 255)
    return canvas


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    logo = Image.open(LOGO)
    color_path = ASSETS / "icon-color-192.png"
    outline_path = ASSETS / "icon-outline-32.png"
    build_color_192(logo).save(color_path, format="PNG")
    build_outline_32(logo).save(outline_path, format="PNG")
    print(f"Wrote {color_path.relative_to(ROOT)}")
    print(f"Wrote {outline_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
