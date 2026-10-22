# JackApp — Progress & Handoff

**Every agent reads this first and updates it last.** Keep it short. Older Done-log entries can be trimmed to one line each.

---

## Status

| | |
|---|---|
| Phase | M0 — Setup done except T-04 CI; T-14 decisions drafted (ADR-003/005 await human Accept); M1 phone spikes pending |
| Last updated | 2026-10-23 by Codex |
| `main` health | `npm run check` green |
| Time left | Deadline Mon Oct 26, 12:29 PM IST · target ship Sun Oct 25 evening |

## Active work

| Agent | Task | Started (IST) | Notes |
|---|---|---|---|
| — | — | — | — |

## Handoff note (latest)

> **T-44 (Codex, 2026-10-23):** `parseResponse(raw)` preserves raw output and returns the first balanced top-level object or repairable `BAD_JSON` errors. It strips outer fences, handles nested arrays/objects, quoted braces/escapes and preambles, rejects arrays/primitives/truncation/malformed JSON, and never skips a broken first object. `fill({prompt,plan,provider,signal?})` calls a loaded provider with FILL instructions and returns raw text; shared `callStage` supplies stage temperature/token limits, optional JSON Schema only when supported, and abort checks before/after calls. Parser/FILL focused tests and full check pass (499 tests). Next: T-45 orchestration and T-46 refusal outcomes. Pure TS, mock only; no device/model runs.

> **T-43 (Codex, 2026-10-23):** `systemPrompt(stage, target?)` supports PLAN/FILL/stage-aware REPAIR. Each includes exactly two examples (compact H1 + unsupported), catalog text, JSON-only/catalog-only/refusal instructions and the 5–15 element guidance. `PlanSchema`/`validatePlan()` check field types and registered names, leaving unfinished references/scheduling semantics to FILL. `outputSchema(target)` derives PLAN-or-refusal and catalog-constrained-spec-or-refusal JSON Schemas from Zod with local references (semantic `validate()` remains authoritative). Focused prompt/schema tests and full check pass. Next: T-44 calls/parsing, T-45 orchestration, T-46 validated refusal handling. No real-model tuning (T-61).

> **T-42 (Codex, 2026-10-23):** `buildCatalogPrompt()` returns `{text, chars, estimatedTokens}` from the renderer-free registry schemas + metadata. Required/defaulted/nested props and every op included; Value/Id/Output/Where stay named. Catalog: 3547 chars, ~886.75 tokens (chars/4). Focused catalog tests and full check pass. Jest root crawl through node_modules is slow: use `npm run check -- -- --runInBand --roots src --watchman=false` (same typecheck/lint/all source tests). Next: T-43 PLAN/prompts, T-44 extraction, T-45 shared repair loop, T-46 refusals. Mock only; no dependencies or contract changes.

> **T-35 (Claude Code, 2026-10-23):** `run/[id].tsx` reads `jackapp:spec:<id>` (`specKey` in `@/storage`), `validate()`s (errors → friendly card, details in console), `SpecSchema.parse`, `createStore` + `load()`, `createActionEngine` with `{share,toast,confirm,navigate}`; `ai` is not wired until T-41 (engine toasts "unavailable"). Store flushes on unmount and app background. New `confirm` capability (`confirm.web.ts` `window.confirm` / `confirm.native.ts` `Alert`). Home shows a `__DEV__` card that writes H1–H3 into `jackapp:spec:fixture-h1..3` and opens them. Currency is fixed `USD` (shortcut, until T-40 settings). `useTheme` starts light on web hydration (static export is rendered light; a dark first client render left stale styles and a hydration error). **AT-04 on web (headless Chromium, light + dark):** typed a note, ticked Oat milk, deleted Basil → UI + `localStorage` updated, no console errors/warnings from our code. **Not verified on Android device:** run `npx expo start --dev-client` → Home → Dev → Fridge Snap → type, tick, delete, kill and reopen; check TalkBack labels and 130% font scale. Running `expo start/export` rewrites `tsconfig.json` formatting: don't commit that.

> **T-32 (Claude Code, 2026-10-23):** `<Renderer spec store engine onReady?>` in `src/runtime/Renderer.tsx` renders `screens[current].root` from the flat map. Each element is its own `<ElementBoundary>` (`ElementBoundary.tsx`) → "This part broke" card, logged with the element id. Props are re-parsed through the catalog schema (defaults), Templates/Values resolved with `@/spec/values`, inputs write via `store.setState`, Buttons call `engine.run` with busy from `engine.subscribe/isBusy`, List toggle/delete write the list immutably (sorted rows map back to original indices). Navigation: history stack + Back; `onReady({navigate})` hands the run screen the function for `services.navigate`. P1 types pass the validator but show the broken card until T-55. AT-04 auto test (H1 type/tick/delete, no console warn/error), broken-element and navigation tests; RNTL 14 `fireEvent` is async (await it).

> **T-33 (Claude Code, 2026-10-23):** 13 P0 components in `src/catalog/<Name>/<Name>.tsx` take already-resolved props + callbacks (no spec/AI/storage imports). Tokens in `src/ui/theme.ts` (`useTheme()` follows system light/dark; `space`, `radius`, `MIN_TARGET` 44). Calm warm palette, one sage accent. NumberInput `slider` is a stepper + bar (shortcut, no native slider in core RN). ImageInput shows camera + library buttons. List delete = ✕ button on all platforms. 2 label/a11y tests; check green (13 suites / 451 tests). Not yet viewed on web/device: T-32/T-35 follow.

> **T-31 (Codex, 2026-10-22):** `createActionEngine({spec, store, services, getValueContext})` in `src/runtime/actions.ts` exposes `run(id, {item?, index?}?)`, `isBusy(id)` and `subscribe(listener)` for UI snapshots. Requires an already semantically validated, parsed spec. All seven state ops validate candidates with `StateDeclSchema` before a single immutable write; indices are range-checked, resolver numeric warnings/fallbacks preserved, resets cloned. Steps await services sequentially with fresh state/settings and captured List context; duplicate IDs are suppressed, distinct IDs independent. Declined confirm stops quietly; failures log action/step details, preserve earlier writes and toast; busy always clears. Inject share/toast/confirm/navigate and optional notify/ai handlers (sync or async); missing handlers toast and stop. AI receives resolved prompt/image plus output/into/mode/defaults and owns state writes. 33 fake-service tests passed independently; `npm run check` green (12 suites / 449 tests). No dependencies, contract changes, native integrations, model runs or device/browser UI tests. **Next:** Claude Code review; T-32/T-35 wire the engine to renderer/store/capabilities. T-41 supplies AI output validation/retry/defaults, live prompt limit, abort and timeout; T-52 supplies notification scheduling.

> **T-34 (Claude Code, 2026-10-22):** `@/capabilities` exports `pickImage({source})` (→ downscaled ≤1024 px JPEG 0.8 data URI, `null` on cancel, throws friendly error if permission denied), `share(text)` (`share.web.ts`: Web Share → clipboard + toast; `share.native.ts`: RN Share) and `toast(msg)`/`subscribeToast`. `src/ui/Toaster.tsx` is mounted in the root layout. `source:'any'` opens the library (shortcut: T-33 ImageInput should render a camera button too). 10 tests with mocked picker/manipulator; check green (416 tests); web export OK. **Not tested on a device:** Android camera, share sheet, permission prompts.

> **T-30 (Claude Code, 2026-10-22):** `createStore(appId, spec.state)` in `src/runtime/store.ts` → `{getState,setState(patch|fn),subscribe,load,flush}`; `useStoreState(store)` hook. Call `await store.load()` on open, `flush()` on unmount/background. Debounce 500 ms to `jackapp:data:<id>` via `src/storage` (`readJson/writeJson/dataKey`); persist:false, undeclared and mistyped stored keys are ignored on load. 6 tests (AT-05 logic, mocked AsyncStorage); check green. Deps per ADR-016. Web/Android UI not run.

> **T-21 (Codex, 2026-10-22):** `validate(input: unknown): SpecError[]` accepts JSON text or an object; types exported from `types.ts` and `validate.ts`. Empty errors authorize render/save; `SpecSchema.parse()` alone does not. Pure helpers cover strict P0 props, reference existence, graph cycles/reuse/orphans/depth, IDs, declaration-based Value/formatter types, all action assignments/filters, AI output subsets/defaults and every List caller context. Independent valid action steps/sections are checked even after structural errors. Precise dot/bracket paths, deduplicated code/path errors, repair hints, immutable inputs. AT-01 activates all heroes and 16 invalid cases; every §12 boundary and immediately-above case tested, including multibyte bytes, defaults-before-size, expanded prompt defaults/items, tree and math depth. Full `npm run check` green (9 suites / 400 tests); no dependencies/renderers/native code or real-model/device/browser UI runs. Approved v0.1 clarifications in SCHEMA §12 and ADR-014/015. **Next:** Claude Code reviews these three commits; T-30/T-32/T-33 can consume the validator/catalog/fixtures. **T-31:** runtime range checks for dynamic indices and rounding digits. **T-41:** static prompts use defaults + fixed clock/en-US/UTC/USD and every default item (typed zeros if empty); recheck actual expanded prompt ≤2000 using live state/item/settings before inference.

> **T-24 (Codex, 2026-10-22):** Renderer-free `catalog` exports the 13 P0 entries as `{props, meta}`. Every component has a named PropsSchema/inferred Props type and metadata example accepted by the schema. Strict nested sort, documented defaults, Select 2–12 options and slider bounds tested; AT-15 checks P0 docs bidirectionally (ADR-014). Full check green (7 suites / 299 tests). No dependencies/renderers/model/device changes. Next: T-21 consumes these schemas; T-33 supplies renderers, T-55 adds P1.

> **T-23 (Codex, 2026-10-22):** Raw `h1/h2/h3.json` exported as named fixtures plus `validFixtures`; 16 separate invalid fixtures export input and expected code/path through `invalidFixtures`. H1 matches §13 exactly; H2/H3 complete their excerpts. Structural fixture tests pass; T-21 must activate semantic assertions for all cases. Full check green (6 suites / 250 tests). Pure data, no device or model run. Next: T-24, then T-21.

> **T-22 (Codex, 2026-10-22):** `values.ts` exports `resolveValue(value, context)` and `resolveTemplate(text, context)`. `ValueContext` requires state, `now: Date`, locale and IANA timeZone; optional item/index, currency and onWarning. Currency formatting requires a currency code. References return raw values (including null/undefined); substitutions are plain text, single-pass, with escaped openers. Invalid numeric operations warn and return 0; invalid formatting warns and returns empty text. `ago` uses whole elapsed seconds/minutes/hours/days/30-day months/365-day years. 93 resolver tests cover all AT-02 cases and formatters, own-property access, immutable inputs and injected settings; full `npm run check` passes (5 suites / 243 tests). Pure modules only, no native code or model runs; no device/browser UI test in these tasks. Next: T-21 semantics, T-23 fixtures, T-24 strict component props.

> **T-20 (Codex, 2026-10-22):** `src/spec/schema.ts` exports strict structural schemas and `SpecSchema`; `types.ts` infers the public types. Defaults are applied on parse. 142 schema tests; `npm run check` passes (4 suites / 150 tests). Per the approved plan, element props remain JSON-only until T-24 supplies strict component schemas. T-21 still owns reference existence, tree validation, state compatibility, expanded prompt and serialized-size checks; structural parsing alone does not authorize rendering/saving. T-22 is complete below this task in git history. No model or device runs.

> **T-14 (2026-10-22):** ADR-003 now has exact ids. Gemma 4 **E2B** default for generation and `ai.run`, Android `unsloth/gemma-4-E2B-it-GGUF` Q4_0 + `mmproj-F16`, web `onnx-community/gemma-4-E2B-it-ONNX`. E4B optional, ids unverified, not wired. ADR-005: own renderer, T-13 skipped. Both ADRs still *Proposed*: human marks Accepted. Spike numbers still need the phone.
>
> **ADR-012 (2026-10-22): no server model, no model on the 4 GB dev laptop.** Providers are `mock` | `local` only. Native = llama.rn (T-10, ported from the human's earlier app; absorbs T-12). Web = Transformers.js + WebGPU (T-11); if it fails the web build says to use the Android app. Eval runs on the phone: Codex `src/ai/generator/eval.ts` + `evals/prompts.json`, Claude Code `src/app/dev/eval.tsx`. Agents use mock only; the human tests on the phone. Needs from human: path/repo of the earlier llama.rn app to port (T-10), and its credit line for README.
>
> Expo SDK 58 app scaffolded (router in `src/app`, `@/` alias, jest-expo, zod installed, skeleton stubs per ARCHITECTURE §3). RNTL 14: `render` is async (`await render(...)`). TS 6: no `baseUrl`; `types: [jest,node]` set. Codex can start `src/spec`. Next: T-04 CI, then the M1 spikes (T-10, T-11) in parallel (see ROADMAP lanes). Everyone commits on `main` (AGENTS.md §8). Answer the open questions below before T-10/T-11.

> **T-10 phone steps:** (1) `npm i -g eas-cli && eas login`; (2) `eas init` in repo, commit the `projectId` it adds to `app.json`; (3) `eas build -p android --profile development`, install the APK from the link; (4) `npx expo start --dev-client`, open JackApp on the phone (same Wi-Fi); (5) open `jackapp://dev/spike`: Download+load (~4 GB, Wi-Fi), Run 5 JSON prompts, Photo prompt, tokens/s; (6) record results in Spike results + ADR-003. Standalone alt: `--profile preview`. Not verified on a device: untested `llama.rn` plugin options on RN 0.88 are the main risk (if EAS build fails, paste the log in Blockers).

> **T-11 phone steps:** `npx expo start --web --tunnel` (WebGPU needs HTTPS), open `/dev/spike` in Chrome on the phone, Download+load, Run 5, Photo; record in Spike results + ADR-003. Not verified: Gemma 4 class names in transformers 4.3.1 against the live model (only checked the export exists), model size vs phone RAM.

## Open questions (human to answer)

1. ~~**Hardware**~~ Answered: laptop has 4 GB RAM, no model runs on it (ADR-012).
2. **Phone**: Android model and RAM? Chrome version (WebGPU)?
3. **Accounts**: Expo/EAS account ready? GitHub repo created (name, public)?
4. **Team**: solo, or teammates (DEV handles)?
5. **Domain**: claim the free .tech domain for the web build?

## Blockers

| Since | Task | Blocker | Tried | Needs |
|---|---|---|---|---|
| — | — | — | — | — |

## Spike results (fill during M1)

| Provider | Model id | Download | Load time | Tokens/s | Valid JSON (of 5) | Verdict |
|---|---|---|---|---|---|---|
| Web (Transformers.js + WebGPU) | | | | | | |
| Android (llama.rn) | | | | | | |

## Done log (newest first)

| When (IST) | Agent | Task | Summary | Commit |
|---|---|---|---|---|
| 2026-10-23 | Codex | T-44 | Defensive JSON extraction with raw/error retention; FILL provider boundary, limits and cancellation; focused + full check green | see git log |
| 2026-10-23 | Codex | T-43 | Stage prompts, two valid examples each, loose plans and catalog-constrained JSON Schemas; focused + full check green | see git log |
| 2026-10-23 | Codex | T-42 | Catalog text generated from registry props/meta, compact Value aliases; focused + full check green | see git log |
| 2026-10-23 | Claude Code | T-35 | Run screen, confirm capability, Home dev menu for H1–H3; AT-04 verified on web, phone pending | see git log |
| 2026-10-23 | Claude Code | T-32 | Renderer with per-element error boundary, bindings, list ops, screen navigation; AT-04 auto test | see git log |
| 2026-10-23 | Claude Code | T-33 | 13 P0 components + theme tokens, light/dark, labels, 44 px targets; check green (451 tests) | see git log |
| 2026-10-22 | Codex | T-31 | Action engine, immutable validated state ops, async service delegation and busy subscriptions; check green (12 suites / 449 tests) | see git log |
| 2026-10-22 | Claude Code | T-34 | pickImage with downscale, platform-split share, toast + Toaster; check green (416 tests) | see git log |
| 2026-10-22 | Claude Code | T-30 | Store with defaults, persist filter, 500 ms debounced AsyncStorage save, load; AT-05 tests; check green (406 tests) | see git log |
| 2026-10-22 | Codex | T-21 | Pure semantic validator with repair hints, AT-01, all limit boundaries and approved clarifications; check green (400 tests) | see git log |
| 2026-10-22 | Codex | T-24 | Strict P0 catalog props, metadata and bidirectional docs sync; check green (299 tests) | see git log |
| 2026-10-22 | Codex | T-23 | Three raw hero fixtures and 16 invalid cases covering all error codes; check green (250 tests) | see git log |
| 2026-10-22 | Codex | T-22 | Pure value/template resolver, all formatters/aggregates/math, safe refs and warnings; check green (243 tests) | see git log |
| 2026-10-22 | Codex | T-20 | Strict structural schemas, typed defaults, bounded Values, inferred types; check green (150 tests) | see git log |
| 2026-10-22 | Claude Code | T-14 | ADR-003 exact model ids (E2B default), ADR-005 own renderer; left Proposed | see git log |
| 2026-10-22 | Claude Code | T-11 (code) | `public/llm-worker.js` (Transformers.js 4.3.1 from jsDelivr, Gemma 4 E2B ONNX, webgpu q4f16 / wasm q4), `local.web.ts` client, fake-Worker tests; `expo export -p web` OK. Phone spike pending | see git log |
| 2026-10-22 | Claude Code | T-10 (code) | llama.rn `local.native.ts`, `provider.ts`, mock, `dev/spike.tsx`, eas.json, app.json plugins, ADR-013; mocked tests only. Phone spike pending | see git log |
| 2026-10-22 | Claude Code | docs (ADR-012) | llama.rn only, phone-side eval; removed the eval script, `scripts/eval.ts` and the server-provider stub; T-10 rewritten, T-12 merged | see git log |
| 2026-10-22 | Claude Code | T-01,T-02,T-03,T-05 | Expo SDK 58 app, scripts, skeleton, README | see git log |
| 2026-10-20 | human + Claude | docs | Project docs created | — |

## Write-up evidence (collect as you go)

- Eval numbers: `____`
- Funny or impressive model outputs (screenshots in `docs/media/`): `____`
- Moments where open/local clearly beat a closed API: `____`
- Lazy Payoff entries: see `docs/LAZY_LOG.md`
