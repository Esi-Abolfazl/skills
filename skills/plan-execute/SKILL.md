---
name: plan-execute
description: Use when the user types /plan-execute, or a queue worker hands over, a plan in .claude/plans/ whose frontmatter says status approved and which is ready to build; walks its section-3 checklist one task at a time, running the gate for each and ticking it the moment it lands, after echoing the model and effort its "Run with" line recommends; closes out by flipping the plan to done and, when the plan carries from_item, running the board's done job once for the item (it never writes the board itself). Not for a draft plan (it must be approved first: say so and stop), for work with no plan (that is /plan-draft), or for ad-hoc changes.
when_to_use: Invoke directly with /plan-execute after a plan from /plan-draft has been set to status approved.
argument-hint: [path to plan, or empty for the latest approved one]
tags: [workflow, artifacts]
category: Workflow
allowed-tools: "*"
---

You are executing an approved implementation plan: the **execution half** of the compact
two-step workflow. The plan is the single source of truth: its section 3 task checklist is
your work queue: walk it one task at a time, flipping `- [ ]` to `- [x]` the moment each lands.

Plan target: $ARGUMENTS
(If empty, use the most recently modified file in `.claude/plans/` whose frontmatter
`status` is `approved`. If none is approved, list the available drafts and stop.)

**1. Load and gate.**
Read the plan. Check frontmatter `status`:

- If `done` → already executed. Report it and stop (offer to archive if not archived).
- If NOT `approved` → **blocked**. Do not implement. Show the plan summary + its task list
  and ask the human to review and set `status: approved` first. The approval gate is the
  entire point of this workflow: never bypass it on your own initiative, even if the plan
  looks obviously fine.

Then check frontmatter `handoffs:`. If non-empty, look for each listed handoff file. A
**missing file means done**: the work landed and the handoff was deleted. Except a handoff
promoted onto the board: first run `grep -rl '<handoff file name>' <its repo>/.pm` (git
history doesn't show a rename for a single deleted path). A brief whose `promoted:` line names
it points at `.pm/iN/NNN`: the work has landed only when that item exists as `iN/done/NNN.md`
or under `done/iN/`, and until then this plan is **blocked**. If no `.pm` brief names it, read
the deleting commit (`git log --diff-filter=D -1 --format=%B -- <path>`): if it carries an
issue link, the work has landed only when that issue is closed. For any that
still exists (`open` or `planned`), it may simply not have been removed yet: verify
against ground truth before blocking:

- If the handoff's `plan:` field is set, Read that target plan: its frontmatter
  `status: done` means the work landed: `git rm` the handoff yourself, note the repair
  in the Execution log, and treat it as satisfied.
- Otherwise ask the human directly: "handoff `<slug>` is still `<status>`: has the
  `<target>` side actually been executed?" If they confirm it's done, `git rm` the
  handoff (log the confirmation) and proceed. If not done, it is **blocked**. Tell the human to
  open a session in the target repo, run `/plan-draft` from the handoff, approve and
  `/plan-execute` it, then come back. Proceed past a genuinely unfinished handoff only if
  the human explicitly says the dependency is not actually blocking (record that override
  in the Execution log).

**2. Load the skills the plan named + the glossary.**
Read section 6 ("Skills Needed") and the `skills:` frontmatter list. As you reach each task
in section 3, load its required skills (or load only once if a skill covers multiple tasks).
Lazy loading keeps context lean. If a listed skill does not exist, note it and continue.
Also read `CONTEXT.md` (or `CONTEXT-MAP.md` → the relevant per-context glossary) if present,
and use its canonical terms in code, identifiers, and comments. If implementation forces a
new domain term or changes an existing one, update `CONTEXT.md` inline (glossary only, no
implementation detail): same as the plan phase did.

**3. Restate.**
Briefly confirm what you are about to do, the task count (N tasks), and the acceptance
criteria you will be held to. Echo the plan's execution recommendation
(`execution_model` / `execution_effort` frontmatter, if present): if the model you are
running as is clearly weaker than recommended, say so and let the human decide whether
to continue here or relaunch on the recommended tier: do not silently proceed past a
mismatch on a high-blast-radius plan.

**4. Walk the task checklist (apply loop).**
Work section 3's tasks top-to-bottom. For each task:

- Announce it: `Working on task K/N: <task>`.
- Make the code changes that task describes: minimal and scoped, no opportunistic refactors.
- Run the relevant build / lint / test for the area you touched.
- The instant it lands, flip its checkbox in the plan file `- [ ]` → `- [x]`.
- Print `✓ Task complete` and move on.

Keep going until every task is `- [x]` or you hit a blocker. After each task show running
progress `K/N tasks complete`.

**Same failure twice.** When a task's gate fails twice on the same error, make no third
attempt on your own. Get the root cause first from a read-only reviewer subagent on the
strongest model. If the cause contradicts the plan, that is divergence (step 5).

**Cross-repo tasks.** First check the workspace's cross-repo policy in the loaded
context (`AGENTS.md`, `CLAUDE.md` or `.claude/CLAUDE.md`). Under **handoff-only**, a sibling-repo need
is never edited from here: write the handoff file the task describes (or, on unplanned
discovery, treat it as divergence per step 5 and propose a handoff), then continue with
the tasks that don't depend on it. Under **inline** policy, a task carrying a `Repo:`
sub-bullet pointing outside the cwd repo: first Read that repo's convention skill(s) at
the absolute path §6 gives, then edit via absolute paths, run that repo's
build/lint/test from inside its directory (`cd` in Bash), and treat it as a separate git
repository: never mix its changes into this repo's commits. If the task turns out to
need that repo's own MCP servers, hooks, or grows past what the plan describes, that is
divergence: stop per step 5 and propose moving it to its own plan in that repo.

**5. Handle divergence (pause, don't improvise).**
If reality contradicts the plan: a file isn't where it said, an assumption was wrong, a
task won't work: STOP. Do not invent a different design. Record it in the plan's
"Execution log", then pause with a clear options block:

```
## Execution Paused

**Plan:** <slug>
**Progress:** K/N tasks complete

### Issue
<what contradicts the plan>

**Options:**
1. <option>
2. <option>
3. Other approach

How do you want to proceed?
```

Trivial mechanical fixes (a renamed import) are fine to do inline; anything that changes
the design is not.

**6. ADR (the invariant, if the change created one).**
If frontmatter `adr: required`, read the format and rules in
`${CLAUDE_SKILL_DIR}/../plan-draft/ADR.md` first (or `docs/adr/_TEMPLATE.md` if the
plan-draft skill is not installed), then create `docs/adr/NNNN-<slug>.md`: get the number
by running `ls docs/adr/` and taking the next free one, never by guessing from memory.

The plan's section 7 is invariant bullets. Carry them across as invariant bullets: the
rule, the wrong code it prevents, where it is enforced. **Do not expand them into prose,
and do not add Context / Alternatives / Consequences sections**: the format has none, and
narrative is exactly what makes an ADR stale and unread. Keep it under 45 lines.

**Verify every `file:line` you write by reading the file**, and add nothing the plan does
not support. Set `Status: accepted` with today's date. Write the chosen number back into
the plan's frontmatter (`adr: NNNN`), and add the ADR's one-clause summary wherever the
project indexes them (e.g. `AGENTS.md` → Key docs). The plan is throwaway; this file is
the part that outlives it. (Human commits the ADR separately if desired.)

**7. Verify against "done".**
Run every acceptance check in section 4 and report pass/fail for each. Discover the
project's verification commands from its manifest/config (e.g. `package.json` scripts,
`Makefile`, `pyproject.toml`, `cargo`, `go test`, `dotnet test`) rather than assuming a
stack. **If an automated test suite exists, run it** for the touched area, plus any
type-check and lint the project defines. **If no test suite exists**, fall back to other
verification: type-check, lint, build, a runnable smoke check, or the manual/visual checks
named in section 4. Say which you used and why. For criteria not automatable (visual
UI, behavior), report as manual check needed. If something fails, fix it; if the fix is
genuinely out of scope, log it and flag it loudly rather than marking the plan done.

**8. Close out.**
Append an "Execution log" to the plan: files changed, per-task and verify results, any
divergences and how they were resolved, ADR number if written. Set frontmatter
`status: done`. If the plan has `from_brief:`, leave the brief alone (it stays with its board item). For the board
item, see "The board close-out" below. If the plan has `from_handoff:` and your verification covered every one
of its Acceptance boxes, `git rm` that handoff: its absence is what unblocks the origin
repo's plan. If the handoff is in this repo, remove it in the same change. If it is in the origin repo, `git rm` it there (a sanctioned write
outside the cwd repo, even under a handoff-only policy) and leave that commit to its owner. If a box is still unmet, leave it `planned` and say which. Then write a PR-ready summary: what changed, why, how it was verified, and
any follow-ups.

**The board close-out.** When the plan carries `from_item: iN/NNN` (or a `from_brief:` whose
promoted item you can name), the item closes **once, at close-out**, never per task: the item
is the board's unit, and a §3 task is not. First verify every line of the item's `## Done when`
against the running code or the project's gate, not against the task ticks. Only when every
line holds, invoke the board's `done <item>` job (`${CLAUDE_SKILL_DIR}/../product-manager/board.md`, or the project's own board command) **once** for the item.

- Never edit a board file yourself. The board's job is its only writer, and a second writer is
  the drift it exists to prevent. If that job is unavailable, say so and leave the board alone
  rather than moving the file by hand: a stale board is recoverable, one with two writers is not.
- If a `## Done when` line does not hold, the item stays open. Name that line, and do not invoke the job.

**Out-of-scope finds.** A bug or debt found during execution that the plan does not cover goes
to `.claude/handoffs/` through `plan-handoff` (`origin_plan:` set to the executing plan's path, the task named in Problem), never
straight onto the board. The board's `promote` job is what turns a handoff into board work, and a human triggers it.

Do not push or open a PR unless explicitly asked. When the human does ask for a PR, hand
over to the project's own ship or PR flow when its instruction file names one (it is the only
path to the default branch for an agent session when the project says so, because a gate that
runs only locally would be skipped by a direct push); otherwise use the `wrap` skill's `pr` mode.
