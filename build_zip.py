import os
import zipfile

def create_yandex_archive():
    zip_filename = "game.zip"
    files_to_pack = [
        "index.html",
        "style.css",
        "manifest.json",
        "icon.png",
        "bg.jpg",
        "tile_bg.png",
        "egg.png",
        os.path.join("js", "audio.js"),
        os.path.join("js", "yandex-sdk.js"),
        os.path.join("js", "slimes.js"),
        os.path.join("js", "game.js")
    ]

    # Add all sprites from sprites/
    if os.path.exists("sprites"):
        for sprite_file in os.listdir("sprites"):
            if sprite_file.endswith(".png"):
                files_to_pack.append(os.path.join("sprites", sprite_file))

    with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zipf:
        for file in files_to_pack:
            if os.path.exists(file):
                zipf.write(file, arcname=file)
                print(f"Added to {zip_filename}: {file}")
            else:
                print(f"Warning: {file} not found!")

    print(f"\n[SUCCESS] Archive {zip_filename} ready for Yandex Games!")

if __name__ == '__main__':
    create_yandex_archive()
