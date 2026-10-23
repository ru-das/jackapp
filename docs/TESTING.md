# JackApp — Testing & Acceptance

Three layers:
1. **Automated** (`npm run check`, every commit): unit and component tests with the mock provider.
2. **Eval on the phone** (hidden `dev/eval` screen): real model quality, run on demand on the human's Android phone. Never on the dev laptop (ADR-012).
3. **Manual acceptance** (this file): device and end-to-end checks before milestones and before shipping.

---

## 1. Automated tests

| Area | Location | What to cover |
|---|---|---|
| Spec schema + validator | `src/spec/__tests__/validate.test.ts` | All valid fixtures pass; each invalid fixture yields its expected `code` and `path` |
| Values | `src/spec/__tests__/values.test.ts` | Table-driven cases for every Value form and formatter |
| Action engine | `src/runtime/__tests__/actions.test.ts` | Each op; `confirm` abort; error stops the action; `ai.run` with mock |
| Renderer + components | `src/runtime/__tests__/render.test.tsx` | H1–H3 fixtures render; input binding; checkbox; delete; navigate |
| Generator | `src/ai/generator/__tests__/*.test.ts` | JSON extraction from messy output; repair loop with scripted mock responses; unsupported path |
| Catalog docs sync | `src/catalog/__tests__/docs-sync.test.ts` | Registry names match P0 `### <Name>` headings in `docs/COMPONENTS.md` in both directions (P1 joins in T-55) |
| Security | `src/__tests__/security.test.ts` | Forbidden API scan over `src/`; HTML strings render as plain text |

Rules:
- Tests never hit the network or a real model. Use `mock`.
- The mock supports **scripted responses** (an array returned in order) so repair loops can be tested.
- A bug fix comes with a test that failed before the fix.

## 2. Eval on the phone

Runner: `src/ai/generator/eval.ts` (pure TS, any provider, unit-tested with `mock`). The hidden screen `src/app/dev/eval.tsx` runs it with the local provider, with options for the model (E2B/E4B), no-plan, and a single prompt id, then shares the results JSON.

- Input: `evals/prompts.json`

```json
[{ "id": "e01", "prompt": "Grocery list from a fridge photo", "expect": "spec",
   "mustUse": ["ImageInput", "List"], "mustOps": ["ai.run"] },
 { "id": "e28", "prompt": "Build me a 3D racing game", "expect": "unsupported" }]
```

- Output: results JSON (shared from the phone; the human commits it as `evals/results/<ISO-timestamp>.json`) plus an on-screen table.

| Metric | Target |
|---|---|
| Valid on first FILL | ≥ 50% |
| Valid after ≤ 2 repairs | **≥ 80%** |
| `mustUse` / `mustOps` satisfied (of valid) | ≥ 80% |
| Unsupported correctly refused | ≥ 4 of 5 |
| False refusals (expected spec, got unsupported) | ≤ 2 of 25 |
| Median generation time (mid-range Android phone) | ≤ 90 s |

Run it with and without the plan stage and keep both result files. The comparison goes in the write-up.

## 3. Acceptance tests

Format: **Given / When / Then**. Platforms: **W** = web (Chrome desktop + Android Chrome), **A** = Android APK/dev build.

### AT-01 Validator (auto)
Given the H1–H3 fixtures and the invalid fixtures, when validated, then valid ones return `[]` and each invalid one returns its expected error code at the expected path.

### AT-02 Value resolution (auto)
Given state `{items:[{name:"Milk",price:40,done:false},{name:"Eggs",price:60,done:true}], people:2}`, then:
- `"{{items|count}} items"` → `"2 items"`
- `$agg sum price` → `100`
- `$agg count where done=false` → `1`
- `$math ["/", sum, people]` → `50`
- division by zero → `0` plus a warning

### AT-03 Actions (auto)
Each op changes state as specified. `confirm` answered "No" stops later steps. A failing step stops the action and shows a toast. `ai.run` with the mock fills `items`, applying `defaults`.

### AT-04 Render & interact (auto + W + A)
Given the H1 fixture, when the user types a note, ticks an item, and deletes an item, then state updates and the UI reflects it with no warnings in the console.

### AT-05 Persistence (W + A)
Given a mini-app with data, when the app is reloaded or killed and reopened, then data is restored. Keys with `persist:false` are reset.

### AT-06 Generator with mock (auto)
- A scripted mock returning a bad spec then a good one → valid after 1 repair.
- A mock that is always bad → `failed` after 2 repairs, with a friendly UI message.
- A plan with `unsupported` → the unsupported UI shows `reason` and `suggestion`.

### AT-07 Real generation (A, on the phone; W if WebGPU passes)
Given each hero prompt from `PRD.md` §6, when generated, then a valid spec previews within 90 s and the mini-app works end to end: the photo goes through `ai.run` into the list, Plant Pal's trigger is saved, and Bill Splitter's Stat shows a correct split.

### AT-08 Edit-by-chat (W)
Given Fridge Snap with 5 items, when the user says "add a price field and show the total", then the spec updates, the 5 items remain, and a total Stat appears.

### AT-09 Triggers (A)
Given Plant Pal with a `once` trigger 2 minutes ahead (test mode), then the notification fires, and tapping it opens Plant Pal.

### AT-10 Offline (W with WebGPU, A on-device — only for providers that passed the spike)
Given the model is downloaded, when the device is offline, then generation and `ai.run` both still work.

### AT-11 Export / import (W + A)
Exported JSON re-imports as an identical spec. A tampered file (unknown component) is rejected with a readable error.

### AT-12 Security (auto + review)
- `grep -rnE "eval\(|new Function|dangerouslySetInnerHTML|WebView" src/` returns nothing (except the test itself).
- A spec with `"<b>hi</b><script>"` in a Text value renders literally.
- Only the model source appears in network logs during a full session. There are no URL fields in Settings.

### AT-13 Builds (W + A)
The static web build loads from the hosted URL on a phone and desktop and is installable as a PWA. The APK installs on a clean Android phone and launches with no dev server.

### AT-14 Eval targets
The latest `evals/results/*.json` meets the targets in §2, or the gap is explained in `PROGRESS.md` and the write-up.

### AT-15 Catalog sync (auto)
The docs-sync test compares registry names bidirectionally with P0 headings until T-55 adds P1 components (ADR-014).

### AT-16 Accessibility basics (W + A)
Every input has a label read by TalkBack or the browser's screen reader. Touch targets ≥ 44 px. Layout survives 130% font scale. Contrast is OK in light and dark.

## 4. Device matrix (fill in)

| Device | OS / browser | WebGPU | Local model | Notes |
|---|---|---|---|---|
| Dev laptop (4 GB RAM) | ____ | n/a | none (mock only) | |
| Phone 1 | Android __ / Chrome __ | ____ | ____ | RAM __ GB |

## 5. Pre-submission checklist (Sun night)

- [ ] `npm run check` green on `main`
- [ ] AT-01 to AT-07, AT-11 to AT-13 pass; others pass or are documented
- [ ] Latest eval results committed; numbers copied into the post
- [ ] Web URL and APK link work from an incognito window or another device
- [ ] README: setup, models, credits, post-deadline section
- [ ] Demo video uploaded; the post embeds the video and the repo
- [ ] Challenge tags present; partner categories listed only where truly used

## 6. Eval scoring conventions (T-60)

Run `runEval(provider, model, { noPlan?, only?, onResult? })` after loading the
provider. Corpus order is stable (`e01`–`e30`): 10 hero variants, 15 everyday
chores, 5 unsupported requests. Capture both default and `noPlan: true` runs on
the phone; no real model runs on the dev laptop.

- `firstFillValidity`: successful expected-spec rows without a spec repair / all
  expected-spec rows. PLAN repairs do not disqualify first-FILL success.
- `validWithinTwoRepairs`: all successful expected-spec rows / all expected-spec
  rows, including zero-repair successes.
- `requirementsSatisfied`: successful expected-spec rows containing every
  `mustUse` component and `mustOps` action op / successful expected-spec rows.
  Presence checks are structural, not a behavioral correctness assessment.
  Built-in List checkbox/delete behavior does not require an explicit action op.
- `correctRefusals` and `refusalRecall`: unsupported expectations refused / all
  unsupported expectations. `refusalPrecision` uses all refusals as denominator.
  `falseRefusals`: expected-spec rows refused / all expected-spec rows.
- Ratio metrics include `count`, `denominator`, `rate` (0–1 or `null` for an empty
  denominator). Median latency includes PLAN and all repairs for successful
  expected-spec generations only, averages the middle pair for even samples,
  and is `null` without samples; `latencySamples` reports its sample count.
- `targets` retain the §2 thresholds and a `met` assessment. A filtered run
  (`only`) has all assessments `null`; metrics still report actual observations.
- `topErrors` counts each diagnostic occurrence from every failed attempt,
  including recovered errors and terminal/provider failures. Terminal errors
  are counted from the failed event only, not again from the result. Sort by
  descending count, then alphabetical code, retaining five. Missing requirements
  remain separate from validator diagnostics.

Automated checks in `src/ai/generator/__tests__/eval.test.ts` use mock/scripted
providers to cover sequencing, filtering, both pipeline modes, repair accounting,
refusals, provider failure, requirements, denominators, median, and error ranking.
These checks establish runner correctness, not real-model quality or phone speed.
