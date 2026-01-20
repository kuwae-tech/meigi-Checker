import os
from PIL import Image, ImageDraw

OUT_DIR = os.path.join("build")
PNG_PATH = os.path.join(OUT_DIR, "icon.png")
ICO_PATH = os.path.join(OUT_DIR, "icon.ico")

def clamp(x, a, b):
    return a if x < a else b if x > b else x

def rounded_rect_mask(w, h, r):
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, w, h], radius=r, fill=255)
    return m

def draw_vertical_gradient(img, top_rgb, bottom_rgb):
    w, h = img.size
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / (h - 1) if h > 1 else 0
        r = int(top_rgb[0] * (1 - t) + bottom_rgb[0] * t)
        g = int(top_rgb[1] * (1 - t) + bottom_rgb[1] * t)
        b = int(top_rgb[2] * (1 - t) + bottom_rgb[2] * t)
        d.line([(0, y), (w, y)], fill=(r, g, b))

def bbox_alpha(img_rgba, threshold=5):
    # bounding box of alpha>threshold
    a = img_rgba.getchannel("A")
    bb = a.point(lambda p: 255 if p > threshold else 0).getbbox()
    return bb

def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # Apple-ish palette
    TOP = (248, 248, 250)             # very light
    BOTTOM = (236, 238, 242)          # subtle depth
    PRIMARY = (10, 132, 255, 255)     # #0A84FF
    SUBTLE = (110, 110, 115, 255)     # #6E6E73

    size = 1024

    # IMPORTANT: transparent canvas (corners must be transparent)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Create an "inset" rounded-square background to reduce perceived size
    inset = 56  # creates visible padding -> not "too big"
    side = size - inset * 2
    r = int(side * 0.22)  # proportional radius

    # gradient layer (opaque) then mask into rounded rect area
    grad = Image.new("RGB", (side, side), TOP)
    draw_vertical_gradient(grad, TOP, BOTTOM)
    grad_rgba = grad.convert("RGBA")

    mask = rounded_rect_mask(side, side, r)
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg.paste(grad_rgba, (inset, inset), mask)

    img = Image.alpha_composite(img, bg)
    d = ImageDraw.Draw(img)

    # subtle highlight blob (kept inside bg; still no border)
    highlight = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    hd = ImageDraw.Draw(highlight)
    hd.ellipse([inset - 120, inset - 180, inset + side + 120, inset + int(side * 0.55)],
               fill=(255, 255, 255, 28))
    img = Image.alpha_composite(img, highlight)
    d = ImageDraw.Draw(img)

    # motif geometry (smaller / more whitespace)
    cx = size // 2
    cy = size // 2 - 70

    circle_r = 150
    d.ellipse([cx - circle_r, cy - circle_r, cx + circle_r, cy + circle_r],
              fill=(255, 255, 255, 180))

    # check mark (thin, Apple-ish)
    w = 34
    d.line([(cx - 90, cy - 5), (cx - 25, cy + 70)], fill=PRIMARY, width=w, joint="curve")
    d.line([(cx - 25, cy + 70), (cx + 115, cy - 65)], fill=PRIMARY, width=w, joint="curve")

    # progress bar (small, low-contrast track)
    bar_w = 420
    bar_h = 40
    bx1 = cx - bar_w // 2
    by1 = size - 290
    bx2 = bx1 + bar_w
    by2 = by1 + bar_h

    d.rounded_rectangle([bx1, by1, bx2, by2], radius=20, fill=(255, 255, 255, 190))
    fill_w = int(bar_w * 0.68)
    d.rounded_rectangle([bx1, by1, bx1 + fill_w, by2], radius=20, fill=PRIMARY)

    # tiny accent line to reduce "floating" feeling (very subtle)
    d.line([(bx1, by2 + 18), (bx2, by2 + 18)], fill=(SUBTLE[0], SUBTLE[1], SUBTLE[2], 70), width=3)

    # --- SAFETY CHECKS (prevents repeating the same mistake) ---
    # 1) corners must be transparent
    corners = [(0,0), (0,size-1), (size-1,0), (size-1,size-1)]
    for x,y in corners:
        if img.getpixel((x,y))[3] != 0:
            raise RuntimeError("Icon corner is not transparent. Must keep corners fully transparent.")

    # 2) visual bbox must be inset enough (not too big)
    bb = bbox_alpha(img, threshold=5)
    if not bb:
        raise RuntimeError("Icon is fully transparent (unexpected).")
    left, top, right, bottom = bb
    # require at least ~40px padding from edges (prevents oversized look)
    if left < 40 or top < 40 or (size - right) < 40 or (size - bottom) < 40:
        raise RuntimeError(f"Icon content too large (bbox={bb}). Must have sufficient padding.")

    # Save PNG/ICO (generated in CI; do not commit)
    img.save(PNG_PATH)
    ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    img.save(ICO_PATH, sizes=ico_sizes)

if __name__ == "__main__":
    main()
