# JackApp — Progress & Handoff

**Every agent reads this first and updates it last.** Keep it short. Older Done-log entries can be trimmed to one line each.

---

## Status

| | |
|---|---|
| Phase | M0 — Setup (T-01..03, T-05 done; T-04 CI open) |
| Last updated | 2026-10-22 by Claude Code |
| `main` health | `npm run check` green |
| Time left | Deadline Mon Oct 26, 12:29 PM IST · target ship Sun Oct 25 evening |

## Active work

| Agent | Task | Started (IST) | Notes |
|---|---|---|---|
| — | — | — | — |

## Handoff note (latest)

> **ADR-012 (2026-10-22): no server model, no model on the 4 GB dev laptop.** Providers are `mock` | `local` only. Native = llama.rn (T-10, ported from the human's earlier app; absorbs T-12). Web = Transformers.js + WebGPU (T-11); if it fails the web build says to use the Android app. Eval runs on the phone: Codex `src/ai/generator/eval.ts` + `evals/prompts.json`, Claude Code `src/app/dev/eval.tsx`. Agents use mock only; the human tests on the phone. Needs from human: path/repo of the earlier llama.rn app to port (T-10), and its credit line for README.
>
> Expo SDK 58 app scaffolded (router in `src/app`, `@/` alias, jest-expo, zod installed, skeleton stubs per ARCHITECTURE §3). RNTL 14: `render` is async (`await render(...)`). TS 6: no `baseUrl`; `types: [jest,node]` set. Codex can start `src/spec`. Next: T-04 CI, then the M1 spikes (T-10, T-11) in parallel (see ROADMAP lanes). Everyone commits on `main` (AGENTS.md §8). Answer the open questions below before T-10/T-11.

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
| 2026-10-22 | Claude Code | docs (ADR-012) | llama.rn only, phone-side eval; removed the eval script, `scripts/eval.ts` and the server-provider stub; T-10 rewritten, T-12 merged | see git log |
| 2026-10-22 | Claude Code | T-01,T-02,T-03,T-05 | Expo SDK 58 app, scripts, skeleton, README | see git log |
| 2026-10-20 | human + Claude | docs | Project docs created | — |

## Write-up evidence (collect as you go)

- Eval numbers: `____`
- Funny or impressive model outputs (screenshots in `docs/media/`): `____`
- Moments where open/local clearly beat a closed API: `____`
- Lazy Payoff entries: see `docs/LAZY_LOG.md`
