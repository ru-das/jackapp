# JackApp

Jack of all trades, master of your chores. Describe a tiny tool in plain language and get a working mini-app, run on your own device with an open model (Gemma 4 or Qwen3.5).

The AI never writes code. It assembles a JSON spec from a fixed catalog of pre-built components, and the app validates and renders it. Everything stays local.

## Run

```bash
npm install
npm run web        # verify/prepare local runtime assets, then web dev server
npm run export:web # verify/prepare assets, then static export to dist/
npm run check      # typecheck + lint + test
```

Android needs a dev build (native modules do not work in Expo Go):

```bash
npx expo run:android
```

Web preparation downloads pinned Transformers.js/ONNX runtime files and licenses into ignored `public/vendor/` (about 27 MB), never model weights. SHA-256 checksums are verified before use. Deployed JavaScript/WASM loads from the app origin; external requests are limited to the three configured model repositories and required metadata (including model-source storage redirects). Direct Expo web commands require `npm run prepare:web` first.

Settings offers Gemma 4 E2B (default), Gemma 4 E4B, and Qwen3.5-2B. Qwen uses Q4_K_M on Android with a vision projector (~1.95 GB combined); the browser uses its ONNX version. Real Qwen performance and RAM fit still need phone testing.

Details for each doc live in `docs/` (start with `docs/PROGRESS.md`).

## Credits

- [Expo](https://expo.dev), [Expo Router](https://docs.expo.dev/router/introduction/), [React Native](https://reactnative.dev), [Zod](https://zod.dev): MIT.
- Gemma 4 (Google DeepMind): open-weight model used for generation.
- [Qwen3.5-2B](https://huggingface.co/Qwen/Qwen3.5-2B) (Apache-2.0): optional local text/vision model; GGUF quantization by [Unsloth](https://huggingface.co/unsloth/Qwen3.5-2B-GGUF), ONNX conversion by [ONNX Community](https://huggingface.co/onnx-community/Qwen3.5-2B-ONNX).
- [llama.rn](https://github.com/mybigday/llama.rn) (MIT): on-device inference on Android.
- Native provider (`src/ai/providers/local.native.ts`) ported from the author's earlier llama.rn + Gemma Android app [Kokishin](https://github.com/ru-das/kokishin) (MIT).
- [Transformers.js](https://github.com/huggingface/transformers.js) 4.3.1 (Apache-2.0) and [ONNX Runtime](https://github.com/microsoft/onnxruntime) 1.31.0-dev.20260914-8d85527a0 (MIT): in-browser WebGPU/WASM inference. Preparation retains upstream licenses and ONNX third-party notices alongside exported runtime assets.

## Post-deadline changes

None yet.
