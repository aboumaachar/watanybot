from pathlib import Path
from PIL import Image
import hashlib
import numpy as np

source = Path("apps/web-user/public/watany-v4/icons/contact-sheet.png")
candidate = Path("pma/theme/schools-hat-candidate.png")

image = Image.open(source).convert("RGBA")
tile_width = image.width // 7
tile_height = image.height // 5

# Item 23 is the second tile in the fourth row of the approved 35-icon sheet.
tile = image.crop((tile_width, tile_height * 3, tile_width * 2, tile_height * 4))
tile = tile.crop((10, 35, tile.width - 10, 185))
array = np.array(tile).astype(np.int16)
rgb = array[..., :3]
maximum = rgb.max(axis=2)
minimum = rgb.min(axis=2)
background = (maximum - minimum <= 18) & (minimum >= 220)
alpha = array[..., 3]
alpha[background] = 0
array[..., 3] = alpha

transparent = Image.fromarray(np.clip(array, 0, 255).astype(np.uint8), "RGBA")
box = transparent.getchannel("A").getbbox()
if box is None:
    raise RuntimeError("SCHOOLS_HAT_CANDIDATE_EMPTY")

trimmed = transparent.crop(box)
scale = min(220 / trimmed.width, 220 / trimmed.height)
resized = trimmed.resize(
    (max(1, round(trimmed.width * scale)), max(1, round(trimmed.height * scale))),
    Image.Resampling.LANCZOS,
)
canvas = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
canvas.alpha_composite(resized, ((256 - resized.width) // 2, (256 - resized.height) // 2))
canvas.save(candidate, "PNG", optimize=True)

print(f"CANDIDATE={candidate}")
print(f"SHA256={hashlib.sha256(candidate.read_bytes()).hexdigest().upper()}")
print(f"SIZE={canvas.size}")
print(f"ALPHA_EXTREMA={canvas.getchannel('A').getextrema()}")