# usage-band reads the plan name from an undocumented endpoint

**Found:** 2026-11-26, Claude desktop session (two-account launcher work).

## Problem
- `mods/usage-band/hooks/register.tsx` polls `https://api.anthropic.com/api/oauth/profile` once an hour to store the account's plan name ("Team", "Max 5x") in `~/.claude/usage-band/limits/<account>.json`.
- The endpoint is not documented. Its reply shape was coded from the expected fields (`organization.organization_type`, `rate_limit_tier`), not from a captured reply. A changed shape drops the plan name without an error.
- The same is true of the per-model weekly limits read from `/api/oauth/usage` (`limits[]`, `weekly_scoped_shares`), but that shape was checked against a real reply on 2026-11-26.

## Proposed fix
- Use the plan name from the engine when the mod API exposes the account (session or app info), and drop the profile poll.
- Until then, add a test built from one captured profile reply (fake ids).

## Done when
The plan name comes from a documented source, or a test pins the real reply shape.
