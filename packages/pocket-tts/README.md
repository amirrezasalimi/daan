# @daan/pocket-tts

Browser-native model implementation for [Kyutai Pocket TTS](https://huggingface.co/kyutai/pocket-tts), ported from
[ekzhang/jax-js](https://github.com/ekzhang/jax-js/tree/main/website/src/routes/tts) (MIT licensed, see
`LICENSE-jax-js`).

This package only contains the pure model/inference code (`pocket-tts.ts`, `inference.ts`, `audio.ts`). It has no UI
and is meant to be driven from a Web Worker for on-device, WebGPU-accelerated text-to-speech — see
`apps/web/src/shared/browser-tts/pocket-tts.worker.ts`.

The Pocket TTS model weights and bundled voice embeddings are downloaded at runtime from Hugging Face and are
© Kyutai, licensed under CC-BY-4.0.
