# skills

Agent skills that turn PRs and work items into readable, ADHD-friendly pages — installable with the [skills CLI](https://github.com/vercel-labs/skills) into Claude Code, Cursor, Codex, OpenCode, and 70+ other agents.

## Install

```bash
# all skills, interactive
npx skills add Esi-Abolfazl/skills

# one skill, global, Claude Code only, no prompts
npx skills add Esi-Abolfazl/skills --skill pr-summary -g -a claude-code -y
```

## Skills

| Skill | What it does |
|---|---|
| [brand-identity](skills/brand-identity/SKILL.md) | Runs brand identity work end to end, deepest on logos: positioning and a competitor/cliché scan, 3+ logo concepts, one built out into color/type/imagery and mockups, delivered on a single presentation board. Every legibility and contrast claim is backed by rendered files; refreshes inventory recognized equity before redesigning. |
| [pr-summary](skills/pr-summary/SKILL.md) | Turns a PR — or a work item's PR bundle — from Azure DevOps or GitHub into one HTML page: why the change exists, how it works, what changed. Whole picture on the first screen, never a wall of diff rows. |
| [task-summary](skills/task-summary/SKILL.md) | Pulls a work item or issue into a readable page: description as written, comments in order, screenshots embedded. Also creates and edits items from session findings; descriptions can be bilingual (full text + short summary). |

## Connecting

Nothing to set up front. Paste a link — the skill resolves its own access, in order: a connected MCP server for that provider → the provider's CLI (`az`, `gh`, `glab`), signed in → REST with a token from the environment → plain `git` for diffs. When no path works, it names what's missing and asks how you want to connect. Azure DevOps and GitHub are exercised daily; GitLab and others ride the same ladder.

`pr-summary` bundles its diff-abridging tools (`abridging.md`, `abridge.py`, `rubric.md` — ported from [boldsoftware/meat](https://github.com/boldsoftware/meat)) — no companion skills needed.

## Adding a skill

1. Create `skills/<skill-name>/SKILL.md` — start from [TEMPLATE.md](TEMPLATE.md).
2. `name` matches the directory. `description` says only when to use the skill — the triggers, never the workflow.
3. Extra files (templates, scripts, references) sit next to the SKILL.md.
4. Spec: [agentskills.io/specification](https://agentskills.io/specification).

## Developing locally

Skills in this repo are symlinked into `~/.claude/skills/` and `~/.agents/skills/` (the cross-runtime path Codex, Copilot CLI, and Gemini CLI also read), so edits go live in every agent immediately:

```bash
ln -s "$(pwd)/skills/<skill-name>" ~/.claude/skills/<skill-name>
ln -s "$(pwd)/skills/<skill-name>" ~/.agents/skills/<skill-name>
```

Or let the CLI do it: `npx skills add . -g -a claude-code`.
