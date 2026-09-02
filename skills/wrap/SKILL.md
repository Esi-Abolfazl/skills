---
name: wrap
description: "Session wrap-up: sweep leftovers, retire debt, sync docs, verify green, regroup work-branch commits, draft a short commit message, report what needs you. Arguments: commit (c) / push (p) / squash (s, --f for the whole branch)."
argument-hint: "[c|commit] [p|push] [s|squash [--f]]"
---

# Wrap the session

Close out the session so the repo is clean, verified, and ready to commit. Work the steps in order; each ends on its criterion.

## Arguments

`/wrap $ARGUMENTS` — bare words, any order; `--f` only after `s`; `p` implies `c`. Bare `/wrap` = steps 1–8, step 6 only when its trigger fires (local scope), step 7 draft-only.

The model picks the arguments from what the user asked — "commit" → `c`, "push" → `p`, "squash"/"regroup" → `s` — and runs the skill itself. Never tell the user to type `/wrap …`, and never ask permission for a plain commit or fast-forward push; the one confirmation in this skill is the `--f` force push.

- `commit` / `c` — step 7 commits (explicit paths). Unpushed commits are reported under Needs you, not asked about.
- `push` / `p` — step 7 commits and pushes: `git push <remote> <branch>`, fast-forward only, never bare `--force`. Remote = the upstream's (`git rev-parse --abbrev-ref @{u}` → `<remote>/<branch>`); no upstream → `-u` to the sole remote, ask if several. Remote rejects → stop and report; never force.
- `squash` / `s` — step 6 runs regardless of the pattern check; local scope.
- `s --f` — step 6 covers the whole branch since its merge-base with the default branch, pushed commits included, then pushes with `--force-with-lease`. Asks once before the reset. Only for branches nobody else has open work or reviews on.

## 1. Sweep

Review everything the session touched: `git status`, then the full diff (staged, unstaged, untracked). Remove scratch files, debug output, commented-out code, and stubs. Every leftover is either deleted or promoted to real, named work.

Also sweep the runtime: kill any process, container, or simulator session **this session spawned** and no longer needs. Leave the user's own long-running processes (their dev servers, their simulator) untouched — name them in the report's Needs-you/heads-up instead.

Done when every modified and untracked file is accounted for (kept on purpose or gone) and no agent-spawned process is left running unreported.

## 2. Retire debt

Ship correct-by-design code. A shortcut that must stay is declared: name it, its ceiling, and the follow-up that retires it, both in the final report and wherever the project tracks work.

Done when the diff holds no shortcut the report leaves unnamed.

## 3. Let the code speak

The code is the source of truth. A comment survives only when it states what code cannot: an external-system fact or a cross-module invariant. Prefer a rename, a named constant, or an assertion; delete narration of what the next line does or why the change is right.

Done when every comment in the diff passes that test.

## 4. Sync the docs

Update the docs the change made stale (README, ADRs, project guides). Details of the change belong here, not in the commit message.

Done when every behavior change is reflected in docs, or the report says why none apply.

## 5. Go green

Run the project's own gates: tests, typecheck, lint, whatever the repo defines. Fix what fails.

Done when the gates pass and the report quotes the commands run.

## 6. Squash (careful)

Trigger: bare wrap with local per-task commits that don't match the default branch's pattern (read its `git log` for the last comparable body of work), or `s`. Never the default branch or a detached HEAD.

Pre-checks:
- `UP=$(git rev-parse --abbrev-ref @{u} 2>/dev/null)` (`<remote>/<branch>`); `R=${UP%%/*}`, or the sole remote when no upstream — never assume `origin`.
- `DEF=$(git symbolic-ref --short refs/remotes/$R/HEAD 2>/dev/null)`, strip `$R/`, fall back to `main` — never hardcode.
- `REMOTE=$(git rev-parse @{u} 2>/dev/null)`; `BASE=$(git merge-base HEAD $DEF)`. `$REMOTE` set but not an ancestor of HEAD → stop; sync first.
- `git rev-list --merges $BASE..HEAD` non-empty → stop; a soft reset flattens merges silently.

Scope: default = whichever of `$REMOTE`/`$BASE` is nearer HEAD (`$BASE` when no upstream). `--f` = `$BASE`, after ONE AskUserQuestion — proceed with force push / local-only instead / stop; auto-continues with no answer → stop, never force push without an explicit choice. Nothing committed above scope → skip.

A soft reset regroups at file granularity — true per-concern commits come from committing per concern during the session; wrap only tidies.

Method (no interactive rebase):
1. Park uncommitted wrap edits: with `c`/`p` run step 7 now (they join the regroup); else `git stash push` (tracked only — untracked files don't affect a soft reset and may be large tool output), pop after 5, also on abort.
2. `OLD=$(git rev-parse HEAD)`; `git reset --soft <scope> && git reset`.
3. One `git add <explicit paths>` + commit per concern, mirroring the default branch's grouping and order, dependencies first (schema → api → ui → e2e/docs) so the branch bisects. Each commit is one united change that stands alone and typechecks — merge a group that can't into the one it needs; never squash merely for fewer commits. Files that don't partition without hunk splits → ask: merge groups / keep separate / stop.
4. Messages per step 7.
5. `git diff --quiet $OLD HEAD` must pass, else `git reset --hard $OLD`, report, stop.
6. `--f` only: verify each intermediate commit — `git checkout <sha> && <typecheck command>` per commit, then `git checkout <branch>`; a failure → merge that group into the one it needs and redo from 2, or `git reset --hard $OLD` and stop. Then, with upstream: `git push --force-with-lease=<branch>:$REMOTE $R <branch>`. Rejected → stop; never `--force`.

Mechanics are exercised by `tests/dry-run.sh` (throwaway repo, bare remote, both scopes, every guard); run it after editing this step.

Report: old hashes gone; `git reset --hard <OLD>` (print the hash) undoes the regroup until garbage collection; whether intermediate commits were typecheck-verified (local runs: ordered for bisectability, unverified unless you ran them). After `--f`: other checkouts recover with `git fetch && git reset --hard $R/<branch>`. Plain `s` with pushed commits above `$BASE`: mention `s --f` can regroup those too.

## 7. Commit message

For changes still uncommitted after step 6 (with `c`/`p` after a squash, step 7 already ran inside it). Readable by humans and LLMs: `type(scope): subject` ≤ 72 chars; body a few lines — what changed and why, pointing to the docs from step 4; one united change per commit, split when changes span concerns; match recent `git log` style. Draft only; with `c`/`p`, commit with explicit paths, then push per Arguments.

## 8. Report

End with two sections:

- **Landed**: one line per meaningful change, the gate results, the commits made or the message draft.
- **Needs you**: anything only the user can decide or do (migrations, env vars, manual settings, debt follow-ups from step 2). "Nothing" is a valid answer.

End every wrap with this help block:

```
/wrap            sweep · docs · gates · draft only
/wrap c|commit   + commit
/wrap p|push     + commit and fast-forward push
/wrap s|squash   regroup local commits by concern
/wrap s --f      whole branch, then --force-with-lease (asks first)
```
