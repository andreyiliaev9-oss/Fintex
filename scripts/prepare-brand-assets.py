"""Crop the user-supplied logo, preserving its artwork/colours (requires Pillow).
Run manually: python -m pip install Pillow && python scripts/prepare-brand-assets.py
The production app loads only these local prepared assets; no image service is used.
"""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1]
source = Image.open(root / 'assets/brand/fintex-logo-source.jpg').convert('RGB')
# Original: 2048 square, gold mark at x682..1364 / y565..1482.
# Keep a balanced green margin; do not stretch, redraw or recolour the mark.
logo = source.crop((464, 464, 1584, 1584))
logo.resize((512, 512), Image.Resampling.LANCZOS).save(root / 'assets/brand/fintex-logo.webp', quality=94, method=6)
for size, name in [(32, 'fintex-icon-32.png'), (180, 'fintex-touch-icon.png')]:
    logo.resize((size, size), Image.Resampling.LANCZOS).save(root / 'assets/brand' / name, optimize=True)
