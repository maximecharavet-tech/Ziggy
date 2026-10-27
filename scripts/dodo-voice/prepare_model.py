#!/usr/bin/env python3
"""
Fetch Kokoro-82M (Apache-2.0) from npm and make it ready for ziggy_voice.py.

Everything comes from registry.npmjs.org (Hugging Face is not needed):
  - kokoro-js@1.2.1             → voices/*.bin (style vectors, float32 [510, 1, 256])
  - kokoro-fp32{a,b,c}-shards   → the fp32 ONNX graph of onnx-community/Kokoro-82M-v1.0-ONNX,
                                  in 19 parts (kokoro-fp32.part0.bin … part18.bin), joined in order

The joined graph is checked (size + sha256), then a copy exposes the phoneme
durations the model already predicts (`/encoder/Gather_output_0`, frames of
600 samples) as an extra output named `duration`. No weight is changed: it only
lets the generator read when each phoneme — so each word — is spoken.

  python prepare_model.py [--cache DIR]
"""
from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import subprocess
import tarfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE = Path(os.environ.get('DODO_VOICE_CACHE', HERE / '.cache'))

PACKAGES = ['kokoro-js@1.2.1', 'kokoro-fp32a-shards@1.0.0', 'kokoro-fp32b-shards@1.0.0', 'kokoro-fp32c-shards@1.0.0']
PARTS = 19
MODEL_SIZE = 325_532_232
MODEL_SHA256 = '8fbea51ea711f2af382e88c833d9e288c6dc82ce5e98421ea61c058ce21a34cb'
DURATION_TENSOR = '/encoder/Gather_output_0'


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', type=Path, default=CACHE)
    args = ap.parse_args()
    cache: Path = args.cache
    npm_dir = cache / 'npm'
    npm_dir.mkdir(parents=True, exist_ok=True)

    pkgs = {}
    for spec in PACKAGES:
        name = spec.split('@')[0]
        dest = npm_dir / name
        if not dest.exists():
            out = subprocess.run(['npm', 'pack', spec, '--silent'], cwd=npm_dir, check=True, capture_output=True, text=True)
            tgz = npm_dir / out.stdout.strip().splitlines()[-1]
            dest.mkdir()
            with tarfile.open(tgz) as t:
                t.extractall(dest, filter='data')
            tgz.unlink()
        pkgs[name] = dest / 'package'

    voices = cache / 'voices'
    if not voices.exists():
        shutil.copytree(pkgs['kokoro-js'] / 'voices', voices)

    model = cache / 'kokoro-fp32.onnx'
    if not model.exists() or model.stat().st_size != MODEL_SIZE:
        with open(model, 'wb') as out:
            for i in range(PARTS):
                part = next(p / f'kokoro-fp32.part{i}.bin' for n, p in pkgs.items()
                            if n.startswith('kokoro-fp32') and (p / f'kokoro-fp32.part{i}.bin').exists())
                with open(part, 'rb') as f:
                    shutil.copyfileobj(f, out)
    digest = sha256(model)
    if model.stat().st_size != MODEL_SIZE or digest != MODEL_SHA256:
        raise SystemExit(f'unexpected model: {model.stat().st_size} bytes, sha256 {digest}')
    print('model ok', digest)

    dur_model = cache / 'kokoro-fp32-dur.onnx'
    if not dur_model.exists():
        import onnx
        from onnx import TensorProto, helper

        m = onnx.load(str(model))
        if not any(DURATION_TENSOR in n.output for n in m.graph.node):
            raise SystemExit(f'{DURATION_TENSOR} not found in the graph')
        m.graph.node.append(helper.make_node('Identity', [DURATION_TENSOR], ['duration'], name='expose_duration'))
        m.graph.output.append(helper.make_tensor_value_info('duration', TensorProto.INT64, ['sequence_length']))
        onnx.save(m, str(dur_model))
    print('ready:', dur_model, '+', voices)


if __name__ == '__main__':
    main()
