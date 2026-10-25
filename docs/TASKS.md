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
- [x] **T-52 (P1) Triggers** (code and tests 2026-10-25, ADR-030; not yet run on a device): schedule/cancel native local notifications; web best-effort; tap opens the mini-app. → AT-09
- [ ] **T-53 (P1) Export/import** spec JSON (share sheet / file). → AT-11
- [ ] **T-54 (P1) Offline polish**: model ready indicator, clear errors when the provider is unavailable. → AT-10
- [~] **T-55 (P1) P1 components**: DateInput and Timer done (ADR-030); Chart open.

## M6 — Quality & builds (Sat)

- [ ] **T-60 (P0) Eval on the phone.** Codex: `src/ai/generator/eval.ts` (pure TS runner, any provider, tested with mock) + 30 prompts in `evals/prompts.json` (10 hero-like, 15 everyday chores, 5 should-be-unsupported). Claude Code: hidden screen `src/app/dev/eval.tsx` runs it with the local provider and shares the results JSON. Metrics: valid on first try, valid after repair, unsupported precision, median latency (target ≤ 90 s). With and without the plan stage. Human saves the shared JSON to `evals/results/<timestamp>.json`. → AT-14
  - [x] **Codex runner + corpus (2026-10-23):** sequential `runEval`, no-plan mode, diagnostic snapshots, scoring/targets/top errors, and 30 prompts; mock-only check green (25 suites / 554 tests). Overall T-60 remains pending Claude Code's screen and human phone runs in both modes.
  - [x] **Claude Code screen (2026-10-23):** hidden `src/app/dev/eval.tsx` (model E2B/E4B, skip-plan switch, one prompt or all, live rows, metrics table, Share + Save file via new `saveFile` capability); mock-tested (557 tests). T-60 stays unchecked until the human's phone runs in both modes are saved to `evals/results/`.
- [ ] **T-61 (P0) Fix the top 3 failure modes** found by the eval (prompts, hints, validator messages). Re-run and record the before/after.
- [x] **T-62 (P0) Security pass**: forbidden-API grep, HTML-in-spec test, import validation. → AT-12
  - [x] **Code + automated review (Codex, 2026-10-23):** 47 security regressions; fixture save validation, persisted image validation, pinned same-origin runtime preparation and worker request/image guards (ADR-018). Typecheck/lint + 27 suites / 604 tests, exact grep (test-only matches), static export and Chromium smoke with external connections blocked/inference mocked pass. Existing generator/create/stored-spec boundaries validate. Import is absent and edit is a placeholder; UI work stays T-53/T-51.
  - [x] **Human phone acceptance (waived by the human, 2026-10-25: no network logs captured; the worker and local web runtime it describes were removed by ADR-021):** full web/Android session network logs (download, generate, photo, save/reopen, offline); verify model-source-only external requests and local WebGPU/WASM assets/cache/redirects. Record results before ticking T-62/AT-12.
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
- [x] **T-104 (P0, human-requested) Number field keeps typed text.** Done 2026-10-25 (Claude Code; not run on a device). `NumberInput` field mode holds a draft: empty, `-`, `1.` stay as typed; only a valid number in range is committed; invalid text shows a short reason, and on blur reverts with "Kept N."
- [x] **T-113 (P0, human-requested) Offline promises + web asset cache.** Done 2026-10-25 (Claude Code; the browser offline check was not run). ADR-038: `public/sw.js` (precache, network-first navigation with shell fallback, same-origin only), `scripts/precache.js` stamps it after `expo export`, registered from `_layout` by `capabilities/offline.web.ts` (not in dev), persistent storage requested. AT-10 is now a six-row promise table with verify steps. Open: human offline reopen on the hosted site and on the phone.
- [x] **T-112 (P0, human-requested) Dependable model download.** Done 2026-10-25 (Claude Code; not run on a device). `.part` file named by revision, resumed with a Range request from its size (no AsyncStorage), Cancel keeps it, free-space check (size left + 300 MB), `isLoaded`/`partialBytes` on `LocalModel`, card states None / Paused / Downloading / Downloaded / Loaded with Resume, Cancel, Load now, and errors that say where the download stopped. Open: phone check of kill-at-30% resume and the oversize-after-Range guard.
- [x] **T-111 (P0, human-requested) Shorten the route to first value.** Done 2026-10-25 (Claude Code; not run on a device). Home: New mini-app on top, two no-AI ready-made tools (Checklist, Tip Calculator built with the log/calculator recipe builders), AI tags on templates, Settings last. Create: AI readiness line re-checked on focus, **Set up AI** replaces Build when not ready, prompt kept across Settings. Progress copy drops Planning and "a minute or two". Settings: model ids behind **Model details**. Open: rendered/device checks of font scaling, web keyboard order, screen-reader announcements, preview bottom bar.
- [x] **T-105 (P0, human-requested) Currency preference.** Done 2026-10-25 (Claude Code; not run on a device). Settings → Money: explicit choice from the splitter's currency list, default USD, never inferred from language. Used by `session.ts` and `Renderer.tsx` via `preferredCurrency()`; a `Stat.currency` (splitter's per-app Select) still wins. Not done: per-app override for other apps.
- [x] **T-107 (P0, human-requested) Share sends the content.** Done 2026-10-25 (Claude Code, in Codex-owned `src/spec/{values,validation-values}.ts`, `recipes/{ai,compare,log,splitter}.ts`; ask Codex to review; not run on a device). New `lines` formatter; Share lists items; splitter Share gives bill, tip, total, each. ADR-037.
- [x] **T-108 (P0, human-requested) Undo the last removal** (row delete, Clear done, AI replace). Done 2026-10-25 (Claude Code; not run on a device). `store.lastRemoval()/undo()` + `UndoBar` on the run screen; one step, shows 8 s. No spec change.
- [x] **T-109 (P0, human-requested) Edit an entry** in log apps without a tap action. Done 2026-10-25 (Claude Code, in Codex-owned `recipes/log.ts`; ask Codex to review; not run on a device). Tap a row → "Fix" screen with Save / Delete; apps with a tap action keep it.
- [x] **T-110 (P0, human-requested) Export data as CSV** from the run screen. Done 2026-10-25 (Claude Code; not run on a device). Header "Export data" shares CSV text (`runtime/export.ts`): one block per saved list, then single values; images and drafts left out; formula-looking text is quote-prefixed. Definition export and backup/import stay T-53.
- [x] **T-106 (P0, human-requested) Required text on `state.append`.** Done 2026-10-25 (Claude Code, in Codex-owned `src/spec/{schema,validation-actions}.ts`, `runtime/actions.ts`, `recipes/log.ts`; ask Codex to review; not run on a device). Blank title on Add shows "Fill in the <field> first.", no row, draft kept. ADR-036.
- [x] **T-103 (P0, human-requested) Stop uncertain AI output from looking verified.** Done 2026-10-25 (Claude Code, in Codex-owned `src/spec/{schema,validation-actions,validation-elements}.ts`, `runtime/actions.ts`, `recipes/{splitter,ai}.ts`; ask Codex to review; not run on a device). `ai.run` essential fields + `flag`, `List.flagField`, empty read keeps the old list. ADR-035.
- [x] **T-100 (P0, human-requested) Bill Splitter: fix lines, type the total, choose currency, tax/service/tip, share.** Done 2026-10-25 (Claude Code, in Codex-owned `recipes/splitter.ts`, `catalog/Stat/props.ts`, `validation-elements.ts`; ask Codex to review; not run on a device). Equal split only. ADR-034.
- [x] **T-101 (P0, human-requested) Plant Pal: discoverable "Watered now", clear last-watered, undo, earlier date.** Done 2026-10-25 (Claude Code, in Codex-owned `recipes/log.ts`; ask Codex to review; not run on a device). Applies to every `log` app with `tap date`. Reminder flow unchanged (T-79/T-99; T-52 still needs the phone run). ADR-034.
- [x] **T-102 (P0, human-requested) Fridge Snap: read, correct, compare with a staples list, then shop.** Done 2026-10-25 (Claude Code, in Codex-owned `recipes/ai.ts`, `src/spec/{schema,validation-actions}.ts`, `runtime/actions.ts`; ask Codex to review; not run on a device). New op `state.diff`, new `recipes/compare.ts`. ADR-034.
- [x] **T-99 (P0, human-requested) Reminder status and device check.** Done 2026-10-25 (Claude Code; not run on a device). Run screen shows `ReminderStatus` (next reminder / notifications off + Open settings / unavailable) and a **Send a test in 2 minutes** button; re-syncs when the app returns to the foreground. T-52 still needs the phone run.
- [x] **T-98 (P0, human-requested) Make the supported scope clear before and after generation.** Done 2026-10-25 (Claude Code, in Codex-owned `src/ai/generator/recipes/*` and `generate.ts` at the human's request; ask Codex to review). Create shows what it works best for; the preview describes the built spec (`src/runtime/describe.ts`) and lists "Not included" (recipe notes for lost formulas/fields/reminders/timer length/AI instruction, plus request keywords the spec lacks: reminders, photos, charts). ADR-033.
- [x] **T-97 (P0, human-requested) Match capability, not topic; ask when unsure; let the user pick a tool type.** Done 2026-10-25 (Claude Code, in Codex-owned `src/ai/generator/**` at the human's request; ask Codex to review). ADR-032: confusables sets (60% → 91.4% dev, 60% → 90.0% hold-out), `recordable` gates, splitter needs cost/people, negation, `choose` result and `recipe` option, type chips in Create. **Open:** phone check of the chips and the two-way question; GPS-notes false refusal.
- [x] **T-96 (P0, human-requested) Evaluate what an app does, not only that it is valid.** Done 2026-10-25 (Claude Code, in Codex-owned eval files at the human's request; ask Codex to review). Three layers (structure / behaviour / intent) scored separately; hold-out set `evals/behaviour.json` (10 prompts, scripted label-matched checks, `src/ai/generator/behaviour.ts`); cold (`firstBuildMs`) and warm (`warmMedianMs`) builds and model load timed separately; `timePhoto` measures photo `ai.run` apart from building; saved options now include corpus, maxRepairs, recipes, backend, speculative, constrained, revision, appVersion, loadMs. ADR-031. **Open:** a phone run of the Behaviour suite and one Time-a-photo run.
- [x] T-95 (P0, human-requested) Persistence failures surface: storage writes/removes reject, reads tell missing / unreadable / unavailable, Create keeps the draft on a failed save, failed autosave stays pending, `flush()` waits for in-flight writes. Done 2026-10-25.
- [~] **T-79 (P0, human-requested) Recipes for the head of the distribution, honest coverage, no dead-end refusals, reminders.** Code and tests done 2026-10-25 (Claude Code), ADR-028/029/030: seven recipes, classifier, cloud/free-form fallback, `$math` pow/min/max/days, Stat number/percent fix, DateInput, Timer, `expo-notifications` triggers (T-52) and the `reminder` recipe, coverage sets and guards. `npm run check` green (47 suites / 2,483 tests). **Open:** build a new dev build (native dependency), phone run of Quick 6 / the human's own prompts / a reminder / a timer; classifier and settings quality on E2B are unmeasured; Chart, random, calendar grids remain gaps.
- [~] **T-78 (P0, human-requested) Recipes for the on-device model.** Code and tests done 2026-10-24 (Claude Code), ADR-027: four validated app builders (`log`, `counter`, `splitter`, `ai-list`), tolerant settings parser, refusal gate, keyword matcher, `generate({ recipes })`, eval-screen switch. `npm run check` green (37 suites / 1,050 tests). **Open:** phone run (Quick 6, then all 30, then 5 prompts of your own); EmbeddingGemma 2 for matching if the keywords miss real wording.
- [~] **T-77 (P0, human-requested) Indented-tree line format, shorthand values, always-patch repair.** Code and tests done 2026-10-24 (Claude Code), ADR-024, after the first phone run of T-76 showed E2B garbling `el id Type … > children`. `npm run check` green. **Open:** phone run of e01 (Skip plan on) — success is a valid FILL or one short patch, total well under 3 min.
- [~] **T-76 (P0, human-requested) Line format + patch repair + 1 repair on-device.** Code and tests done 2026-10-24 (Claude Code, edited Codex-owned generator files at the human's request): ADR-023. `compact.ts`, patch repair, `maxRepairs`, `plainText`, mock and prompts moved to the line format; `parse.ts` removed. `npm run check` green. **Open:** phone run of e01 (Skip plan on, TESTING §7a) to compare FILL time with 511 s and to see whether E2B follows the format; tune the prompt example if not.
- [~] **T-75 (P0, human-requested) On-device Gemma 4 E2B via LiteRT-LM on Android + detailed eval log.** Code and tests done 2026-10-24 (Claude Code): local Expo module `modules/litert-lm` (Kotlin, LiteRT-LM 0.16.1), `litert.native.ts` provider + download, Settings card, Create skips PLAN for `local`, eval screen live status + timestamped log saved in the JSON, OpenRouter daily-quota 429 fails fast. ADR-022. `npm run check` green (33 suites / 642 tests); web export builds.
  - [x] **Kotlin module compiles:** the EAS development build installed and ran on the Moto G45 (GPU backend worked).
  - [ ] **First run (2026-10-24):** e01 failed (BAD_JSON, then a false refusal); FILL 175 s wall, writing ~4.3 tok/s. Follow-up with constrained JSON, speculative decoding, GPU/CPU switches and warm-up built; needs the A/B run (TESTING §7a).
  - [ ] **Spike gate on the Moto G45:** e01 with "Skip plan stage" on, one FILL ≤ 2.5 min (stop and report above 3 min). Then Fridge Snap in 1–2 min, photo `ai.run`, airplane-mode rebuild, Quick 6 both modes. TESTING §7a.
- [x] **T-49 (P0, human-requested) OpenRouter default + Ollama; remove on-device inference.** Code done 2026-10-24 (Claude Code): `openrouter.ts` (free model per stage, fallback, 429 retry), `ollama.ts`, Settings (key / address / model), `LLMProvider` slimmed, llama.rn / worker / vendored runtime / spike removed. ADR-021.
  - [ ] **Human acceptance:** real build with a key, time under 2 min; photo `ai.run`; one Ollama build; eval run (needs credits).
- [x] **T-114 (P0, human-requested) Customize recipe apps.** Done 2026-10-25 (Claude Code, in Codex-owned `src/spec/schema.ts` and `recipes/*`; ask Codex to review; not run on a device). `meta.recipe` keeps settings + version; run header **Customize** edits setting lines (field names/labels, counter step, reminder time, log sort, calculator currency-style inputs) and rebuilds via the validated builder; `dataAtRisk` + "(old)" copy with data. ADR-039.
- [x] **T-115 (P0, human-requested) Honest Remix.** Done 2026-10-25 (Claude Code). Home button reads "Make similar to X"; data-preservation rules recorded in ADR-039 for future chat editing.
- [x] **T-116 (P0, human-requested) Photo logs, converter starter, honest free-form message.** Done 2026-10-25 (Claude Code, in Codex-owned `src/ai/generator/**`; ask Codex to review). ADR-040: `log` `photo` setting + Read photo action; calculator converter starter instead of a cloud trip; `freeFormReason` in progress events. Instant "can't build that" card is a proposal, not built. Phone check pending.
- [x] **T-125 (P2, human-requested) Final polish pass.** Done 2026-10-25 (Claude Code). The same toast shown twice is spoken twice and restarts its timer; AT-16 lists the Android checks for T-119..124. Not tried on a device.
- [x] **T-124 (P1, human-requested) Confirm dialogs and copy.** Done 2026-10-25 (Claude Code). Delete app, delete model and Customize name their action on the button; a mini-app's own confirm shows its question as the title; decorative sloth not read aloud. ADR-045. Mini-app confirm buttons still say OK (spec has no label field). Not tried on a device.
- [x] **T-123 (P1, human-requested) List performance.** Done 2026-10-25 (Claude Code; edits Codex-owned `src/spec/values.ts` with the human's yes, ask Codex to review). Measured a keystroke at 200 rows: 421 ms, 1,000 rows: 1,825 ms; now 28 ms and 78 ms (desktop). Memoised list rows and a cache for Intl formatters. ADR-044. Opening a very long list is still linear (not virtualized). Not tried on a device.
- [x] **T-122 (P1, human-requested) Run header layout.** Done 2026-10-25 (Claude Code). The run-screen header has one "More actions" button; Customize (recipe apps only) and Export data sit in a small overflow menu (tap outside or system Back closes it), so long mini-app names keep the width. Shared `MoreIcon` with Home rows. No contract change. Not tried on a device.
- [x] **T-121 (P1, human-requested) Distill Home app rows.** Done 2026-10-25 (Claude Code). Each saved app is one row (open + More); Rename, Duplicate and Delete show inline only after More, so Delete is no longer always one tap away. No contract change. Not tried on a device.
- [x] **T-120 (P0, human-requested) Harden screen-reader and control contrast from the audit.** Done 2026-10-25 (Claude Code). `outline` token for inputs and Switches, build-progress live region without the clock, `useAnnounce` for toasts, Undo and errors. ADR-043. Not tried with TalkBack.
- [x] **T-119 (P0, human-requested) Android adaptation from the audit.** Done 2026-10-25 (Claude Code). Bottom insets (preview bar, toast, undo bar, scroll screens), keyboard avoidance at the root, system Back through mini-app screen history, 48 dp targets. ADR-042. Not tried on a device.
- [x] **T-118 (P0, human-requested) Second pass: UI system and app-wide copy.** Done 2026-10-25 (Claude Code; edits Codex-owned recipes, generator, runtime and fixtures for user text only). Tokens, `Card`, danger button, press feedback, Home header with Settings icon, loading and wide-screen fixes, label-based preview/CSV/validation text, plural-safe toasts, provider errors shown to users. ADR-041. Not tried on a device or rendered.
- [x] **T-117 (P0, human-requested) First clean + polish pass.** Done 2026-10-25 (Claude Code). Unused deps and stale docs removed; Customize, not-found, Toaster, run/settings a11y and wording fixed. Not tried on a device.
