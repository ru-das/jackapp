# JackApp

Jack of all trades, master of your chores. Describe a tiny tool in plain language and get a working mini-app, run on your own device with an open model (Gemma 4).

The AI never writes code. It assembles a JSON spec from a fixed catalog of pre-built components, and the app validates and renders it. Everything stays local.

## Run

```bash
npm install
npm run web        # dev server, web
npm run check      # typecheck + lint + test
```

Android needs a dev build (native modules do not work in Expo Go):

```bash
npx expo run:android
```

Details for each doc live in `docs/` (start with `docs/PROGRESS.md`).

## Credits

- [Expo](https://expo.dev), [Expo Router](https://docs.expo.dev/router/introduction/), [React Native](https://reactnative.dev), [Zod](https://zod.dev): MIT.
- Gemma 4 (Google DeepMind): open-weight model used for generation.
- [llama.rn](https://github.com/mybigday/llama.rn) (MIT): on-device inference on Android.
- Native provider (`src/ai/providers/local.native.ts`) ported from the author's earlier llama.rn + Gemma Android app [Kokishin](https://github.com/ru-das/kokishin) (MIT).
- [Transformers.js](https://github.com/huggingface/transformers.js) (Apache-2.0): in-browser inference via WebGPU.

## Post-deadline changes

None yet.
