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
- **Offline:** saved mini-apps open offline on Android, and on the web after one online visit (a service worker caches the app). Building needs the downloaded Android model or a reachable Ollama host.
- **Ollama (web default):** run `ollama serve` on your computer, then enter its address and a model name. On web, start it with `OLLAMA_ORIGINS=*` so the browser may call it. A phone needs your computer's address on the same Wi-Fi (the Android build allows plain `http`).

Privacy: with Ollama, your request, and any photo you ask `ai.run` to read, goes to the chosen service; with the on-device model it stays on the phone. Mini-apps and their data stay on your device. No telemetry.

Look: Settings → Appearance switches between System, Light and Dark.

Details for each doc live in `docs/` (start with `docs/PROGRESS.md`).

## Credits

- [Expo](https://expo.dev), [Expo Router](https://docs.expo.dev/router/introduction/), [React Native](https://reactnative.dev), [Zod](https://zod.dev): MIT.
- [LiteRT-LM](https://github.com/google-ai-edge/LiteRT-LM) (Google, Apache-2.0) runs Gemma 4 E2B on Android; the model file is [litert-community/gemma-4-E2B-it-litert-lm](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm) (Apache-2.0).
- [Ionicons](https://ionic.io/ionicons) via [`@react-native-vector-icons/ionicons`](https://github.com/oblador/react-native-vector-icons) (MIT). Fonts, bundled with the app: [Bagel Fat One](https://fonts.google.com/specimen/Bagel+Fat+One) (the JackApp name only), [Fraunces](https://fonts.google.com/specimen/Fraunces), [Figtree](https://fonts.google.com/specimen/Figtree) and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) (SIL Open Font License), through [`@expo-google-fonts`](https://github.com/expo/google-fonts) (MIT).
- Gemma 4 (Google DeepMind) on the phone through LiteRT-LM; optional local models through [Ollama](https://ollama.com).

## Post-deadline changes

Made after the deadline (Mon Oct 26, 2026, 12:29 PM IST); docs only, no app code or dependency changes:

- `25838dd` (14:26 IST): demo video and screenshots recorded, logged in `docs/PROGRESS.md` and `docs/TASKS.md` [T-71].
- `e92bcc4` (14:58 IST): 16:9 demo export without chapter labels [T-71].
- The commit that adds this entry (README and docs only).
