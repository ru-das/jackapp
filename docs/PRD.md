# JackApp — Product Requirements

> **Jack of all trades, master of your chores.** Describe a tiny tool, get a working mini-app, run it on your own device with an open model.

| | |
|---|---|
| Status | Draft v1 (Oct 20, 2026) |
| Challenge | DEV Hacktoberfest Open-Source AI Challenge, Week 3: *Slow and Steady* |
| Hard deadline | **Oct 25, 2026 11:59 PM PDT = Mon Oct 26, 12:29 PM IST** |
| Target ship | Sun Oct 25 evening IST (12+ hours buffer) |

---

## 1. Problem

Most of the boring, repetitive tasks in a person's life are **too niche or too personal** for anyone to build an app for: tracking which plant you watered, splitting one specific restaurant bill, turning what's in your fridge into a grocery list. Nobody builds those apps, so lazy people do the chore manually, or never do it.

General AI chat can answer once, but it doesn't give you a **reusable tool** with buttons, saved state, and reminders. Existing "AI app builders" generate code in the cloud, cost money per generation, and send your personal data (photos, habits, receipts) to someone else's server.

## 2. Solution

JackApp lets a user **describe a mini-app in plain language** and get a working one in about a minute.

- The AI does **not** write code. It assembles a **JSON spec** from a fixed catalog of pre-built, tested components (camera input, checklist, AI step, reminder, stat, and so on). See `SCHEMA.md` and `COMPONENTS.md`.
- The model is **Gemma 4 E2B running on the Android phone** (ADR-022), or an open-weight model served free by OpenRouter, or your own model through Ollama. Mini-apps and their data stay on the device (ADR-021).
- Mini-apps can use the model **at runtime** too (for example, "read this receipt photo"), so open AI is the core of both building and using them.

## 3. Why open AI matters here (the core of the write-up)

| Concern | Closed API approach | JackApp (open, local) |
|---|---|---|
| Privacy | Fridge photos, receipts, habits go to a vendor | Data never leaves the device |
| Cost | Every generation and every run costs tokens | Free OpenRouter models, or your own Ollama; generate 100 apps or 1 |
| Offline | Breaks without internet | Saved apps run offline (web after one online visit, via a service worker); generating needs internet, a reachable Ollama, or the downloaded Android model |
| Control | Vendor decides model, limits, policies | Swap models, constrain output to our schema, fine-tune later |
| Longevity | API deprecations break your tools | Your mini-apps keep working on your device |

## 4. Target users

1. **Primary: "the lazy power user."** Comfortable with phones, hates repetitive chores, won't write code, cares about privacy.
2. **Secondary: developers and tinkerers** who want a private, hackable generative-UI runtime they can extend with their own components.

## 5. Goals and non-goals

### Goals (for the challenge build)
- G1. Prompt → working, saved mini-app in **≤ 90 s** (median) with the default AI.
- G2. **≥ 80% of eval prompts** produce a valid spec within 2 repair attempts (see `TESTING.md`, eval harness).
- G3. **One codebase** runs as a website (installable PWA) and an Android app; iOS builds from the same code later.
- G4. **3 hero mini-apps** that are polished and actually used by the author Fri–Sun (the "Lazy Payoff").
- G5. Saved mini-apps run **offline** (except `ai.run`).

### Non-goals (explicitly out of scope)
- ❌ Generating or executing code (JS, HTML, WebViews). Mini-apps are data only. See ADR-002.
- ❌ "Any app." Physics simulators, games, multiplayer, and anything needing network APIs are out.
- ❌ Accounts, cloud sync, backend servers, telemetry.
- ❌ Reading other apps' data (email, messages, files) automatically. Inputs come from camera, photo library, typing, or paste.
- ❌ Publishing to Play Store or App Store before the deadline (see ADR-006).

## 6. Hero mini-apps (the demo)

| # | Name | Prompt the user types | Shows off |
|---|---|---|---|
| H1 | **Fridge Snap** | "Take a photo of my fridge and make me a grocery list of what's running low" | Vision AI step at runtime, checklist, persistence |
| H2 | **Plant Pal** | "Track which of my plants I watered and when, and remind me every Sunday morning" | State, list with timestamps, scheduled trigger |
| H3 | **Bill Splitter** | "Photo of a restaurant bill → split it between friends" | Vision extraction, number input, computed stat (`$agg`/`$math`) |

A fourth, the **graceful refusal**, is also part of the demo: "Build me a physics simulator" → JackApp explains which component it's missing instead of producing a broken app.

## 7. User stories

### Create
- US-01. As a user, I type what I want and see progress stages ("Planning → Building → Checking") while the app is generated.
- US-02. As a user, I see a live preview of the generated mini-app before saving it.
- US-03. As a user, if my request can't be built, I get a clear, friendly explanation of what's missing, plus the closest thing JackApp *can* build.
- US-04. As a user, I can start from a template in a gallery and "remix" it with a sentence.

### Use
- US-05. As a user, I open a saved mini-app from my home screen and it remembers its data.
- US-06. As a user, I can take or pick a photo inside a mini-app and have the local model process it.
- US-07. As a user, I get reminders from mini-apps that have a schedule (Android; web is best-effort).

### Change
- US-08. As a user, I can say "add a quantity field" or "sort by date" and the mini-app updates without losing my data where possible.
- US-09. As a user, I can rename, duplicate, delete, export (JSON), and import mini-apps.

### Control
- US-10. As a user, I can paste a free OpenRouter key, or point the app at my own Ollama server, in Settings.
- US-11. As a user, I see a friendly message when the AI is not set up or the free models are busy.

## 8. Feature list and priority

| ID | Feature | Priority |
|---|---|---|
| F-01 | Spec validator, renderer, state store, action engine | P0 |
| F-02 | P0 component catalog (see `COMPONENTS.md`) | P0 |
| F-03 | Provider abstraction + mock provider | P0 |
| F-04 | OpenRouter provider (free model per step) | P0 |
| F-05 | Ollama provider (user's own server) | P0 |
| F-06 | Two-stage generation with repair loop | P0 |
| F-07 | Graceful "unsupported" responses | P0 |
| F-08 | Home gallery + starter templates | P0 |
| F-09 | `ai.run` runtime op (text + vision) | P0 |
| F-10 | Edit-by-chat | P1 |
| F-11 | Scheduled triggers (local notifications) | P1 |
| F-12 | Export/import spec JSON | P1 |
| F-13 | Eval harness + metrics | P0 (it feeds the write-up) |
| F-14 | P1 components: Chart, DateInput, Timer | P1 |
| F-15 | iOS build | P2 |
| F-16 | Tinker fine-tune for spec generation | P2 (stretch) |

## 9. Success metrics (reported in the write-up)

- Valid-spec rate on the eval set (first try, and after repair).
- Median prompt-to-preview time per provider.
- Number of real uses of hero apps Fri–Sun and estimated minutes saved.
- Bundle and model size; works-offline confirmation per platform.

## 10. Constraints

- **Challenge rules:** the repo must be started and completed within Oct 19–25, 2026. Any commit after the deadline must be noted in the README. Credit any non-trivial reused open-source code. Submission must be in English.
- **Time:** about 5 working days, solo (or team ≤ 4), built with Claude Code and Codex.
- **Hardware:** to be confirmed. See `PROGRESS.md` → Open questions.

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Free models rate-limited or removed | High | Medium | Named fallback models, 429 retry, friendly message; Ollama as the alternative |
| Small model makes invalid specs | High | High | Two-stage generation, schema-constrained output, repair loop, few-shot examples |
| Scope creep | High | High | `TASKS.md` priorities; P1/P2 only after P0 is green |
| Weak write-up (weighted most) | Medium | High | Sunday is reserved for the write-up; collect evidence from Friday |

## 12. Partner categories (opt-in, honest use only)

- **Best Use of Gemma** (primary): Gemma 4 is the core model.
- **Best Use of a .tech domain**: if we deploy the web build there.
- **Best Use of GitHub Copilot**: only if Copilot or GitHub Actions is genuinely used.
- **Best Use of Entire**: only if agent sessions are shared in the post.
- A project can only win once per challenge, so don't stretch for categories.
