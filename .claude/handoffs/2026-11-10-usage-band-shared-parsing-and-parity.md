---
status: open
area: usage-band
date: 2026-11-10
target: skills
origin_plan: .claude/plans/2026-11-10-usage-band-models-card.md (task Z1, simplify review)
plan:
---

# Handoff: usage-band shared transcript parsing, one limits poller, scoped price parity

## Context

The Models card (0.5.0) added a second transcript scan beside the session scan. The simplify review found four debts. Each is real but changes working code, so it waits for its own plan.

## Problem

- `hooks/models.ts` (`MODELS_AWK`) and `hooks/scan.ts` (`SCAN_AWK`) each parse one message's usage line: `num()`, the `msg_` id regex, the last `"usage":{` walk, the timestamp loop. The prefix window already differs (400 and 800 chars). `scan.ts` skips `isSidechain` lines; `models.ts` counts them. A fix in one parser does not reach the other, and the Tokens card and Models card can disagree for one session.
- `MODELS_SH` repeats the shell steps of `SCAN_SH`: complete-last-line check, `dd` seek, shrunk-file restart.
- Limits polling runs in every session process every 60 s (`register.tsx` `pollLimits`). Its guards are per process. N open sessions make N calls a minute to an undocumented endpoint for one shared `limits.json`.
- The price parity check (`sessionParity`) compares the ledger for this session id (all time) with the engine's session cost (which may restart on resume, and may or may not include subagents). A resumed session can show "Prices may be stale" with correct prices.
- Speed, measured on this machine: `MODELS_SH` pushes every byte through macOS awk (about 32 MB/s) and 82 % of the bytes are lines it drops at once. A `grep -F` for assistant lines before awk cut one sample from 56.9 s to 10.4 s. The offset then comes from the file size in the `@@F` header, and a file whose last line is unfinished keeps the unfiltered path.
- Each scan reads the 13 MB ledger three times (scan, query, session sums) and rewrites it. Folding the period and session sums into `MODELS_AWK`'s END step, and an append-only ledger, remove that. The scan after each turn costs about 2 s today.
- The 5 minute timer in every open session spawns a scan and a query even when nothing changed; the lock holder's result is not shared.
- The engine exposes no per-model cost or price: a grep of its types finds none. The hand-kept `hooks/prices.ts` stays until it does.

## Contract

- One shared awk fragment (for example `USAGE_AWK`) holds the usage-line parsing; `SCAN_AWK` and `MODELS_AWK` both prepend it. A bench case proves both read the same fixture line to the same numbers.
- One shared sh fragment for the file-reading steps, prepended to both scripts.
- Limits poll: skip the fetch when `limits.json` is younger than the poll period; store the poll time in the file so all sessions share it.
- Parity: compare within one scope (this process's own turns: the per-turn cost delta against the ledger rows of that turn), and only from a scan that finished after the turn ended.
- A handoff to the engine side asking for per-model cost in `$.session.usage()`, if it is wanted.

## Acceptance

- [ ] `bench/parity.mjs` and `bench/models.mjs` both pass with the shared fragments
- [ ] two sessions started together make one limits request per period
- [ ] a first scan of 4.8 GB takes under 60 s
- [ ] a resumed session with correct prices shows no stale-price note
