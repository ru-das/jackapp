# JackApp — Implementation Checklist

Work **top to bottom** within a milestone. Don't start P1 work while any P0 task in M0–M4 is open. The two agent lanes in `ROADMAP.md` may run milestones in parallel (for example, Lane A starts M2 during the M1 spikes).
Each task: `- [ ] T-xx (Pn) Title`, then acceptance criteria and the acceptance tests (AT-xx) from `TESTING.md`.
Tick with `[x]` only when the Definition of Done in `AGENTS.md` §6 is met. ROADMAP.md has the schedule and ready-to-paste prompts.

---

## M0 — Setup (Wed morning)

- [ ] **T-01 (P0) Init Expo app.** TypeScript strict, Expo Router with routes in `src/app/`, `@/` alias, web + Android targets. Record the SDK version in ADR-001.
  - `npm run web` shows a placeholder home; `npm run android` builds a dev client.
- [ ] **T-02 (P0) Scripts and test setup.** `typecheck`, `lint`, `test` (jest-expo + RN Testing Library), `check`, `eval` (placeholder).
  - `npm run check` passes with one sample test.
- [ ] **T-03 (P0) Folder skeleton** exactly as in `ARCHITECTURE.md` §3, with `index.ts` stubs. Add a placeholder `scripts/eval.ts` and `evals/prompts.json` (empty array).
- [ ] **T-04 (P1) CI.** GitHub Actions runs `npm ci && npm run check` on push and PR.
- [ ] **T-05 (P0) README skeleton.** What it is, how to run, Credits, "Post-deadline changes" (empty).

## M1 — Risk spikes (Wed). Time-boxed; record results in DECISIONS.md

- [ ] **T-10 (P0) Ollama provider.** Implement `ai/providers/ollama.ts` per `ARCHITECTURE.md` §5 with `format` JSON Schema and images. Add a script `scripts/spike-ollama.ts` that sends a text prompt and a photo prompt and prints parsed JSON.
  - Works from Node and from the web app (document `OLLAMA_ORIGINS` for CORS in README). ⏱ 1.5 h
- [ ] **T-11 (P0) Web local provider spike.** Transformers.js + WebGPU in a Web Worker loading a small Gemma 4 (prefer E2B ONNX). Text → JSON and image → JSON in the Expo web build.
  - Record: model id, download size, load time, tokens/s, JSON validity on 5 prompts → ADR-003. ⏱ 3 h. **If it fails, mark web-local P1 and move on.**
- [ ] **T-12 (P0) Android local provider spike.** `react-native-executorch` with Gemma 4 E2B (fallback `llama.rn` + GGUF) on the dev build, on a real phone.
  - Record the same metrics → ADR-003. ⏱ 3 h. **If it fails, Android uses the Ollama provider for the challenge.**
- [ ] **T-13 (P1) json-render evaluation.** Can it render the H1 fixture through an adapter on web and Android? Write the result in ADR-005. ⏱ 2 h max. Default: own renderer.
- [ ] **T-14 (P0) Decision gate.** Update ADR-003/005, `PROGRESS.md`, and reorder tasks if needed.

## M2 — Spec core (Thu morning)

- [ ] **T-20 (P0) Spec types + Zod schema** (`src/spec/schema.ts`, `types.ts`) covering all of `SCHEMA.md` §1–8, with strict objects. → AT-01
- [ ] **T-21 (P0) Semantic validator** (`validate.ts`): refs, tree (orphans, cycles, reuse), bind types, action field checks, `ai.run` output/into compatibility, `$item` context, limits. Returns `SpecError[]` with the codes in `SCHEMA.md` §11 and model-friendly hints. → AT-01
- [ ] **T-22 (P0) Value resolver** (`values.ts`): literals, templates + formatters, `$ref`, `$agg`, `$math`, `$now`, `$item`/`$index`. Pure functions. → AT-02
- [ ] **T-23 (P0) Fixtures.** Full H1, H2, H3 specs from `SCHEMA.md` §13, plus at least 12 invalid specs (one per error code where possible), each with its expected error code.
- [ ] **T-24 (P0) Catalog prop schemas** for all P0 components (`catalog/*/props.ts` + `meta.ts`) and the registry. Validator uses them. → AT-15

## M3 — Runtime (Thu afternoon)

- [ ] **T-30 (P0) State store** with defaults, `persist`, debounced AsyncStorage save, and load. → AT-05
- [ ] **T-31 (P0) Action engine** with all ops except `ai.run` and `notify`; busy state per action; `confirm` abort; errors → toast. → AT-03
- [ ] **T-32 (P0) Renderer**: flat map → tree, screen navigation, per-element error boundary. → AT-04
- [ ] **T-33 (P0) P0 components**: Stack, Card, Divider, Text, Image, Stat, TextInput, NumberInput, Toggle, Select, ImageInput, List, Button. Light/dark, labels, 44 px targets. → AT-04, AT-16
- [ ] **T-34 (P0) Capabilities**: image pick/camera with downscale, share with fallback, toast. Platform-split where needed.
- [ ] **T-35 (P0) Run screen** `run/[id].tsx` loads a stored spec and renders it; dev menu loads the H1–H3 fixtures. → AT-04

## M4 — AI (Fri morning)

- [ ] **T-40 (P0) Provider registry + mock provider + settings screen** (choose provider, Ollama URL, model ids, load/download progress). → AT-06
- [ ] **T-41 (P0) `ai.run` op**: output → JSON Schema, call provider, validate, one retry, coerce with defaults, write to state. Abort and 120 s timeout. → AT-03
- [ ] **T-42 (P0) Catalog prompt builder** from `catalog/*/meta.ts`.
- [ ] **T-43 (P0) Plan stage** (prompt + few-shot + loose validation).
- [ ] **T-44 (P0) Fill stage** (plan + catalog → spec; defensive JSON parsing).
- [ ] **T-45 (P0) Repair loop** (≤ 2 attempts, errors fed back). → AT-06
- [ ] **T-46 (P0) Unsupported path** in plan and fill; friendly UI. → AT-06
- [ ] **T-47 (P0) Create screen**: prompt box, progress stages, live preview, save, retry. → AT-07

## M5 — App features (Fri afternoon)

- [ ] **T-50 (P0) Home**: my mini-apps (open, rename, duplicate, delete) + template gallery (H1–H3) with "Remix" (prefilled edit prompt).
- [ ] **T-51 (P1) Edit-by-chat** keeping compatible state. → AT-08
- [ ] **T-52 (P1) Triggers**: schedule/cancel native local notifications; web best-effort; tap opens the mini-app. → AT-09
- [ ] **T-53 (P1) Export/import** spec JSON (share sheet / file). → AT-11
- [ ] **T-54 (P1) Offline polish**: model ready indicator, clear errors when the provider is unavailable. → AT-10
- [ ] **T-55 (P1) P1 components**: DateInput, Timer, Chart.

## M6 — Quality & builds (Sat)

- [ ] **T-60 (P0) Eval harness** `npm run eval`: 30 prompts in `evals/prompts.json` (10 hero-like, 15 everyday chores, 5 should-be-unsupported). Metrics: valid on first try, valid after repair, unsupported precision, median latency. With and without the plan stage. Saves `evals/results/<timestamp>.json` and prints a table. → AT-14
- [ ] **T-61 (P0) Fix the top 3 failure modes** found by the eval (prompts, hints, validator messages). Re-run and record the before/after.
- [ ] **T-62 (P0) Security pass**: forbidden-API grep, HTML-in-spec test, import validation. → AT-12
- [ ] **T-63 (P0) Web deploy**: static export + PWA manifest/icons, hosted. → AT-13
- [ ] **T-64 (P0) Android APK** via EAS `preview`, attached to a GitHub release. → AT-13
- [ ] **T-65 (P1) Accessibility and visual polish pass.** → AT-16

## M7 — Ship (Sun → Mon 11:00 IST)

- [ ] **T-70 (P0) Lazy Payoff log**: real uses of H1–H3 Fri–Sun with minutes saved (`docs/LAZY_LOG.md`).
- [ ] **T-71 (P0) Demo video** (≤ 3 min) and screenshots/GIFs.
- [ ] **T-72 (P0) Final README**: setup, models, credits, eval numbers, post-deadline section.
- [ ] **T-73 (P0) DEV post** using the challenge template (human writes final text; agents gather facts).
- [ ] **T-74 (P0) Publish** with tags `devchallenge`, `hf26challenge`, before **Mon 12:29 PM IST**.

## Backlog (P2, after the challenge)

- [ ] T-90 iOS build + TestFlight
- [ ] T-91 Play Store closed test (12 testers × 14 days)
- [ ] T-92 Tinker fine-tune for spec generation, compared against the eval baseline
- [ ] T-93 Audio input component (Gemma 4 E2B/E4B audio)
- [ ] T-94 Spec v0.2: conditions (`when`), nested screens
