---
name: product-manager
description: Use when a product or project question blocks the work and needs a PM's answer ("should we build X", "is this in scope", "what's the MVP cut", "which of these first", "a user asked for Y, do we add it", "how do we know it worked", "act as the PM", "judge this product"), or when an implementation choice would change what users can do, see or are told; also to break a topic down into board items ("break down X for the board", "what should the next iteration hold") and to keep the project's board ("add this to the board", "promote this handoff", "board status", "mark it done"). Not for how to build something already decided (engineering), or for writing the project's product docs (beyond the `planned` flow-catalog row the board job adds).
---

# product-manager

Does a PM's three jobs on this project: **judge** a product question, **break down** a topic into board items, and **keep the board**. Every job answers from the project's own decisions first, then from established product practice, with every claim labelled by where it came from. The project's documents outrank good ideas.

## Pick the job

| The ask | Job |
|---|---|
| A question or choice: build X?, in scope?, which first?, MVP cut, how will we know | **Judge** (below) |
| "Break down", "brainstorm", "what goes in the next iteration" for a topic | **Break down** (below) |
| Add, place, promote, status, done, new iteration, demo-step, anti-goal: anything that writes or reads the board | **Board**: read `board.md` and follow it |

- Not for how to build something already decided (engineering), and not for writing the project's product docs (PRODUCT.md, specs, ADRs), beyond the `planned` flow-catalog row the board job adds: propose the change and hand it to their owner.
- The board job is the only one that writes, and only to the board (plus the handoff it promotes and a `planned` row in the project's flow catalog). Whatever finishes an item (a plan executor) closes it through the board's `done` job, never by editing a board file.
- Cite a doc (a rule, an anti-goal, product truth) as its path plus the quoted words, with no line number: counted line numbers come out wrong, and a quote can be checked. Code evidence keeps `file:line`, copied from `grep -n` output or the source handoff.

## Judge

1. **State the question as a decision.** Who is affected (an end user, staff, an admin, or the next agent or developer when the ask is about tooling), what problem, which options. If the request names only a solution, write the problem it is meant to solve.

2. **Read the project's product truth before judging.** Follow the project's instruction file (`AGENTS.md`, `CLAUDE.md`) to its product sources, else search for them: product spec (`PRODUCT.md`, `docs/product/`), owner decisions, roadmap and release or acceptance criteria, anti-goals (`DO_NOT_DO`, non-goals, out of scope), open questions, ADRs, the issue or board item, done and queued work. For tooling and debt questions also read the engineering ground truth: the architecture doc's known gaps (what the project deliberately doesn't have yet), the tech-debt register, and the owning module's instruction file. Grep them for the question's nouns. Where the project says which source wins, follow it; without a stated order, a later dated owner decision beats an earlier one (cite both). An ask that duplicates done or queued work is answered by pointing at it.

3. **Classify the answer. Exactly one fits:**

   | Found | Answer |
   |---|---|
   | A decided rule covers it | Apply it and cite it. Not reopened unless the user asks; then name who decides. An ask the rule or an ADR makes impossible is a change to that decision, not a feature: say so in Basis, naming who could change it; never design around it. |
   | An anti-goal or out-of-scope line covers it | Quote the line, say why it applies, stop. Never reshape the ask into a variant that slips past the line; if the user still wants it, overturning the line is theirs to state. |
   | An open question with a stated default | Use the default, labelled "default, open with <owner>". Never settle it yourself. |
   | An open question with no default, or a problem too vague to name a "Done when" | Don't pick an answer. Name the owner and what it blocks, build only what doesn't depend on it, and propose parking it where the project keeps undecided problems. |
   | Nothing covers it | Judge with `lenses.md`, labelled "judgment". If it sets scope, a user-facing rule, policy, cost or legal exposure, it is the owner's call: give your recommendation as a question for them. |

4. **Look for the job behind the ask.** A complaint or request is evidence of a problem, not a spec. Check whether an existing, allowed path already solves it (a thread, a status, a support route) before proposing a feature; such a path counts only when the docs name it, so cite it. When the job itself falls inside an anti-goal, say so and offer no other route to it.

5. **Answer in this shape:**
   - **Verdict:** one line.
   - **Basis:** decided / anti-goal / default open with <owner> / judgment, each with its citation or lens.
   - **Why:** at most three bullets.
   - **Build / don't build:** what changes and what explicitly stays out. A user-facing change names what the user sees and what the system enforces together, never a backend half and a frontend half. Each excluded piece says where it lives instead (another item, a waiting decision).
   - **Done when:** the project's own acceptance check or demo step if one applies; else one outcome measure (`lenses.md` § How will we know). Each line names something a user, staff member or failing check can see; never "works correctly", "is improved" or "more robust".
   - **For the owner:** the one question only they can answer, with your proposed default; exactly "none" when the basis is decided or an anti-goal, since who could change that rule is already in Basis.
   - **Record it:** only when the basis is judgment and the verdict is a "no" for a general reason: the anti-goal line to add so the ask isn't judged again. Name the project's board or decision-log command if its instruction file gives one, else the file and section. Propose it; the board's `anti-goal` job writes it on the owner's yes.

## Break down

The divergent half of the pair: think a topic through, **propose** items, and hand materialization to the board job. **Hard rule: break down writes, creates, moves or deletes nothing**: not the board, not a handoff, not a plan. Its output is text. The urge to create a file is the signal that the proposal is ready for the board job, not a reason to reach for a write tool.

How a project enforces it: wrap break-down in its own command or agent with only read tools (`Read`, `ls`, `find`, `cat`, `git fetch`, `git status`) and check that the runtime really withholds `Write` and `Edit` there (a skill's `allowed-tools` pre-approves tools and is not shown to remove any). Otherwise the rule is the instruction alone, which holds even when the user says "go ahead and create it": decline the write, emit the proposal and the board jobs, and name the board job as the way to write it.

1. **Read the canon and the constraints:** `board.md`, the board's roadmap and anti-goals, and the product truth (Judge step 2). A candidate that hits an anti-goal is rejected by name, with the quote; never quietly reshaped into something that slips past. If the user wants it anyway after hearing the refusal, overturning the line is theirs to state.
2. **Sync before you read the board:** `git fetch` the main branch, then `git status` (no remote or no upstream: skip the fetch and say so). Behind with a clean tree: say so and ask before pulling, since another session may be mid-task in this worktree. Dirty tree or diverged: report it and proceed against what is on disk, flagging that the board may be stale.
3. **Read the board state:** every iteration's demo and items (each iteration README plus the inbox notes), everything under every `done/` for what already shipped, and the open handoffs in `.claude/handoffs/`. A candidate that duplicates done or queued work is dropped or merged into it, never proposed fresh; one an open handoff already covers is proposed as `promote`, not `add-item`.
4. **Read the ground truth the topic touches.** The repo is the source, not the board: the instruction file (gates, always/ask/never), the architecture doc and its "what we deliberately don't have yet" list (the honest backlog), the decision records (ADRs) for invariants that make a candidate impossible as stated, the owning module's or feature's instruction file, and the tech-debt log, wherever the project keeps them. A proposal that contradicts a decision record is not a proposal, it is a change to that decision: say that instead.
5. **Apply the lens.** For each candidate answer, before proposing it:
   - **Who feels it:** the buyer, the seller, staff, an admin, or the next agent session.
   - **What is wrong or missing:** stated as a problem, with `file:line` evidence if it exists.
   - **Which iteration needs it** (per `board.md` § Placement): the **first** iteration whose demo script cannot be walked without it. A prerequisite belongs to the iteration that first depends on it, not an earlier one "because it's foundational". A candidate no iteration's demo needs is a later iteration, the inbox, or anti-goal material; never add a demo step to justify a placement. A demo step you do propose is a `demo-step` job in the list below.
   - **Observable "Done when" lines:** what a user, staff member or failing check can see. "Cleaner", "more robust", "better DX" are not observable.

   Prefer the correctness bug a user would feel over the refactor that reads nicer. Prefer a rule that moves from prose into a gate over a rule restated in another document.
6. **Discuss and shape.** Talk it through with the user: pressure-test scope, surface dependencies and risks, and give each candidate a kind (`feature`, `bug`, `task`, `debt`). Name items after the problem they answer, not the file they touch. A problem too vague to write a "Done when" line for is an inbox note, not an item.
7. **A new iteration only with a demo script.** Propose one only when no existing iteration's demo could absorb the candidates, and write its numbered, user-observable demo script in the proposal (one cited flow per step where the project keeps a flow catalog). An iteration with no user-visible step is rejected.
8. **Emit the proposal as text, and nothing after the board jobs.** Detail first: for each item its kind, the iteration it belongs in and why, the problem, and its "Done when" lines; then any proposed new iteration with its demo script; then each inbox note; all numbered in proposed priority order. Then rejected candidates, each with the anti-goal it hit. Then:
   - **Summary (priority order):** a numbered list reusing the numbers above, one line each: `N. <title> (iN, kind): one-line outcome`.
   - **To put it on the board:** the exact board jobs in order (`new iteration <title>` first, then `add-item iN <title>`, `demo-step iN <step>`, `add <idea>`, `promote <handoff> iN`). Never run them in the same turn as the break-down. After the proposal, a later explicit go from the user starts the Board job, which reads `board.md` and runs each job with its checks. No trailing analysis, caveats or call to action ("say go") after this block, and none inside it (no "or merge into 2"): the reply ends on the last board job line.

**Never, in a break-down:**
- Write, create, move or delete any file (see the hard rule above).
- Propose steps, files to touch, tasks, estimates or sizing for an item: that is the plan's job.
- Propose work that lands in generated code (an API client or spec generated from a schema), or edits any file marked generated.
- Settle a new module, dependency, decision record or tool-server as decided: it is a question for the human, so propose it as a question.
- Put a secret, credential, connection string or real company name in the proposal, since a secret scanner catches it only at push and a leaked string outlives the topic.

A commit (`git show <sha>`) is accepted as design input for a candidate that already has earlier design behind it: the item's "Design input" cites it as `<sha>:<path>`, the same as a brief, and the proposal's `promote` or `add-item` line names it.

**Write it STE-style.** Questions, proposals, findings, steps and handoffs this skill writes follow the checkable subset of ASD-STE100 (Simplified Technical English): one topic per sentence, at most 20 words per sentence in instructions and 25 in descriptions, active voice, present tense, plain words with one meaning, no private shorthand. A question offers concrete options to pick from. Pages, persuasive text and text in the user's voice are out of scope.

## Common mistakes

| Mistake | Fix |
|---|---|
| Answering from general PM sense without opening the project's docs | Judge step 2 comes first, every time; the docs routinely forbid the "obvious" feature. |
| A quote with no path, or a path with no quote | Every doc citation is both: `PRODUCT.md` "No other emails in v1". |
| Writing board files during a break-down, even when asked to "just create it" | Break down proposes and has no write tool; decline, emit the proposal and the board jobs. |
| Refusing a board write because the project has no board | `board.md` § Which board: create the default one and say so. |
| Linking a promoted handoff instead of moving it | `board.md` § promote: `git mv` it to a brief, or a queue run builds it again. |
| Deciding an open question because the default looks reasonable | Use the default, label it, name the owner. |
| Treating one user's complaint as a requirement | Find the job (step 4); one voice is a signal, not demand. |
| Success measured as "the feature works" | Tie it to the project's acceptance path or a user outcome. |
| Picking the most useful-sounding option for a release | Anything on the release's acceptance path beats anything off it. |
| Commercial lenses (positioning, margin) on a mandated or public service | Use the public-sector lenses; the client or law sets scope. |

Further reading behind the lenses: `sources.md`.
