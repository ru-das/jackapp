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
2026-10-20 · Proposed · human

**Context.** We need an open-weight model with vision, structured output, and sizes that run on phones and laptops. It's also the strongest partner category fit.
**Decision.** Gemma 4: E2B for on-device runtime `ai.run`; E4B for on-device/web generation; a larger Gemma 4 via Ollama when available. Exact model ids are recorded after the spikes: `web: ____ · android: ____ · ollama: ____`.
**Consequences.** One family across providers keeps prompt behavior consistent.
**Alternatives.** Qwen / Llama small models: fine technically, but weaker fit for the story and the partner category.

## ADR-004: Provider abstraction with platform-split local providers
2026-10-20 · Accepted · human

**Context.** Inference differs per platform. Agents and tests need to work without a model.
**Decision.** One `LLMProvider` interface (see `ARCHITECTURE.md` §5). Providers: `mock`, `ollama`, and `local` (split into `local.web.ts` with Transformers.js and `local.native.ts` with ExecuTorch or llama.rn).
**Consequences.** Features never depend on a specific runtime. Ollama is the always-available fallback.
**Alternatives.** Hard-coding one runtime: too risky given the spike unknowns.

## ADR-005: Our spec is canonical; json-render is optional under the hood
2026-10-20 · Proposed · human

**Context.** Vercel's json-render (Apache-2.0) offers Zod catalogs, a React Native renderer, and streaming. Our hand-written renderer is small.
**Decision.** `SCHEMA.md` stays the contract. Spike T-13 (≤ 2 h) checks whether json-render can render our spec through an adapter on web and Android. **Default if the spike is inconclusive: our own renderer.**
**Spike result:** `____`
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
