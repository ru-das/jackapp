# JackApp

Jack of all trades, master of your chores. Describe a tiny tool in plain language and get a working mini-app, run on your own device with an open model (Gemma 4).

The AI never writes code. It assembles a JSON spec from a fixed catalog of pre-built components, and the app validates and renders it. Everything stays local.

## Run

```bash
npm install
npm run web        # web dev server
npm run export:web # static export to dist/ with the offline service worker
npm run check      # typecheck + lint + test
```

Android needs a dev build (native modules do not work in Expo Go):

```bash
npx expo run:android
```

## AI setup

JackApp sends your request to an AI service you choose in **Settings**:

- **On-device (Android, default):** Settings → On-device → Download once (2.6 GB, Wi-Fi). Gemma 4 E2B runs on the phone through Google's LiteRT-LM, so it works offline and has no request limit. The download resumes if it is interrupted. Nothing you type or photograph leaves the phone.
- **Offline:** saved mini-apps open offline on Android, and on the web after one online visit (a service worker caches the app). Building needs the downloaded Android model, an OpenRouter connection, or a reachable Ollama host.
- **OpenRouter (web default):** paste a free key from <https://openrouter.ai/keys>. Each step uses a different free model (see `src/ai/models.ts`). Free models are rate-limited (about 50 requests a day without credits), so a full eval run needs credits. The key is stored on your device only, never in the repo.
- **Ollama:** run `ollama serve` on your computer, then enter its address and a model name. On web, start it with `OLLAMA_ORIGINS=*` so the browser may call it. A phone needs your computer's address on the same Wi-Fi (the Android build allows plain `http`).

Privacy: with OpenRouter or Ollama, your request, and any photo you ask `ai.run` to read, goes to the chosen service; with the on-device model it stays on the phone. Mini-apps and their data stay on your device. No telemetry.

Details for each doc live in `docs/` (start with `docs/PROGRESS.md`).

## Credits

- [Expo](https://expo.dev), [Expo Router](https://docs.expo.dev/router/introduction/), [React Native](https://reactnative.dev), [Zod](https://zod.dev): MIT.
- [LiteRT-LM](https://github.com/google-ai-edge/LiteRT-LM) (Google, Apache-2.0) runs Gemma 4 E2B on Android; the model file is [litert-community/gemma-4-E2B-it-litert-lm](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm) (Apache-2.0).
- Free open-weight models served by [OpenRouter](https://openrouter.ai), including Gemma 4 (Google DeepMind); optional local models through [Ollama](https://ollama.com).

## Post-deadline changes

None yet.
