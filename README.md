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
| [pr-summary](skills/pr-summary/SKILL.md) | Pull a PR (or a work item's PR bundle) from Azure DevOps or GitHub into one polished HTML summary page — why / how / what, no diff rows. Also imports work items/issues as artifacts and exports session findings as work items. |

Notes for `pr-summary`: Azure DevOps flows prefer the `azure-devops` MCP server and fall back to the `az` CLI; GitHub flows use `gh`. Companion skills (`abridge-diff`, `ux-writing`) sharpen the output when present but aren't required.

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
