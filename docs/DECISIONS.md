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
**Consequences.** Offline generation with no request limit, at the cost of a 2.6 GB download and phone-dependent speed.

**First phone run (Moto G45, GPU, e01, no PLAN, 2026-10-24).** The module compiled and ran on the GPU. Model load 19.9 s (first call only); prompt reading ~100 tok/s (~2,100 tokens in 20.9 s); writing **~4.3 tok/s** (~540 tokens in ~127 s; a Galaxy S26 Ultra does 52). One FILL took 175 s wall (148 s without the load) and returned invalid JSON; REPAIR (42 s) then falsely refused with `unsupported`. Whole run 216.8 s, no spec. Token counts are estimates from `kvTokens` and char counts. So the 1–2 min target needs fewer output tokens or faster writing, not only a shorter prompt; fine-tuning alone would save ~20 s of reading.
**Follow-up switches (same day), all in `LocalTuning` and on the eval screen:** constrained JSON (`enableResponseFormat` + `ResponseFormat.json({"type":"object"})`, on by default; if the engine rejects it the call is retried without it and it stays off for the session), speculative decoding (`ExperimentalFlags.enableSpeculativeDecoding`, off by default; engine init retries without it, then on the CPU), GPU/CPU choice, and a warm-up that loads the model when the Create screen opens. The eval log now also keeps the full model output of every call (saved JSON and logcat, not on screen). Defaults change only after a phone A/B run (TESTING §7a). Fixed the same day: the false `unsupported` in REPAIR came from the refusal rule and refusal example being in every prompt; a repair of a non-refusal response now gets a prompt without them (`systemPrompt(..., allowRefusal)`).

## ADR-023: Line format between the model and the generator; patch repairs (T-76)
2026-10-24 · Accepted · human

**Context.** On the Moto G45 E2B writes ~4.3 tok/s, so output length is the cost. A full-JSON FILL took 511 s, the first repair another 852 s, because a repair re-emitted the whole spec (one build + two repairs ≈ three full specs).
**Decision.**
- Every generator output (PLAN, FILL, REPAIR, refusal) is **one plain-text line format**, not JSON: `app`, `state`, `screen`, `el`, `use` (PLAN), `action` + `- op` steps, `trigger`, `unsupported`, `drop`. Values are `key=value`; text with spaces is in double quotes; numbers, `true`/`false`/`null` bare; objects and arrays are inline JSON. `src/ai/generator/compact.ts` (`parseCompact`, `toCompact`, `toCompactPlan`, `toCompactRefusal`) compiles it to the **same Spec / Plan / `{unsupported}` objects** as before. `validate()`, the runtime and the security checks are unchanged; `SCHEMA.md` is unchanged (it is the stored contract, this is only the model's wire format). `specVersion`, omitted `default`s (zero value), omitted `purpose`s and `type: "schedule"` are filled in by code.
- A line with an unreadable value is reported (`BAD_JSON`, path `line N`) and **not applied**.
- **Patch repair.** A spec repair returns only the changed lines; lines replace items by kind and id (an `action` line replaces the whole action), `drop <kind> <id>` deletes, an `app` line starts over. The model is shown the merged draft (`toCompact`), or its own text when a whole response had broken lines. A response with no usable lines, and every PLAN repair, is rewritten whole.
- `generate({ maxRepairs })`, default 2; Create and the eval screen use **1 for `local`**.
- No stage sends a JSON Schema any more, and `generate` has a new `plainText` flag so `litert.native.ts` skips constrained JSON for generator calls (it still applies to `ai.run`).
- Repair/FILL requests are plain text (`Request:`, `Plan:`, `Previous response:`, `Errors:`), not JSON envelopes.
- `parse.ts` (JSON extraction) deleted. `ai.run` replies stay JSON: they are app data validated by a JSON Schema.
**Measured.** Compact vs compact JSON of the fixtures: H1 1329 vs 1839 chars, H2 910 vs 1307, H3 1016 vs 1410 (−28 to −30 %). Long `ai.run` prompts do not compress, so tokens will not halve; E2B's tokenizer not measured.
**Amended by ADR-024** after the first phone run (components are an indented tree, shorthand values). **Not verified.** Whether E2B writes the format reliably (it has seen one example); real-model run needed. Constrained JSON no longer protects generator output on-device.
**Amends** ADR-017 (spec stages were already unconstrained; now PLAN is too). **Consequences.** Shorter output and much shorter repairs; a new parser to keep in step with the catalog's prop names (it is generic, so it needs no change when props change).

## ADR-024: Indented component tree, shorthand values, always-patch repair (T-77)
2026-10-24 · Accepted · human

**Context.** First phone run of ADR-023 (Moto G45, E2B, GPU, e01, PLAN on): PLAN 70.9 s, FILL 83.2 s (was 511 s as JSON), REPAIR 89.5 s; each call spends ~20 s reading the prompt and writing runs at ~4–5 tok/s. The format did not hold: E2B wrote `el root Button` and `el root Stack … > ImageInput`, using component types as ids and as children; it wrote `name:string:string` and `{"name":"string":"string"}`; an unclosed quote swallowed the next line; `- toast="x"` had no `message=`; and the repair ignored "return only changed lines", started with `app`, rewrote everything and got worse.
**Decision.** The model's job is made smaller; the spec, validator and runtime are unchanged.
- **Components are an indented tree** under their `screen` line, one per line, `Type prop=value …`; nesting is indentation (2 spaces, a tab counts 2). Ids are generated (`button1`, `card2`, a per-type counter); an optional `#id` pins one. The `el <id> <Type> … > children` line is gone. Forgiving: several top-level components are wrapped in a `Stack`, components before any `screen` get a `main` screen, `root=` on a screen is ignored (it is computed).
- **Shorthand instead of nested JSON** (`shorthand.ts`; JSON is still accepted and is the fallback when a value has no short form): `@name` = `{"$ref":"name"}`, `@now` = `{"$now":true}`; on action steps only: `output=list:name:string,qty:string` (or a scalar type), `where=done:true`, `defaults=` / `set=` / `state.append value=` as `k:v,k2:@ref`.
- **Tolerant parser:** extra `:type` parts are ignored; the op is the first non-`key=value` token after `-`; a line with an unreadable value is skipped together with everything nested under it; a stray bare word on a component line is an error.
- **Repair is always a patch when a draft exists** (there is no "`app` starts over"). The model is shown the draft with a `#id` on every component. `Type #id props…` replaces that component in place (children stay); an indented line under it is added to it (or replaces the child with the same `#id`); `drop #id` removes a component and its subtree; `drop state|screen|action|trigger <id>`; a `screen` line followed by a whole tree replaces that screen's UI; state/action/trigger lines replace by key/id. A refusal attempt is shown as written. The patch prompt carries a 4-line patch example, not a whole app.
- FILL shows a second example (Plant Pal) before the refusal example: about 2.5 s more prompt reading per FILL call.
**Measured (text only).** Line format vs compact JSON on the fixtures: H1 1153 vs 1839 chars, H2 786 vs 1307, H3 868 vs 1410 (−37 to −40 %).
**Not verified.** Whether E2B follows this simpler format; a phone run is needed (Skip plan on). Amends ADR-023 (`el` line, `>` children, the `app` restart rule).

## ADR-025: No PLAN stage by default (T-77)
2026-10-24 · Accepted · human

**Context.** Phone runs of e01 on E2B (GPU, same prompts): with PLAN the run took 229 s and failed (PLAN 68 s, FILL 84 s, REPAIR 76 s); without PLAN it took 112 s on CPU and was valid on the first FILL with 0 repairs. The plan reached FILL as input; FILL followed the thin outline (4 components, no `TextInput`/`Card`) instead of the example, dropped `image=`/`output=`/`into=` from `ai.run`, wrote `{{item.qty}}` and a broken `state.append value={…}`. The patch repair then failed on the `#id` rules. There is no measurement showing PLAN improves any provider (the T-60 plan vs no-plan comparison never completed).
**Decision.** Create always calls `generate({ noPlan: true })`; the eval screen's "Skip plan stage" switch is on by default. FILL refuses by itself (its prompt keeps the refusal rule and the `unsupported` example). The PLAN code, prompt and `noPlan: false` path stay for A/B runs; the mock now refuses at FILL too.
**Consequences.** One fewer call (about 68 s on the phone, and one request off the OpenRouter daily limit per build). Refusal quality at FILL is unmeasured: run Quick 6 and look at e26 and e29 and the false-refusal rate on e01, e05, e09 and e13. Amends ADR-022 (which skipped PLAN only for `local`).

## ADR-026: A repair sees only the lines the errors point at (T-77)
2026-10-24 · Accepted · human

**Context.** Phone runs showed E2B copies whatever it is shown: given the whole draft (1.8K chars) it re-emitted the whole app, with the same mistake, and ignored the `#id` rules; a repair cost as much as a build (76–122 s).
**Decision.** For a spec repair, `toCompactSlice` (compact.ts) builds the view from the errors: `elements.<id>…` shows that component's line with its `#id` (no children), `state.<key>` the state line, `actions.<id>…` the action block, `screens[n]` / `triggers[n]` / `meta` that line; a `line N` syntax error shows the raw line as written, with its `action` line when it is a step. The request text says "the rest of the app is fine" and the prompt says to copy a line, fix it and return it. Falls back to the whole draft with ids when an error has no single line (`TREE`, limits, version, empty path, unknown id). Plan repairs and refusal attempts are unchanged.
- A patch component line without `#id` is no longer an error: it is added to the first screen's root `Stack`/`Card` (an error remains when there is none).
**Consequences.** Shorter repair prompts (less prompt reading) and a small thing to rewrite. A syntax error hides semantic errors until the line is fixed (the draft is partial then), so on-device the single repair may not reach them. Not verified on E2B.

## ADR-027: Recipes — the on-device model fills a form, code builds the app (T-78)
2026-10-24 · Accepted · human

**Context.** Quick 6 on Gemma 4 E2B (CPU, no PLAN, line format): fridge and plants valid (86–117 s), bill split and expenses failed, both refusals missed (it built a physics app and a weather app), and all four repairs made things worse. The model was asked to author a whole program (layout, state, actions, cross-references) in a format it never saw; it only succeeds when the answer is close to an example. The 25 buildable corpus prompts fall into four shapes (photo/text → AI list, tap-to-record or value log with a total, bill splitter, counter).
**Decision.** For provider `local`, `generate({ recipes: true })` (set by Create and, via a switch, the eval screen) runs `recipes/generateRecipe.ts`:
1. `refusalGate` (code): physics/simulation, games, live or fetched data, external accounts, maps, audio/video → `unsupported` with a canned reason and a suggestion that is itself buildable. No model call.
2. `matchRecipe` (async, keyword scoring; an embedding model such as EmbeddingGemma 2 can replace it later): `splitter`, `ai-list`, `counter`, `log`; no match → `unsupported` with a friendly list of what can be built (no free-form fallback on-device).
3. One model call (~300-token prompt, `maxTokens` 400, `plainText`) returns a few setting lines (name, icon, fields, total, tap, share, reminder…). `settings.ts` parses them leniently and sanitises (identifiers, template braces, lengths, emoji); anything missing or wrong falls back to the recipe's defaults, so there is no repair stage and a bad reply never fails the build.
4. The recipe's `make` returns a Spec-shaped object (data only), metadata is stamped by code, and the spec goes through `validate()` and `SpecSchema.parse()` like every spec.
Cloud providers keep the free-form pipeline (ADR-023/024/026). The free-form path stays reachable on-device by turning the eval switch off, to compare.
**Measured (tests, no model).** Builders: 255 settings combinations all pass `validate()` (valid by construction). Matcher on the 25 buildable corpus prompts: 25/25 (one, e18, needed a rule fix after the first run; the rules were tuned with the corpus in view, so this shows no regression, not generalisation); on 17 independent phrasings: 17/17; refusal gate on the 5 unsupported corpus prompts: 5/5 and on 9 independent phrasings 9/9 with 9/9 near-miss phrasings not refused. With a hand-written reply per prompt the built app has every `mustUse`/`mustOps` of the corpus.
**Not verified.** Whether E2B writes the setting lines (and picks `total`/`tap`/`share` when the request needs them) on the phone; the keyword rules on real user wording; app quality (labels, field names) judged by eye. Known limits: a request that mixes types picks the highest-scoring one; "photo" in a non-list request goes to the AI list.
**Consequences.** On-device build time should drop to one short call (about 20–35 s) and refusals become instant. Local apps are limited to these four shapes (plus their options). Amends ADR-022 and ADR-024 for provider `local`.

## ADR-028: Recipes v2 — seven app types, a classifier, and a fallback instead of a refusal (T-79)
2026-10-25 · Accepted · human

**Context.** The human typed "Currency Converter" on the phone and was told it was out of scope. ADR-027's four recipes were designed around the 30 eval prompts and "no match" ended in a refusal, so the app only worked for corpus-shaped requests. No public ranking of what people ask an app builder exists (searched Lovable/Bolt/v0 write-ups, Reddit mirrors, DEV, Glide, Notion, Airtable/Softr, Vertex42, Google Sheets, Etsy, calculator.net, store charts, the OpenAI usage study); what exists is the real artifacts people build and sell, so coverage was triangulated from ~165 named templates and calculators plus the usage study (practical guidance, information and writing are ~80% of ChatGPT messages, so AI-helper requests are likely the largest class). A manual tally put ~45% lists/logs/trackers, ~20% calculators/converters, ~10% AI helpers, the rest planners, timers, counters and items blocked by the catalog. **99% coverage cannot be guaranteed or verified.**
**Decision.**
- **Seven recipes** (`src/ai/generator/recipes/`): `log` (extended: long text, choice, rating, typed `day`, up to 3 totals sum/avg/min/max/count, tap = set a date or add one, sort, share, reminder), `counter`, `splitter`, `calculator` (new: inputs + formulas with `+ - * / ^ ( ) %`, `round min max sqrt days`, compiled to `$math`; formulas deeper than the 3-node limit switch to a Calculate button with hidden `state.set` steps), `ai` (new, replaces `ai-list`: text/number/choice/photo inputs → text answer or checklist, optional history), `timer` (new), `reminder` (new).
- **Routing:** refusal gate (code; families now also chat, services/ordering, device sensors/scanning, random/dice, charts/diagrams/calendar grids, location; payments and podcasts no longer over-match) → keyword matcher with a confidence flag → one tiny model **classification** call when unsure (~200 tokens in, one word out) → **fallback** when nothing fits or the settings cannot make a working app (`RecipeError`): `generate({ fallback })` sends the request to the cloud model when an OpenRouter key is set (`getCloudFallback()`), otherwise the same on-device model tries free-form. The progress event carries `freeForm: 'cloud' | 'device'` and Create shows a notice. The only refusals left are gate refusals.
- **Measurement** (`evals/coverage.json`, 198 prompts, and `evals/coverage-holdout.json`, 86 prompts, both written from external artifact names before the matcher was tuned): the T-78 matcher scored **97/198 (49.0%)** on the dev set (calculators 3/48, AI 9/26, reminders 0/5, timers 0/5). Now, by keywords and gate alone with no model call: dev **193/198 (97.5%), 0 wrong, 5 unsure**; hold-out **79/86 (91.9%), 1 wrong, 6 unsure**; 0 buildable prompts refused. "Unsure" goes to the classifier, whose accuracy on E2B is **not measured**. The dev set was used to tune the rules; the hold-out set was written before tuning but its misses were read once, and some gate vocabulary (services, random, sensors) was added after seeing them, so the hold-out figure is optimistic for the gate. `coverage.test.ts` fails if either number drops.
**Known gaps (no recipe can fix them):** charts (`Chart` needs react-native-svg), random/dice/pickers (no random op; the picker case goes to the AI helper), calendar grids, quiz/flashcard study logic and per-day resets (no conditionals), photos inside logs, monthly reminders (daily/weekly/once only), a background Timer notification, DateInput time-of-day (needs a native picker).
**Consequences.** On-device builds for known shapes stay one short call; novel requests cost a classifier call and then either the cloud model (fast) or on-device free-form (slow, the weakest path we measured). Amends ADR-027.

## ADR-029: `$math` gains pow, min, max, days; Stat `number` and `percent` render (T-79)
2026-10-25 · Accepted · human

`$math` operators are now `+ - * / pow min max round days` (SCHEMA §4): `pow` is exponentiation (`sqrt(x)` is `pow(x, 0.5)`), `days` returns the whole calendar days between two dates (date state, `$now`, or an ISO literal; only the date part counts). Validator, runtime, catalog prompt and tests updated together; the old tests that used `pow` as the example of an unknown operator now use `mod`. This unblocks compound interest, loans, mortgages, age and days-until, which were about a third of calculator-type requests. **Bug fix found on the way:** a Stat with the default `number` format, or `percent`, rendered an empty string because no template formatter exists for them; `formatStat` now formats both with `Intl.NumberFormat` (`percent` takes a fraction), with tests.

## ADR-030: DateInput, Timer and real reminders (T-52, T-55 partly) (T-79)
2026-10-25 · Accepted · human

- **DateInput** (P1→P0): typed `YYYY-MM-DD` plus a Today button, `mode` date only. No new dependency; a native picker (time-of-day, date-time) needs a dependency and a rebuild and is deferred.
- **Timer** (P1→P0): Start/Pause/Reset countdown up to 24 h, `onDone` action. It runs while the app is open; `notify` is reserved.
- **New dependency `expo-notifications` (~58.1.6), added with the human's approval because reminders (`triggers`, the `notify` op, the `reminder` recipe and the `log` reminder option) did nothing without it.** Capability `src/capabilities/notifications.{native,web}.ts`: one permission request, an Android channel, daily/weekly/one-off schedules keyed `jackapp:<appId>:<triggerId>`, cancel by app, immediate notify, and a tap handler that opens the mini-app. Web is best-effort: timers while a tab is open. `runtime/triggers.ts` evaluates the notification text when scheduling (SCHEMA §8) and replaces the app's reminders each time the app opens (which always follows a save); deleting an app cancels them. **Needs a new EAS development build; not run on a device.** Chart (T-55) stays deferred.

## ADR-031: Behaviour and intent are scored by scripted label-matched checks (T-96)
2026-10-25 · Accepted · human

The eval used to say only that a spec was valid and contained the named components and ops, which cannot tell a total that sums the wrong field from a right one. Each hold-out prompt in `evals/behaviour.json` now carries `checks`: a short script (`fill` an input, `press` a button or list row, `expectStat`, `expectRow`) run on the generated spec by the real action engine with an in-memory store and a fixed date. Elements are found by their **visible label** (a regex), never by state or action ids, so any valid spec for the request can pass. Layers: **structure** = valid and requirements met; **behaviour** = the workflow functions (the add button appends the row, the known inputs give the known output); **intent** = the app answers this request (the total adds across rows, "weekly" separates weeks). Chosen over an LLM judge because it is deterministic, offline, free, and needs no second model call on the phone. Limits: label regexes can miss an unusual wording (a false failure shows its reason in the log), and checks cannot judge look or layout. The set is a hold-out: prompts, recipes and matchers are not tuned against it, and a changed check gets a new id. Cold start is the first prompt of a run (the screen times the model load before it), warm is the median of the valid builds after it; photo `ai.run` is timed by `timePhoto` and never mixed into build time. The saved JSON `options` now records `corpus, noPlan, maxRepairs, recipes, only` and an `env` object (`backend, speculative, constrained, revision, appVersion, loadMs`); `revision` is the commit `npm start/web/android` was launched from (`EXPO_PUBLIC_GIT_SHA`).

## ADR-035: Unreadable AI fields are flagged, not defaulted to trusted values (T-103)
Date: 2026-10-25. Status: Accepted.
`ai.run` used to fill any unreadable list field with a default or zero, so an unreadable receipt price became a verified-looking `0`, and an empty reply wiped the previous list. **Contract:** output fields are essential unless the step lists them in `defaults`; blank strings count as unreadable; rows with nothing readable are dropped; new optional `flag` names a string field that records `Couldn't read the price`; an empty or unusable result throws a `FriendlyError` (photo or text wording), shown as the toast, and leaves state untouched. `List` gets `flagField`. Bill Splitter keeps flagged rows, shows `⚠` on them, counts "Lines to check", and an unread price adds 0 / unread type matches no sum, so flagged lines stay out of the total until fixed (saving a line clears its flag). The checklist recipe makes `qty` a default, so only a missing name drops a row. No confidence scores. Limits: a type outside the known kinds is not flagged; a read that returns plausible but wrong numbers is still only caught by the user's review.

## ADR-034: Hero tools stay honest and correctable (T-100..102)
Date: 2026-10-25. Status: Accepted.
Bill Splitter rows carry a `kind` (item, tax, service, tip, subtotal, total); the bill total is items + tax + service, or the printed total if larger, and can be typed. Tip is explicit, equal split only. **Contract:** `Stat` gets an optional `currency` template (3-letter code, bad code falls back to the app default). `navigate` to a screen already in the history returns to it instead of stacking, so a Save button on a second screen leaves Back at the first. Plant Pal (the `log` recipe's `tap date`): tapping an item opens an item screen with the big "Last watered" stat, a primary "Watered now", Undo (restores the date held before the last change), and a date picker with "Save that day"; the main list says "Tap a plant to log it or fix the date". `describeSpec` reads only the first screen. Fridge Snap (the `ai` recipe, new `output compare`, also chosen for any photo request about a fridge/pantry): three cards — what the photo shows (editable, "only what is clearly visible"), the user's usual items (editable, default Milk, Eggs, Bread, …), and a shopping list of usual items not seen, with a note that absence from a photo is not proof. **Contract:** new op `state.diff` (SCHEMA §7); matching is a deliberate simple text match (case, plural "s", substring), so "oat milk" counts as seeing "milk" and "yogurt" does not match "yoghurt". No new dependency.

## ADR-033: The preview describes the built spec and discloses lost intent (T-98)
Date: 2026-10-25. Status: Accepted.
The preview text is derived from the spec JackApp built (`describeSpec`), not the model's `description` line. Recipe parsers push a note only when a fallback loses requested intent (unreadable formula, dropped field/total/reminder, missing timer length or AI instruction); icon, name and description defaults stay silent. `omissions(request, spec)` adds keyword checks (reminders, photos, charts) that can miss but are reliable on a hit. Notes ride on `GenerationResult.done.notes`. No new dependency, no spec contract change.

## ADR-032: Gates refuse capabilities, not topics; ask when two app types tie (T-97)
Date: 2026-10-25. Status: Accepted.
The refusal gates and the matcher read the subject of a request as the capability it needs ("Keep a list of physics books" was refused, "Split my workout into sets" became a bill splitter). Measured first on two new sets of confusable wording (`evals/coverage-confusables.json`, dev 35, and `-holdout.json`, 20, written before any rule change): **60.0% routed right on both** (13 and 8 wrong or wrongly refused). "Track my monthly payments" was already fine. Changes in `recipes/match.ts`: (1) the physics gate needs simulation wording, not the word "physics"; (2) games, accounts/payments and order/brand gates are `recordable`: they do not fire when the request only tracks, logs or lists the subject and never asks to connect, send, stream, control or play. Maps, location, audio and sensor gates stay strict because they are the capability itself; (3) `split`/`divide` score 2, so a splitter also needs money words or "between N people"; (4) a negated word (`not|no|without`) plus the next word is dropped before gating and scoring; (5) `matchSync` returns `close: [a, b]` when two types are within 2 points. `generate({ askWhenUnsure })` then returns `{ status: 'choose', choices }` instead of calling the classifier, and `generate({ recipe })` builds that type directly, skipping gate, matcher and classifier (the user picked a supported tool). Create shows type chips and a two-button question. After: **91.4% (dev), 90.0% (hold-out)**, 0 wrong; the old dev set 192/198, hold-out 79/86 (unchanged guards pass). Known miss: "Notes about GPS devices I own" is still refused. **No embedding model:** the hold-out shows 0 wrong routes, only 1 false refusal and 1 unsure; revisit if a phone run of real requests shows more. Limits: the negation rule drops one word, and the `recordable` check is word-level.

- **ADR-030 follow-up (T-99):** `syncTriggers` returns `status` (`none|on|denied|unavailable`) and `next`; the run screen shows it instead of a one-time denial toast. A "Send a test in 2 minutes" one-off (`jackapp:<appId>:test`) lets reminders be checked on a phone without waiting for the schedule; it survives re-syncs and is cancelled with the app. No new dependency.
