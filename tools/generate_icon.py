import os
from PIL import Image, ImageDraw

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

    # Apple-like neutral palette (match app UI)
    BG = (245, 245, 247, 255)         # #F5F5F7
    PRIMARY = (10, 132, 255, 255)     # #0A84FF

    size = 1024
    radius = 220  # macOS-like rounded square

    # Transparent canvas
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Full-bleed rounded-square background (NO outline / NO border)
    bg_layer = Image.new("RGBA", (size, size), BG)
    mask = rounded_rect_mask(size, radius)
    img = Image.composite(bg_layer, base, mask)

    # Very subtle highlight (NOT a frame)
    overlay = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse([-220, -300, size + 220, int(size * 0.52)], fill=(255, 255, 255, 40))
    img = Image.alpha_composite(img, overlay)

    d = ImageDraw.Draw(img)

    # Content: scale down to create "normal icon" padding
    cx, cy = size // 2, size // 2 - 44

    # Softer circle backing (smaller)
    circle_r = 200
    d.ellipse([cx - circle_r, cy - circle_r, cx + circle_r, cy + circle_r], fill=(255, 255, 255, 175))

    # Check mark (slightly thinner)
    d.line([(cx - 118, cy + 6), (cx - 26, cy + 110)], fill=PRIMARY, width=48, joint="curve")
    d.line([(cx - 26, cy + 110), (cx + 162, cy - 88)], fill=PRIMARY, width=48, joint="curve")

    # Progress bar (slightly smaller, balanced)
    bar_w = 520
    bar_h = 50
    bx1 = cx - bar_w // 2
    by1 = size - 235
    bx2 = bx1 + bar_w
    by2 = by1 + bar_h

    d.rounded_rectangle([bx1, by1, bx2, by2], radius=26, fill=(255, 255, 255, 200))
    fill_w = int(bar_w * 0.72)
    d.rounded_rectangle([bx1, by1, bx1 + fill_w, by2], radius=26, fill=PRIMARY)

    # IMPORTANT: do NOT draw any outline/border.

    img.save(PNG_PATH)

    ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    img.save(ICO_PATH, sizes=ico_sizes)

if __name__ == "__main__":
    main()
