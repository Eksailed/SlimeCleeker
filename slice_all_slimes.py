from PIL import Image, ImageEnhance, ImageOps
import os

def remove_white_bg(img):
    img = img.convert('RGBA')
    # Using modern Pillow getdata / pixel access
    pixels = img.load()
    w, h = img.size
    
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            brightness = (r + g + b) / 3
            diff = max(abs(r - g), abs(r - b), abs(g - b))
            
            # White background threshold
            if brightness > 250 and diff < 12:
                pixels[x, y] = (255, 255, 255, 0)
            elif brightness > 230 and diff < 20:
                alpha = int((255 - brightness) / 25 * 255)
                pixels[x, y] = (r, g, b, max(0, min(255, alpha)))
                
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    
    # Fit into square with padding
    max_dim = max(img.width, img.height)
    square = Image.new('RGBA', (max_dim + 16, max_dim + 16), (0, 0, 0, 0))
    offset_x = (square.width - img.width) // 2
    offset_y = (square.height - img.height) // 2
    square.paste(img, (offset_x, offset_y), img)
    return square.resize((160, 160), Image.Resampling.LANCZOS)

def main():
    os.makedirs('sprites', exist_ok=True)
    
    grid1_path = r'C:\Users\schas\.gemini\antigravity\brain\fd0b6807-64cc-44c7-abdf-e3edf9d772e2\slimes_grid_1791015299584.jpg'
    grid2_path = r'C:\Users\schas\.gemini\antigravity\brain\fd0b6807-64cc-44c7-abdf-e3edf9d772e2\slimes_grid_2_1791015319021.jpg'
    
    g1 = Image.open(grid1_path)
    g2 = Image.open(grid2_path)
    
    cw = 1024 // 3
    ch = 1024 // 3
    
    def get_cell(grid, col, row):
        return grid.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
    
    # Map all 20 tiers to high quality sliced and stylized sprites
    tier_map = {
        1: get_cell(g1, 0, 0),   # Green Sprout
        2: get_cell(g2, 1, 0),   # Ice Diamond
        3: get_cell(g1, 1, 0),   # Fire Flame
        4: get_cell(g2, 1, 1),   # Lightning Spark
        5: get_cell(g1, 1, 2),   # Turquoise Explorer
        6: get_cell(g1, 2, 0),   # Blue Wizard
        7: get_cell(g1, 0, 2),   # Purple Witch
        8: get_cell(g1, 1, 1),   # Orange Warrior
        9: get_cell(g1, 2, 2),   # Dark Ninja/Shadow
        10: get_cell(g2, 2, 1),  # Honey Bear
        11: get_cell(g2, 0, 1),  # Rainbow Swirl
        12: get_cell(g2, 2, 0),  # Red Dragon
        13: get_cell(g2, 0, 0),  # Galaxy Saturn
        14: None,                # Cyber Neon (derived below)
        15: get_cell(g1, 2, 1),  # Angel Halo
        16: get_cell(g2, 0, 2),  # Obsidian Demon
        17: None,                # Star Overlord (derived below)
        18: get_cell(g1, 0, 1),  # Golden King Crown
        19: None,                # Chronos Titan (derived below)
        20: get_cell(g2, 2, 2),  # Divine God Corona
    }
    
    # Save standard mapped tiers
    saved_sprites = {}
    for tier, cell_img in tier_map.items():
        if cell_img is not None:
            processed = remove_white_bg(cell_img)
            saved_sprites[tier] = processed
            out_path = f'sprites/slime_{tier}.png'
            processed.save(out_path, 'PNG')
            print(f'Saved {out_path}')
            
    # Derive Tier 14 (Cyber Neon) by color shifting and glowing Tier 5 (Explorer)
    base_14 = saved_sprites[5].copy()
    r, g, b, a = base_14.split()
    # Swap channels for futuristic neon magenta-cyan
    cyber_img = Image.merge('RGBA', (b, r, g, a))
    enh = ImageEnhance.Color(cyber_img).enhance(1.6)
    enh.save('sprites/slime_14.png', 'PNG')
    print('Saved sprites/slime_14.png')

    # Derive Tier 17 (Star Overlord) by glowing Tier 13 (Galaxy)
    base_17 = saved_sprites[13].copy()
    r, g, b, a = base_17.split()
    star_img = Image.merge('RGBA', (r, b, g, a))
    enh = ImageEnhance.Color(star_img).enhance(1.8)
    enh = ImageEnhance.Brightness(enh).enhance(1.15)
    enh.save('sprites/slime_17.png', 'PNG')
    print('Saved sprites/slime_17.png')

    # Derive Tier 19 (Chronos Golden Titan) by gold-shifting Tier 18 (King)
    base_19 = saved_sprites[18].copy()
    r, g, b, a = base_19.split()
    titan_img = Image.merge('RGBA', (r, r, b, a))
    enh = ImageEnhance.Color(titan_img).enhance(1.4)
    enh = ImageEnhance.Brightness(enh).enhance(1.2)
    enh.save('sprites/slime_19.png', 'PNG')
    print('Saved sprites/slime_19.png')
    
    print('[SUCCESS] All 20 tiers generated in sprites/!')

if __name__ == '__main__':
    main()
