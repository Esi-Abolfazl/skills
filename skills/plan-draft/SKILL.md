---
name: plan-draft
description: Use when a change is too large to start coding without a plan, when the user types /plan-draft, when a goal arrives as a handoff file path or a board item id (`iN/NNN`), and a reviewed plan (no code) under .claude/plans/ is wanted; reads the project's anti-goals and roadmap first and refuses a goal that conflicts; writes one self-contained, execution-ready plan and delegates a cold review to a subagent running plan-review. Not for a change you can make and verify in one pass, for questions, or for running a plan that already exists (that is /plan-execute).
when_to_use: Invoke directly with /plan-draft <goal> before starting any non-trivial change. Pairs with /plan-execute.
category: Workflow
tags: [workflow, artifacts]
argument-hint: [what you want to build or change]
allowed-tools: Read, Grep, Glob, Write, Task, Bash(git status:*), Bash(git log:*), Bash(git diff:*), Bash(git branch:*), Bash(ls:*), Bash(find:*), Bash(echo:*), Bash(date:*)
---

You are producing an implementation **plan only**. You must not modify, create, or
delete any source file. The only files you may write are the plan itself under
`.claude/plans/` and, in multi-repo workspaces, handoff files under this repo's
`.claude/handoffs/` (see phase 2: handoffs are planning artifacts that live next to
the plan that generated them). You deliberately have no Edit tool: if you feel the
urge to change code, that is a signal to write it into the plan instead.

This is the **planning half** of a compact two-step workflow (`/plan-draft` then
`/plan-execute`). The plan you write is the single source of truth: one self-contained
artifact, no separate spec files. Its task list is what `/plan-execute` walks; its ADR
section carries any invariant the change creates that an agent could not otherwise infer.
Make both execution-ready.

The plan has two readers, in priority order: a **human** who must approve it by skimming
(tables, diagrams, short bullets), and the **executor model** that follows it (concrete
paths, ordered tasks). When detail would serve only the executor, keep it to one tight
sub-bullet; when it would serve neither: code transcription, restated context, leave
it out. The executor has the codebase; the plan only needs to carry the decisions.

The plan template lives next to this skill at `${CLAUDE_SKILL_DIR}/PLAN.md`: read it
before you start writing the plan so the artifact matches the section order exactly. The
glossary format lives at `${CLAUDE_SKILL_DIR}/CONTEXT-FORMAT.md`: read it before phase 3.

This workflow keeps **two durable docs** alongside the ephemeral plan: `CONTEXT.md` (the
project's ubiquitous-language glossary, maintained inline during the grill phase) and
`docs/adr/` (invariants an agent would otherwise break: not a decision log). The plan
itself is throwaway (draft → done → archive); the glossary and ADRs outlive it.

## Repository context (injected)

Recent history: orientation only (conventions, in-flight direction). This is NOT the plan's
scope; ignore it if unrelated to the goal.

- Recent commits: !`git log --oneline -5 2>/dev/null || echo "(no git history: not a repo, or no commits yet)"`
- Today's date: !`date +%F`

Goal from the requester: $ARGUMENTS

Work through these phases in order. Do not skip ahead, and do not start writing the
plan file until phase 10.

**1. Understand the request.**
Restate the goal in your own words. Define scope explicitly: what is in scope and
what is out of scope. If the request is ambiguous in a way that would change the
implementation, STOP and ask before continuing: do not guess past a fork that
matters.

**Anti-goals bound the goal.** Before investigating, read where the project lists what it
won't build (an out-of-scope or non-goals section, a do-not-do file such as the board's
`DO_NOT_DO.md`, an owner's decisions log). A goal that conflicts with one is **refused, not
reshaped**: quote the line it hits, say why, and stop. Don't offer or recommend a variant that
routes around it ("a named person collects it" for "no delivery"; "have the browser call the
API directly" is not replanned as "through a thin proxy"). A variant is planned only when the
requester asks for that after hearing the refusal. If the requester reaffirms the original
goal (they own the anti-goal, or say its owner has lifted it), record the override in §2 and
plan it: their call, stated once. Without that, the only path forward is the owner lifting it.

**The roadmap bounds the goal too.** If the project has a roadmap (the board's `ROADMAP.md`),
read it. A goal that fits no iteration on it is worth questioning in phase 3 before it becomes
a plan.

**2. Investigate the real codebase + domain.**
Use Glob / Grep / Read to find the files, modules, and patterns this change touches.
Reference concrete paths, not assumptions. Identify the existing conventions you must
follow (naming, structure, error handling, test style). If you expected something and
can't find it, say so rather than inventing it.
**The plan has no findings section.** Investigation is how you earn the plan's content,
not content itself: a table of everything you read is noise the reviewer must wade
through. Each fact you keep goes where it does work: a `path:line` in the task that acts
on it (§3), an entry in §2 if it is an assumption or an open question, a row in §5 if it
is a risk. A fact that lands in none of those was not worth recording.
Also read the domain docs: `CONTEXT.md` (or `CONTEXT-MAP.md` at root → the per-context
`CONTEXT.md` it points to) if present, and read `docs/adr/` for invariants that constrain
this change: each one names code an agent would otherwise write wrongly, so a plan that
violates one is a plan that will be built wrong. Honour the canonical terms and the
invariants in the plan.

**Multi-repo workspaces.** If the loaded context (`AGENTS.md`, `CLAUDE.md` or `.claude/CLAUDE.md`)
declares sibling repositories and the goal touches one, investigate it too: via a
codebase-index MCP if one is available, otherwise Read with absolute paths. How the
change itself gets made is the **workspace's cross-repo policy**, declared in that same
context: follow it. The two policies:

- **Inline** (default when the workspace declares none): a small, well-bounded
  foreign-repo change (a few tasks, no need for that repo's own MCP servers) may be
  planned as direct edits: mark each such task in §3 with a `Repo:` sub-bullet, and list
  that repo's convention skill(s) in §6 **by absolute path** (not auto-registered here).
  Anything larger gets its own plan in its own repo: add a §3 task
  "run `/plan-draft` in `<repo>` for `<sub-goal>`".
- **Handoff-only** (when the workspace declares sibling edits forbidden): never plan
  direct edits to a sibling. Instead the handoff is a **planning artifact you write
  yourself in phase 10, alongside the plan**: not an execution task, and following
  `${CLAUDE_SKILL_DIR}/../plan-handoff/SKILL.md` for the mechanics (target, template,
  file contents) rather than reinventing them here: with `target:` naming the repo
  that must act on it. List every handoff you write in the plan's `handoffs:`
  frontmatter. If this plan **consumes** the sibling's output (e.g. a frontend plan
  needing a new backend API), say so in §1: the requester passes the handoff's absolute
  path to a session in the target repo, which plans and executes it **first**.
  `/plan-execute` will refuse to run this plan while any listed handoff still exists
  (a handoff is deleted when its work lands), or was promoted and its board item is not done.

**Drafting FROM a handoff:** if the goal points at a handoff file (usually an absolute
path into the origin repo's `.claude/handoffs/`), read it and treat its Contract section
as settled input: do not re-grill what the origin plan already decided (grill only what
the handoff leaves open). Set the plan's `from_handoff:` frontmatter to the handoff path,
and update the handoff's frontmatter: `status: planned`, `plan:` → your plan's path.
(That status flip is the one sanctioned write outside this repo besides `CONTEXT.md`
edits here.) Drafting from a board brief (`BRIEF-<slug>.md`, a promoted handoff): treat its
Contract the same way, set the plan's `from_brief:` to its path, and leave the brief untouched.

Either way, record the cross-repo contract (API shape, event, schema) this plan depends
on in §2 as a blocking assumption until the other side lands.

**Drafting FROM a board item.** If the goal is a board id of the form `iN/NNN` (see
`${CLAUDE_SKILL_DIR}/../product-manager/board.md`), read the item, every `## Design input` brief it names and the
iteration's `README.md` demo script. Name in §1 the demo script step this item makes pass. The item's `## Problem`, `## Done when` and `## Rules`
are the settled requirement: its `## Done when` becomes §4. Decisions already settled in
the briefs are not re-opened. The **plan owns the design and the task breakdown**, which
the item deliberately lacks, so §3 is yours to write; grill only what the item and briefs
leave open. Set `from_item: iN/NNN` in the plan's frontmatter, next to `from_handoff:`.
Never edit the board: its job (`${CLAUDE_SKILL_DIR}/../product-manager/board.md`) is its only writer (the project's
board check, if it has one, exists to catch a second writer), and `/plan-execute` closes the
item through that job.

**3. Grill (interview to a shared understanding).**
Interview the requester to resolve the design tree, one question at a time, waiting for the
answer before the next. Walk down each branch, resolving dependencies between decisions in
order. For every question, **state your recommended answer**: do not just ask open-endedly.
Keep it lightweight and bounded:

- **Only grill forks that change the implementation.** If the request is already clear, say
  so and move on: do not manufacture questions.
- **If the codebase can answer it, answer it from the codebase** instead of asking.
- **Sharpen fuzzy language.** When a term is vague or overloaded, propose a precise canonical
  term ("you said 'account': Customer or User? those differ"). When a term conflicts with
  `CONTEXT.md`, call it out immediately.
- **Stress-test with concrete scenarios.** Invent edge-case scenarios that force precision
  about boundaries between concepts.
- **Cross-reference code.** If a stated behaviour contradicts the code, surface it.

**Update `CONTEXT.md` inline** as each term resolves: do not batch. Create it lazily (only
once the first term is worth recording) using `${CLAUDE_SKILL_DIR}/CONTEXT-FORMAT.md`. Keep it
a glossary and nothing else: canonical terms + `_Avoid_` synonyms, zero implementation detail.
Only record terms specific to this project's domain, not general programming concepts. This is
the only source file you may touch besides the plan.

**4. State assumptions and open questions.**
After grilling, list what remains. Split assumptions into "safe" (low risk if wrong) and
"blocking" (the plan is invalid if wrong). Any blocking question not settled in phase 3 goes
to the requester now.

**5. Write the implementation tasks (the apply-loop checklist).**
Produce an ordered checklist of `- [ ]` tasks: this is exactly what `/plan-execute` walks
and flips to `- [x]`. One task = one coherent, verifiable unit: small enough to land and
check on its own, ordered so each builds on the last.
Format each task as a **short imperative title** with the detail in indented sub-bullets:
Files, Change (1 to 2 lines), and a constraint/ordering note only when load-bearing. Add a
"Why" sub-bullet only when the reason is not obvious from the title: never cram
files + change + why into one long bullet line. Group tasks into phases when ordering
across groups matters. Be specific enough that the executor can follow without
re-deriving your reasoning. Cite a `path:line` when it pins down a decision; never
transcribe the code itself: the executor reads the file at run time.

**Every plan ends with three standing tasks**, after the implementation tasks:

- **Simplify**: the user's simplify or review skill (`/simplify` if present) over the changed code.
- **Test coverage**: tests for real behavior and failure modes, not for lines.
- **Docs surface**: every doc the change touches or makes stale, per its doc map, using the `project-documents` skill (the project's own documents skill wins when it has one).

**6. Define done.**
Write acceptance criteria as a checklist. For each item, specify exactly how it will be
verified. If the project has a test suite, name the test(s); if no tests cover the touched
area, say which tests should be added. If the project has no test setup at all, do not
invent one: specify the verification that does apply (build, type-check, lint, smoke run,
or a manual/visual check) and note tests as a future add-on.

**7. Assess risk.**
What can break? What is the blast radius (other modules, services, consumers)? What is
the rollback path? Flag anything irreversible (migrations, data changes, public API or
contract changes).

**8. Determine the skills needed (section 6).**
Decide which skills `/plan-execute` should load to carry out section 3: from **either**
source: this repo's own `.claude/skills/`, or a skill installed globally on the operator's
machine (outside this repo, e.g. under their personal skill directories) that the
available-skills list surfaces for this session. Check both; use only skills that
actually appear in `.claude/skills/` or that list: do not invent names. A global skill
is fair game here (a framework/language best-practice skill, a build tool, a design
critique skill) even though this repo's own files never *depend* on one existing: the
plan may still recommend loading it if it happens to be present, and should degrade
gracefully (fall back to the relevant `docs/conventions/` rule, or note the gap) if a
later `/plan-execute` run is on a machine without it. Look for skills matching the areas
the tasks touch: UI / visual-verification skills for visible UI work, coding-standards or
framework best-practice skills for code-quality-sensitive work, build/run workflow skills
for anything that must be launched to verify.
List each skill with which task(s) it serves and why, noting whether it's project-local
or global. Record them in the plan's `skills:` frontmatter as a YAML list so
`/plan-execute` can preload them on demand. If none apply, write "None".

Also recommend the **execution model + effort**: an instruction to the human who will
launch `/plan-execute`. Set frontmatter `execution_model` / `execution_effort` and fill
the "Run with" line under the plan title with a one-line justification. Judge from the
plan itself, not the goal's prestige:

- **haiku / low to medium**: purely mechanical tasks: renames, config, boilerplate the plan
  fully specifies.
- **sonnet / medium**: the default: well-specified tasks in a familiar codebase.
- **sonnet / high**: tricky integration, concurrency, subtle ordering constraints, or a
  weak test safety net.
- **opus / high**: high blast radius (migrations, auth, public contracts), tasks that
  leave real design freedom to the executor, or cross-repo coordination.

The recommendation binds the human, not the tooling: `/plan-execute` runs on whatever
model the session has: the human picks it when launching.

**9. ADR check (section 7).**
An ADR under `docs/adr/` records **an invariant an LLM agent could not infer from the
codebase and would plausibly violate**: nothing else. It is not a record of what changed
or why; that is the plan's job, and the plan is throwaway on purpose. Read
`${CLAUDE_SKILL_DIR}/ADR.md` before deciding: it holds the four gates and the format.

An ADR is REQUIRED only when the change creates a rule that survives all four gates:
it is not already a convention rule ID, not enforced by a machine (schema, CHECK,
dependency-cruiser, the type-checker), not a comment's job at one call site, and an agent
writing ordinary code would break it. In practice that means **an absence** (a field that
must never exist, a value that must never be returned, a retry that must never be added)
or **a deliberate contradiction** of an existing convention.

None of these earns an ADR on its own: adding or removing a dependency; picking library A
over B; a new module or slice that follows the existing pattern; a schema change whose
rules are visible in the schema.

If required, set frontmatter `adr: required` and draft section 7 as **invariant bullets
only** (≤20 lines: see the §7 stub in `${CLAUDE_SKILL_DIR}/PLAN.md`): the rule, the wrong
code it prevents, and where it is enforced. Never Context / Alternatives / Consequences
prose: the ADR format has no such sections. If a gate caught it instead, set `adr: none`
and name the file that carries the rule (the convention rule ID, the constraint, the
comment): naming the better home IS the answer, not a fallback.

**10. Save the draft.**
Write the plan to `.claude/plans/YYYY-MM-DD-<short-slug>.md` (use the injected "Today's date"
for `YYYY-MM-DD`, never a guessed date) following the structure in
`${CLAUDE_SKILL_DIR}/PLAN.md` exactly (sections 1 to 7 + Execution log). Set frontmatter
`status: draft`, `date` (today's date), the `adr` field, and the `skills` list from phase 8.
In a multi-repo workspace, **also write now** every handoff file phase 2 decided on,
per `${CLAUDE_SKILL_DIR}/../plan-handoff/SKILL.md` (`origin_plan` → this plan's path,
`target` → the repo that must act), and list their paths in the plan's `handoffs:`
frontmatter: the requester needs them to exist immediately so the target side can be
planned and executed before this plan runs.
Print each handoff's absolute path at the end so the requester can paste it into a
session in the target repo. If this plan was drafted from a handoff, set `from_handoff:`
and update that handoff's frontmatter as phase 2 describes.
(It must exist as a
file so the reviewer can read it cold.) Create `.claude/plans/` with the Write tool path if
it does not exist. Do not write any other file. Do not start implementing.

The first audience is the **human reviewer**: write for a skim, not a read. Follow the
formatting rules in the template's header comment, in particular:

- Tables and short bullets over prose; no paragraph longer than 3 sentences.
- Each fact lives in one section; cross-reference ("see §3") instead of repeating.
- Add a mermaid diagram (renders in VSCode Mermaid Preview / GitHub) only when the plan
  changes architecture or module boundaries; add before/after payload examples (fenced
  json) only when it changes an API/data contract. Skip both otherwise.
- Omit empty headings: no "none" placeholders (except §6/§7 which require an explicit
  "None"/"No ADR needed" + why).
- A reviewer should grasp goal, approach, and risk in ~5 minutes. If the plan runs long,
  trim task sub-bullets and §5 rows first: never the task list itself or the
  definition of done.

**11. Delegate the review.**
The review must be cold: a fresh context that did not write the plan. Spawn a
read-only reviewer subagent on the strongest model with the Task tool (the user's own
reviewer agent when they have one; else a general-purpose subagent with model: opus, and say so). Its prompt: read
`${CLAUDE_SKILL_DIR}/../plan-review/SKILL.md` and follow those instructions exactly,
reviewing the plan file at the path you just wrote. Tell it to verify every `path:line`
and every negative assertion ("X does not exist", "only N call sites") against the
codebase, since those are what the plan stakes its tasks on.

If subagents are unavailable, or the `plan-review` skill cannot be found, stop here:
print the plan path and tell the requester to run `/plan-review <path>` (ideally in a
fresh session), then bring back the verdict so phase 12 can run.

The reviewer reads the plan cold, verifies the claims against the codebase, checks the
task list is atomic/ordered/verifiable and the skills list is real, and returns a
structured verdict (APPROVE / REVISE) with prioritised findings. Do not review your own
plan inline: the point is a cold, separate reviewer. Run the review exactly once; do not
re-delegate. Proceed to phase 12 with the verdict and findings.

**12. Apply the findings.**
Address every CRITICAL and SHOULD-FIX item by rewriting the plan file with Write. Resolve
each UNVERIFIED CLAIM (check it, or move it to section 2 "Assumptions & open questions" if it
can't be settled here). If a finding reveals a blocking question for the requester, surface
it. Keep `status: draft`: approval is the human's call, never yours.

**13. Print the review brief (in chat, not in the plan).**
End with a compact brief so the requester can catch problems without reading the whole
plan. Include ONLY the decisions that would be expensive to discover late: for each, one
line: the decision + the alternative it beat (so a wrong call is visible at a glance).
Cover, when present (omit empty categories, no placeholders):

- **Dependencies:** libraries/packages added, removed, or version-bumped.
- **Contracts:** API/schema/event changes: one line each, breaking ones flagged.
- **Flow/architecture changes:** anything that reroutes an existing behavior, moves a
  boundary, or changes where a rule lives.
- **Convention deviations:** anywhere the plan knowingly departs from the codebase's
  established patterns.
- **Irreversibles:** migrations, data changes, anything with no clean rollback.
- **Blocking assumptions & open questions** the human must settle before approving.
- **Handoffs:** target repo + one-line contract each, with absolute paths.
- **Run with:** the recommended execution model/effort.

Cap it at ~15 lines; if a category would push past that, keep the riskiest items and say
"N more in plan §X". This brief is chat output only: never duplicate it into the plan
file. Then print the file path, the reviewer's verdict, and what changed after review.
Tell the requester to set `status: approved` when satisfied, then run `/plan-execute`.

**Write it STE-style.** Questions, proposals, findings, steps and handoffs this skill writes follow the checkable subset of ASD-STE100 (Simplified Technical English): one topic per sentence, at most 20 words per sentence in instructions and 25 in descriptions, active voice, present tense, plain words with one meaning, no private shorthand. A question offers concrete options to pick from. Pages, persuasive text and text in the user's voice are out of scope.
