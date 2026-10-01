"""Atualiza somente os áudios CC0 embutidos no HTML, sem alterar o jogo."""
from pathlib import Path
import base64
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'output' / 'audio'
KENNEY = SOURCE / 'kenney' / 'Audio'
files = {
    'roar': SOURCE / 'child-roar-wolfdoctor.wav',
    'kick': KENNEY / 'impactSoft_medium_000.ogg',
    'bump': KENNEY / 'impactSoft_heavy_001.ogg',
    'land': KENNEY / 'footstep_grass_002.ogg',
    'step0': KENNEY / 'footstep_grass_000.ogg',
    'step1': KENNEY / 'footstep_grass_001.ogg',
    'bell': KENNEY / 'impactBell_heavy_000.ogg',
}
data = {key: base64.b64encode(file.read_bytes()).decode('ascii') for key, file in files.items()}
html = ROOT / 'index.html'
text = html.read_text(encoding='utf8')
replacement = 'const AUDIO_DATA = ' + json.dumps(data, separators=(',', ':')) + '; // AUDIO_EMBED_PLACEHOLDER'
text, count = re.subn(r'const AUDIO_DATA = .*?; // AUDIO_EMBED_PLACEHOLDER', lambda _: replacement, text)
assert count == 1, 'Não foi encontrado o ponto de inclusão do áudio.'
html.write_text(text, encoding='utf8')
print(f'{len(data)} gravações embutidas; HTML com {html.stat().st_size:,} bytes.')
