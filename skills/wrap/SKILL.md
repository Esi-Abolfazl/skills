---
name: wrap
description: "Session wrap-up: sweep leftovers, review the diff and apply the findings, retire debt, sync docs, verify green, regroup work-branch commits, draft a short commit message, report what needs you. Arguments: commit (c) / squash (s); --p pushes after either; s --f regroups the whole branch."
argument-hint: "[c|commit [--p]] [s|squash [--p|--f]]"
---

# Wrap the session

Close out the session so the repo is clean, verified, and ready to commit. Work the steps in order; each ends on its criterion.

## Arguments

`/wrap $ARGUMENTS` — bare words, any order; `--p` only after `c` or `s`, `--f` only after `s`; `--p` implies `c`. Bare `/wrap` = steps 1–9, step 7 only when its trigger fires (local scope), step 8 draft-only.

The model picks the arguments from what the user asked — "commit" → `c`, "push" → `--p`, "squash"/"regroup" → `s` — and runs the skill itself. Never tell the user to type `/wrap …`, and never ask permission for a plain commit or fast-forward push; the one confirmation in this skill is the `--f` force push.

- `commit` / `c` — step 8 commits (explicit paths). Unpushed commits are reported under Needs you, not asked about.
- `--p` — after step 8's commit(s), push: `git push <remote> <branch>`, fast-forward only, never bare `--force`. With `s`, the regrouped commits are what gets pushed (local scope, so always a fast-forward). Remote = the upstream's (`git rev-parse --abbrev-ref @{u}` → `<remote>/<branch>`); no upstream → `-u` to the sole remote, ask if several. Remote rejects → stop and report; never force.
- `squash` / `s` — step 7 runs regardless of the pattern check; local scope.
- `s --f` — step 7 covers the whole branch since its merge-base with the default branch, pushed commits included, then pushes with `--force-with-lease` (`--p` is redundant here). Asks once before the reset. Only for branches nobody else has open work or reviews on.

## 1. Sweep

Review everything the session touched: `git status`, then the full diff (staged, unstaged, untracked). Remove scratch files, debug output, commented-out code, and stubs. Every leftover is either deleted or promoted to real, named work.

Also sweep the runtime: kill any process, container, or simulator session **this session spawned** and no longer needs. Leave the user's own long-running processes (their dev servers, their simulator) untouched — name them in the report's Needs-you/heads-up instead.

Done when every modified and untracked file is accounted for (kept on purpose or gone) and no agent-spawned process is left running unreported.

## 2. Review

Refs (step 7 reuses them):
- `UP=$(git rev-parse --abbrev-ref @{u} 2>/dev/null)` (`<remote>/<branch>`); `R=${UP%%/*}`, or the sole remote when no upstream — never assume `origin`.
- `DEF=$(git symbolic-ref --short refs/remotes/$R/HEAD 2>/dev/null)`, strip `$R/`, fall back to `main` — never hardcode.
- `REMOTE=$(git rev-parse @{u} 2>/dev/null)`; `BASE=$(git merge-base HEAD $DEF)`; `SCOPE` = whichever of `$REMOTE`/`$BASE` is nearer HEAD (`$BASE` when no upstream or `$REMOTE` is not an ancestor of HEAD; `--f` → `$BASE`).
- `TREE=$(GIT_INDEX_FILE=$(mktemp -u) sh -c 'git read-tree HEAD && git add -A && git write-tree; rm -f "$GIT_INDEX_FILE"')` — a tree object of the working tree, untracked included, ignored excluded; the real index and tree stay untouched. It is exactly what wrap will commit, so it is what gets reviewed.

`git diff --quiet $SCOPE $TREE` → nothing to review, skip. Otherwise run the `reviewing-changes` skill (Skill tool) with base `$SCOPE` and head `$TREE`. `$TREE` is not a commit, so two-argument forms only: `git diff $SCOPE $TREE`, `git grep … $TREE --`, `python3 <skill dir>/sweep.py $SCOPE $TREE`; the commit list is `git log --oneline $SCOPE..HEAD`. Claims = what the session set out to do plus every commit message in that range. Skill not installed → say so under Needs you and continue.

The review names, wrap fixes — apply the findings instead of reporting them:
- BLOCK / HIGH: fix now; nothing commits while one stands.
- MED / LOW and every sweep row with an `existing:` hit: fix (reference the existing constant, helper, bulk call, doc) unless the fix outgrows the session's change → carry it into step 3 as declared debt.
- Re-run the review after fixing (fresh `$TREE`); after two passes, report what remains instead of a third.

Done when the verdict is MERGE, or MERGE WITH DECLARED DEBT with every item carried into step 3.

## 3. Retire debt

Ship correct-by-design code. The review's Declared-debt rows and undeclared-debt findings are the input. A shortcut that must stay is declared: name it, its ceiling, and the follow-up that retires it, both in the final report and wherever the project tracks work.

Done when the diff holds no shortcut the report leaves unnamed.

## 4. Let the code speak

The code is the source of truth. A comment survives only when it states what code cannot: an external-system fact or a cross-module invariant. Prefer a rename, a named constant, or an assertion; delete narration of what the next line does or why the change is right.

Done when every comment in the diff passes that test.

## 5. Sync the docs

Update the docs the change made stale (README, ADRs, project guides), starting from the review's doc hits. Details of the change belong here, not in the commit message.

Done when every behavior change is reflected in docs, or the report says why none apply.

## 6. Go green

Run the project's own gates: tests, typecheck, lint, whatever the repo defines. Fix what fails.

Done when the gates pass and the report quotes the commands run.

## 7. Squash (careful)

Trigger: bare wrap with local per-task commits that don't match the default branch's pattern (read its `git log` for the last comparable body of work), or `s`. Never the default branch or a detached HEAD.

Pre-checks (refs from step 2):
- `$REMOTE` set but not an ancestor of HEAD → stop; sync first.
- `git rev-list --merges $BASE..HEAD` non-empty → stop; a soft reset flattens merges silently.

Scope: `$SCOPE` from step 2. `--f` = `$BASE`, after ONE AskUserQuestion — proceed with force push / local-only instead / stop; auto-continues with no answer → stop, never force push without an explicit choice. Nothing committed above scope → skip.

A soft reset regroups at file granularity — true per-concern commits come from committing per concern during the session; wrap only tidies.

Method (no interactive rebase):
1. Park uncommitted wrap edits: with `c` run step 8 now (they join the regroup); else `git stash push` (tracked only — untracked files don't affect a soft reset and may be large tool output), pop after 5, also on abort.
2. `OLD=$(git rev-parse HEAD)`; `git reset --soft <scope> && git reset`.
3. One `git add <explicit paths>` + commit per concern, mirroring the default branch's grouping and order, dependencies first (schema → api → ui → e2e/docs) so the branch bisects. Each commit is one united change that stands alone and typechecks — merge a group that can't into the one it needs; never squash merely for fewer commits. Files that don't partition without hunk splits → ask: merge groups / keep separate / stop. Each `git commit` is its own Bash call, never the tail of a chain, so the commit gate's "rerun the exact command" replays only the commit.
4. Messages per step 8.
5. `git diff --quiet $OLD HEAD` must pass, else `git reset --hard $OLD`, report, stop.
6. `--f` only: verify each intermediate commit — `git checkout <sha> && <typecheck command>` per commit, then `git checkout <branch>`; a failure → merge that group into the one it needs and redo from 2, or `git reset --hard $OLD` and stop. Then, with upstream: `git push --force-with-lease=<branch>:$REMOTE $R <branch>`. Rejected → stop; never `--force`.

Mechanics of this step and the step 2 refs/`$TREE` snapshot are exercised by `tests/dry-run.sh` (throwaway repo, bare remote, both scopes, every guard); run it after editing this step. `tests/gate.sh` exercises the commit-gate hook; run it after editing the hook.

Report: old hashes gone; `git reset --hard <OLD>` (print the hash) undoes the regroup until garbage collection; whether intermediate commits were typecheck-verified (local runs: ordered for bisectability, unverified unless you ran them). After `--f`: other checkouts recover with `git fetch && git reset --hard $R/<branch>`. Plain `s` with pushed commits above `$BASE`: mention `s --f` can regroup those too.

## 8. Commit message

For changes still uncommitted after step 7 (with `c` after a squash, step 8 already ran inside it). Readable by humans and LLMs: `type(scope): subject` ≤ 72 chars; body a few lines — what changed and why, pointing to the docs from step 5; one united change per commit, split when changes span concerns; match recent `git log` style. Draft only; with `c`, commit with explicit paths, then push if `--p`. The commit runs as its own Bash call for the same reason.

## 9. Report

End with two sections:

- **Landed**: one line per meaningful change, the review verdict, the gate results, the commits made or the message draft.
- **Needs you**: anything only the user can decide or do (migrations, env vars, manual settings, debt follow-ups from step 3). "Nothing" is a valid answer.

End every wrap with this help block:

```
/wrap            sweep · review · docs · gates · draft only
/wrap c|commit   + commit
/wrap c --p      + commit and fast-forward push
/wrap s|squash   regroup local commits by concern
/wrap s --p      regroup, commit, fast-forward push
/wrap s --f      whole branch, then --force-with-lease (asks first)
```
