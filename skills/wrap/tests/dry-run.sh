#!/usr/bin/env bash
# Dry run of /wrap step 6 (Squash) against a throwaway repo with a bare "remote".
# Replays the skill's exact git commands for the local scope and the --f scope,
# then provokes each guard. Prints PASS/FAIL per assertion; exit 1 on any FAIL.
set -u

ROOT=$(mktemp -d -t wrap-dry-run)
trap 'rm -rf "$ROOT"' EXIT
REMOTE_DIR="$ROOT/remote.git"
WORK="$ROOT/work"
OTHER="$ROOT/other"
FAILS=0

pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; FAILS=$((FAILS + 1)); }
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }

commit() { # commit <file> <content> <message>
  mkdir -p "$(dirname "$1")"; printf '%s\n' "$2" >"$1"; git add "$1"; git commit -q -m "$3"
}

# --- fixture: remote named "stylit" (not origin), default branch main, one base commit
git init -q --bare -b main "$REMOTE_DIR"
git init -q -b main "$WORK"; cd "$WORK"
git config user.email t@t; git config user.name t
commit README.md "base" "chore: base"
printf '#!/bin/sh\n# fake typecheck: ui must not reference an api symbol the api layer lacks\nif grep -q useBand ui/*.ts 2>/dev/null && ! grep -q "export const band" api/*.ts 2>/dev/null; then echo "typecheck failed"; exit 1; fi\nexit 0\n' >check.sh
chmod +x check.sh; git add check.sh; git commit -q -m "chore: fake typecheck"
git remote add stylit "$REMOTE_DIR"; git push -q -u stylit main
git remote set-head stylit main

# --- work branch: 5 per-task commits across 3 concerns; first 3 pushed, last 2 local
git checkout -q -b feat/x
commit api/band.ts   "export const band = 1;"    "wip: api band"
commit ui/chip.ts    "import {band} from '../api/band'; useBand(band);" "wip: chip uses band"
commit docs/notes.md "band"                       "wip: doc band"
git push -q -u stylit feat/x
commit api/band.ts   "export const band = 2;"    "wip: api band v2"
commit ui/chip.ts    "import {band} from '../api/band'; useBand(band); // v2" "wip: chip v2"

# =============================== pre-checks (skill text) ===============================
UP=$(git rev-parse --abbrev-ref @{u} 2>/dev/null); R=${UP%%/*}
DEF=$(git symbolic-ref --short "refs/remotes/$R/HEAD" 2>/dev/null); DEF=${DEF#"$R/"}; DEF=${DEF:-main}
REMOTE=$(git rev-parse @{u}); BASE=$(git merge-base HEAD "$DEF")
check "remote derived from upstream (=stylit, not origin)" '[ "$R" = stylit ]'
check "default branch detected from remote HEAD"          '[ "$DEF" = main ]'
check "upstream is an ancestor of HEAD"                   'git merge-base --is-ancestor "$REMOTE" HEAD'
check "no merge commits in BASE..HEAD"                    '[ -z "$(git rev-list --merges "$BASE"..HEAD)" ]'
check "default scope = nearer of REMOTE/BASE (REMOTE)"    'git merge-base --is-ancestor "$BASE" "$REMOTE"'

# =============================== local scope (bare /wrap or `s`) =======================
printf 'x\n' >>docs/notes.md                       # an uncommitted wrap edit, tracked file
echo junk >untracked.tmp                           # untracked: must survive, never stashed
git stash push -q                                   # tracked only
OLD=$(git rev-parse HEAD)
git reset -q --soft "$REMOTE" && git reset -q
git add api/band.ts;  git commit -q -m "feat(api): band v2"
git add ui/chip.ts;   git commit -q -m "feat(ui): chip follows band v2"
check "local regroup: 2 wip commits -> 2 concern commits" '[ "$(git rev-list --count "$REMOTE"..HEAD)" = 2 ]'
check "local regroup: content identical to OLD"           'git diff --quiet "$OLD" HEAD'
check "local regroup: pushed commits untouched"           '[ "$(git rev-parse "$REMOTE")" = "$(git rev-parse stylit/feat/x)" ]'
git stash pop -q
check "wrap edit restored from stash"                     'grep -q x docs/notes.md'
check "untracked file untouched by tracked-only stash"    '[ -f untracked.tmp ]'
git checkout -q docs/notes.md; rm untracked.tmp

# =============================== --f scope (whole branch + lease) ======================
OLD=$(git rev-parse HEAD)
git reset -q --soft "$BASE" && git reset -q
git add api/band.ts;   git commit -q -m "feat(api): band"
git add ui/chip.ts;    git commit -q -m "feat(ui): chip uses band"
git add docs/notes.md; git commit -q -m "docs: band"
check "--f regroup: 5 wip -> 3 concern commits"      '[ "$(git rev-list --count "$BASE"..HEAD)" = 3 ]'
check "--f regroup: content identical to OLD"        'git diff --quiet "$OLD" HEAD'
ok=1; for sha in $(git rev-list --reverse "$BASE"..HEAD); do git checkout -q "$sha"; ./check.sh >/dev/null || ok=0; done; git checkout -q feat/x
check "--f: every intermediate commit passes typecheck (api before ui)" '[ $ok = 1 ]'
git push -q --force-with-lease=feat/x:"$REMOTE" "$R" feat/x
check "--f: force-with-lease accepted, remote now at HEAD" '[ "$(git rev-parse stylit/feat/x)" = "$(git rev-parse HEAD)" ]'

# =============================== guards ==================================================
# 1) wrong order breaks bisectability: ui before api must fail the per-commit check
git reset -q --soft "$BASE" && git reset -q
git add ui/chip.ts;    git commit -q -m "feat(ui): chip uses band"
git add api/band.ts;   git commit -q -m "feat(api): band"
git add docs/notes.md; git commit -q -m "docs: band"
ok=1; for sha in $(git rev-list --reverse "$BASE"..HEAD); do git checkout -q "$sha"; ./check.sh >/dev/null || ok=0; done; git checkout -q feat/x
check "guard: ui-before-api ordering is caught by the per-commit typecheck" '[ $ok = 0 ]'
git reset -q --hard stylit/feat/x

# 2) parity failure -> reset --hard OLD
OLD=$(git rev-parse HEAD)
git reset -q --soft "$BASE" && git reset -q
git add api/band.ts ui/chip.ts; git commit -q -m "feat: partial (docs forgotten)"
git diff --quiet "$OLD" HEAD && parity=1 || parity=0
[ $parity = 0 ] && git reset -q --hard "$OLD"
check "guard: forgotten file -> parity fails -> reset --hard OLD restores" '[ $parity = 0 ] && git diff --quiet "$OLD" HEAD && [ "$(git rev-parse HEAD)" = "$OLD" ]'
git checkout -q -- .

# 3) stale lease: another clone pushes first -> our lease must be rejected
git clone -q "$REMOTE_DIR" "$OTHER"; ( cd "$OTHER" && git config user.email o@o && git config user.name o && git checkout -q feat/x && echo other >other.md && git add other.md && git commit -q -m "wip: someone else" && git push -q origin feat/x )
cd "$WORK"; LEASE=$(git rev-parse stylit/feat/x)   # what we last saw
git commit -q --allow-empty -m "chore: local only"
git push -q --force-with-lease=feat/x:"$LEASE" "$R" feat/x 2>/dev/null && pushed=1 || pushed=0
check "guard: lease rejected when remote moved underneath us" '[ $pushed = 0 ]'
git fetch -q "$R"
check "guard: after fetch, REMOTE not ancestor of HEAD -> skill must stop" '! git merge-base --is-ancestor "$(git rev-parse @{u})" HEAD'
git reset -q --hard "$R/feat/x"

# 4) merge commit in range -> stop
git checkout -q main; commit README.md "main moved" "chore: main moved"; git push -q "$R" main
git checkout -q feat/x; git merge -q --no-edit main >/dev/null
check "guard: merge commit in BASE..HEAD detected" '[ -n "$(git rev-list --merges "$(git merge-base HEAD main)"..HEAD)" ]'

# 5) default branch / detached HEAD refusals
git checkout -q main
check "guard: on default branch -> refuse" '[ "$(git rev-parse --abbrev-ref HEAD)" = "$DEF" ]'
git checkout -q --detach
check "guard: detached HEAD -> refuse" '[ "$(git rev-parse --abbrev-ref HEAD)" = HEAD ]'

printf '\n%s\n' "$([ $FAILS = 0 ] && echo 'ALL PASS' || echo "$FAILS FAILED")"
[ $FAILS = 0 ]
