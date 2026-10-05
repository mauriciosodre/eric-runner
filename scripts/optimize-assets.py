"""Cria as cópias WebP de jogo sem recriar a arte nem substituir os PNGs.

Requer apenas Pillow no desenvolvimento: python scripts/optimize-assets.py
As poses frontais usam compressão sem perdas, mantendo todos os pixels do rosto.
As folhas mantêm dimensões/recortes e usam qualidade 95, com alfa sem perdas.
As miniaturas de 128x192 evitam baixar poses grandes só para mostrar cartões.
O navegador não precisa de Python, Pillow ou deste script para jogar.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FILES = (
    'eric', 'eric-actions', 'eric-run', 'eric-roar', 'eric-roar-actions',
    'daniel', 'daniel-actions', 'daniel-run', 'daniel-special',
    'samuel', 'samuel-actions', 'samuel-run', 'samuel-special',
)
STANDING = {'eric', 'daniel', 'samuel'}


def encode(image, target, lossless=False):
    image.save(target, format='WEBP', lossless=lossless, quality=100 if lossless else 95,
               method=6 if lossless else 4, exact=True)
    decoded = Image.open(target).convert('RGBA')
    assert decoded.size == image.size, f'Dimensões alteradas: {target.name}'
    assert decoded.getchannel('A').tobytes() == image.getchannel('A').tobytes(), f'Alfa alterado: {target.name}'
    if lossless:
        assert decoded.tobytes() == image.tobytes(), f'Pixels alterados: {target.name}'


def main():
    original_bytes = optimized_bytes = 0
    for name in FILES:
        original, target = ROOT / (name + '.png'), ROOT / (name + '.webp')
        image = Image.open(original).convert('RGBA')
        encode(image, target, lossless=name in STANDING)
        original_bytes += original.stat().st_size
        optimized_bytes += target.stat().st_size
        print(f'{original.name}: {original.stat().st_size:,} -> {target.stat().st_size:,} bytes')
        if name in STANDING:
            thumbnail = image.resize((128, 192), Image.Resampling.LANCZOS)
            encode(thumbnail, ROOT / (name + '-thumb.webp'))
    print(f'Folhas e poses: {original_bytes:,} -> {optimized_bytes:,} bytes')


if __name__ == '__main__':
    main()
