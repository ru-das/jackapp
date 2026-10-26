# JackApp

Jack of all trades, master of your chores. Describe a tiny tool in plain language and get a working mini-app, run on your own device with an open model (Gemma 4).

Built for the DEV Hacktoberfest Open-Source AI Challenge, Week 3. Web app: <https://ru-das.github.io/jackapp/>. Android: build it yourself (below).

The AI never writes code. It picks and fills in pre-built pieces, and the result is a JSON spec that the app validates and renders. Mini-apps and their data stay on the device. No accounts, no telemetry.

## What it does

- **Create:** type what you need ("track which plants I watered and remind me every Sunday"). You get a preview, then save it. A request the catalog cannot build gets a plain "can't build that yet" card instead of a broken app.
- **Ready-made starters:** a checklist and a tip calculator on Home, no AI needed.
- **Mini-apps can use the model too:** "Read photo" turns a fridge or receipt photo into list rows (the demo apps are Fridge Snap, Plant Pal and Bill Splitter).
- **Customize:** change a built mini-app's settings (fields, steps, reminder time) without rebuilding it. It asks before hiding saved data and keeps an "(old)" copy.
- **Also:** reminders on Android, Undo after removing rows, Export data as CSV, rename / duplicate / delete.
- **Offline:** saved mini-apps open offline on Android, and on the web after one online visit (a service worker caches the app).
- **Appearance:** Settings → Appearance: System, Light or Dark.

## How it works

1. **Recipes (on-device model):** code refuses what the catalog cannot do, a keyword matcher picks one of seven ready-made app types (log, counter, splitter, calculator, AI, timer, reminder), the small Gemma 4 model fills in a few settings, and code builds the spec. Requests no recipe fits go through a free-form pipeline (plan, fill, repair) on the same model.
2. **Validate:** every spec is checked with Zod and semantic rules before it is rendered or saved, whether generated, loaded or imported.
3. **Render:** the runtime draws the spec with 15 components (Stack, Card, Text, TextInput, NumberInput, DateInput, Select, Toggle, Button, List, Stat, Timer, Image, ImageInput, Divider) and a small set of actions. Specs are data: no `eval`, no WebView, no generated code.

Code layout: `src/spec` (schema, validator, values), `src/catalog` (components), `src/runtime` (renderer, state, actions), `src/ai` (providers and generator), `src/capabilities` (camera, notifications, share, per platform), `src/app` (screens). Details: `docs/ARCHITECTURE.md`.

## Run

```bash
npm install
npm run web        # web dev server
npm run export:web # static export to dist/ with the offline service worker
npm run check      # typecheck + lint + test (Jest, mock AI provider)
```

Android needs a dev build (native modules do not work in Expo Go):

```bash
npx expo run:android
```

An installable APK: `eas build -p android --profile preview`.

## AI setup

JackApp sends your request to the AI you choose in **Settings**:

- **On-device (Android, default):** Settings → On-device → Download once (2.6 GB, Wi-Fi). Gemma 4 E2B runs on the phone through Google's LiteRT-LM, so it works offline and has no request limit. The download resumes if it is interrupted, and Create shows the same download card when no model is installed. Nothing you type or photograph leaves the phone.
- **Ollama (web default):** run `ollama serve` on your computer, then enter its address and a model name (Settings has a Test connection button). On web, start it with `OLLAMA_ORIGINS=*` so the browser may call it. A phone needs your computer's address on the same Wi-Fi (the Android build allows plain `http`).
- Building needs the downloaded Android model or a reachable Ollama host. Opening saved mini-apps does not.

Privacy: with Ollama, your request, and any photo you ask `ai.run` to read, goes to your Ollama server; with the on-device model it stays on the phone. The only other network use is the one-time model download from huggingface.co.

## Tests and evals

`npm run check` runs 70 suites / 2,716 tests with the mock provider (validator rules, value resolution, actions, generator parsing, accessibility, security greps). Real-model quality is measured on a phone through the hidden `jackapp://dev/eval` screen; results are in `evals/results/`.

Honest numbers: the last on-device runs (Moto G45, Android 15, 8 GB, Gemma 4 E2B) were small. One prompt built in 32.7 s, valid with no repairs. A 4-prompt run was 4/4 valid on the first fill, with a 13.9 s median build and 2/2 correct refusals. The full 25-prompt suite (target: 80% valid within two repairs) was not completed on the phone, so there is no full-suite figure. The demo video uses a phone-sized browser capture with example data, not a recording from a physical Android.

## Docs

Start with `docs/PROGRESS.md`. Spec and validator: `docs/SCHEMA.md`. Components: `docs/COMPONENTS.md`. Why things are the way they are: `docs/DECISIONS.md`. Testing: `docs/TESTING.md`.

## Credits

- [Expo](https://expo.dev), [Expo Router](https://docs.expo.dev/router/introduction/), [React Native](https://reactnative.dev), [Zod](https://zod.dev): MIT.
- [LiteRT-LM](https://github.com/google-ai-edge/LiteRT-LM) (Google, Apache-2.0) runs Gemma 4 E2B on Android; the model file is [litert-community/gemma-4-E2B-it-litert-lm](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm) (Apache-2.0).
- [Ionicons](https://ionic.io/ionicons) via [`@react-native-vector-icons/ionicons`](https://github.com/oblador/react-native-vector-icons) (MIT). Fonts, bundled with the app: [Bagel Fat One](https://fonts.google.com/specimen/Bagel+Fat+One) (the JackApp name only), [Fraunces](https://fonts.google.com/specimen/Fraunces), [Figtree](https://fonts.google.com/specimen/Figtree) and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) (SIL Open Font License), through [`@expo-google-fonts`](https://github.com/expo/google-fonts) (MIT).
- Gemma 4 (Google DeepMind) on the phone through LiteRT-LM; optional local models through [Ollama](https://ollama.com).

## Post-deadline changes

The deadline was Mon Oct 26, 2026, 12:29 PM IST. Commits after it touch docs only, no app code or dependencies:

- `25838dd`, `e92bcc4`: demo video and screenshots recorded and logged in `docs/` [T-71].
- The commits that update this README.
