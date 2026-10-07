"""Build the bundled Arknights assets from mashirozx/arknights-ui.

Development only: pip install Pillow, then run with --source pointing to the
upstream checkout at 8fb68d35992467c0cca9de953c5bd6227c316b97.
Game art retains its original rights; see docs/arknights/README.md.
"""
import argparse
from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    args = parser.parse_args()
    source = args.source / 'img'
    target = Path(__file__).resolve().parents[1] / 'public' / 'assets'
    target.mkdir(parents=True, exist_ok=True)
    character = Image.open(source / 'char_010_chen_2b_merged.png').convert('RGBA')
    character.save(target / 'arknights-chen-v1.png', optimize=True)
    # Expand the upstream .level-logo crop to retain the complete RHODES ISLAND wordmark.
    logo = Image.open(source / 'UI_HOME.png').convert('RGBA').crop((480, 1220, 700, 1416))
    logo.save(target / 'arknights-logo-v1.png', optimize=True)
    scene = ImageOps.fit(Image.open(source / 'UI_HOME_FRONT_BKG.png').convert('RGB'), (1920, 1080))
    scene = ImageEnhance.Color(scene).enhance(.32).convert('RGBA')
    # Leave the left data area calm; retain readable ship architecture on the right.
    shade = Image.new('RGBA', scene.size)
    shade.putdata([(12, 17, 22, round(190 - 100 * x / 1919)) for y in range(1080) for x in range(1920)])
    scene = Image.alpha_composite(scene, shade)
    scene.convert('RGB').save(target / 'arknights-background-v1.png', optimize=True)
    cover = scene.copy()
    figure = ImageOps.contain(character, (1120, 1120))
    cover.alpha_composite(figure, (780, 5))
    cover.alpha_composite(ImageOps.contain(logo, (250, 285)), (165, 350))
    cover.resize((960, 540), Image.Resampling.LANCZOS).convert('RGB').save(target / 'arknights-cover-v1.png', optimize=True)


if __name__ == '__main__':
    main()
