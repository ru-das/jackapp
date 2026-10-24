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

## AI setup

JackApp sends your request to an AI service you choose in **Settings**:

- **OpenRouter (default):** paste a free key from <https://openrouter.ai/keys>. Each step uses a different free model (see `src/ai/models.ts`). Free models are rate-limited (about 50 requests a day without credits), so a full eval run needs credits. The key is stored on your device only, never in the repo.
- **Ollama:** run `ollama serve` on your computer, then enter its address and a model name. On web, start it with `OLLAMA_ORIGINS=*` so the browser may call it. A phone needs your computer's address on the same Wi-Fi (the Android build allows plain `http`).

Privacy: your request, and any photo you ask `ai.run` to read, goes to the chosen service. Mini-apps and their data stay on your device. No telemetry.

Details for each doc live in `docs/` (start with `docs/PROGRESS.md`).

## Credits

- [Expo](https://expo.dev), [Expo Router](https://docs.expo.dev/router/introduction/), [React Native](https://reactnative.dev), [Zod](https://zod.dev): MIT.
- Free open-weight models served by [OpenRouter](https://openrouter.ai), including Gemma 4 (Google DeepMind); optional local models through [Ollama](https://ollama.com).

## Post-deadline changes

None yet.
