#!/usr/bin/env bash
# Self-test of hooks/wrap-gate.sh: feeds synthetic hook JSON on stdin and asserts the decision.
# Covers the `git commit` match (global opts, quotes, sh -c, near-misses, non-Bash tools),
# deny-once arming, UserPromptSubmit arm/disarm, and PostToolUse Skill(wrap) arming.
# Prints PASS/FAIL per assertion; exit 1 on any FAIL.
set -u

HOOK="$(dirname "$0")/../hooks/wrap-gate.sh"
SESSION=gate-test-$$
MARK="${TMPDIR:-/tmp}/claude-wrap-armed-$SESSION"
trap 'rm -f "$MARK"' EXIT
FAILS=0

pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; FAILS=$((FAILS + 1)); }
check()  { if eval "$2"; then pass "$1"; else fail "$1"; fi; }
expect() { if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 (want $2, got $3)"; fi; }

run() { # run <event> <tool_name> <field> <value> -> permissionDecision, or "pass" when the hook printed nothing
  local out
  out=$(jq -n --arg e "$1" --arg t "$2" --arg f "$3" --arg v "$4" --arg s "$SESSION" \
    '{hook_event_name:$e, session_id:$s, tool_name:$t}
     + (if $f == "prompt" then {prompt:$v} else {tool_input:{($f):$v}} end)' | "$HOOK")
  if [ -z "$out" ]; then echo pass; else jq -r '.hookSpecificOutput.permissionDecision // "pass"' <<<"$out"; fi
}
bash_cmd() { run PreToolUse Bash command "$1"; }

# --- deny once, then pass
rm -f "$MARK"
expect "plain git commit, unarmed -> deny"         deny "$(bash_cmd 'git commit -m x')"
check  "deny arms the gate (marker exists)"        '[ -e "$MARK" ]'
expect "same command, armed -> pass"               pass "$(bash_cmd 'git commit -m x')"

# --- global options before the subcommand
rm -f "$MARK"; expect "git -C dir commit -> deny"        deny "$(bash_cmd 'git -C dir commit')"
rm -f "$MARK"; expect "git -c k=v commit -q -> deny"     deny "$(bash_cmd 'git -c k=v commit -q')"

# --- quotes are part of the text, never stripped
rm -f "$MARK"; expect "unbalanced quote in -m -> deny"   deny "$(bash_cmd "git commit -m \"it's\"")"
rm -f "$MARK"; expect "sh -c 'git commit' -> deny"       deny "$(bash_cmd "sh -c 'git commit -m x'")"

# --- near-misses
rm -f "$MARK"; expect "git commitment -> pass"           pass "$(bash_cmd 'git commitment')"
rm -f "$MARK"; expect "my-git commit -> pass"            pass "$(bash_cmd 'my-git commit')"
rm -f "$MARK"; expect "git log -> pass"                  pass "$(bash_cmd 'git log')"
rm -f "$MARK"; expect "Read tool with 'git commit' path -> pass" pass "$(run PreToolUse Read file_path 'git commit')"

# --- UserPromptSubmit: /wrap arms, anything else disarms
rm -f "$MARK"
run UserPromptSubmit "" prompt '/wrap c' >/dev/null
check  "prompt '/wrap c' arms"                     '[ -e "$MARK" ]'
expect "commit after /wrap prompt -> pass"         pass "$(bash_cmd 'git commit -m x')"
run UserPromptSubmit "" prompt 'hello' >/dev/null
check  "prompt 'hello' disarms"                    '[ ! -e "$MARK" ]'
expect "commit after plain prompt -> deny"         deny "$(bash_cmd 'git commit -m x')"

# --- PostToolUse: only Skill(wrap) arms
rm -f "$MARK"
run PostToolUse Skill skill wrap >/dev/null
check  "Skill(wrap) arms"                          '[ -e "$MARK" ]'
rm -f "$MARK"
run PostToolUse Skill skill other >/dev/null
check  "Skill(other) does not arm"                 '[ ! -e "$MARK" ]'

printf '\n%s\n' "$([ $FAILS = 0 ] && echo 'ALL PASS' || echo "$FAILS FAILED")"
[ $FAILS = 0 ]
