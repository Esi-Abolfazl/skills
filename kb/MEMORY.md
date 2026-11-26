# Project knowledge base

What this repo has learned: the owner's answers, rules they set, and mistakes not to repeat. Read it at the start of any work in this repo and before asking the owner anything. When an answer, a correction or a repeated problem comes up, add one file here (Claude memory format) and a line below.

## Owner's answers

## Rules and choices
- [No unasked mod changes](no-unasked-mod-changes.md) · change a mod only when asked for that mod

## Mistakes not to repeat
- [Mod version in both files](mod-version-both-files.md) · plugin.json and hooks/version.ts, run tests/mod-version.sh
- [Check CI after push](check-ci-after-push.md) · gh run list after every push to main

## Reference
- [macOS runner queue timeout](macos-runner-queue-timeout.md) · 15m "not acquired by Runner" is GitHub, not code
- [Dev mod gets default options](dev-mod-gets-default-options.md) · use /usage-band frame to test frames
- [Run mod tests](run-mod-tests.md) · claude plugin test <mod path>
