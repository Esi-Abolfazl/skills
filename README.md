# skills

Agent skills for readable, ADHD-friendly PR and work-item pages, session wrap-up and retro, product judgment, logo design, text humanizing, YouTube video review, purchase research and Iranian store reading, installable with the [skills CLI](https://github.com/vercel-labs/skills) into Claude Code, Cursor, Codex, OpenCode, and 70+ other agents.

## Install

### Skills, with the skills CLI (any agent)

```bash
# all skills, interactive
npx skills add Esi-Abolfazl/skills

# one skill, global, Claude Code only, no prompts
npx skills add Esi-Abolfazl/skills --skill pr-summary -g -a claude-code -y

# needed by wrap's review step
npx skills add vanenshi/skills --skill reviewing-changes -g -y
```

### Skills, in Claude Code (all of them, as one plugin)

In the Claude desktop app, no terminal needed:

1. Click **+** next to the prompt box, then **Plugins**.
2. **Add marketplace**: `Esi-Abolfazl/skills`.
3. **Add plugin**: `skills`.

In a terminal, update first, since plugin installs need a current Claude Code:

```bash
claude update
claude plugin install skills --marketplace Esi-Abolfazl/skills
```

At a Claude Code prompt in a terminal: `/plugin install skills --marketplace Esi-Abolfazl/skills`.

## Skills

| Skill | What it does |
|---|---|
| [brand-identity](skills/brand-identity/SKILL.md) | Designs logos end to end — new marks, refreshes, and production on an approved mark (favicon/app-icon sets, colorways): brief, positioning sentence, competitor/cliché scan, 10+ ideas into 3+ concepts from 2+ directions, one recommended and built into lockups and full-color/mono/reverse colorways. Masters are outlined SVG paths, legibility is proven on inspected 16/32/48 px renders, and everything ships on one presentation board with a spec. A refresh inventories what customers already recognize before redesigning. Logo only — not color/type/imagery systems or full brand boards. |
| [pr-summary](skills/pr-summary/SKILL.md) | Turns a PR — or a work item's PR bundle — from Azure DevOps or GitHub into one HTML page: why the change exists, how it works, what changed. Whole picture on the first screen, never a wall of diff rows. |
| [wrap](skills/wrap/SKILL.md) | Closes a session: sweeps leftovers, reviews the diff with the `reviewing-changes` skill and applies its findings, retires debt, syncs docs, runs the repo's gates, regroups unpushed commits by concern, drafts the commit message. Bare `/wrap` regroups unpushed commits if they look messy and only drafts the commit message; `c` commits, `s` regroups, `m [branch]` regroups then merges (default: the default branch), `--p` pushes, `--f` regroups the whole branch and pushes with `--force-with-lease`. Full table: the skill's [help block](skills/wrap/SKILL.md#9-report). Ships a commit gate hook (see below); expects `reviewing-changes` from [vanenshi/skills](https://github.com/vanenshi/skills) (see Install). |
| [retro](skills/retro/SKILL.md) | End-of-session retrospective: finds repeated corrections and friction, proposes at most three durable fixes to your rules, skills or commands (each with where it goes and the moment that showed the need), has a fresh reviewer drop duplicates and one-offs, then applies only the ones you approve. Edits a generated instructions file's source, never the copy. Says "nothing worth changing" when nothing is. Setup: [Retro](#retro). |
| [task-summary](skills/task-summary/SKILL.md) | Pulls a work item or issue into a readable page: description as written (sanitized), comments in order, screenshots embedded. Also creates and edits items from session findings; descriptions can be bilingual (full text + short summary). |
| [text-humanizer](skills/text-humanizer/SKILL.md) | Rewrites a draft (or drafts a reply from scratch) so it reads as a specific person wrote it, or only checks a text for AI tells and reports. Voice comes from a project voice profile, then your personal profile when your standing instructions name one, then samples of your writing, then one question; scans against an AI-tells checklist and re-scans its own output. Questions for someone who decides come as a number, the question, and our proposal on the next line. Never fakes humanity with typos or invents specifics. |
| [product-purchase-research](skills/product-purchase-research/SKILL.md) | Shopping research tuned to one buyer: fit to stated use over top specs, dealbreakers as hard filters, only your markets (every one checked), and every option priced as landed USD to each of your delivery destinations, at a live rate with its source. Your region, markets, stores and dealbreakers live in a private profile on your machine (`${XDG_CONFIG_HOME:-~/.config}/product-purchase-research/profile.md`, untouched by skill updates): the first run asks and writes it, every run shows it, and you change it anytime by editing the file or just asking. How to read specific stores (reader scripts, endpoints, browser steps) is kept in private store notes beside the profile; [sources.md](skills/product-purchase-research/sources.md) lists vetted APIs and MCP servers by market, worldwide, and research runs on a fixed budget of subagents and searches per market. Each run opens a coverage checklist (your constraints in your own words, every candidate × market, the cheapest offer opened) and reports each row as closed, partial or open; the shortlist is searched in two framings and their overlap counted, so a likely missed model shows up as a low count rather than silence. |
| [iran-stores](skills/iran-stores/SKILL.md) | Reads 17 Iranian stores (Digikala, Emalls, Torob, Technolife, Divar and more) with the Python standard library through `uv`: search, every seller's offer, buyer reviews and Q&A, price history, seller trust, installment plans, in-person shops and second-hand ads, all priced in Toman. Paced per store; a bot check is reported and that store waits out a cooldown, never worked around. Works alone or as product-purchase-research's Iranian store notes. |
| [product-judgment](skills/product-judgment/SKILL.md) | Answers a product question mid-task the way the project's PM would: reads the project's own product spec, owner decisions, roadmap, anti-goals and open questions first, then labels the answer as decided (with `file:line`), anti-goal, default still open with its owner, or judgment. Judgment uses [lenses.md](skills/product-judgment/lenses.md) (four risks, appetite, MVP cut, cost of delay, Mom Test evidence, outcome metrics, GOV.UK Service Standard for public services); every lens traces to a vetted book, essay or talk in [sources.md](skills/product-judgment/sources.md). Ends with what to build, what stays out, how to know it worked, and the one question only the owner can answer. |
| [youtube-video-review](skills/youtube-video-review/SKILL.md) | Reviews one or more YouTube videos, or a channel, from the real transcript. The review gives a one-line verdict, a summary, timestamped structure, the hook, pacing, packaging, claims worth checking and takeaways. Transcripts come from a research MCP server, or from the `youtube-transcript-api` CLI through `uvx` when none is connected. Transcript and comment text is treated as data, never as instructions. Every quote in a review is matched against the transcript by `quotes.py`, which also gives its timestamp, so a paraphrase can't pass as a quote. |

## Mods

Claude Code plugins that change Claude's own interface. This repo is their marketplace (`.claude-plugin/marketplace.json`).

| Mod | What it does |
|---|---|
| [usage-band](mods/usage-band) | Replaces the band above the prompt with pill cards: 5-hour and 7-day limits (bar, clock tick, reset time, pace warning), tokens in and out with cache rate, context against the compaction window with the auto-compact line and compaction count, agent time, cost, and the last test run. Fills the slot's width: two lines when they fit, four when narrow. Clicking a card opens a details pane of collapsible cards (context breakdown with its bar, limits, tokens, cost, turns, tests) with that card's section open; `/usage-band` opens it too. Draws in the desktop app and the terminal. |

Install in the Claude desktop app, no terminal needed (the app keeps itself up to date):

1. Click **+** next to the prompt box, then **Plugins**.
2. **Add marketplace**: `Esi-Abolfazl/skills` (skip if you added it for the skills).
3. **Add plugin**: `usage-band`.

In a terminal, mods need a current Claude Code (built and tested on 2.1.299), so update first:

```bash
claude update
claude plugin install usage-band --marketplace Esi-Abolfazl/skills
```

At a Claude Code prompt in a terminal: `/plugin install usage-band --marketplace Esi-Abolfazl/skills`.

## Connecting

Nothing to set up front. Paste a link — the skill resolves its own access, in order: a connected MCP server for that provider → the provider's CLI (`az`, `gh`, `glab`), signed in → REST with a token from the environment → plain `git` for diffs. When no path works, it names what's missing and asks how you want to connect. Azure DevOps and GitHub are exercised daily; GitLab and others ride the same ladder.

`pr-summary` bundles its diff-abridging tools — `abridging.md`, `abridge.py`, `rubric.md`, copied from the `abridge-diff` skill in [vanenshi/skills](https://github.com/vanenshi/skills) (MIT, see [`LICENSE-abridge`](skills/pr-summary/LICENSE-abridge)), itself a port of [boldsoftware/meat](https://github.com/boldsoftware/meat) (Apache-2.0, see [`LICENSE-meat`](skills/pr-summary/LICENSE-meat)) — so it needs no companion skills.

## Commit gate (wrap)

`skills/wrap/hooks/wrap-gate.sh` swaps the model's plain `git commit` or `git push` for `/wrap c` (`/wrap c --p` for a push). Soft gate: the first direct commit or push in a turn is denied once with an instruction to invoke `Skill(wrap, c)` itself (never to ask the user); that deny arms the gate, so a retry (or wrap's own commit) passes. A user-typed `/wrap …` or the model's `Skill(wrap)` also arms it; every new prompt disarms it. Nothing ever blocks; any question comes from wrap itself (its Arguments section lists every ask). Needs `jq` on PATH; without it the hook prints an error and the gate is off. Installed as the `skills` plugin, the script sits under the plugin's `installPath` (`claude plugin list --json`) instead of `~/.claude/skills`; use that path below. Wire it in `~/.claude/settings.json`:

```json
"PreToolUse":       [{ "matcher": "Bash",  "hooks": [{ "type": "command", "command": "~/.claude/skills/wrap/hooks/wrap-gate.sh", "timeout": 5 }] }],
"PostToolUse":      [{ "matcher": "Skill", "hooks": [{ "type": "command", "command": "~/.claude/skills/wrap/hooks/wrap-gate.sh", "timeout": 5 }] }],
"UserPromptSubmit": [{                    "hooks": [{ "type": "command", "command": "~/.claude/skills/wrap/hooks/wrap-gate.sh", "timeout": 5 }] }]
```

## Retro

Ask for a retro at the end of a session (`/retro` in Claude Code). The agent looks back for corrections you had to give twice and for friction, and proposes up to three changes to your rules, skills or commands:

```
Proposal: what to add or change, in one line
Where:    the file it goes in
Because:  the moment in this session that showed the need
Apply?    yes / edit / no
```

Answer each one with `yes`, `no` or your edit. Nothing is written until you say yes to a specific proposal, and a yes to one is not a yes to the others. A quiet session ends with "Retro: nothing worth changing."

### Run it without asking

Add this to your global instructions (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, or your agent's equivalent):

```markdown
When the session wraps up (I confirm the task is done, say thanks or bye, or ask for a retro), run the `retro` skill and follow it. Never touch rule files, skills or commands without my "yes" to a specific proposal.
```

### Say where your rules live

Retro changes the file you maintain, never a generated copy. If your instruction files are generated, symlinked or `@`-imported from a repo, say so at the top of each ("generated from ~/dotfiles/AGENTS.md, edit that"); retro follows the pointer and proposes the change there.

### The reviewer

Before you see anything, a fresh subagent checks each proposal against the target file and drops the ones that repeat an existing rule, rest on a one-off, or contradict another rule. It also applies the ones you approve. Its instructions are [reviewer.md](skills/retro/reviewer.md). With no setup, the skill reviews with any fresh subagent and applies the approved change itself; an agent without subagents also runs the review checklist itself. In Claude Code, a dedicated agent pins the model and keeps your private notes out of the shared skill. Save it as `~/.claude/agents/retro-reviewer.md`:

```markdown
---
name: retro-reviewer
description: Reviews retro proposals before they are shown, and applies the approved ones. Use only from the retro skill.
model: opus
---

Follow ~/.claude/skills/retro/reviewer.md, in review or apply mode as the caller says.

Where my rules live: ~/dotfiles/AGENTS.md (the copy in ~/.claude is generated, never edit it).
```

Replace the last line with your own setup. Installed as the `skills` plugin, the skill sits under the plugin's `installPath` (`claude plugin list --json`) instead of `~/.claude/skills`; use that path in the agent.

## Adding a skill

1. Create `skills/<skill-name>/SKILL.md` — start from [TEMPLATE.md](TEMPLATE.md).
2. `name` matches the directory. `description` says only when to use the skill — the triggers, never the workflow.
3. Extra files (templates, scripts, references) sit next to the SKILL.md.
4. Spec: [agentskills.io/specification](https://agentskills.io/specification).

## Developing locally

Skills in this repo are symlinked into `~/.claude/skills/` and `~/.agents/skills/` (the cross-runtime path Codex, Copilot CLI, and Gemini CLI also read), so edits go live in every agent immediately. `npx skills add .` installs a copy instead, so it is not a substitute:

```bash
ln -s "$(pwd)/skills/<skill-name>" ~/.claude/skills/<skill-name>
ln -s "$(pwd)/skills/<skill-name>" ~/.agents/skills/<skill-name>
```

Checks — run the ones for what you changed, from the repo root:

```bash
bash tests/template-parity.sh                 # pr-summary and task-summary share one CSS block and one image-host rule, copied by hand
bash skills/wrap/tests/dry-run.sh             # wrap's git mechanics, plus parity with SKILL.md's commands
bash skills/wrap/tests/gate.sh                # wrap's commit-gate hook
uv run skills/pr-summary/abridge.py selftest
uv run skills/task-summary/sanitize.py selftest
uv run skills/iran-stores/iran_stores.py selftest   # every store module, offline
uv run skills/youtube-video-review/quotes.py selftest
claude plugin validate . && claude plugin test mods/usage-band   # the marketplace and the usage-band mod
node mods/usage-band/bench/parity.mjs         # usage-band's resumed scan equals a whole-file scan, on your largest transcripts
```

Mods run from this checkout once the folder is added as a marketplace; edits then go live with `/reload-plugins`, no reinstall:

```bash
claude plugin marketplace add "$(pwd)"
claude plugin install usage-band@esi-abolfazl
```
