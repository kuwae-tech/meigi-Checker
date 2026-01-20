import os
from PIL import Image, ImageDraw

OUT_DIR = os.path.join("build")
PNG_PATH = os.path.join(OUT_DIR, "icon.png")
ICO_PATH = os.path.join(OUT_DIR, "icon.ico")

def rounded_rect_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size, size], radius=radius, fill=255)
    return m

def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # Apple-ish palette (match app UI)
    BG = (245, 245, 247, 255)         # #F5F5F7
    PRIMARY = (10, 132, 255, 255)     # #0A84FF
    SUBTLE = (110, 110, 115, 255)     # #6E6E73
    WHITE = (255, 255, 255, 255)

    size = 1024
    radius = 220  # macOS-ish rounded square

    # Transparent canvas (important: no "mystery white background")
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Full-bleed rounded square background (no inner white card)
    bg_layer = Image.new("RGBA", (size, size), BG)
    mask = rounded_rect_mask(size, radius)
    img = Image.composite(bg_layer, img, mask)

    d = ImageDraw.Draw(img)

    # Subtle top highlight (very light, Apple-like)
    # (simple gradient-like overlay)
    overlay = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse([-200, -260, size + 200, size * 0.55], fill=(255, 255, 255, 60))
    img = Image.alpha_composite(img, overlay)
    d = ImageDraw.Draw(img)

    # Icon content geometry
    cx, cy = size // 2, size // 2 - 40

    # Soft circle backdrop behind check
    circle_r = 230
    d.ellipse([cx - circle_r, cy - circle_r, cx + circle_r, cy + circle_r], fill=(255, 255, 255, 180))

    # Check mark (clean, not too thick)
    # Tuned for 1024
    d.line([(cx - 130, cy + 10), (cx - 30, cy + 120)], fill=PRIMARY, width=56, joint="curve")
    d.line([(cx - 30, cy + 120), (cx + 175, cy - 95)], fill=PRIMARY, width=56, joint="curve")

    # Progress bar (subtle)
    bar_w = 560
    bar_h = 54
    bx1 = cx - bar_w // 2
    by1 = size - 220
    bx2 = bx1 + bar_w
    by2 = by1 + bar_h
    # track
    d.rounded_rectangle([bx1, by1, bx2, by2], radius=28, fill=(255, 255, 255, 200))
    # fill
    fill_w = int(bar_w * 0.72)
    d.rounded_rectangle([bx1, by1, bx1 + fill_w, by2], radius=28, fill=PRIMARY)

    # Very subtle divider line for crispness (optional)
    d.rounded_rectangle([24, 24, size - 24, size - 24], radius=radius-8, outline=(0, 0, 0, 18), width=2)

    # Save PNG (not committed)
    img.save(PNG_PATH)

    # Save ICO (not committed)
    ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    img.save(ICO_PATH, sizes=ico_sizes)

if __name__ == "__main__":
    main()
