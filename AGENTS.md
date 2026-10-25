# AGENTS.md — Rules for every coding agent (Claude Code, Codex, others)

JackApp: describe a mini-app in plain language → an open model (Gemma 4 via OpenRouter) builds a **JSON spec** from pre-built components → the app renders it. Expo app for web + Android. Mini-apps and data stay on the device. Deadline: **Mon Oct 26, 2026, 12:29 PM IST** (Oct 25, 11:59 PM PDT).

## 1. Read before you work

Every session, read in this order:
1. `docs/PROGRESS.md`: current state, active work, handoff notes. **Always.**
2. `docs/TASKS.md`: pick your task here.
3. The docs your task touches:
   - Spec, validator, values → `docs/SCHEMA.md`
   - Components → `docs/COMPONENTS.md`
   - Structure, providers, generator, runtime → `docs/ARCHITECTURE.md`
   - Why something is the way it is → `docs/DECISIONS.md`
   - How to verify → `docs/TESTING.md`
   - Scope questions → `docs/PRD.md`

If the docs contradict each other, stop and ask the human. Don't guess.

## 2. Workflow for every task

Everyone works in **one folder, directly on `main`**. No branches, no worktrees.

1. **Read** `docs/PROGRESS.md` (always) and the docs your task touches (§1).
2. **Plan**: write 3–6 bullets in your reply before coding. List the files you will touch.
3. **Build** the smallest change that fully meets the task's acceptance criteria. Stay inside your own files (§8).
4. **Verify**: run `npm run check`. Run anything else the task lists in `TESTING.md`. Paste the result summary in your reply.
5. **Update docs**: tick the task in `TASKS.md`; update `PROGRESS.md` (Done log + Handoff note); update any doc whose contract changed.
6. **Commit on `main`**, staging only the files you changed (§8): `git add <paths> && git commit -m "feat(spec): add validator semantic checks [T-21]"`.
7. **Stop** and report: what changed, how it was verified, what's next, any risk.

A prompt may contain several tasks. Do them in the order given, one commit per task. If a task grows beyond about 2 hours, split it in `TASKS.md` and say so.

## 3. Commands

| Command | Does |
|---|---|
| `npm run web` | Dev server, web |
| `npm run android` | Dev build on device/emulator (native modules need this, not Expo Go) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint` |
| `npm test` | Jest (`jest-expo`), uses the mock provider |
| `npm run check` | typecheck + lint + test. **Must pass before every commit** |

## 4. Hard rules (never break)

1. **Specs are data, never code.** No `eval`, `new Function`, dynamic import of spec content, `dangerouslySetInnerHTML`, or WebView for mini-apps. (ADR-002)
2. **Validate every spec** before rendering or saving it: generated, loaded, or imported.
3. **Respect module boundaries** (`ARCHITECTURE.md` §4): `src/spec` has no React or platform imports; the runtime never imports the generator; catalog components never call AI or storage.
4. **Platform code goes in `.web.ts` / `.native.ts`** behind one interface.
5. **No network** except the AI provider the user picked (on-device, OpenRouter, or the user's own Ollama address) and the one-time on-device model download from huggingface.co. No telemetry. The only user-set URL is the Ollama address. Never log or commit the API key. (ADR-021, ADR-022)
6. **No new dependency** without a `DECISIONS.md` line saying why. Prefer what Expo already ships.
7. **Contract changes** (`SCHEMA.md`, `COMPONENTS.md`) update code, tests, and docs in the same commit, plus a `DECISIONS.md` entry.
8. **TypeScript strict.** No `any` except at JSON parse boundaries, where data immediately goes through Zod.
9. **Never delete or weaken a test** to make it pass. Fix the code, or explain in the reply and ask.
10. **Never commit secrets, model weights, or large binaries.** Weights are downloaded at runtime.
11. **Don't edit the other agent's files** (§8).
12. **Tests and agents use the mock provider; never hit OpenRouter or Ollama from tests, and never put a real key in the repo.** Real-model checks happen in the app with the human's key. (ADR-021)

## 5. Code conventions

- Path alias `@/` → `src/`.
- Components: function components, named exports, one per file.
- Tap targets use `Tap` from `@/ui/Tap`, not a bare `Pressable` (ripple on Android, dim elsewhere; ADR-048).
- Errors shown to users are short and friendly. Errors in logs are detailed.
- A comment explains *why*, never *what*. A known limitation gets `// shortcut: <limit>, <when to fix>`.
- Accessibility: every input has a label, touch targets ≥ 44 px, and screens work with system font scaling.
- Keep files under about 300 lines. Split when they grow.

## 6. Definition of done

- Acceptance criteria in `TASKS.md` met.
- `npm run check` passes. New logic has tests (validator rules, value resolution, action ops, generator parsing).
- Works on **web**. Works on **Android** if the task touches native code or capabilities (say so if you couldn't test on a device).
- Docs updated (`TASKS.md`, `PROGRESS.md`, and any contract doc).

## 7. When you're stuck

- After 2 failed attempts at the same error, stop. Write what you tried in `PROGRESS.md` → Blockers and ask the human.
- Missing information (hardware, model ids, accounts) → ask. Don't invent values.
- An inference runtime won't work → keep building on the `mock` provider, log it in `PROGRESS.md` → Blockers, and ask the human to test on the phone. Don't burn hours.

## 8. Multi-agent coordination (two agents, one folder, one branch)

Claude Code and Codex may run at the same time in the same folder. These rules keep them from breaking each other's work:

**Who owns which files**

| Codex owns | Claude Code owns |
|---|---|
| `src/spec/**` | `package.json`, lockfile, `app.json`, `eas.json`, configs |
| `src/ai/generator/**` | `src/app/**`, `src/ui/**` |
| `src/runtime/actions.ts` (+ its tests) | `src/runtime/` everything else |
| `src/catalog/*/props.ts`, `src/catalog/*/meta.ts`, `src/catalog/index.ts` | `src/catalog/*/*.tsx` |
| `src/ai/generator/eval.ts`, `evals/**` | `src/ai/provider.ts`, `src/ai/providers/**` |
| `src/__tests__/security.test.ts` | `src/capabilities/**`, `src/storage/**`, `README.md` |

Both may edit `docs/TASKS.md` and `docs/PROGRESS.md`. Re-read the file right before editing it, and change only your own lines. Anything not in the table: ask the human first.

**Git rules**

- Stage only your own files: `git add <paths>`. **Never** `git add -A`, `git add .`, or `git commit -a`. Those commit the other agent's half-done work.
- **Never** run `git stash`, `git reset`, `git checkout -- <file>`, `git restore`, `git clean`, `git rebase`, or switch branches. Those destroy the other agent's uncommitted work.
- Only Claude Code adds dependencies. If Codex needs one, it writes the request in `PROGRESS.md` → Blockers.
- If `npm run check` fails **only** in the other agent's files, don't fix them. Commit your work and say so in your report.

**Review**

- After a prompt is done, the human asks the **other** agent to review that agent's last commits (ROADMAP §2 "Review").
- Handoff notes in `PROGRESS.md` must let a fresh agent continue without reading chat history.

## 9. Challenge rules that affect code

- The repo must be built within **Oct 19–25, 2026**. Commits after the deadline must be listed in the README under "Post-deadline changes".
- Credit any non-trivial reused open-source code in `README.md` → Credits.
