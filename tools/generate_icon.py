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

def make_shadow(mask: Image.Image, blur: int = 26, y_offset: int = 18, opacity: int = 60) -> Image.Image:
    # Create a soft drop shadow behind the rounded square to avoid "transparent corner squares" looking harsh.
    shadow = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    alpha = mask.point(lambda p: int(p * (opacity / 255)))
    shadow.putalpha(alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    # Offset shadow downward slightly
    out = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    out.alpha_composite(shadow, (0, y_offset))
    return out

def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # Apple-ish palette (match app UI)
    BG = (245, 245, 247, 255)         # #F5F5F7
    PRIMARY = (10, 132, 255, 255)     # #0A84FF

    size = 1024
    radius = 220  # rounded square

    # Transparent canvas
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Mask for rounded square
    mask = rounded_rect_mask(size, radius)

    # Soft shadow layer (key: makes corners feel natural on Launchpad)
    shadow = make_shadow(mask, blur=26, y_offset=16, opacity=55)

    # Rounded-square background (NO outline/border)
    bg_layer = Image.new("RGBA", (size, size), BG)
    icon = Image.composite(bg_layer, base, mask)

    # Very subtle highlight (not a frame)
    overlay = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse([-240, -320, size + 240, int(size * 0.52)], fill=(255, 255, 255, 38))
    icon = Image.alpha_composite(icon, overlay)

    # Composite shadow behind icon
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    img.alpha_composite(shadow)
    img.alpha_composite(icon)

    d = ImageDraw.Draw(img)

    # Content: scale down more to reduce "too big" feeling
    cx, cy = size // 2, size // 2 - 52

    # Softer circle backing (smaller)
    circle_r = 185
    d.ellipse([cx - circle_r, cy - circle_r, cx + circle_r, cy + circle_r], fill=(255, 255, 255, 170))

    # Check mark (thinner + slightly smaller)
    d.line([(cx - 110, cy + 4), (cx - 28, cy + 98)], fill=PRIMARY, width=44, joint="curve")
    d.line([(cx - 28, cy + 98), (cx + 150, cy - 82)], fill=PRIMARY, width=44, joint="curve")

    # Progress bar (smaller + better padding)
    bar_w = 480
    bar_h = 46
    bx1 = cx - bar_w // 2
    by1 = size - 248
    bx2 = bx1 + bar_w
    by2 = by1 + bar_h

    d.rounded_rectangle([bx1, by1, bx2, by2], radius=24, fill=(255, 255, 255, 195))
    fill_w = int(bar_w * 0.72)
    d.rounded_rectangle([bx1, by1, bx1 + fill_w, by2], radius=24, fill=PRIMARY)

    # IMPORTANT: No outline/border anywhere.

    # Save PNG/ICO (generated in CI; do not commit)
    img.save(PNG_PATH)
    ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    img.save(ICO_PATH, sizes=ico_sizes)

if __name__ == "__main__":
    main()
