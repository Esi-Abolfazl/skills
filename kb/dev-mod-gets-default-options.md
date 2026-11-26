---
name: dev-mod-gets-default-options
description: A dev-mods copy of a mod gets the plugin's default options, not the user's pluginConfigs
metadata:
  type: reference
---

A copy under `~/.claude/dev-mods/<session>/` receives `options` filled with the manifest defaults (for usage-band `accountTints: ''`), not the values in `~/.claude/settings.json` `pluginConfigs`. Spreading those options after a fallback wipes the fallback.

**How to apply:** to test a tinted usage-band in a dev copy, run `/usage-band frame <color> <LABEL>` in that window; clear it with `/usage-band frame off`.
