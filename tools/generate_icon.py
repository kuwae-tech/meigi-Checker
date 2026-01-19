import os
from PIL import Image, ImageDraw

OUT_DIR = os.path.join("build")
PNG_PATH = os.path.join(OUT_DIR, "icon.png")
ICO_PATH = os.path.join(OUT_DIR, "icon.ico")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # 1024x1024 canvas
    size = 1024
    bg = (247, 246, 243, 255)  # warm off-white
    green = (47, 111, 94, 255)  # sage-ish green
    gray = (120, 120, 120, 255)

    img = Image.new("RGBA", (size, size), bg)
    d = ImageDraw.Draw(img)

    # Rounded card
    pad = 96
    r = 140
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=r, fill=(255, 255, 255, 255))

    # Spot (circle) + check
    cx, cy = size // 2, size // 2 - 30
    spot_r = 220
    d.ellipse([cx - spot_r, cy - spot_r, cx + spot_r, cy + spot_r], fill=(231, 242, 238, 255))

    # Check mark (thicker lines)
    # coordinates tuned for 1024
    d.line([(cx - 120, cy + 10), (cx - 20, cy + 120)], fill=green, width=60, joint="curve")
    d.line([(cx - 20, cy + 120), (cx + 160, cy - 80)], fill=green, width=60, joint="curve")

    # Small progress bar
    bar_w = 520
    bar_h = 56
    bx1 = cx - bar_w // 2
    by1 = size - 220
    bx2 = bx1 + bar_w
    by2 = by1 + bar_h
    d.rounded_rectangle([bx1, by1, bx2, by2], radius=28, fill=(235, 235, 235, 255))
    d.rounded_rectangle([bx1, by1, bx1 + int(bar_w * 0.72), by2], radius=28, fill=green)

    # Save PNG (not committed)
    img.save(PNG_PATH)

    # Save ICO with multiple sizes (not committed)
    ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    img.save(ICO_PATH, sizes=ico_sizes)


if __name__ == "__main__":
    main()
