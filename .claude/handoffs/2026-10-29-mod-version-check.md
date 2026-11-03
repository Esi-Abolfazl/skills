---
status: open # all fixtures pass; waits on CI proof on a real PR
area: tooling
date: 2026-10-29
target: skills
origin_plan: none (found during the usage-band light-tile PR)
plan:
---

# Handoff: CI check that a mod change bumps its plugin version

## Context

PR 4 (usage-band light tiles) merged without a `plugin.json` version bump. The installed plugin lives in `~/.claude/plugins/cache/esi-abolfazl/usage-band/<version>/` and `claude plugin update` only picks up a new version, so the user kept seeing the old band until 0.3.4 (6c64a7b). The README now states the rule; prose alone is what failed.

## Problem

- `.github/workflows/tests.yml` runs on `push` and `pull_request` but has no version check.
- `git log -- mods/usage-band` shows mod commits with no bump: d81b5be, 4ba0ef5, 9cd5db4, fc0a03b, d87f1fb. Any pull between a change and its later bump leaves an install stale.

## Contract

- New `tests/mod-version.sh`; for each `mods/<mod>/`, fail when a file outside `tests/` and `bench/` differs from the base and `.claude-plugin/plugin.json` `version` does not.
- Base is the PR base on `pull_request`, `HEAD~1` on push.
- Add `- run: bash tests/mod-version.sh` to the `checks` job in `.github/workflows/tests.yml` and one line to the README "Checks" block.
- Fixture test for both outcomes (bumped passes, unbumped fails), in the style of the other `tests/` scripts.

## Acceptance

- [x] fixture: unbumped shipped change fails (selftest)
- [x] fixture: bumped passes (selftest)
- [x] fixture: tests-only passes (selftest)
- [ ] CI `checks` job runs the script on a pull request
