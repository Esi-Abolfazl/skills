---
name: mod-version-both-files
description: A mod version lives in plugin.json and hooks/version.ts; bump both and run the CI check before push
metadata:
  type: feedback
---

Bump `.claude-plugin/plugin.json` `version` and `hooks/version.ts` `VERSION` in the same change. Any change to a mod's shipped files (outside tests/ and bench/) needs a bump.

**Why:** usage-band 0.7.1 shipped with version.ts still at 0.7.0, and CI on main went red. The local test suite does not check this; only `tests/mod-version.sh` does.

**How to apply:** before a commit that touches mods/, run `bash tests/mod-version.sh HEAD` from the repo root (it checks the version match; with an unpushed commit, pass the last pushed rev instead).
