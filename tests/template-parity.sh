#!/usr/bin/env bash
# pr-summary and task-summary install separately, so what they share is a copy, not a shared file:
# the template block (`:root {` through `a { color: inherit; }`) and the image-fetch host rule.
# The STE-style rule is shared the same way by the skills listed below.
# Exit 1 on drift.
set -u
d="$(dirname "$0")/../skills"
block() { sed -n '/^  :root {/,/^  a { color: inherit; }/p' "$1"; }
pr="$d/pr-summary/pr-page-template.html"
task="$d/task-summary/task-page-template.html"
fail=0
[ -s "$pr" ] && [ -s "$task" ] || { echo "FAIL  template missing"; exit 1; }
[ -n "$(block "$pr")" ] && [ -n "$(block "$task")" ] || { echo "FAIL  shared block anchors not found"; exit 1; }
if diff <(block "$pr") <(block "$task"); then echo "PASS  shared CSS block in parity"; else echo "FAIL  shared CSS block drifted (pr-summary < > task-summary)"; fail=1; fi

rules=(
  "Credentials go only to the tracker's own host: fetch a URL only when it starts with \`https://dev.azure.com/<org>/\` or \`https://<org>.visualstudio.com/\`. Any other host is never fetched — replace that image with \`[image not embedded: <host>]\`."
  "only \`*.githubusercontent.com\` hosts (\`curl -fsSL \"<src>\" -o <name>\`, no auth header), any other host gets the placeholder"
)
for r in "${rules[@]}"; do
  for f in "$d/pr-summary/SKILL.md" "$d/task-summary/SKILL.md"; do
    grep -qF -- "$r" "$f" || { echo "FAIL  image host rule missing in ${f#"$d"/}: ${r:0:60}…"; fail=1; }
  done
done
[ "$fail" = 0 ] && echo "PASS  image host rule in parity"

# Skills that write questions, proposals, findings, steps or handoffs carry one copy of the STE-style rule.
ste="**Write it STE-style.** Questions, proposals, findings, steps and handoffs this skill writes follow the checkable subset of ASD-STE100 (Simplified Technical English): one topic per sentence, at most 20 words per sentence in instructions and 25 in descriptions, active voice, present tense, plain words with one meaning, no private shorthand. A question offers concrete options to pick from. Pages, persuasive text and text in the user's voice are out of scope."
ste_fail=0
for s in retro plan-draft plan-review plan-handoff wrap qa-engineer product-manager; do
  grep -qF -- "$ste" "$d/$s/SKILL.md" || { echo "FAIL  STE-style rule missing or drifted in $s"; ste_fail=1; }
done
[ "$ste_fail" = 0 ] && echo "PASS  STE-style rule in parity" || fail=1
exit "$fail"
