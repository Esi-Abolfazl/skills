---
name: retro
description: "Use when the session wraps up (the user confirms the task is done, says thanks or bye) or the user asks for a retro, retrospective or \"what should we change\" about how the agent worked this session. Not for reviewing the code or product built this session (that is a code review), or for applying a change the user hasn't approved."
---

# Retro

Review the session so far and propose at most three durable improvements to the user's agent setup: rules, skills, commands, docs. An improvement adds, changes, merges or removes. Proposes only. Nothing is applied without an explicit "yes" to a specific proposal.

## 1. Find candidates

Every retro looks in both places. The user does not need to ask for either.

**In the session:**

- a correction the user had to give more than once
- friction: a wrong assumption, missing context, repeated lookups
- a rule, skill, command or doc that would have prevented the above

**In the instruction files this agent loaded** (they are already in context):

- two rules that say the same thing: merge them into one
- two rules that conflict: keep one, and say which and why
- a rule that names a file, command or tool that is gone: remove or update it

Session candidates come first. Cleanup candidates fill the slots that remain. If the user's request names a topic, look there first.

A new rule goes into an existing rule when one covers the topic. Change that rule. Do not add a second one beside it.

If nothing qualifies, end with "Retro: nothing worth changing." Never invent improvements to seem useful.

## 2. Find where each one lives

The targets are the instruction files this agent loaded (global and project `AGENTS.md`, `CLAUDE.md` and the like), the user's skills and commands. A file that says it is generated, or only imports or links another file, is not the target: follow it to its source and name that. The user's standing rules may name where their setup lives; use that.

## 3. Review before showing

Hand the candidates, the session moments or the rule text behind them and the target files' paths to a fresh reviewer subagent following [reviewer.md](reviewer.md) in review mode. Use the user's own reviewer agent when they have one (for example a `retro-reviewer` agent), else a read-only subagent on a strong model. With no subagents available, run reviewer.md's review checklist yourself before showing anything.

Show only the proposals that survive, with the reviewer's revisions, each as its own fenced code block of exactly this shape, so the proposal renders as a box (not as chat text):

```
Proposal: what to add, change, merge or remove, in one line
Where:    the target file (its source, not a generated copy); two files when a merge spans both
Because:  the moment in this session, or the rule text, that shows the need
Apply?    yes / edit / no
```

## 4. Apply only what is approved

Discuss and revise each proposal until the user approves or drops it. Apply only the approved one, through the same reviewer in apply mode (or reviewer.md's apply rules yourself). Never touch rule files, skills or commands on your own initiative, and never treat "yes" to one proposal as "yes" to the others. An "edit" or other free-text answer is not a final answer: revise the proposal with the user's words, show the revised box, and ask yes or no again.

**Write it STE-style.** Questions, proposals, findings, steps and handoffs this skill writes follow the checkable subset of ASD-STE100 (Simplified Technical English): one topic per sentence, at most 20 words per sentence in instructions and 25 in descriptions, active voice, present tense, plain words with one meaning, no private shorthand. A question offers concrete options to pick from. Pages, persuasive text and text in the user's voice are out of scope.

## Common mistakes

| Mistake | Fix |
|---|---|
| Padding the list to three | Fewer is fine; none is fine |
| Editing a generated copy (`~/.claude/CLAUDE.md` stub, an installed plugin's cache) | Follow it to the source the user edits |
| A proposal that restates an existing rule | The reviewer drops it; point at the existing rule if it was ignored |
| Adding a rule beside one that covers the same topic | Change the existing rule |
| Applying on a vague "sounds good" | Ask which proposal, then apply that one |
| Treating an edit answer as done | Revise the box and ask again |
