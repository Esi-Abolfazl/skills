#!/usr/bin/env bash
# Claude Code hook: commits go through /wrap. A Bash `git commit` is denied unless /wrap
# was invoked this turn — wrap arms the gate, then commits itself (c/p/s).
# Wire all three events in settings.json to this one script:
#   UserPromptSubmit          — new turn disarms; a user-typed `/wrap ...` arms
#   PostToolUse  (Skill)      — Skill(wrap) arms
#   PreToolUse   (Bash)       — `git commit` denied unless armed
set -u
INPUT=$(cat)
EVENT=$(jq -r '.hook_event_name // ""' <<<"$INPUT")
SESSION=$(jq -r '.session_id // "nosession"' <<<"$INPUT")
MARK="${TMPDIR:-/tmp}/claude-wrap-armed-$SESSION"

case "$EVENT" in
  UserPromptSubmit)
    PROMPT=$(jq -r '.prompt // ""' <<<"$INPUT")
    if [[ "$PROMPT" =~ ^[[:space:]]*/wrap([[:space:]]|$) ]]; then touch "$MARK"; else rm -f "$MARK"; fi
    ;;
  PostToolUse)
    [[ "$(jq -r '.tool_name // ""' <<<"$INPUT")" == Skill ]] || exit 0
    [[ "$(jq -r '.tool_input.skill // ""' <<<"$INPUT")" == wrap ]] && touch "$MARK"
    ;;
  PreToolUse)
    [[ "$(jq -r '.tool_name // ""' <<<"$INPUT")" == Bash ]] || exit 0
    CMD=$(jq -r '.tool_input.command // ""' <<<"$INPUT")
    # `git [global opts] commit`; global opts may carry one non-dash argument (-C dir, -c k=v)
    RE='(^|[^[:alnum:]_/.-])git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+commit([[:space:]]|$)'
    grep -Eq "$RE" <<<"$CMD" || exit 0
    [[ -e "$MARK" ]] && exit 0
    jq -n '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",
      permissionDecisionReason:"Commit gate: commits go through /wrap. Do not run git commit directly — invoke the Skill tool with skill \"wrap\" and args \"c\" (or \"p\" to push); wrap sweeps, verifies, and commits. The gate resets every user turn."}}'
    ;;
esac
exit 0
