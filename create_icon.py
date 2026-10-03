import math
from PIL import Image, ImageDraw

def create_game_icon():
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Background Rounded Rect with gradient
    bg_color_top = (27, 40, 69)
    bg_color_bot = (51, 92, 103)
    
    # Draw radial/linear gradient background
    for y in range(size):
        interp = y / size
        r = int(bg_color_top[0] * (1 - interp) + bg_color_bot[0] * interp)
        g = int(bg_color_top[1] * (1 - interp) + bg_color_bot[1] * interp)
        b = int(bg_color_top[2] * (1 - interp) + bg_color_bot[2] * interp)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Mask rounded corners (radius 90)
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, size, size], radius=110, fill=255)
    img.putalpha(mask)

    draw = ImageDraw.Draw(img)

    # Golden border
    draw.rounded_rectangle([4, 4, size-4, size-4], radius=110, outline=(255, 215, 0, 200), width=8)

    # Shadow under slime
    cx, cy = size // 2, int(size * 0.62)
    draw.ellipse([cx - 150, cy + 80, cx + 150, cy + 130], fill=(0, 0, 0, 90))

    # Draw Cute Jelly Slime
    # Main Body
    slime_box = [cx - 140, cy - 130, cx + 140, cy + 110]
    draw.chord(slime_box, start=0, end=360, fill=(72, 202, 228))

    # Cute Head tip
    draw.polygon([(cx - 70, cy - 80), (cx + 70, cy - 80), (cx, cy - 170)], fill=(72, 202, 228))

    # Highlight
    draw.ellipse([cx - 90, cy - 90, cx - 40, cy - 60], fill=(255, 255, 255, 180))

    # Golden Crown on top!
    crown_top = cy - 210
    crown_bot = cy - 145
    crown_pts = [
        (cx - 70, crown_bot),
        (cx - 80, crown_top),
        (cx - 35, crown_bot + 25),
        (cx, crown_top - 15),
        (cx + 35, crown_bot + 25),
        (cx + 80, crown_top),
        (cx + 70, crown_bot)
    ]
    draw.polygon(crown_pts, fill=(255, 214, 10), outline=(214, 40, 40), width=4)
    # Crown jewels
    draw.ellipse([cx - 15, crown_bot + 5, cx + 15, crown_bot + 35], fill=(230, 57, 70))

    # Kawaii Eyes
    eye_y = cy - 10
    # Left eye
    draw.ellipse([cx - 70, eye_y - 30, cx - 25, eye_y + 20], fill=(30, 30, 36))
    draw.ellipse([cx - 60, eye_y - 25, cx - 42, eye_y - 7], fill=(255, 255, 255))
    # Right eye
    draw.ellipse([cx + 25, eye_y - 30, cx + 70, eye_y + 20], fill=(30, 30, 36))
    draw.ellipse([cx + 35, eye_y - 25, cx + 53, eye_y - 7], fill=(255, 255, 255))

    # Rosy Cheeks
    draw.ellipse([cx - 110, eye_y + 15, cx - 75, eye_y + 35], fill=(255, 112, 166, 170))
    draw.ellipse([cx + 75, eye_y + 15, cx + 110, eye_y + 35], fill=(255, 112, 166, 170))

    # Happy Smile
    draw.arc([cx - 25, eye_y + 10, cx + 25, eye_y + 45], start=10, end=170, fill=(30, 30, 36), width=6)

    # Golden Coins floating around
    draw.ellipse([cx - 160, cy - 70, cx - 110, cy - 20], fill=(255, 195, 0), outline=(255, 255, 255), width=3)
    draw.ellipse([cx + 110, cy - 70, cx + 160, cy - 20], fill=(255, 195, 0), outline=(255, 255, 255), width=3)

    img.save("icon.png", "PNG")
    print("Icon generated successfully as icon.png")

if __name__ == '__main__':
    create_game_icon()
