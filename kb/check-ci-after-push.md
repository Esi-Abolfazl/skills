---
name: check-ci-after-push
description: After a push to main, read the CI result with gh run list
metadata:
  type: feedback
---

After each push, run `gh run list -R Esi-Abolfazl/skills -L 3` and open any failure with `gh run view <id>`.

**Why:** three red runs on main went unnoticed until the owner found them.

**How to apply:** report the CI result in the same reply as the push. See [[macos-runner-queue-timeout]] for failures that are not code.
