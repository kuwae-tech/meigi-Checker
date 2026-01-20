import os
from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = os.path.join("build")
PNG_PATH = os.path.join(OUT_DIR, "icon.png")
ICO_PATH = os.path.join(OUT_DIR, "icon.ico")


def rounded_rect_mask(size: int, radius: int) -> Image.Image:
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size, size], radius=radius, fill=255)
    return m


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # Apple-ish palette
    BG = (245, 245, 247, 255)         # #F5F5F7
    PRIMARY = (10, 132, 255, 255)     # #0A84FF

    # --- draw at 4x for super-smooth edges, then downsample ---
    out_size = 1024
    scale = 4
    size = out_size * scale
    radius = 220 * scale

    # transparent canvas
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # mask (rounded square)
    mask = rounded_rect_mask(size, radius)

    # soft shadow behind rounded square (no outline)
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    alpha = mask.point(lambda p: int(p * (55 / 255)))
    shadow.putalpha(alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(26 * scale))
    shadow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_layer.alpha_composite(shadow, (0, 16 * scale))  # slight downward offset

    # rounded-square background (no border)
    bg_layer = Image.new("RGBA", (size, size), BG)
    icon = Image.composite(bg_layer, base, mask)

    # very subtle highlight (NOT a frame)
    overlay = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse([-240 * scale, -320 * scale, size + 240 * scale, int(size * 0.52)],
               fill=(255, 255, 255, 38))
    icon = Image.alpha_composite(icon, overlay)

    # composite
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    img.alpha_composite(shadow_layer)
    img.alpha_composite(icon)

    d = ImageDraw.Draw(img)

    # --- content (scaled down more for "normal" padding) ---
    cx, cy = size // 2, size // 2 - 56 * scale

    circle_r = 170 * scale  # smaller than before
    d.ellipse([cx - circle_r, cy - circle_r, cx + circle_r, cy + circle_r],
              fill=(255, 255, 255, 170))

    # check mark (thinner + smaller)
    w = 40 * scale
    d.line([(cx - 104 * scale, cy + 2 * scale), (cx - 30 * scale, cy + 92 * scale)],
           fill=PRIMARY, width=w, joint="curve")
    d.line([(cx - 30 * scale, cy + 92 * scale), (cx + 138 * scale, cy - 76 * scale)],
           fill=PRIMARY, width=w, joint="curve")

    # progress bar (smaller)
    bar_w = 440 * scale
    bar_h = 42 * scale
    bx1 = cx - bar_w // 2
    by1 = size - 258 * scale
    bx2 = bx1 + bar_w
    by2 = by1 + bar_h

    d.rounded_rectangle([bx1, by1, bx2, by2], radius=22 * scale, fill=(255, 255, 255, 195))
    fill_w = int(bar_w * 0.72)
    d.rounded_rectangle([bx1, by1, bx1 + fill_w, by2], radius=22 * scale, fill=PRIMARY)

    # IMPORTANT: no outline/border anywhere

    # downsample to 1024 with high quality
    img_1024 = img.resize((out_size, out_size), resample=Image.Resampling.LANCZOS)

    # Save PNG/ICO (generated in CI; do not commit)
    img_1024.save(PNG_PATH)
    ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    img_1024.save(ICO_PATH, sizes=ico_sizes)


if __name__ == "__main__":
    main()
