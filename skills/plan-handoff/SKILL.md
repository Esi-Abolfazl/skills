---
name: plan-handoff
description: Use when out-of-scope work turns up mid-task (a bug, a debt, a reproduced finding from a routine or QA run, a change another repo must make) and needs a durable, self-contained file in .claude/handoffs/ instead of a chat offer or a task chip; plan-draft and plan-execute point here for the mechanics. Not for a trivial fix on a line you are already editing, for work inside the current task's scope, or for writing board files (the board's promote job turns a handoff into board work).
category: Workflow
tags: [workflow, artifacts, handoff]
allowed-tools: Read, Grep, Glob, Write, Bash(git log:*), Bash(git status:*), Bash(date:*), Bash(ls:*)
---

This is a shared procedure, not a standalone command. `/plan-draft` (phase 2 and the
handoff-writing phase) and `/plan-execute` (checking a listed handoff's status) both
follow these mechanics rather than duplicating them, and `handoff-queue` works a queue
of these files while the user is away; a project rule (in its `AGENTS.md` or
`CLAUDE.md`) that out-of-scope work becomes a handoff instead of a task chip, session card or offer
also follows this procedure directly, any time it applies mid-task. If the project
keeps a note on why handoffs exist (a philosophy or workflow doc named in its instruction file), it
is the place to read that.

You are filing a **handoff**, not fixing anything. Do not edit or create any file
except the handoff itself under `.claude/handoffs/`. If you feel the urge to fix the
issue, stop: that urge is exactly what this procedure replaces. The only exception is
a trivial one-line fix on a line you're already editing for the current task; anything
more becomes this file.

**1. Determine target.**
Read this repo's `AGENTS.md`, `CLAUDE.md` or `.claude/CLAUDE.md` for a declared "Multi-repo workspace"
table.

- No table declared → `target:` is this repo's own name: the handoff is for a _future session_ of this same repo, not a sibling.
- Table declared and the issue clearly belongs to a listed sibling → `target:` is that
  sibling's name. If it's ambiguous which repo owns the issue, ask before writing.
- That table's cross-repo policy (inline vs handoff-only) governs whether you may also
  _edit_ a sibling directly for the current task: it does not change how you file a
  handoff for something out of scope.

**2. Gather evidence, don't invent it.**
Point at the actual `file:line`, error, or behavior that shows the problem. If this
surfaced from something you just read or ran in the current task, reuse that: don't
go re-investigate the whole area beyond what's needed to make the Problem section
concrete.

**3. Write the file.**
Template: `${CLAUDE_SKILL_DIR}/HANDOFF.md`. Date via `date +%F`. Slug: short
kebab-case from the issue. Path: `.claude/handoffs/YYYY-MM-DD-<slug>.md`.

- `status: open`
- `area:` optional: one of the project's own module names, taken from its instruction file
  (e.g. its API, web, docs or tooling parts); omit the field when the project names none
- `date:` today
- `target:` from step 1
- `origin_plan:` the plan/session that surfaced this if one exists, else
  `none (found during <task>)`, naming the actual task
- `plan:` leave blank: the target repo's `/plan-draft` fills this in
- **Context**: what the caller was doing when this surfaced. One or two sentences,
  reference the current task, don't restate a plan that doesn't exist.
- **Problem**: the evidence from step 2, concrete `file:line`.
- **Contract**: the expected behavior/fix shape, precise enough that a cold
  `/plan-draft <this file>` in the target repo doesn't need to re-derive it.
- **Acceptance**: a checklist a future session can verify against (test, endpoint
  probe, manual check).

**4. Report back.**
State the handoff's path and a one-line summary: never silently. Then return to the
task that was in progress; do not start planning or executing the handoff yourself.

**Write it STE-style.** Questions, proposals, findings, steps and handoffs this skill writes follow the checkable subset of ASD-STE100 (Simplified Technical English): one topic per sentence, at most 20 words per sentence in instructions and 25 in descriptions, active voice, present tense, plain words with one meaning, no private shorthand. A question offers concrete options to pick from. Pages, persuasive text and text in the user's voice are out of scope.
