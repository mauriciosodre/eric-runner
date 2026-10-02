"""Embute os recortes medidos de Daniel e Samuel no HTML (sem fetch externo)."""
from pathlib import Path
import json
import re
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[1]
data = {}
for character in ['daniel', 'samuel']:
    source = root / 'output' / 'imagegen' / f'{character}-frames-v1.json'
    atlases = json.loads(source.read_text(encoding='utf8'))
    for kind, atlas in atlases.items():
        atlas['file'] = f'{character}-{kind}.png'
    # Somente mede o PNG aprovado; não altera a imagem. Esses dados evitam
    # ler pixels do Canvas ao abrir o jogo diretamente com file://.
    image = Image.open(root / f'{character}.png')
    alpha = np.asarray(image)[:, :, 3] > 24
    ys, xs = np.where(alpha)
    x, y = int(xs.min()), int(ys.min())
    right, bottom = int(xs.max()) + 1, int(ys.max()) + 1
    _, head_xs = np.where(alpha[y:y + int((bottom - y) * .16), x:right])
    atlases['standing'] = {
        'file': f'{character}.png', 'x': x, 'y': y,
        'width': right - x, 'height': bottom - y, 'sole': bottom,
        'headX': x + int((head_xs.min() + head_xs.max()) / 2),
        'headWidth': int(head_xs.max() - head_xs.min()) + 1,
        'sourceWidth': image.width, 'sourceHeight': image.height,
    }
    data[character] = atlases
html = root / 'index.html'
text = html.read_text(encoding='utf8')
replacement = 'const EXTRA_CHARACTER_FRAMES = ' + json.dumps(data, separators=(',', ':')) + '; // CHARACTER_FRAMES_EMBED'
text, count = re.subn(r'const EXTRA_CHARACTER_FRAMES\s*=\s*.*?; // CHARACTER_FRAMES_EMBED', lambda _: replacement, text)
assert count == 1, 'Marcador CHARACTER_FRAMES_EMBED não encontrado.'
html.write_text(text, encoding='utf8')
print('Recortes de 40 quadros embutidos no HTML.')
