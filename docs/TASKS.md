# JackApp — Implementation Checklist

Work **top to bottom** within a milestone. Don't start P1 work while any P0 task in M0–M4 is open. The two agent lanes in `ROADMAP.md` may run milestones in parallel (for example, Lane A starts M2 during the M1 spikes).
Each task: `- [ ] T-xx (Pn) Title`, then acceptance criteria and the acceptance tests (AT-xx) from `TESTING.md`.
Tick with `[x]` only when the Definition of Done in `AGENTS.md` §6 is met. ROADMAP.md has the schedule and ready-to-paste prompts.

---

## M0 — Setup (Wed morning)

- [x] **T-01 (P0) Init Expo app.** TypeScript strict, Expo Router with routes in `src/app/`, `@/` alias, web + Android targets. Record the SDK version in ADR-001.
  - `npm run web` shows a placeholder home; `npm run android` builds a dev client.
- [x] **T-02 (P0) Scripts and test setup.** `typecheck`, `lint`, `test` (jest-expo + RN Testing Library), `check`. (A placeholder `eval` script was added here and removed by ADR-012.)
  - `npm run check` passes with one sample test.
- [x] **T-03 (P0) Folder skeleton** exactly as in `ARCHITECTURE.md` §3, with `index.ts` stubs. Add `evals/prompts.json` (empty array). (`scripts/eval.ts` was removed by ADR-012.)
- [ ] **T-04 (P1) CI.** GitHub Actions runs `npm ci && npm run check` on push and PR.
- [x] **T-05 (P0) README skeleton.** What it is, how to run, Credits, "Post-deadline changes" (empty).

## M1 — Risk spikes (Wed). Time-boxed; record results in DECISIONS.md

- [x] **T-10 (P0) [ticked 2026-10-23 on the human's word that it works on the phone; no numbers recorded] Native provider with llama.rn.** `provider.ts` + `local.native.ts` ported from the human's earlier llama.rn + Gemma app. Model downloaded with progress; JSON via grammar / JSON-schema mode; images via mmproj. Add the dev screen `src/app/dev/spike.tsx` that runs 5 JSON prompts + 1 photo prompt and shows load time, tokens/s, and valid JSON count.
  - Credit the earlier app in README → Credits. Human runs the spike on the phone and records results in `PROGRESS.md` → Spike results and ADR-003. No model runs on the dev laptop (ADR-012). ⏱ 3 h. Absorbs the old T-12.
- [x] **T-11 (P0) Web local provider spike.** *(ticked 2026-10-23 on the human's word that it works in Chrome on the phone; no numbers recorded)* Transformers.js + WebGPU in a Web Worker loading a small Gemma 4 (prefer E2B ONNX). Text → JSON and image → JSON in the Expo web build, tested by the human in Chrome on the phone.
  - Record: model id, download size, load time, tokens/s, JSON validity on 5 prompts → ADR-003. ⏱ 3 h. **If it fails, the web build shows "this browser can't run the model, use the Android app", and the APK is the main demo.**
- [x] **T-12 merged into T-10.** (Android local provider is now T-10, llama.rn only. ADR-012.)
- [ ] **T-13 (P1) json-render evaluation.** Can it render the H1 fixture through an adapter on web and Android? Write the result in ADR-005. ⏱ 2 h max. Default: own renderer.
- [x] **T-14 (P0) Decision gate.** Update ADR-003/005, `PROGRESS.md`, and reorder tasks if needed.

## M2 — Spec core (Thu morning)

- [x] **T-20 (P0) Spec types + Zod schema** (`src/spec/schema.ts`, `types.ts`) covering all of `SCHEMA.md` §1–8, with strict objects. → AT-01
- [x] **T-21 (P0) Semantic validator** (`validate.ts`): refs, tree (orphans, cycles, reuse), bind types, action field checks, `ai.run` output/into compatibility, `$item` context, limits. Returns `SpecError[]` with the codes in `SCHEMA.md` §11 and model-friendly hints. → AT-01
- [x] **T-22 (P0) Value resolver** (`values.ts`): literals, templates + formatters, `$ref`, `$agg`, `$math`, `$now`, `$item`/`$index`. Pure functions. → AT-02
- [x] **T-23 (P0) Fixtures.** Full H1, H2, H3 specs from `SCHEMA.md` §13, plus at least 12 invalid specs (one per error code where possible), each with its expected error code.
- [x] **T-24 (P0) Catalog prop schemas** for all P0 components (`catalog/*/props.ts` + `meta.ts`) and the registry. Validator uses them. → AT-15

## M3 — Runtime (Thu afternoon)

- [x] **T-30 (P0) State store** with defaults, `persist`, debounced AsyncStorage save, and load. → AT-05
- [x] **T-31 (P0) Action engine** with all ops except `ai.run` and `notify`; busy state per action; `confirm` abort; errors → toast. → AT-03
- [x] **T-32 (P0) Renderer**: flat map → tree, screen navigation, per-element error boundary. → AT-04
- [x] **T-33 (P0) P0 components**: Stack, Card, Divider, Text, Image, Stat, TextInput, NumberInput, Toggle, Select, ImageInput, List, Button. Light/dark, labels, 44 px targets. → AT-04, AT-16
- [x] **T-34 (P0) Capabilities**: image pick/camera with downscale, share with fallback, toast. Platform-split where needed.
- [x] **T-35 (P0) Run screen** `run/[id].tsx` loads a stored spec and renders it; dev menu loads the H1–H3 fixtures. → AT-04

## M4 — AI (Fri morning)

- [x] **T-40 (P0) Provider registry + mock provider + settings screen** (model choice E2B/E4B, download progress, delete model; no URL fields; network = model downloads only). → AT-06
- [x] **T-41 (P0) `ai.run` op**: output → JSON Schema, call provider, validate, one retry, coerce with defaults, write to state. Abort and 120 s timeout. Recheck the actual expanded prompt ≤2000 characters with live state/item/settings immediately before inference (ADR-015). → AT-03
- [x] **T-42 (P0) Catalog prompt builder** from `catalog/*/meta.ts`.
- [x] **T-43 (P0) Plan stage** (prompt + few-shot + loose validation).
- [x] **T-44 (P0) Fill stage** (plan + catalog → spec; defensive JSON parsing).
- [x] **T-45 (P0) Repair loop** (≤ 2 attempts, errors fed back). → AT-06
- [x] **T-46 (P0) Unsupported path** in plan and fill; friendly UI. → AT-06
  - Generator complete (2026-10-23): validated refusals from PLAN/FILL/REPAIR, malformed refusals repaired. **Friendly UI now exists (T-47, `UnsupportedCard`); mock-tested. Ticked 2026-10-23 on the human's word that the phone check passed.**
- [x] **T-47 (P0) Create screen**: prompt box, progress stages, live preview, save, retry. → AT-07
- [ ] **T-48 (P0, human-requested) Add Qwen3.5-2B Q4_K_M alongside Gemma.** Persisted Settings/eval selection, exact native GGUF + vision-projector downloads, existing native offload path, corresponding allowlisted ONNX web model. → TESTING §7
  - [x] **Code (2026-10-24, Codex):** shared registry, Settings restoration, provider labels and Qwen worker class; no dependency or spec-format change. Regression tests cover Settings/eval persistence, native downloads/offload/deletion and browser selection/security. `npm run check`: typecheck/lint + 30 suites / 635 tests pass. Web export and blocked-network browser smoke pass with inference mocked.
  - [ ] **Human phone acceptance:** download/load/generate/photo/offline, switch/delete isolation and eval both modes on Moto G45; record results. No inference on the dev laptop. Keep unchecked until device acceptance.

## M5 — App features (Fri afternoon)

- [x] **T-50 (P0) Home**: my mini-apps (open, rename, duplicate, delete) + template gallery (H1–H3) with "Remix" (prefilled edit prompt).
  - Done 2026-10-23 (Claude Code): `src/storage/apps.ts` + `src/ui/AppRow.tsx`; "Try" saves a template as the user's own copy; "Remix" opens Create with a prefilled prompt. Duplicate copies the spec only (fresh data). Mock/jest-tested; not yet checked on a device.
- [ ] **T-51 (P1) Edit-by-chat** keeping compatible state. → AT-08
- [ ] **T-52 (P1) Triggers**: schedule/cancel native local notifications; web best-effort; tap opens the mini-app. → AT-09
- [ ] **T-53 (P1) Export/import** spec JSON (share sheet / file). → AT-11
- [ ] **T-54 (P1) Offline polish**: model ready indicator, clear errors when the provider is unavailable. → AT-10
- [ ] **T-55 (P1) P1 components**: DateInput, Timer, Chart.

## M6 — Quality & builds (Sat)

- [ ] **T-60 (P0) Eval on the phone.** Codex: `src/ai/generator/eval.ts` (pure TS runner, any provider, tested with mock) + 30 prompts in `evals/prompts.json` (10 hero-like, 15 everyday chores, 5 should-be-unsupported). Claude Code: hidden screen `src/app/dev/eval.tsx` runs it with the local provider and shares the results JSON. Metrics: valid on first try, valid after repair, unsupported precision, median latency (target ≤ 90 s). With and without the plan stage. Human saves the shared JSON to `evals/results/<timestamp>.json`. → AT-14
  - [x] **Codex runner + corpus (2026-10-23):** sequential `runEval`, no-plan mode, diagnostic snapshots, scoring/targets/top errors, and 30 prompts; mock-only check green (25 suites / 554 tests). Overall T-60 remains pending Claude Code's screen and human phone runs in both modes.
  - [x] **Claude Code screen (2026-10-23):** hidden `src/app/dev/eval.tsx` (model E2B/E4B, skip-plan switch, one prompt or all, live rows, metrics table, Share + Save file via new `saveFile` capability); mock-tested (557 tests). T-60 stays unchecked until the human's phone runs in both modes are saved to `evals/results/`.
- [ ] **T-61 (P0) Fix the top 3 failure modes** found by the eval (prompts, hints, validator messages). Re-run and record the before/after.
- [ ] **T-62 (P0) Security pass**: forbidden-API grep, HTML-in-spec test, import validation. → AT-12
  - [x] **Code + automated review (Codex, 2026-10-23):** 47 security regressions; fixture save validation, persisted image validation, pinned same-origin runtime preparation and worker request/image guards (ADR-018). Typecheck/lint + 27 suites / 604 tests, exact grep (test-only matches), static export and Chromium smoke with external connections blocked/inference mocked pass. Existing generator/create/stored-spec boundaries validate. Import is absent and edit is a placeholder; UI work stays T-53/T-51.
  - [ ] **Human phone acceptance:** full web/Android session network logs (download, generate, photo, save/reopen, offline); verify model-source-only external requests and local WebGPU/WASM assets/cache/redirects. Record results before ticking T-62/AT-12.
- [x] **T-63 (P0) Web deploy**: static export + PWA manifest/icons, hosted. → AT-13
- [ ] **T-64 (P0) Android APK** via EAS `preview`, attached to a GitHub release. → AT-13
- [~] **T-65 (P1) Accessibility and visual polish pass.** → AT-16
  - Code done (2026-10-23, Claude Code): light palette now ≥4.5:1 (guarded by `src/ui/__tests__/theme.test.ts`), themed element-error fallback, spinners + elapsed time for slow model, sloth copy on Home empty state / unsupported card / empty List, Settings "Ready". Mock-only `EXPO_PUBLIC_MOCK_DELAY_MS` simulates a slow model on web. **Pending (human):** walk each screen on phone at 130% font + dark + real model; then tick.

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
