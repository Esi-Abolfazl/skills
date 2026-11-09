---
name: wrap
description: "Use when the user asks to wrap up, finish or close out the session, or to commit, push, squash/regroup commits, or merge the branch, and before any git commit or push, which go through wrap. Also use to open a pull or merge request, ship or land the branch. Not for reviewing a pull request someone else opened (that is a code review)."
argument-hint: "[c|commit [--p]] [s|squash [--p|--f]] [m|merge [branch] [--p|--f]] [pr [--m]]"
---

# Wrap the session

Close out the session so the repo is clean, verified, and ready to commit. Work the steps in order; each ends on its criterion.

## Arguments

`/wrap $ARGUMENTS`: bare words, any order (trailing quoted text after `pr` is context for the PR description); `--p` only after `c`, `s` or `m`, `--f` only after `s` or `m`, `--m` only after `pr`; `--p` implies `c`; `pr` implies `c` and its own push (no `--p`); `m` implies `s` (and `c`, so the tree is clean to merge). Bare `/wrap` = steps 1 to 9, step 7 only when its trigger fires (local scope), step 8 draft-only.

**A primary that cannot run revokes its modifiers.** `--p`, `--f` and `--m` are sub-orders of `c`, `s`, `m` or `pr`. When the primary stops for any reason (a guard, a failed pre-check, an AskUserQuestion answered or defaulted to stop), wrap stops and reports: no modifier, and no later one-way step (a push, a PR, a merge), a push above all. A `pr` whose step 6 gates are red, whose branch is the default branch, or whose project says `flow: direct` opens no PR and merges nothing. Pushing after a refused squash spends the locality the squash needed and turns a free local `reset --soft` into a force push.

The model picks the arguments from what the user asked, "commit" → `c`, "push" → `--p`, "squash"/"regroup" → `s`, "merge" → `m`, "ship", "land" or "open a PR" → `pr`, "merge the PR" → `pr --m`, and runs the skill itself. Never tell the user to type `/wrap …`, and never ask permission for a plain commit or fast-forward push. Under an explicit `flow: pr` (step 8b), "merge into the default branch" means `pr --m`, never `m`. "Ship it" before step 6 has run means step 6 runs first. Wrap asks only where it cannot choose for you: which default branch (step 2, when nothing names it), which remote (several, no upstream), how to group files that need hunk splits (step 7), and the `--f` force push.

- `commit` / `c`, step 8 commits (explicit paths). Unpushed commits are reported under Needs you, not asked about.
- `--p`, after step 8's commit(s), push: `git push <remote> <branch>`, fast-forward only, never bare `--force`. With `s`, the regrouped commits are what gets pushed (local scope, so always a fast-forward). Remote = the upstream's (`git rev-parse --abbrev-ref @{u}` → `<remote>/<branch>`); no upstream → `-u` to the sole remote, ask if several. Remote rejects → stop and report; never force. With `m`, the branch pushed is the *target*, after step 7b's merge. Primary stopped → no push (rule above).
- `squash` / `s`, step 7 runs regardless of the pattern check; local scope.
- `s --f`, step 7 covers the whole branch since its merge-base with the default branch, pushed commits included, then pushes with `--force-with-lease`. Adding `--p` changes no push, but it still implies `c`: uncommitted work is committed into the regroup instead of parked. Asks once before the reset. Only for side branches nobody else has open work or reviews on; refused on the default branch (step 7).
- `merge` / `m [target]`, when the Ship section explicitly declares `flow: pr`, `m` with target equal to `$DEF` refuses and points to `pr --m` (the PR is the only path to the default branch); with no section `m` keeps its plain behaviour; `s`, then step 7b merges the branch into `target` (default: `$DEF` from step 2, never a hardcoded `main`) and deletes the local feature branch. Fast-forward when possible, else one merge commit; never squash-merge, the regrouped commits are the history.
- `pr [--m]`: after step 8's commit, step 8b ships the branch through a pull or merge request: sync with the remote default branch, push `-u`, open the PR with the host CLI. `--m` is always required to merge, and the Ship section's `may-merge: no` is a hard refusal it cannot override. Refused when the Ship section says `flow: direct` (use `m`). Never combined with `m` in one run. Settings come from the project's "Ship" section (step 8b); without one, defaults apply and the report says which were assumed.
- `m --f`, `s --f` (whole-branch regroup, the one AskUserQuestion, `--force-with-lease` push), then step 7b. `--p` here pushes `target`.

## 1. Sweep

Review everything the session touched: `git status`, then the full diff (staged, unstaged, untracked). Remove scratch files, debug output, commented-out code, and stubs. Every leftover is either deleted or promoted to real, named work.

Also sweep the runtime: kill any process, container, or simulator session **this session spawned** and no longer needs. Leave the user's own long-running processes (their dev servers, their simulator) untouched, name them in the report's Needs-you/heads-up instead.

Done when every modified and untracked file is accounted for (kept on purpose or gone) and no agent-spawned process is left running unreported.

## 2. Review

Refs (step 7 reuses them):
- `UP=$(git rev-parse --abbrev-ref @{u} 2>/dev/null)` (`<remote>/<branch>`); `R=${UP%%/*}`, or the sole remote when no upstream, never assume `origin`.
- `DEF=$(git symbolic-ref --short refs/remotes/$R/HEAD 2>/dev/null)`, strip `$R/`; empty → the remote's own answer, `git ls-remote --symref $R HEAD` (`ref: refs/heads/<b>`); still empty → the one of `main`/`master` that exists locally; neither or both → stop and ask. Never go on with an empty `DEF`: the empty `$SCOPE` it leads to makes `git diff --quiet $SCOPE $TREE` pass and skips the review in silence.
- `REMOTE=$(git rev-parse @{u} 2>/dev/null)`, else the same-name `refs/remotes/$R/<branch>` when it exists, a push without `-u` is still a push.
- `BASE=$(git merge-base HEAD $DEF $R/$DEF)`, naming only those of the two that exist: the newest commit HEAD shares with either copy of the default branch, so a local `$DEF` behind or ahead of its remote never brings default-branch commits into range. On `$DEF` itself it is HEAD.
- `SCOPE`: `--f` → `$BASE` (off `$DEF` only; step 7 refuses it there). Otherwise the parent of the oldest commit no remote has: `U=$(git rev-list HEAD --not --remotes $DEF | tail -1)` (`$DEF` only off it and when it exists locally), `SCOPE=$U^`, a plain run never reaches a pushed commit, upstream or not, nor, off `$DEF`, a local default-branch commit. `U` empty, or a root commit (no remote has any of it) → HEAD's sha; in the root case step 7 skips, as nothing marks where the unpushed work begins.
- `TREE=$(GIT_INDEX_FILE=$(mktemp -u) sh -c 'git read-tree HEAD && git add -A && git write-tree; rm -f "$GIT_INDEX_FILE"')`, a tree object of the working tree, untracked included, ignored excluded; the real index and tree stay untouched. It is exactly what wrap will commit, so it is what gets reviewed.

`git diff --quiet $SCOPE $TREE` → nothing to review, skip. Otherwise run the `reviewing-changes` skill (Skill tool) with base `$SCOPE` and head `$TREE`. `$TREE` is not a commit, so two-argument forms only: `git diff $SCOPE $TREE`, `git grep … $TREE --`, and the skill's own sweep with `$SCOPE $TREE` as base and head; the commit list is `git log --oneline $SCOPE..HEAD`. Claims = what the session set out to do plus every commit message in that range. Skill not installed → under Needs you, give `npx skills add vanenshi/skills --skill reviewing-changes -g -y` and continue.

The review names, wrap fixes, apply the findings instead of reporting them:
- BLOCK / HIGH: fix now; nothing commits while one stands.
- MED / LOW and every sweep row with an `existing:` hit: fix (reference the existing constant, helper, bulk call, doc) unless the fix outgrows the session's change → carry it into step 3 as declared debt.
- Re-run the review after fixing (fresh `$TREE`); after two passes, report what remains instead of a third.

Done when the verdict is MERGE, or MERGE WITH DECLARED DEBT with every item carried into step 3; or the review was skipped (empty diff, or the skill is missing and noted under Needs you); or two passes ran and what remains is reported. Then continue through step 9, a standing BLOCK/HIGH still blocks every commit (above).

## 3. Retire debt

Ship correct-by-design code. The review's Declared-debt rows and undeclared-debt findings are the input. A shortcut that must stay is declared: name it, its ceiling, and the follow-up that retires it, in the final report, in a code comment at the shortcut (unless the repo bans comments by a gate, e.g. a comments test; then the task item, or the final report when the project tracks no work, carries the file:line), and wherever the project tracks work.

Done when the diff holds no shortcut the report leaves unnamed, and each declared shortcut carries its comment (or, where a gate bans comments, its file:line in the task item or the final report).

## 4. Let the code speak

The code is the source of truth. A comment survives only when it carries what code cannot: an external-system fact, a cross-module invariant, a non-obvious why, or a declared shortcut's ceiling (a `shortcut:` comment, the marker the Ponytail plugin writes, counts). Prefer a rename, a named constant, or an assertion; delete narration of what the next line does or why the change is right. A repo whose own gate bans comments wins over this step.

Done when every comment in the diff passes that test.

## 5. Sync the docs

Update the docs the change made stale (README, ADRs, project guides), starting from the review's doc hits. Doc hits catch only docs that mention a changed name, never an omission: also walk each README covering the change as its reader would (setup, new-machine steps, file or doc index) and add the file, step, dependency or secret it now lacks. Details of the change belong here, not in the commit message.

Done when every behavior change is reflected in docs, or the report says why none apply.

## 6. Go green

Run the project's own gates: tests, typecheck, lint, whatever the repo defines. Fix what fails.

A red gate is compared before anyone fixes it: rerun the same command on a clean copy of the default branch (`git worktree add --detach <tmp> $R/$DEF`, then `git worktree remove --force <tmp>`, as the gate run leaves caches in it; never stash the session's work for this). Red there the same way → it predates the change: leave it unfixed, name it under Needs you, and the commit goes ahead. Green there → the change broke it: fix it.

Done when the gates pass, or every red one is shown red on the default branch too, and the report quotes the commands run.

## 7. Squash (careful)

Trigger: local per-task commits that don't match the default branch's pattern (read its `git log` for the last comparable body of work), on any run; `s` runs it regardless. The guard is pushed commits, not the branch's name: plain `s` stops at `$SCOPE`, touching only commits no remote has seen, so it runs on the default branch too. `--f` reaches through pushed commits, so it is for side branches only (pre-checks).

Pre-checks (refs from step 2):
- Detached HEAD (`git symbolic-ref -q HEAD` fails) → stop.
- `$REMOTE` set but not an ancestor of HEAD → stop; sync first.
- `git rev-list --merges $BASE..HEAD` non-empty → stop; a soft reset flattens merges silently.
- `pr` → its pre-check (step 8b) runs first, before any commit.
- `--f` on `$DEF` → stop; `$BASE` is HEAD there, and the default branch's published history is not `--f`'s to rewrite. Report that plain `s` regroups its unpushed commits.

Scope: `$SCOPE` from step 2. `--f` = `$BASE`, after ONE AskUserQuestion, proceed with force push / local-only instead / stop; auto-continues with no answer → stop, never force push without an explicit choice. With `c` (so also `--p` and `m`), step 8's commit runs now, its push not yet: those commits join the regroup, and 7b finds a clean tree. Then nothing committed above scope → skip.

A soft reset regroups at file granularity, true per-concern commits come from committing per concern during the session; wrap only tidies.

Method (no interactive rebase):
1. Without `c`, park uncommitted wrap edits: `S0=$(git rev-parse -q --verify refs/stash)`, then `git stash push -q` (tracked only, untracked files don't affect a soft reset and may be large tool output). Parked only when `refs/stash` moved off `$S0`: a clean tree stashes nothing, and a blind pop would apply the user's own stash. Pop only what was parked, after method step 6 (after any `--f` verify and push), also on abort, method step 6's checkouts need a clean tree, and its `reset --hard $OLD` would wipe popped edits.
2. `OLD=$(git rev-parse HEAD)`; `git reset --soft <scope> && git reset`.
3. One `git add <explicit paths>` + commit per concern, mirroring the default branch's grouping and order, dependencies first (schema → api → ui → e2e/docs) so the branch bisects. Each commit is one united change that stands alone and typechecks, merge a group that can't into the one it needs; never squash merely for fewer commits. Files that don't partition without hunk splits → ask: merge groups / keep separate / stop. Each `git commit` is its own Bash call, never the tail of a chain, so the commit gate's "rerun the exact command" replays only the commit.
4. Messages per step 8.
5. `git diff --quiet $OLD HEAD` must pass, else `git reset --hard $OLD`, report, stop.
6. `--f` only: verify each intermediate commit, `git checkout <sha> && <typecheck command>` per commit, then `git checkout <branch>`; a failure → merge that group into the one it needs and redo from 2, or `git reset --hard $OLD` and stop. Then, with `$REMOTE` set: `git push --force-with-lease=<branch>:$REMOTE $R <branch>`. Rejected → stop; never `--force`.

Mechanics of this step and the step 2 refs/`$TREE` snapshot are exercised by `tests/dry-run.sh` (throwaway repo, bare remote, both scopes, every guard); run it after editing step 2's refs, this step or 7b. Its replay is a copy: a parity FAIL names a command reworded here, whose replay helper changes with it. `tests/gate.sh` exercises the commit-gate hook; run it after editing the hook.

Report: old hashes gone; `git reset --hard <OLD>` (print the hash) undoes the regroup until garbage collection; whether intermediate commits were typecheck-verified (local runs: ordered for bisectability, unverified unless you ran them). After `--f`: other checkouts recover with `git fetch && git reset --hard $R/<branch>`. Plain `s` with pushed commits above `$BASE`: mention `s --f` can regroup those too.

## 7b. Merge (`m` only)

Runs after step 7's parity check (`git diff --quiet $OLD HEAD`) and after any `--f` push. `target` = the argument, else `$DEF`.

Pre-checks, any failure → stop, report, nothing merged:
- The Ship section explicitly declares `flow: pr` and `target` equals `$DEF` → refuse and point to `pr --m` (the PR is the only path to the default branch). With no Ship section, or a non-default `target`, this check does not apply.
- `target` is checked out in another worktree (`git worktree list`) → run the merge there: `git -C <that checkout> merge --ff-only <branch>`.
- Current branch is not `target`; `target` exists locally (`git rev-parse --verify refs/heads/<target>`).
- `TU=$(git rev-parse --abbrev-ref <target>@{u} 2>/dev/null)`; when set: `git fetch ${TU%%/*}` and `git merge-base --is-ancestor <target> $TU`, `target` at or behind its upstream, else stop (local-only commits on `target` are not wrap's to merge over).
- `git status --porcelain --untracked-files=no` empty, wrap edits are committed by now; untracked wrap output is fine.

Method:
1. `FEATURE=$(git rev-parse --abbrev-ref HEAD)`; `FEATURE_UP=$(git rev-parse --abbrev-ref $FEATURE@{u} 2>/dev/null)` (recorded now: deleting the branch drops its upstream config, and the report needs it); `git checkout <target>`; with upstream `git merge --ff-only @{u}` (sync first); `TARGET_OLD=$(git rev-parse HEAD)`.
2. `git merge --ff-only $FEATURE`, else `git merge --no-ff --no-edit $FEATURE`. Never squash-merge. Under `flow: direct` only the `--ff-only` form runs: when it fails, stop and say to rebase the feature onto target and rerun step 6; never a merge commit.
3. Step 6's gate commands on the merged result. Failure → `git reset --hard $TARGET_OLD && git checkout $FEATURE`, report, stop. Nothing is deleted or pushed.
4. `FEATURE_SHA=$(git rev-parse $FEATURE)`; `git merge-base --is-ancestor $FEATURE HEAD && git branch -D $FEATURE`, the check is the real question, is it in `target`; `-d` asks the feature's upstream instead and refuses a pushed branch with local commits. Check fails → stop, report. Stay on `target`. `--p` → push `target` per the `--p` rules (fast-forward only).

`tests/dry-run.sh` exercises this step too (ff merge, merge commit, gate-failure rollback, `m` with only uncommitted work, a pushed feature).

Report: target and merge kind (fast-forward or merge commit); `git reset --hard <TARGET_OLD>` (print the hash) undoes the merge; `git branch <FEATURE> <FEATURE_SHA>` restores the deleted branch until garbage collection; whether `target` was pushed. `FEATURE_UP` set → the remote feature branch still exists, stale unless `--f` pushed it, deleting it is the user's call (Needs you).

## 8. Commit message

For changes still uncommitted after step 7 (with `c`, the commit already ran at step 7's scope check whenever step 7 ran; the push is still this step's). Readable by humans and LLMs: `type(scope): subject` ≤ 72 chars; body a few lines, what changed and why, pointing to the docs from step 5; one united change per commit, split when changes span concerns; match recent `git log` style. Draft only; with `c`, commit with explicit paths: `git add <paths>`, then `git commit -m` (index only). Never pass paths to `git commit` (`git commit [--] <paths>`): it commits those files' working-tree state, so a hunk held out of the index ships anyway; then push if `--p` and the primary did not stop (Arguments). The commit runs as its own Bash call for the same reason. Staging is session-aware: stage exactly the files this session edited, by name; a file in `git status` you did not touch is inspected fully (`git diff --stat`, `git diff --cached --stat`) or asked about before anything beyond your own edits is staged. Never `git add -A`, never `--no-verify` (a failing pre-commit hook is fixed and the commit rerun), and generated code is committed with its source in the same commit.

## 8b. PR mode (`pr` only)

Runs after step 8's commit, reusing steps 2 to 6: the review, the gates and the commit are not repeated here.

**Pre-check, before step 7 and before anything is committed** (like `--f` on `$DEF`): `flow: direct` → refuse (method step 0). On `$DEF` or a detached HEAD → ask for the branch name (`branch-naming` shapes the suggestion) and `git switch -c <name>` first, so no commit lands on the default branch; never create a branch behind the user's back.

**Gate freshness.** The gate requirement is **step 6's green result on the exact head** that gets pushed. Record `GATED=$(git rev-parse HEAD^{tree})` only from a gate run that was green on HEAD itself: when the working tree differs from HEAD, run the gates in `git worktree add --detach <tmp> HEAD` (then `git worktree remove --force <tmp>`), never record GATED from a dirty tree. Step 6 reruns unless `git rev-parse HEAD^{tree}` equals GATED (a commit after step 6, a rebase or a merge that changed the tree).

### Ship section (project settings)

The general flow lives here; only these settings are per project. Read the "Ship" section of the project's instruction file (AGENTS.md or CLAUDE.md). Keys and defaults:

| Key | Meaning | Default |
| --- | --- | --- |
| flow | `pr` or `direct`. `direct`: the project lands work on the default branch without PRs (commit on it, or `git merge --ff-only` a short local branch; from a worktree `git -C <main checkout> merge --ff-only <branch>`), full local gates before each commit, never a merge commit. `pr`: the PR is the only path to the default branch, so `m` into `$DEF` refuses. Only an explicit `flow: pr` in the section restricts `m` and `c --p`; with no section they keep their plain behaviour | `pr`, for `pr` mode only |
| push | `direct` only: `owner-word` (push only on the owner's explicit word, so `--p` only then) or `allowed` | `owner-word` |
| host | PR host CLI: `gh`, `glab` or `az` | `gh` |
| ci | `none` (local-only: step 6 green on the head is the only check; the merge must be fast-forward, or the branch already rebased on `$DEF` so the trees are equal, else the landed commit was never gated), `after-push` (CI runs after the push, reported not awaited), `on-pr` (the PR's checks on that SHA must be green to merge) | `on-pr` |
| merge-method | `fast-forward`, `rebase`, `merge-commit`, `squash` | the host's own setting (see host table) |
| may-merge | `yes` or `no`. `no` is a hard refusal that `--m` cannot override. `yes` still merges only with `--m` | `yes` |
| sync | how the branch takes the remote default: `rebase` or `merge` | `rebase` |
| batching | an MR is a batch: one commit per item, push once, fix red locally before pushing again; board or docs-only changes wait for the next code PR | off |
| generated | generated paths plus their regenerate command | none |
| pr_template | path of the PR template; the agent fills its sections into the description | the host's default template, if any |
| branch-naming | the branch name pattern the project wants | none (ask the user for the name) |
| commit-format | the commit format a hook enforces | read the hook, else step 8's format |

Host commands (`<n>` = the PR number, `<sha>` = local HEAD, `<f>` = the filled description file; checked against gh 2.101.0, glab 1.123.0, az 2.90.0):

| host | create | head SHA | checks (`ci: on-pr`) | merge | merged SHA (rebase, squash) |
| --- | --- | --- | --- | --- | --- |
| `gh` | `gh pr create --base $DEF --title <t> --body-file <f>` | `gh pr view <n> --json headRefOid -q .headRefOid` | `gh pr checks <n>` | `gh pr merge <n> --match-head-commit <sha>` plus `--merge`, `--rebase` or `--squash` per method; fast-forward is unsupported on gh: refuse, or use `--rebase` and check the trees match; no method set: read `gh repo view --json mergeCommitAllowed,rebaseMergeAllowed,squashMergeAllowed`, or ask | `gh pr view <n> --json mergeCommit -q .mergeCommit.oid` |
| `glab` | `glab mr create --target-branch $DEF --title <t> --description-file <f> --yes` | `glab mr view <n> -F json \| jq -r .sha` | `glab ci status --branch <b>` | `glab mr merge <n> --sha <sha> --auto-merge=false --yes` plus `--rebase` or `--squash` per method | `glab mr view <n> -F json \| jq -r '.merge_commit_sha // .squash_commit_sha'` |
| `az` | `az repos pr create --source-branch <b> --target-branch $DEF --title <t> -d "$(cat <f>)"` | `az repos pr show --id <n> --query lastMergeSourceCommit.commitId -o tsv` | `az repos pr policy list --id <n>` | `az repos pr update --id <n> --status completed` plus `--squash true\|false` only; any other method is the branch policy's. The head-SHA compare is the guard | `az repos pr show --id <n> --query lastMergeCommit.commitId -o tsv` |

The description is written to a temp file: the project's `pr_template` is only the outline, and the agent fills each section.

With no Ship section, use the defaults and list under Needs you which were assumed. Filled example (a made-up project, a self-hosted GitLab):

```
## Ship
- flow: pr
- host: glab
- ci: none (no pipeline; wrap's step 6 on the PR head is the check)
- merge-method: fast-forward (main is protected, nobody pushes it)
- may-merge: yes
- sync: rebase
- batching: on (one commit per item, push once; board and docs-only changes wait for the next code MR)
- generated: `web/src/gen/**` and `api/openapi/**`, regenerated with `pnpm gen`
- pr_template: .gitlab/merge_request_templates/Default.md
- branch-naming: feat/<slug>, fix/<slug>
- commit-format: Conventional Commits, enforced by commitlint in the commit-msg hook
```

### Method

Commits made inside 8b (conflict resolutions, regenerated output) follow step 8's staging rules.

0. **Flow.** `flow: direct` → refuse: report that this project lands work without PRs, and use `m` (fast-forward only, gates before each commit; `--p` per the Ship `push` key). Nothing else runs. `flow: pr` (or no section) continues.
1. **Branch and batch.** On `$DEF` (or detached) the pre-check above already moved to a named branch; never ship from or push the default branch. `batching: on` and every changed path is board or docs: commit, do not push, report "waiting for the next code PR". Nothing else runs in that case.
2. **Sync.** `git fetch $R $DEF`, then `git rebase $R/$DEF` (`sync: merge` → `git merge $R/$DEF`). Rebase keeps history linear: no merge commit, no `git pull` without `--rebase`. On conflict, resolve instead of escalating at once:
   1. Read `git status`, `git diff --name-only --diff-filter=U`, each combined diff, the surrounding code and the history. For a hard conflict read both index stages: `git show :2:<path>` and `git show :3:<path>`.
   2. Infer both sides' intent and make the smallest coherent resolution that keeps both; update dependent code, tests, generated output or docs when the combined result demands it.
   3. Resolve side by side when both sides carry intent. `--ours` or `--theirs` only when inspection shows one side is the complete intended result.
   4. Remove every conflict marker and review the resolved diff for accidental loss.
   5. Stage the resolved paths explicitly, then `git rebase --continue` (`git merge --continue` under `sync: merge`), repeating until done.

   Generated output is never resolved by hand, and it is regenerated inside the stopped step: resolve its source first, run the project's `generated` command, `git add` the regenerated path, then `--continue`, once per replayed commit that conflicts there. Escalate only when two resolutions would materially change behaviour and you cannot infer which was intended, or when credentials or external state block you: leave the worktree and the rebase state intact and ask one narrow question.
3. **Gates.** After a rebase or merge that changed the tree, step 6 runs again before the push (gate freshness above).
4. **Push and open.** `git push -u $R HEAD` (the feature branch only). Write the description to a temp file and open the PR with the host's create command: what changed, why, how it was verified (the gate output you already have) and the manual QA script when project-documents' Definition of Done produced one, following the sections of `pr_template` when it exists. Quoted text after `pr` is context for it.
5. **Merge** (only with `--m`). Any failure stops with the PR open and reported as not shipped:
   - `may-merge: no` → refuse, `--m` cannot override it;
   - `git rev-parse HEAD` equals the PR's head SHA from the host (an unpushed local commit, or a commit after the gates ran, is a commit no gate saw);
   - step 6's gates ran green on that exact head this session (`ci: on-pr` → the host's checks command is green on that SHA as well);
   - `ci: none` → the merge is a fast-forward, or the branch is already rebased on `$DEF` (equal trees), else the landed commit was never gated.

   Then merge with the host command and the project's `merge-method`. If the host says the default branch moved, go back to method step 2, rerun the gates on the rebased tree, push with `git push --force-with-lease $R HEAD` (your own PR branch only), then repeat the step 5 checks and merge. Never press the host's Rebase or Update button: it writes a commit no local gate ran.
6. **Report.** `git fetch $R $DEF`, then confirm by merge method, and only then print `Shipped: <URL> → <sha> <subject>`:
   - fast-forward: `$R/$DEF` equals the head;
   - merge-commit: `$R/$DEF^2` equals the head;
   - squash or rebase: `$R/$DEF` moved and its tree equals the head's tree (when the branch was up to date); otherwise the host's merged SHA (host table) must be an ancestor of `$R/$DEF`.

   Never report shipped before that, and never report a SHA you have not seen. An open PR is "not shipped": say exactly that and what it waits on (review, CI, `--m` not given, `may-merge: no`, a gate not green on the head).

### Never (pr mode)

- Push to the default branch, open a PR from it, or merge into it locally under an explicit `flow: pr` (the PR is the only path).
- `git add -A`, `--no-verify`, `--force` onto the default branch or a shared branch (`--force-with-lease` on your own PR branch after a rebase is the one exception).
- Merge a PR whose head you have not checked against local `HEAD`, or whose head the gates did not pass on.
- Hand-edit generated output to resolve a conflict: regenerate it.
- Report a shipped SHA you have not seen.

`tests/dry-run.sh` exercises the `flow: direct` refusals, the branch and `m` refusals (flow parsed from a fixture Ship section), the head-SHA check and the merge with a fake host CLI.

## 9. Report

**Write it STE-style.** Questions, proposals, findings, steps and handoffs this skill writes follow the checkable subset of ASD-STE100 (Simplified Technical English): one topic per sentence, at most 20 words per sentence in instructions and 25 in descriptions, active voice, present tense, plain words with one meaning, no private shorthand. A question offers concrete options to pick from. Pages, persuasive text and text in the user's voice are out of scope.

End with two sections:

- **Landed**: one line per meaningful change, the review verdict, the gate results, the commits made or the message draft, the merge (step 7b) when `m` ran, the PR result (step 8b) when `pr` ran: URL and shipped SHA, or "not shipped" with what it waits on, and which Ship settings were assumed, under Needs you.
- **Needs you**: anything only the user can decide or do (migrations, env vars, manual settings, debt follow-ups from step 3). "Nothing" is a valid answer.

End every wrap with this help block:

```
/wrap            sweep · review · docs · gates · regroup unpushed if messy · draft only
/wrap c|commit   + commit
/wrap c --p      + commit and fast-forward push
/wrap s|squash   regroup local commits by concern
/wrap s --p      regroup, commit, fast-forward push
/wrap s --f      whole branch, then --force-with-lease (asks first)
/wrap m [branch] regroup, then merge into branch (an explicit flow: pr: never the default branch)
/wrap m --f      whole-branch regroup + --force-with-lease, then merge
/wrap pr         + commit, sync with the default branch, push, open the PR
/wrap pr --m     + merge it (may-merge, head SHA and gates must hold)
```
