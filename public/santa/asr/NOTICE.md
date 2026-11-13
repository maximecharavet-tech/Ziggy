# Santa's on-device ears — third-party files

| File | Project | License |
|---|---|---|
| sherpa-vad-asr.js, sherpa-vad-asr.wasm, sherpa-onnx-asr.js, sherpa-onnx-vad.js | [k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) WebAssembly build (bundles [ONNX Runtime](https://github.com/microsoft/onnxruntime), MIT) | Apache-2.0 |
| silero_vad.onnx | [snakers4/silero-vad](https://github.com/snakers4/silero-vad) | MIT |
| Whisper tiny int8 (downloaded at run time from huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny) | [openai/whisper](https://github.com/openai/whisper) | MIT |

Changes: the WebAssembly loader's embedded model package (Chinese zipformer) was removed;
the wasm file was renamed. `stt-worker.js` is Ziggy code (same license as the repo).
