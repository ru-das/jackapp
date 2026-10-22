# JackApp — Roadmap & Agent Playbook

The detailed **what, when, who, and exactly what to paste** for every phase. `docs/TASKS.md` is the checklist; this file is the playbook that drives it.

- Times are **IST**. Hard deadline: **Mon Oct 26, 12:29 PM IST**. Target: ship Sunday night, publish Monday morning.
- **Feature freeze: Sun Oct 25, 12:00 IST.** After that, only fixes, builds, and the write-up.

---

## 0. How to use this file

**Setup, once:** one folder, the branch is `main`. Open two terminals in that folder: run `codex` in one and `claude` in the other. Both agents read `AGENTS.md` on their own, so there are no setup prompts to paste.

**Every step after that:**
1. Find the current phase in §3.
2. Paste that phase's Lane A prompt into Codex and its Lane B prompt into Claude Code.
3. When an agent finishes, check the phase's exit criteria, then paste **Review** (§2) into the *other* agent.
4. If the review finds problems, paste **Fix findings** (§2) into the agent that did the work.
5. Move to the next prompt in that lane.

The phase prompts in §3 are the only prompts you need for building. §2 has just three helpers: Review, Fix findings, and Debug.

### Agent lanes

| Lane | Agent | Best for | Why |
|---|---|---|---|
| **A — Core (pure TS)** | **Codex** | `src/spec`, generator logic, eval harness, tests | Well-specified by docs, no device needed, easy to verify with tests |
| **B — App & device** | **Claude Code** (local, interactive) | Expo setup, UI, runtime rendering, native inference, builds | Needs your machine, phone, browser, and quick back-and-forth |
| **Reviewer** | the *other* agent | after every prompt | A second model catches what the first one missed |

File ownership between the lanes is defined in `AGENTS.md` §8.

---

## 1. Timeline at a glance

| When (IST) | Phase | Lane A — Codex | Lane B — Claude Code | Human |
|---|---|---|---|---|
| Wed 09:00–10:30 | P0 Setup | — | T-01, T-02, T-03, T-05 | Create GitHub repo, answer open questions |
| Wed 10:30–19:00 | P1 Spikes + early core | T-20, T-22 (spec types, values) | T-10 → T-11 (llama.rn native, web local) | Run the spikes on the phone (T-10, T-11) |
| Wed 19:00–20:00 | **Decision gate** | T-04 CI | T-13 (optional), T-14 | Accept ADR-003/005 |
| Thu 09:00–13:00 | P2 Spec core | T-21, T-23, T-24 | T-30 store, T-34 capabilities | Run reviews |
| Thu 14:00–21:00 | P3 Runtime | T-31 action engine | T-32, T-33, T-35 | Try fixtures on phone |
| Fri 09:00–14:00 | P4 Generator | T-42 → T-46 (with mock) | T-40, T-41, T-47 | Write hero prompts |
| Fri 14:00–21:00 | P5 Features | T-60 eval runner (`generator/eval.ts`) | T-50, T-52, T-51, T-60 `dev/eval.tsx` | **Start Lazy Log** (use H1–H3 for real) |
| Sat 09:00–21:00 | P6 Quality & builds | T-61, T-62 | T-63, T-64, T-53–T-55, T-65 | Run evals, real-device test |
| Sun 09:00–12:00 | Last fixes | bug fixes | bug fixes | **Feature freeze 12:00** |
| Sun 12:00–23:00 | P7 Ship story | facts for write-up | README, screenshots | Demo video, write the post |
| Mon 09:00–11:00 | Publish | — | — | Proofread, publish, verify links |

### If you're behind (cut in this order)
1. T-13 json-render evaluation → keep own renderer.
2. T-55 P1 components (Chart, Timer, DateInput).
3. T-51 edit-by-chat → "Remix" regenerates from scratch with the old prompt plus the change.
4. T-11 web local → web build shows "this browser can't run the model, use the Android app"; the APK is the main demo.
5. T-52 triggers → drop from Plant Pal; mention as next step.
**Never cut:** validator, repair loop, the 3 hero apps, eval numbers, the write-up day.

---

## 2. Helper prompts

### Review (paste into the *other* agent)

```
Review the latest commits by <Codex | Claude Code> for <T-xx…>
(`git log --oneline -10`, then `git show` each one).
Check, in order:
1. Does it meet the acceptance criteria in docs/TASKS.md?
2. Hard rules in AGENTS.md §4 and §8 (spec-as-data, validation, boundaries,
   platform split, no network, no new deps without ADR, file ownership).
3. Contract drift: does the code match docs/SCHEMA.md and docs/COMPONENTS.md?
4. Bugs and edge cases (empty lists, null images, division by zero,
   aborts, double taps).
5. Tests: do they test behaviour, not implementation? Anything missing?
Output one line per finding: `path:line — severity (blocker/major/minor) —
problem — fix`. End with APPROVE or CHANGES REQUESTED. Don't edit files.
```

### Fix findings (paste into the agent that did the work)

```
Fix these review findings: <paste findings>.
Fix blockers and majors. For any finding you disagree with, explain why
instead of changing code. Re-run npm run check, update PROGRESS.md, commit.
```

### Debug

```
Bug: <what happens> | Expected: <what should happen> | Where: <web/Android, screen>
Logs: <paste the shortest decisive lines>
Don't guess-fix. First: reproduce (write a failing test if it's logic),
list the 2–3 most likely causes ranked by evidence, check them, then fix the
root cause once. Add the regression test. If two attempts fail, stop and
write it up in PROGRESS.md → Blockers.
```

Ending a session: just say "update PROGRESS.md handoff and commit". AGENTS.md already says what goes in it.

---

## 3. Phases

### P0 — Setup · Wed 09:00–10:30 · Lane B

**Goal:** an empty app that runs on web and Android, with `npm run check` green.

**Human first:** create the GitHub repo (public), add these docs in the first commit, install Node LTS, Expo/EAS CLI, Android Studio or a USB-debuggable phone.

**Prompt (Claude Code):**
```
Do T-01, T-02, T-03 and T-05 from docs/TASKS.md.

- Create the Expo app in the repo root (TypeScript, Expo Router with routes
  under src/app). Keep our docs/, AGENTS.md, CLAUDE.md, ROADMAP.md.
- tsconfig strict, "@/*" → "src/*".
- Scripts exactly as AGENTS.md §3. jest-expo + @testing-library/react-native.
  One sample test so `npm run check` passes.
- Also install zod now (Codex needs it for src/spec and can't add deps).
- Folder skeleton exactly as docs/ARCHITECTURE.md §3 with index.ts stubs.
- README skeleton: what JackApp is (2 lines from docs/PRD.md), how to run,
  Credits, "Post-deadline changes".
- Record the Expo SDK version in docs/DECISIONS.md ADR-001.
Verify: `npm run web` shows a placeholder home; `npm run check` passes.
Tell me the exact command to make an Android dev build on my phone.
```

**Exit:** web placeholder renders; dev build installs on the phone; `check` green.

---

### P1 — Risk spikes · Wed 10:30–19:00

**Goal:** know by tonight which inference paths are real. Meanwhile Lane A builds the pure-TS core, which doesn't depend on spike results.

**Lane B prompt 1 — Native provider with llama.rn (T-10):**
```
Do T-10 (ADR-012). Never run a model on this laptop (4 GB RAM): use mock
for tests; I run the spike on my phone.
- src/ai/provider.ts (interface from ARCHITECTURE.md §5, ids 'mock' | 'local')
  and src/ai/providers/local.native.ts, ported from my earlier llama.rn +
  Gemma app at <path or repo>. Credit it in README → Credits.
- Model downloaded to app storage with progress (never bundle weights);
  JSON via llama.rn grammar / JSON-schema mode; images via mmproj.
- Dev screen src/app/dev/spike.tsx: runs 5 JSON prompts + 1 photo prompt and
  shows load time, tokens/s, valid JSON count (of 5).
- Tell me exactly what to do on the phone (build, install, permissions).
Record my results in the Spike results table in docs/PROGRESS.md and ADR-003.
```

**Lane B prompt 2 — Web local provider spike (T-11), time-box 3 h:**
```
Do T-11 as a time-boxed spike (3 hours max; stop and report if blocked).
Goal: Gemma 4 (prefer E2B, ONNX for Transformers.js) running in a Web
Worker inside our Expo web build, via @huggingface/transformers with
device "webgpu".
- src/ai/providers/local.web.ts implements LLMProvider by messaging a worker.
- Report download progress through load(onProgress).
- If Metro can't bundle the worker or the library, load the library inside
  the worker from the jsDelivr ESM build and document it as a shortcut.
- Test: 5 prompts asking for small JSON outputs, plus 1 image prompt.
Report: model id, download MB, load seconds, tokens/s, valid JSON count.
Write them into docs/PROGRESS.md (Spike results) and propose ADR-003 text.
If WebGPU isn't available on my machine, say so and stop.
```

**T-12** is merged into prompt 1 (ADR-012). There is no separate Android spike prompt.

**Lane A prompt — spec types + values (T-20, T-22), no spike dependency:**
```
Do T-20 and T-22. docs/SCHEMA.md is the
contract; implement it exactly.
- src/spec/schema.ts: Zod schemas for the whole spec (§1–§8), strict objects,
  identifier regex, limits that are purely structural.
- src/spec/types.ts: types inferred from Zod.
- src/spec/values.ts: pure resolver for literals, templates with
  formatters, $ref, $agg, $math, $now, $item/$index (§4). Inject `now` and
  locale for testability. Division by zero → 0 + warning callback.
- Table-driven tests including every case in docs/TESTING.md AT-02.
No React or platform imports in src/spec (ARCHITECTURE.md §4 rule 3).
```

### Decision gate · Wed 19:00–20:00

**Prompt (Claude Code):**
```
Do T-14. From the Spike results in docs/PROGRESS.md:
1. Propose final ADR-003 model ids per provider and ADR-005 outcome
   (T-13 if it ran; else "own renderer").
2. Tell me which providers are P0 for the demo, and which tasks in
   docs/TASKS.md should move priority because of the results.
3. Update PROGRESS.md Status + Handoff note.
Don't mark ADRs Accepted. I'll do that.
```

**Human:** accept the ADRs. If the web spike failed, the web build says "this browser can't run the model, use the Android app" and the APK is the main demo. If llama.rn fails on the phone, stop and ask: there is no server fallback.

---

### P2 — Spec core · Thu 09:00–13:00

**Lane A prompt — validator + fixtures + catalog schemas (T-21, T-23, T-24):**
```
Do T-23 first, then T-24, then T-21.

T-23: src/spec/fixtures/ — H1 exactly as docs/SCHEMA.md §13, and full H2
(Plant Pal) and H3 (Bill Splitter) built from the excerpts. Then ≥12
invalid fixtures, each in a file with `expected: {code, path}`.

T-24: src/catalog/<Name>/props.ts + meta.ts for every P0 component in
docs/COMPONENTS.md (props exactly as the tables; strict Zod). Registry in
src/catalog/index.ts exporting {name → {props, meta}}. No .tsx yet (Lane B
does those). Add the docs-sync test (AT-15).

T-21: src/spec/validate.ts → SpecError[] with codes and paths from
SCHEMA.md §11. Check: structure, catalog types and props, refs, tree
(single reachability, no cycles/reuse), bind type compatibility, action op
fields, ai.run output/into compatibility, $item only in item context,
all limits in §12. Hints must help a small model fix the error (for example,
list valid component names or valid state keys).
Tests: AT-01. Report any place SCHEMA.md was ambiguous. Don't silently
choose; list them for me.
```

**Lane B prompt — store + capabilities (T-30, T-34):**
```
Do T-30 and T-34.
T-30: src/runtime/store.ts per ARCHITECTURE.md §7–8. Tiny store with
useSyncExternalStore, defaults from spec.state, persist !== false saved
debounced 500 ms to AsyncStorage key jackapp:data:<id>, load on open.
Tests for AT-05 logic with mocked AsyncStorage.
T-34: src/capabilities/ — pickImage({source}) with downscale ≤1024px
JPEG 0.8 (expo-image-picker + expo-image-manipulator), share(text) with
Web Share → clipboard fallback, toast(). Platform-split files where needed.
```

---

### P3 — Runtime · Thu 14:00–21:00

**Lane A prompt — action engine (T-31):**
```
Do T-31. src/runtime/actions.ts implementing
every op in docs/SCHEMA.md §7 except ai.run and notify (stub them behind
an injected `services` object: {ai, notify, share, toast, confirm, navigate}).
- Steps run in order; any failure stops the action and calls toast.
- Per-action busy state observable by the UI.
- $item/$index context passed in when triggered from a List item.
- Uses values.ts for all Value resolution.
Tests: AT-03 with fake services.
```

**Lane B prompt — renderer + components + run screen (T-32, T-33, T-35):**
```
Do T-32, T-33, T-35. Codex's catalog schemas (T-24) and action engine
(T-31) must be committed first; check `git log`. If not, start with T-33 visuals.
- src/runtime/Renderer.tsx: render screens[current].root from the flat map,
  per-element error boundary ("this part broke" card), navigation state.
- src/catalog/<Name>/<Name>.tsx for every P0 component per
  docs/COMPONENTS.md: design tokens, light/dark, labels, 44px targets.
  Components get props + callbacks only; no AI or storage imports.
- src/app/run/[id].tsx loads a stored spec, validates, renders. Add a dev
  menu on Home to load H1–H3 fixtures.
Make it look good, not generic: a calm, friendly "lazy Sunday" feel
(soft colours, roomy spacing, rounded cards, one accent colour).
Verify AT-04 on web and on my phone. Include screenshots in your reply.
```

**Exit:** all three hero fixtures render and work on web and Android with the mock `ai.run`.

---

### P4 — Generator · Fri 09:00–14:00

**Lane A prompt — generator pipeline (T-42 → T-46):**
```
Do T-42 to T-46. Follow ARCHITECTURE.md §6.

- catalogPrompt.ts builds a compact catalog section from catalog meta:
  per component: name, one-line hint, props with types/enums/required,
  children yes/no. Plus the op table and Value forms from SCHEMA.md.
  Keep it as short as possible; measure its token-ish length (chars/4).
- prompts.ts: PLAN, FILL, REPAIR system prompts. Each must:
  * say "Output ONLY JSON. No prose, no code fences."
  * say "Use only listed components, ops and props. If the request needs
    something not listed, return {\"unsupported\": …}" (SCHEMA.md §9).
  * include 2 few-shot examples (H1 short, and an unsupported one).
  * prefer FEWER elements: "A great mini-app has 5–15 elements."
- plan.ts, fill.ts, repair.ts, generate.ts with progress events, defensive
  JSON extraction, temperatures (0.4/0.2/0.0), ≤2 repairs, JSON Schema
  passed when provider.caps.jsonSchema.
- Mock provider supports scripted responses. Tests for AT-06.
Don't tune prompts against a real model yet. That's T-61 with eval data.
```

**Lane B prompt — providers UI, ai.run, create screen (T-40, T-41, T-47):**
```
Do T-40, T-41, T-47.
- T-40: provider registry + mock (shared with Lane A's scripted mock),
  settings screen: model choice E2B/E4B, download progress and size,
  delete model, persisted in jackapp:settings. No URL fields; network is
  model downloads only.
- T-41: ai.run op per SCHEMA.md §7 (output → JSON Schema, one retry,
  coercion with defaults, 120 s timeout, abort). Wire it into the
  action engine services.
- T-47: create screen. Prompt box with 3 example chips (the hero prompts),
  staged progress (Planning → Building → Checking → Repairing n),
  live preview using the real Renderer, Save, Try again, and a friendly
  unsupported card showing reason + suggestion + "Build the suggestion".
Verify AT-07 on my phone for at least H1 (I run it; you use mock).
```

---

### P5 — Features · Fri 14:00–21:00

**Lane A prompt — eval runner (T-60):**
```
Do T-60 (Codex part). src/ai/generator/eval.ts is a pure TS runner that
takes any LLMProvider and uses the same generate() pipeline (no React imports; if
anything blocks this, tell me the boundary violation).
- evals/prompts.json: 30 prompts as described in TASKS.md T-60
  (10 hero-like, 15 everyday chores in plain casual English, 5 that
  should be unsupported). Include mustUse/mustOps where obvious.
- Options object: { noPlan, only }, sequential. Returns the results object
  (per-prompt outcome + metrics and targets from docs/TESTING.md §2, top 5
  error codes). Unit-test it with the mock provider.
```

**Lane B prompt — phone eval screen (T-60, Claude Code part):**
```
Do T-60 (screen). Hidden screen src/app/dev/eval.tsx runs
src/ai/generator/eval.ts with the local provider on the phone: model
(E2B/E4B), no-plan toggle, run-one-prompt, live progress, metrics table,
and a Share button for the results JSON. I save it to evals/results/.
```

**Lane B prompt — home, triggers, edit (T-50, T-52, T-51):**
```
Do T-50, then T-52, then T-51.
- T-50: Home = "My apps" grid (emoji icon, name, last used) with rename,
  duplicate, delete (confirm) + "Templates" row (H1–H3) with Remix.
  Empty state that invites a first prompt.
- T-52: triggers per SCHEMA.md §8 via expo-notifications. Schedule on save
  and on app start, cancel on delete, tap opens run/[id]. Web: in-app
  best-effort with a note. Test-mode "once in 2 minutes" for AT-09.
- T-51: edit-by-chat on edit/[id]: send current spec + request to FILL/
  REPAIR; keep state keys whose type didn't change; show a diff summary
  ("added 2 elements, 1 action"). Verify AT-08.
```

**Human (Fri evening onwards):** install the build and use Fridge Snap, Plant Pal, and Bill Splitter for real. Log every use in `docs/LAZY_LOG.md`: date, app, what you did, minutes saved compared to doing it manually, anything that broke.

---

### P6 — Quality & builds · Sat 09:00–21:00

**Lane A prompt — eval-driven fixes (T-61):**
```
I ran the eval on my phone (with and without the plan stage); results are in evals/results/. Do T-61: from the results,
find the top 3 failure modes (by error code and by prompt). For each:
hypothesis → change (prompt wording, few-shot example, validator hint,
or catalog hint) → re-run only the affected prompts → full re-run at the end.
Keep every results file. Write a before/after table in PROGRESS.md
(Write-up evidence). Don't loosen the validator to raise the score.
```

**Lane A prompt — security pass (T-62):**
```
Do T-62. Implement src/__tests__/security.test.ts per docs/TESTING.md
AT-12. Then audit: every entry point that produces a spec (generate, load,
import, edit) calls validate() before use; templates render plain text;
fetch() is only used for model downloads.
Report findings as path:line — issue — fix, then fix them.
```

**Lane B prompt — web deploy + APK (T-63, T-64):**
```
Do T-63 and T-64.
- T-63: `npx expo export -p web`, PWA manifest + icons (sloth-friendly
  JackApp icon: simple, original), deploy to <host: e.g. static hosting on
  the .tech domain>. Verify installable PWA on Android Chrome (AT-13).
- T-64: eas.json `preview` profile with android.buildType "apk",
  build it, and tell me the steps to attach it to a GitHub release
  named v0.1.0-hf26.
Note any manual steps I must do (accounts, DNS) as a checklist.
```

**Lane B prompt — polish (T-65, plus T-53–T-55 if time):**
```
Polish pass (T-65): walk through each screen on web and phone at 130%
font scale, dark mode, and slow model. Fix layout breaks, missing labels,
contrast, loading states, and confusing copy. Make the empty states and
the unsupported card charming (sloth theme, gentle humour, short text).
Then, only if all P0 tasks are ticked: T-53, T-54, T-55 in that order.
```

---

### P7 — Ship story · Sun 12:00–23:00 (feature freeze at 12:00)

Writing quality is weighted most heavily. Agents **gather facts and draft structure**; you write the final words in your own voice.

**Prompt — facts sheet (either agent):**
```
Create docs/WRITEUP_FACTS.md for the DEV post. Pull only verifiable facts
from the repo: eval tables (latest + before/after T-61), spike metrics,
model ids and sizes, offline results, number of components/ops, lines of
code per area (cloc or wc), dependencies list, ADR summaries in one line
each, and LAZY_LOG totals. For each fact, give its source file. No
marketing language.
```

**Prompt — post outline (either agent):**
```
Using docs/WRITEUP_FACTS.md and docs/PRD.md, outline the DEV post using the
challenge template sections: What I Built, Demo, Code, How I Built It,
Why Does Open Innovation Matter?, My Agent Session, The Lazy Payoff,
Prize Categories. For each section: 3–5 bullet points of what to say and
which fact or screenshot backs it. Suggest a title (3 options) and an
opening hook about apps that are "too niche for anyone to build". Flag any
claim that the facts don't support.
```

**Prompt — demo video script (either agent):**
```
Write a ≤ 3-minute demo script with timestamps:
0:00 hook (the niche-chore problem) → build Fridge Snap from a prompt
(real generation, sped up) → use it with a real fridge photo →
Plant Pal reminder → Bill Splitter → graceful refusal (physics sim) →
airplane mode proof (if local works) → eval numbers on screen → close.
Include on-screen text for each shot and what to record on phone vs desktop.
```

**Prompt — final README (Lane B, T-72):**
```
Do T-72. README: one-paragraph pitch, GIF, live web link, APK link,
how it works (diagram from ARCHITECTURE.md), run locally (web, Android dev build), models used and why, eval results table, privacy statement,
Credits (every library and model with license), "Post-deadline changes"
(empty unless there are any), and the challenge note.
```

**Human:** record the video, write the post in your own words from the outline, add screenshots, and list only partner categories you truly used.

---

### Publish · Mon 09:00–11:00 (hard stop 12:29)

```
Final check before I publish. Verify in this order and report pass/fail:
1. main is green (npm run check); tag it: git tag v0.1.0-hf26.
2. Web URL loads in a fresh browser profile; APK link downloads.
3. README links work; eval results file referenced exists.
4. No commits after the deadline, or they're listed in README
   "Post-deadline changes".
5. docs/TESTING.md §5 checklist status.
```

Then publish on DEV with tags `devchallenge` and `hf26challenge`, open the post in a logged-out window, and check that the embeds render.

---

## 4. Prompting tips that improve agent output here

- **Point at the contract.** "Implement docs/SCHEMA.md §7 exactly" beats describing the feature again.
- **Ask for the plan first** on anything over about 30 minutes, then say "go".
- **One task per session.** Fresh context stays sharper; `PROGRESS.md` carries memory.
- **Ask for evidence.** "Paste the test output", "include a screenshot", "show the eval table".
- **Ban silent choices.** "If the docs are ambiguous, list it and ask" prevents contract drift.
- **Cross-review every prompt.** Codex reviews Claude Code's commits and the other way round.
- **Save sessions** you're proud of for the post (the optional "My Agent Session" section).
