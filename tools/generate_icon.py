import os
from PIL import Image, ImageDraw

OUT_DIR = os.path.join("build")
PNG_PATH = os.path.join(OUT_DIR, "icon.png")
ICO_PATH = os.path.join(OUT_DIR, "icon.ico")

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
    a = img_rgba.getchannel("A")
    bb = a.point(lambda p: 255 if p > threshold else 0).getbbox()
    return bb

def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    TOP = (248, 248, 250)
    BOTTOM = (236, 238, 242)
    PRIMARY = (10, 132, 255, 255)
    SUBTLE = (110, 110, 115, 255)

    size = 1024
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # more padding to avoid "too big" look
    inset = 88
    side = size - inset * 2
    r = int(side * 0.22)

    grad = Image.new("RGB", (side, side), TOP)
    draw_vertical_gradient(grad, TOP, BOTTOM)
    grad_rgba = grad.convert("RGBA")

    mask = rounded_rect_mask(side, side, r)

    # bg = rounded-square only (used for bbox measurement)
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg.paste(grad_rgba, (inset, inset), mask)

    img = Image.alpha_composite(img, bg)
    d = ImageDraw.Draw(img)

    # highlight must stay fully inside the rounded-square area
    highlight = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    hd = ImageDraw.Draw(highlight)
    hd.ellipse([inset + 20, inset - 40, inset + side - 20, inset + int(side * 0.55)],
               fill=(255, 255, 255, 26))
    img = Image.alpha_composite(img, highlight)
    d = ImageDraw.Draw(img)

    # motif (small)
    cx = size // 2
    cy = size // 2 - 78

    circle_r = 145
    d.ellipse([cx - circle_r, cy - circle_r, cx + circle_r, cy + circle_r],
              fill=(255, 255, 255, 180))

    w = 32
    d.line([(cx - 88, cy - 6), (cx - 26, cy + 66)], fill=PRIMARY, width=w, joint="curve")
    d.line([(cx - 26, cy + 66), (cx + 108, cy - 62)], fill=PRIMARY, width=w, joint="curve")

    bar_w = 400
    bar_h = 38
    bx1 = cx - bar_w // 2
    by1 = size - 300
    bx2 = bx1 + bar_w
    by2 = by1 + bar_h

    d.rounded_rectangle([bx1, by1, bx2, by2], radius=19, fill=(255, 255, 255, 190))
    fill_w = int(bar_w * 0.68)
    d.rounded_rectangle([bx1, by1, bx1 + fill_w, by2], radius=19, fill=PRIMARY)

    d.line([(bx1, by2 + 16), (bx2, by2 + 16)], fill=(SUBTLE[0], SUBTLE[1], SUBTLE[2], 60), width=3)

    # SAFETY CHECKS
    corners = [(0,0), (0,size-1), (size-1,0), (size-1,size-1)]
    for x,y in corners:
        if img.getpixel((x,y))[3] != 0:
            raise RuntimeError("Icon corner is not transparent. Must keep corners fully transparent.")

    # measure bbox from bg only (avoid highlight/motif affecting bbox)
    bb = bbox_alpha(bg, threshold=5)
    if not bb:
        raise RuntimeError("Icon background bbox not found.")
    left, top, right, bottom = bb

    min_pad = 70
    if left < min_pad or top < min_pad or (size - right) < min_pad or (size - bottom) < min_pad:
        raise RuntimeError(f"Icon background too large (bbox={bb}). Must have sufficient padding.")

    img.save(PNG_PATH)
    ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    img.save(ICO_PATH, sizes=ico_sizes)

if __name__ == "__main__":
    main()
