# skills

Personal agent skills, installable with the [skills CLI](https://github.com/vercel-labs/skills) into Claude Code, Cursor, Codex, OpenCode, and other supported agents.

## Install

```bash
# everything, interactive
npx skills add Esi-Abolfazl/skills

# one skill, globally, for Claude Code, no prompts
npx skills add Esi-Abolfazl/skills --skill pr-summary -g -a claude-code -y
```

## Skills

| Skill | What it does |
|---|---|
| [pr-summary](skills/pr-summary/SKILL.md) | Pull a PR (or a work item's PR bundle) from Azure DevOps or GitHub into one polished HTML summary page — why / how / what, no diff rows. |
| [issue](skills/issue/SKILL.md) | Pull a work item/issue into the session as a reviewable artifact (description, comments, embedded screenshots) — and create or edit items from session findings, with a bilingual-description contract. |

Notes: Azure DevOps flows prefer the `azure-devops` MCP server and fall back to the `az` CLI; GitHub flows use `gh`. `pr-summary` ships its own diff-abridging workflow (`abridging.md` + `abridge.py` + `rubric.md`, ported from [boldsoftware/meat](https://github.com/boldsoftware/meat)) — no companion skill needed; `ux-writing` sharpens page copy when present but isn't required.

## Adding a skill

1. Create `skills/<skill-name>/SKILL.md` — start from [TEMPLATE.md](TEMPLATE.md).
2. `name` matches the directory; `description` states only *when to use it* (the triggers), never how it works.
3. Extra files (templates, scripts, references) live next to the SKILL.md.
4. Spec: [agentskills.io/specification](https://agentskills.io/specification).

## Local use (this machine)

Skills here are symlinked into `~/.claude/skills/`, so edits in this repo are live immediately:

```bash
ln -s "$(pwd)/skills/<skill-name>" ~/.claude/skills/<skill-name>
```

Or let the CLI do it: `npx skills add . -g -a claude-code`.
