---
name: retro
description: "Use when the session wraps up (the user confirms the task is done, says thanks or bye) or the user asks for a retro, retrospective or \"what should we change\" about how the agent worked this session. Not for reviewing the code or product built this session (that is a code review), or for applying a change the user hasn't approved."
---

# Retro

Review the session so far and propose at most three durable improvements to the user's agent setup: rules, skills, commands, docs. Proposes only. Nothing is applied without an explicit "yes" to a specific proposal.

## 1. Find candidates

Look for:

- a correction the user had to give more than once
- friction: a wrong assumption, missing context, repeated lookups
- a rule, skill, command or doc that would have prevented the above

If nothing qualifies, end with "Retro: nothing worth changing." Never invent improvements to seem useful.

## 2. Find where each one lives

The targets are the instruction files this agent loaded (global and project `AGENTS.md`, `CLAUDE.md` and the like), the user's skills and commands. A file that says it is generated, or only imports or links another file, is not the target: follow it to its source and name that. The user's standing rules may name where their setup lives; use that.

## 3. Review before showing

Hand the candidates, the session moments behind them and the target files' paths to a fresh reviewer subagent following [reviewer.md](reviewer.md) in review mode. Use the user's own reviewer agent when they have one (for example a `retro-reviewer` agent), else a read-only subagent on a strong model. With no subagents available, run reviewer.md's review checklist yourself before showing anything.

Show only the proposals that survive, with the reviewer's revisions, each as its own fenced code block of exactly this shape, so the proposal renders as a box (not as chat text):

```
Proposal: what to add or change, in one line
Where:    the target file (its source, not a generated copy)
Because:  the moment in this session that showed the need
Apply?    yes / edit / no
```

## 4. Apply only what is approved

Discuss and revise each proposal until the user approves or drops it. Apply only the approved one, through the same reviewer in apply mode (or reviewer.md's apply rules yourself). Never touch rule files, skills or commands on your own initiative, and never treat "yes" to one proposal as "yes" to the others.

**Write it STE-style.** Questions, proposals, findings, steps and handoffs this skill writes follow the checkable subset of ASD-STE100 (Simplified Technical English): one topic per sentence, at most 20 words per sentence in instructions and 25 in descriptions, active voice, present tense, plain words with one meaning, no private shorthand. A question offers concrete options to pick from. Pages, persuasive text and text in the user's voice are out of scope.

## Common mistakes

| Mistake | Fix |
|---|---|
| Padding the list to three | Fewer is fine; none is fine |
| Editing a generated copy (`~/.claude/CLAUDE.md` stub, an installed plugin's cache) | Follow it to the source the user edits |
| A proposal that restates an existing rule | The reviewer drops it; point at the existing rule if it was ignored |
| Applying on a vague "sounds good" | Ask which proposal, then apply that one |
