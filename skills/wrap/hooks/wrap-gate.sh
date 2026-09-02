#!/usr/bin/env bash
# Claude Code hook: soft commit gate. The first direct `git commit` in a turn is denied once,
# telling the model to route through Skill(wrap, c); that deny arms the gate, so a retry
# (or wrap's own commit) passes. Never blocks work — worst case one retry.
# Wire all three events in settings.json to this one script:
#   UserPromptSubmit          — new turn disarms; a user-typed `/wrap ...` arms
#   PostToolUse  (Skill)      — Skill(wrap) arms
#   PreToolUse   (Bash)       — `git commit` unarmed: deny once and arm
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
    touch "$MARK"
    jq -n '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",
      permissionDecisionReason:"Commit gate (soft, fires once per turn): commits go through /wrap. Do it yourself now — do NOT ask the user and do NOT stop: invoke the Skill tool with skill \"wrap\" and args \"c\" (or \"p\" to push); wrap sweeps, verifies, and commits for you. If the Skill tool is not available to you (e.g. you are a subagent), simply rerun this exact command — it now passes."}}'
    ;;
esac
exit 0
