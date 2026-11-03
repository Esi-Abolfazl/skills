#!/usr/bin/env bash
# A mod installs from ~/.claude/plugins/cache/<marketplace>/<mod>/<version>/ and `claude plugin update`
# only picks up a new version, so a change to a shipped file needs a plugin.json version bump.
# usage: mod-version.sh [base-rev]   (default HEAD~1; all-zero or empty means HEAD~1)
#        mod-version.sh selftest
# Exit 1 on a mod changed since base with the same version.
set -u
ROOT=.

version_of() { sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' | head -1; }

check() {
  local base=${1:-HEAD~1} fail=0 mod old new
  case $base in ''|*[!0]*) ;; *) base=HEAD~1 ;; esac
  for dir in "$ROOT"/mods/*/; do
    mod=$(basename "$dir")
    [ -n "$(git -C "$ROOT" diff --name-only "$base" HEAD -- "mods/$mod" ":!mods/$mod/tests" ":!mods/$mod/bench")" ] || continue
    old=$(git -C "$ROOT" show "$base:mods/$mod/.claude-plugin/plugin.json" 2>/dev/null | version_of)
    [ -n "$old" ] || continue # a new mod has no earlier version to keep
    new=$(version_of < "$dir/.claude-plugin/plugin.json")
    if [ "$old" = "$new" ]; then
      echo "FAIL $mod: shipped files changed since $base but version is still $old"
      fail=1
    fi
  done
  return $fail
}

selftest() {
  local t rc=0
  t=$(mktemp -d)
  mkdir -p "$t/mods/m/.claude-plugin" "$t/mods/m/hooks" "$t/mods/m/tests"
  printf '{"name":"m","version":"1.0.0"}\n' > "$t/mods/m/.claude-plugin/plugin.json"
  echo a > "$t/mods/m/hooks/x.ts"; echo a > "$t/mods/m/tests/x.test.ts"
  git -C "$t" init -q && git -C "$t" add -A && git -C "$t" -c user.name=t -c user.email=t@example.com commit -qm base
  expect() { # <want rc> <label>
    ROOT=$t check HEAD~1 >/dev/null; [ $? -eq "$1" ] && echo "ok   $2" || { echo "FAIL $2"; rc=1; }
  }
  step() { git -C "$t" add -A && git -C "$t" -c user.name=t -c user.email=t@example.com commit -qm "$1"; }
  echo b > "$t/mods/m/tests/x.test.ts"; step tests-only; expect 0 "tests-only change passes"
  echo b > "$t/mods/m/hooks/x.ts"; step unbumped; expect 1 "unbumped shipped change fails"
  echo c > "$t/mods/m/hooks/x.ts"; printf '{"name":"m","version":"1.0.1"}\n' > "$t/mods/m/.claude-plugin/plugin.json"; step bumped; expect 0 "bumped shipped change passes"
  rm -rf "$t"
  return $rc
}

if [ "${1:-}" = selftest ]; then selftest; else check "${1:-}"; fi
