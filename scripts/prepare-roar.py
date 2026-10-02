"""Prepara a voz do Eric a partir de WAV PCM de 16 bits (NumPy e SciPy).

Uso: python scripts/prepare-roar.py caminho/gravacao.wav
O original fica intacto; o resultado vai para output/audio/eric-roar.wav.
"""
import argparse
import json
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, resample_poly, sosfiltfilt

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('recording', type=Path)
args = parser.parse_args()
with wave.open(str(args.recording), 'rb') as recording:
    if recording.getsampwidth() != 2:
        raise ValueError('Use uma gravação WAV PCM de 16 bits.')
    rate = recording.getframerate()
    channels = recording.getnchannels()
    voice = np.frombuffer(recording.readframes(recording.getnframes()), dtype='<i2')
    voice = voice.reshape(-1, channels).mean(axis=1) / 32768

# Corte apenas as bordas da gravação enviada, mantendo a entrada e a cauda da voz.
voice = voice[round(.09 * rate):round(2.67 * rate)]
# Limpeza discreta: elimina rumble e chiado alto, sem mudar a afinação.
voice = sosfiltfilt(butter(2, 70, 'highpass', fs=rate, output='sos'), voice)
voice = sosfiltfilt(butter(2, 9000, 'lowpass', fs=rate, output='sos'), voice)
# Bordas suaves evitam estalos. Não há mudança de velocidade ou efeito de monstro.
fade_in = round(.012 * rate)
fade_out = round(.045 * rate)
voice[:fade_in] *= np.linspace(0, 1, fade_in)
voice[-fade_out:] *= np.linspace(1, 0, fade_out)
# Mono a 24 kHz mantém a voz clara e deixa o áudio embutido pequeno.
from math import gcd
divisor = gcd(rate, 24000)
voice = resample_poly(voice, 24000 // divisor, rate // divisor)
peak = np.max(np.abs(voice))
if peak <= 0:
    raise ValueError('A gravação está silenciosa.')
voice *= .85 / peak
pcm = np.round(voice * 32767).astype('<i2')
output = Path(__file__).resolve().parents[1] / 'output' / 'audio' / 'eric-roar.wav'
output.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(output), 'wb') as recording:
    recording.setnchannels(1)
    recording.setsampwidth(2)
    recording.setframerate(24000)
    recording.writeframes(pcm.tobytes())
print(json.dumps({'file': str(output), 'duration': len(pcm) / 24000,
                  'peak': float(np.max(np.abs(pcm.astype(float))) / 32768),
                  'clipped_samples': int(np.count_nonzero(np.abs(pcm.astype(int)) >= 32767))}))
