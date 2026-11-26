---
name: macos-runner-queue-timeout
description: usage-band-scan failing after exactly 15m with 'not acquired by Runner' is GitHub capacity, not code
metadata:
  type: reference
---

The `usage-band-scan` job runs on a hosted macOS arm64 runner. When GitHub has none free, the job fails after 15m0s with "The job was not acquired by Runner of type hosted". Rerun it later (`gh run rerun <id> --failed`); do not change code for it.
