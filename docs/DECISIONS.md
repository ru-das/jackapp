# JackApp — Architecture Decision Log

Append-only. Never edit an accepted decision's body; supersede it with a new entry instead.

**Format**

```
## ADR-NNN: Title
Date · Status (Proposed | Accepted | Superseded by ADR-MMM) · Decider (human / agent name)
Context — why we needed to decide.
Decision — what we chose.
Consequences — what this makes easier and harder.
Alternatives — what we rejected and why (one line each).
```

Agents may add **Proposed** entries. Only the human marks them **Accepted**, or the agent may do so if the human said so in the session.

---

## ADR-001: Expo single codebase for web + Android (+ iOS later)
2026-10-20 · Accepted · human

**Context.** The user wants an installable mobile app and a website from one codebase, in about 5 days, built with coding agents.
**Decision.** Expo (React Native + React Native Web), Expo Router, TypeScript strict. Record the exact SDK version here at setup: `SDK: 58.0.17` (expo ~58.0.17, react-native 0.88.0, react 19.3.0, TypeScript ~6.0.3; set up 2026-10-22).
**Consequences.** One component catalog and runtime for all platforms. Native modules need a dev build, not Expo Go. Web uses react-native-web primitives, so web styling follows React Native rules.
**Alternatives.** Capacitor (web-first wrapper): simpler web, but weaker native inference options. Flutter: new language for the team, weaker web story for this use. Separate web + native apps: no time.

## ADR-002: Mini-apps are data (JSON specs), never code
2026-10-20 · Accepted · human

**Context.** Small open models write unreliable code. Running generated code is a security risk. Apple Guideline 2.5.2 forbids executing downloaded or generated code that changes app functionality, and vibe-coding apps were pulled for this in 2026.
**Decision.** The model outputs a JSON spec limited to a fixed component catalog and a closed op set. No `eval`, no WebView, no HTML. No "custom code" component.
**Consequences.** Reliable rendering, safe sharing, small models become viable, and the store-policy position is stronger. Expressiveness is capped by the catalog, so we handle that with graceful "unsupported" responses.
**Alternatives.** Code generation in a sandboxed WebView: rejected for reliability, security, and store policy.

## ADR-003: Gemma 4 as the default model family
2026-10-20 · Proposed (Ollama parts superseded by ADR-012) · human

**Context.** We need an open-weight model with vision, structured output, and sizes that run on phones and laptops. It's also the strongest partner category fit.
**Decision.** Gemma 4, E2B by default for both generation and `ai.run` on every platform (the only size wired in code; one model to download, fits phone RAM). E4B is an optional Settings choice later, only if the phone spike shows E2B generation quality is too low and E4B fits in RAM. Exact ids (as in code):
- **Android (llama.rn):** `unsloth/gemma-4-E2B-it-GGUF` → `gemma-4-E2B-it-Q4_0.gguf` (3,041,378,400 B) + `mmproj-F16.gguf` (985,654,080 B) for images. Q4_0 because Android GPU offload supports only Q4_0/Q6_K (ADR-013).
- **Web (Transformers.js 4.3.1):** `onnx-community/gemma-4-E2B-it-ONNX`, `q4f16` on WebGPU, `q4` on wasm fallback (`public/llm-worker.js`).
- **E4B ids (verified on Hugging Face 2026-10-23, wired in Settings by T-40):** `unsloth/gemma-4-E4B-it-GGUF` → `gemma-4-E4B-it-Q4_0.gguf` (4,836,002,944 B) + `mmproj-F16.gguf` (990,372,672 B); web `onnx-community/gemma-4-E4B-it-ONNX`. RAM fit and quality are unproven on the phone.
- **Spike status:** ids are locked from code; download size, load time, tokens/s and JSON validity are still pending phone runs (PROGRESS.md → Spike results).
**Consequences.** One family across providers keeps prompt behavior consistent.
**Alternatives.** Qwen / Llama small models: fine technically, but weaker fit for the story and the partner category.

## ADR-004: Provider abstraction with platform-split local providers
2026-10-20 · Accepted (Ollama parts superseded by ADR-012) · human

**Context.** Inference differs per platform. Agents and tests need to work without a model.
**Decision.** One `LLMProvider` interface (see `ARCHITECTURE.md` §5). Providers: `mock`, `ollama`, and `local` (split into `local.web.ts` with Transformers.js and `local.native.ts` with ExecuTorch or llama.rn).
**Consequences.** Features never depend on a specific runtime. Ollama is the always-available fallback.
**Alternatives.** Hard-coding one runtime: too risky given the spike unknowns.

## ADR-005: Our spec is canonical; json-render is optional under the hood
2026-10-20 · Proposed · human

**Context.** Vercel's json-render (Apache-2.0) offers Zod catalogs, a React Native renderer, and streaming. Our hand-written renderer is small.
**Decision.** We use our own renderer (`src/runtime`, catalog in `src/catalog`). No json-render dependency. `SCHEMA.md` stays the contract. T-13 is not run; reopen only if the own renderer proves too costly.
**Spike result:** not run (own renderer is the default).
**Consequences.** Docs don't churn whichever way the spike goes. If json-render is adopted, credit it in the README and the post.
**Alternatives.** Adopt json-render's spec format directly: rejected, because it couples our contract to a fast-moving library.

## ADR-006: Distribution for the challenge — web PWA + Android APK
2026-10-20 · Accepted · human

**Context.** New personal Google Play accounts must run a 14-day closed test with 12 testers before production. App Store needs a paid account, review, and carries 2.5.2 risk.
**Decision.** Ship a static web build (PWA) and an Android APK via EAS Build (`preview` profile, `buildType: apk`) attached to a GitHub release. Store submissions happen after the challenge.
**Consequences.** Judges can try it immediately. The "one codebase" claim is shown by the web + APK builds.

## ADR-007: Local-only, no backend, no accounts
2026-10-20 · Accepted · human

**Context.** Privacy is the core of the "why open" story. Time is short.
**Decision.** AsyncStorage on device. No server, auth, sync, or telemetry. Sharing is JSON export/import.
**Consequences.** Simple and private. No cross-device sync.

## ADR-008: Two-stage generation (plan → fill) with up to 2 repairs
2026-10-20 · Accepted · human

**Context.** Small models struggle to produce a large nested JSON in one shot.
**Decision.** Stage 1 outputs a compact plan; stage 2 fills the full spec; the validator's errors drive up to 2 repair calls. Use schema-constrained decoding when the provider supports it.
**Consequences.** More model calls (slower), much higher valid rate. We measure the effect in the eval harness (with and without the plan stage) for the write-up.

## ADR-009: Mock provider is first-class
2026-10-20 · Accepted · human

**Context.** Coding agents run without a model and need deterministic tests.
**Decision.** `mock` provider returns fixture specs and canned `ai.run` outputs by keyword. All unit and UI tests use it.

## ADR-010: Two coding agents, one branch each
2026-10-20 · Superseded by ADR-011 · human

**Context.** Claude Code and Codex both work on this repo.
**Decision.** Each agent works on its own branch or git worktree and claims tasks in `PROGRESS.md` → Active work. Cross-review: the other agent reviews before merge into `main`.
**Consequences.** Fewer conflicts. Slight overhead per merge.

## ADR-011: Both agents commit directly on `main` in one folder
2026-10-22 · Accepted · human

**Context.** Branches and worktrees (ADR-010) confused the human and both agents, and cost time we don't have.
**Decision.** One folder, one branch (`main`). Each agent stages only the files it owns (`AGENTS.md` §8) and never runs history- or worktree-changing git commands. The other agent reviews the latest commits after each prompt.
**Consequences.** No merges. A broken commit lands on `main` directly, so the review step and `npm run check` matter more. One agent's half-done files can make the other's `npm run check` fail; agents ignore failures in files they don't own.

## ADR-012: No Ollama. llama.rn on Android, WebGPU on web, real-model work on the phone
2026-10-22 · Accepted · human

**Context.** The dev laptop has 4 GB RAM, so no model ever runs on it. Ollama (ADR-003/004) needed a model host we don't have. The human already shipped an Android app with llama.rn + Gemma on their phone, and tested Transformers.js + WebGPU in Chrome on the same phone.
**Decision.**
- Provider ids are only `'mock' | 'local'`. `local.native.ts` = llama.rn (ported from the human's earlier app, credited in README). `local.web.ts` = Transformers.js + WebGPU. `react-native-executorch` is dropped.
- T-12 merges into T-10 (native provider + dev screen `src/app/dev/spike.tsx`). If web WebGPU (T-11) fails, the web build shows "this browser can't run the model, use the Android app", and the APK is the main demo.
- Eval runs on the phone: Codex writes `src/ai/generator/eval.ts` (pure TS, any provider, tested with mock) and `evals/prompts.json`; Claude Code writes the hidden screen `src/app/dev/eval.tsx`, which runs it with the local provider and shares the results JSON. `npm run eval` and `scripts/eval.ts` are removed.
- Settings: model choice E2B/E4B, download progress, delete model. No URL fields. Network = model downloads only.
- Target: generation median ≤ 90 s on a mid-range Android phone.
- Agents never run a model on the dev laptop; they use the mock provider. Real-model checks happen on the human's phone (`AGENTS.md` §4.12).
- Web worker (T-11): `public/llm-worker.js` imports `@huggingface/transformers@4.3.1` from jsDelivr, because Metro can't bundle workers or onnxruntime-web. No npm dependency added; the CDN load is library code, not user data (shortcut: vendor into `public/` for offline web).
**Consequences.** One less provider, no LAN or CORS setup, a stronger "runs on your own device" story. Real-model verification needs the human and a phone, so agent work stays on mock until then.
**Alternatives.** Ollama on a borrowed machine: rejected, no host and it breaks the on-device story. ExecuTorch: rejected, llama.rn is already proven in the human's app.
**Supersedes.** The Ollama parts of ADR-003 and ADR-004.

## ADR-013: Dependencies added for the native provider (T-10)
2026-10-22 · Accepted · Claude Code

`llama.rn@0.12.9` (pinned, the version proven in Kokishin; on-device GGUF inference + mmproj vision), `expo-file-system` (resumable model download), `expo-dev-client` (native modules don't run in Expo Go), `expo-build-properties` (minSdk 24, proguard keep for `com.rnllama`), `expo-image-picker` (photo input for the spike, later ImageInput). Android model: `unsloth/gemma-4-E2B-it-GGUF` Q4_0 + `mmproj-F16` (Q4_0 because Android GPU offload supports only Q4_0/Q6_K). Spike result pending on the phone (ADR-003).

## ADR-014: P0 catalog sync before P1 implementation
2026-10-22 · Accepted · human-approved T-23 → T-24 → T-21 plan

**Decision.** The renderer-free catalog exports `{ name: { props, meta } }` for the 13 P0 components. Strict prop schemas and metadata examples follow COMPONENTS.md. AT-15 compares P0 headings in both directions; P1 schemas and headings join the registry in T-55. No dependency added and no specVersion change: this implements the existing v0.1 prop contract.

## ADR-015: Deterministic semantic validation of v0.1
2026-10-22 · Accepted · human-approved T-23 → T-24 → T-21 plan

**Decision.** Keep specVersion `0.1` and the existing Value grammar. Use Zod for structure and the renderer-free P0 catalog for props, then pure helpers for references, graph constraints, declaration-based Value types, action assignments, AI compatibility and item contexts. `validate()` returns repairable errors and never mutates input. Structural parsing alone does not authorize render/save. No dependencies or renderers added.

**Approved clarifications.** Size is compact input JSON ≤32,768 UTF-8 bytes including metadata, before defaults. Root depth is 1; math permits three nested nodes (`BAD_VALUE` on excess; other §12 limits use `LIMIT_EXCEEDED`). Prompt checks use declared defaults, a fixed 2000-01-01T00:00:00Z clock, en-US, UTC and USD; inspect every default item of every caller, using typed zeros for empty lists. Append supplies all fields; update is partial; whole-list set requires identical schemas. Reject unknown fields. AI defaults are declared, type-correct and list-only. Literal indices are nonnegative integers and rounding digits integers; dynamic arguments require runtime range checks. No numeric coercion; valid ISO/image URI literals work in typed positions. Inspect complete unescaped templates only in documented positions; unmatched braces are literal. Actions requiring item context must work for every List caller and cannot have ordinary callers or be unused. Catalog sync remains P0-only under ADR-014.

**Handoff.** T-41 must recheck actual expanded prompt length using live state/item/settings before invoking the provider; static defaults cannot bound later user input. T-31 must range-check dynamic indices/digits. Pure unit checks cover web-compatible modules; no device or real-model checks are involved.

## ADR-016: Dependencies for store and capabilities (T-30, T-34)
2026-10-22 · Accepted · Claude Code

`@react-native-async-storage/async-storage` (ADR-001 storage; web uses localStorage, ships a jest mock) and `expo-image-manipulator` (downscale to ≤1024 px JPEG 0.8 on native and web). No clipboard library: web uses `navigator.share` then `navigator.clipboard`, native uses React Native `Share`. Picked images are stored as `data:image/jpeg;base64,…` URIs so they persist and satisfy the `image` state type.

## ADR-017: JSON Schema constrains PLAN only (T-60)

2026-10-23 · Accepted · Claude Code
Both E2B eval runs failed all 30 prompts with `[json.exception.type_error.302] type must be string, but is object`: llama.rn's grammar converter rejects the 22 KB spec schema, while the 3 KB plan schema works. `callStage` now sends `jsonSchema` only for the plan target. The FILL/REPAIR spec output relies on the prompt examples, the parser, `validate()` and the two-repair budget. Revisit if a simpler spec schema is found that llama.cpp accepts (then constraining FILL may raise first-fill validity).

## ADR-018: Same-origin web runtime and security trust boundaries (T-62)
2026-10-23 · Proposed · Codex (implementation authorized by the human's T-62 plan)

**Decision.** Keep the closed catalog and spec v0.1 unchanged. Validate fixture saves as well as generated/stored specs. Revalidate restored image state with `StateDeclSchema`; invalid values retain defaults. Other restored state types keep their existing behavior.

Prepare Transformers.js **4.3.1** and its package-declared ONNX Runtime **1.31.0-dev.20260914-8d85527a0** JavaScript/WASM using a dependency-free Node script and committed SHA-256 manifest. The runtime asset hashes were cross-checked against jsDelivr's package manifests. Assets, upstream licenses and ONNX third-party notices go into ignored `public/vendor/`, included in the static export; no model weights or runtime binaries are committed. ONNX's npm package omits license files, so retain them from its exact source revision `8d85527a0`. `npm run web` prepares/verifies assets first; `npm run export:web` does the same before export. Build/development preparation needs internet once; deployed clients fetch runtime code only from the app origin.

The worker accepts only the two configured ONNX repositories, decodes only image data URLs, and delegates GET/HEAD fetches only for known same-origin runtime files, image data URLs, and those repositories' model weights/tokenizer/processor/config metadata. Both Transformers' captured `env.fetch` and global fetch use the guard. Omit credentials/referrers. Hugging Face controls signed storage redirects from allowed model downloads; these remain model-source traffic. WASM paths stay local; disable blob WASM caching/proxy workers and use one thread so nested workers cannot bypass the fetch guard. This supersedes ADR-012's CDN exception and the PRD CDN mitigation.

**Verification limit.** Agent tests use mocked inference and blocked external connections; no model runs on the laptop. Real WebGPU/WASM compatibility, signed-download redirects, cache/offline behavior and full-session phone network logs still require phone acceptance before T-62/AT-12 are complete. Import UI is absent and edit UI is a placeholder; implementing them remains T-53/T-51, with validation required at their future save/render boundaries.

## ADR-019: GitHub Pages for the web build, no service worker (T-63)

2026-10-23 · Accepted · Claude Code
Host the static export on GitHub Pages from a Pages workflow (no deploy branch) under `/jackapp`. Cloudflare Pages is out: its 25 MiB per-file limit rejects the 26.9 MB ONNX wasm. No service worker: Chrome on Android installs from the manifest alone; add one only if the install prompt fails. Deep links use the `404.html` copy of `index.html`. A .tech domain is optional; with one, drop `experiments.baseUrl`.

## ADR-020: Optional Qwen3.5-2B alongside Gemma (T-48)

2026-10-24 · Accepted · human (explicit request to add Qwen3.5-2B Q4_K_M)

**Decision.** Add `Qwen3.5-2B` to the shared registry, Settings persistence and eval selection; E2B remains the default and existing Gemma downloads remain reusable.

- Android: [Unsloth GGUF](https://huggingface.co/unsloth/Qwen3.5-2B-GGUF), `Qwen3.5-2B-Q4_K_M.gguf` **1,280,835,840 B** plus `mmproj-F16.gguf` **668,227,264 B**, verified using Hugging Face repository metadata on 2026-10-24. Total **1,949,063,104 B**. Both files use the `Qwen3.5-2B-` local prefix. Retain the existing GPU-offload request for model and projector (`n_gpu_layers: 99`, `use_gpu: true`). Installed llama.rn source includes Q4_K/Q6_K OpenCL kernels; this supersedes ADR-003/013’s assertion that only Q4_0/Q6_K is supported. Actual Moto G45 acceleration remains unverified. Existing Gemma Q4_0 configuration is unchanged. Thinking stays disabled.
- Web: [ONNX Community conversion](https://huggingface.co/onnx-community/Qwen3.5-2B-ONNX). The existing pinned Transformers.js 4.3.1 exports `Qwen3_5ForConditionalGeneration`; the worker selects it only for this repository, retaining `q4f16` WebGPU / `q4` WASM and the exact-repository request allowlist. Verified ONNX file variants and processor config; the browser does not consume GGUF.
- Restore the saved model into the provider before Settings queries download status or starts a download; otherwise a cold start could use E2B while displaying Qwen.

**Consequences.** No new dependencies, URLs in Settings, model runs on the laptop or spec-format changes. Model files remain runtime downloads. Native source includes Qwen3.5 support, but real loading, JSON quality, photo processing, RAM, heat and speed still require Moto G45/Chrome checks (TESTING §7). A 6 GB target is not a measured acceptance result. Only Gemma is the current default; choosing a faster default requires phone eval evidence.

## ADR-021: OpenRouter default, Ollama for local, on-device inference removed (T-49)
2026-10-24 · Accepted · human

**Context.** On-device Gemma and Qwen took 5–10+ minutes per eval prompt on the phone; the product goal is a mini-app in 1–2 minutes.
**Decision.**
- Default provider `openrouter`: plain `fetch` to `https://openrouter.ai/api/v1/chat/completions` on web and Android. The key is pasted in Settings and kept in on-device storage only; never in the repo or the bundle.
- **One free model per step** (`src/ai/models.ts`, ids checked against OpenRouter's model list on 2026-10-24): PLAN `google/gemma-4-26b-a4b-it:free`; FILL, REPAIR and `ai.run` `google/gemma-4-31b-it:free` (image input). Nemotron (3-super was down; 3.5-super-vl spent its whole budget reasoning, 183 s with no text) was tried and dropped on 2026-10-24. `jsonSchema` requests are sent as `response_format: json_object` (Nvidia's grammar compiler rejected the strict schema: `Unimplemented keys: ["propertyNames"]`); the prompt and validator enforce shape. `max_tokens` gets +6144 headroom because reasoning tokens count against it (Nemotron used the whole 1024 PLAN cap thinking and returned `content: null`). Every request also lists named fallback models and `reasoning.effort: low`; never `openrouter/free`, which silently routed PLAN to a 2.6B model. `429` retries up to 3 times (honors `retry-after`).
- Second provider `ollama` for anything local: POST `<ollamaUrl>/api/chat`. The user sets the address and model name. Android allows cleartext `http` for LAN use (`usesCleartextTraffic`). Web needs `OLLAMA_ORIGINS`.
- `LLMProvider` is now `{ id, label, caps, isConfigured(), generate() }`; `generate` takes an optional `stage`. Providers read Settings themselves.
- Removed: `llama.rn`, Transformers.js worker and vendored runtime, model download/delete UI, `dev/spike`, Gemma/Qwen GGUF/ONNX registry, worker security tests. Saved specs with `generatedBy.provider: "local"` still validate.
**Supersedes.** ADR-003 (model files), ADR-012, ADR-013, ADR-018 (worker parts; spec/renderer trust boundaries stay), ADR-020. **Amends** ADR-007 and hard rule 5: prompts and `ai.run` photos leave the device for the chosen AI service; specs and app data do not. A user-set URL now exists for Ollama only (http/https checked).
**Consequences.** Fast generation, smaller app, no 2–4 GB download. Needs internet (or a reachable Ollama) and a key; offline generation is gone, but saved apps still run offline except `ai.run`. Free-tier limits apply. Free model ids can disappear, so the fallback and the id list are the first thing to check when generation fails.

## ADR-022: On-device Gemma 4 E2B on Android through LiteRT-LM (T-75)
2026-10-24 · Accepted · human

**Context.** OpenRouter's free tier is 50 `:free` requests a day (20 a minute) per account, and both free Gemma models share one upstream (Google AI Studio). Quick 6 run 5 failed every call with HTTP 429. llama.rn took 5–10+ minutes per app on a budget phone, mostly reading the ~4K-token catalog prompt on the CPU for each of PLAN, FILL and REPAIR. Google's LiteRT-LM reads prompts several times faster and runs Gemma 4 on the phone's GPU.
**Decision.**
- New provider `local` (`src/ai/providers/litert.native.ts`, web stub `litert.ts`) backed by the local Expo module `modules/litert-lm` (Kotlin, `com.google.ai.edge.litertlm:litertlm-android:0.16.1`, Apache-2.0). It tries the GPU backend and retries on the CPU if GPU init fails. Thinking is off, sampler `topK 40 / topP 0.95`, context 8192 tokens, one conversation per call, `cancelProcess()` on abort.
- **Pinned to 0.16.1.** 0.17.0+ is compiled with Kotlin 2.4 and this project's toolchain (RN 0.88) compiles with Kotlin 2.2; a 2.2 compiler cannot read 2.4 metadata. 0.16.1 was built with 2.2.21. Bump together with the Kotlin version.
- Model `litert-community/gemma-4-E2B-it-litert-lm` file `gemma-4-E2B-it.litertlm`, **2,588,147,712 B**, Apache-2.0, not gated, downloaded once to `documentDirectory/models/` at the pinned revision `1caa527c1e88b55f046fcd8d2b4265606680663d`; size checked before the file is moved into place. It handles text and photos (`caps.vision`). `caps.jsonSchema` is false: the prompt, parser, validator and repair loop enforce shape.
- Create skips the PLAN stage for `local` (`noPlan`): every call pays for the catalog prompt. The eval screen's "Skip plan stage" switch compares the two.
- Settings: fresh Android installs default to `local`; web and anything unparsable stay on `openrouter`. A saved `local` is valid again.
- The eval screen shows a live status line and a timestamped log (start, first token, retries, backend, timings, per-attempt errors), saved as `log` in the results JSON. Providers report it through optional `onPartial` / `onLog`; `withLog` wraps any provider.
- OpenRouter: a 429 whose body names the per-day quota fails at once with a clear message instead of retrying; every retry is logged with the upstream reason.
**Amends.** ADR-021 and hard rule 5: the only added request is the one-time model download from `huggingface.co`; prompts and photos do not leave the device in `local` mode. Re-adds a native dependency (ADR-021 removed llama.rn).
**Not in scope.** LiteRT-LM on web (early preview, text-only model), speculative decoding / MTP, NPU builds, KV-cache reuse across calls, fine-tuning. Revisit if the measured time misses 1–2 minutes.
**Consequences.** Offline generation with no request limit, at the cost of a 2.6 GB download and phone-dependent speed. Not yet measured on a device: GPU vs CPU speed, RAM, heat, JSON quality of E2B without PLAN. The Kotlin module was written against the 0.16.1 source and has not been compiled yet.
