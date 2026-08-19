---
name: abridge-diff
description: Use when reviewing or reading a code diff that is too long or too mechanical to read row by row — a large commit, an agent-generated change, a noisy PR, "summarize this diff", "what actually changed here", "abridge this", "give me a reading diff". Also use when `meat` is wanted but no OPENAI_API_KEY or ANTHROPIC_API_KEY is available.
---

# Abridge a diff into a reading diff

Turn a long unified diff into a short one that still *is* a diff: same rows,
same markers, same file and hunk structure, with the mechanical bulk removed.
A local port of [boldsoftware/meat](https://github.com/boldsoftware/meat) that
runs on this session's model instead of a paid API key.

**Core principle: you never write diff text.** You emit coordinates against the
immutable original and `abridge.py` applies them. That is what makes the output
trustworthy — every surviving row is byte-identical to the input except explicit
elisions and generated `...` markers, so no line can be invented.

## When to use

- A commit, range, or working diff is long enough that reading it row by row
  wastes the reviewer's attention.
- Agent-generated changes, where most rows are mechanical and a few matter.
- Before a code review, to find where the real change lives.

**Not for:** hunting bugs (use `/code-review`), diffs under ~50 changed rows
(just read them), or binary/lockfile-only diffs.

## Workflow

Never skip step 3. Reading the numbered diff is where the judgment happens.

`$SKILL` below is this skill's own directory — the base directory you are given
when the skill loads. Set it once so the commands work wherever the skill is
installed (`~/.claude/skills/`, `~/.agents/skills/`, a plugin cache, or a
project-local `.claude/skills/`):

```bash
SKILL=<this skill's base directory>
```

1. **Capture the diff to a file.** Pick the source from what was asked:

   ```bash
   git show HEAD > /tmp/d.diff          # a commit
   git diff main...HEAD > /tmp/d.diff   # a branch
   git diff --staged > /tmp/d.diff      # the index
   git diff > /tmp/d.diff               # the working tree
   ```

   Use the session scratchpad instead of `/tmp` when one is configured.

2. **Number it.**

   ```bash
   python3 "$SKILL"/abridge.py number /tmp/d.diff
   ```

   The gutter is `N|source`. `N` is a 1-based physical line in the original and
   never shifts — all coordinates refer to it.

3. **Read `rubric.md` in this skill directory and decide the plan.** It holds
   the keep/remove/fold/elide rules and the worked examples. Use Read and Grep
   on the repo when a clue outside the diff would change your judgment about
   whether a row is load-bearing.

4. **Write the plan JSON**, then apply it:

   ```bash
   python3 "$SKILL"/abridge.py apply /tmp/d.diff /tmp/plan.json
   ```

   The abridged diff goes to stdout; retention stats and the summary go to
   stderr. A rejected plan exits 2 and names every problem — fix the
   coordinates and re-run. Rejections are the compiler protecting the
   guarantee, not a reason to hand-write the output.

5. **Present** the abridged diff in a ```diff block, then the one-line summary,
   then the retention line. Mention anything dropped wholesale (generated files,
   mechanical renames) in the summary. Never mention imports — they are removed
   automatically.

## Plan format

```json
{
  "summary": "Swaps math/rand for crypto/rand in token generation.",
  "remove":  [[17, 21], [40, 40]],
  "replace": [[202, "\"route ID = %d, want %d\", got, want", "..."]],
  "fold":    [[222, 224]]
}
```

| Op | Shape | Use for |
|---|---|---|
| `remove` | inclusive `[start, end]` line ranges | pure noise; whole hunks or file sections |
| `replace` | `[line, old, new]` | part of one useful row is noise |
| `fold` | inclusive range, ≥2 rows | a block whose shape helps but whose interior repeats |

Rules the applier enforces, so plan around them:

- `old` must appear **exactly once** in that row's content, measured after the
  leading `+`, `-`, or space marker. Never include the gutter or the marker.
- `new` must be `old` with every omitted span written as `...` or `…` — it may
  not add, reorder, or silently delete characters.
- A fold range must be ≥2 rows, inside one hunk, all sharing one marker, with no
  import rows and no overlap with a `remove` range. You supply only coordinates;
  the applier derives the indent and emits the `...`.
- Imports and `index <blob>..<blob>` rows are stripped automatically. Spending
  coordinates on imports is rejected.
- Metadata and `@@` headers can only be removed, never folded or replaced. When
  every body row of a hunk or file goes, its headers are pruned for you.
- Emit `[]` for any op you do not need.

## Common mistakes

| Mistake | Fix |
|---|---|
| Hand-writing the abridged diff because a plan was rejected | Read the rejection; it names the exact coordinate. The guarantee only holds if the applier writes the output. |
| Off-by-one coordinates | They are physical lines of the **original file**, including metadata rows — never post-removal positions. |
| Compressing one side of a moved block | Both sides get matching treatment, or relocation reads as deletion. |
| Folding a decorator or a suite owner along with its body | Keep the anchor row; fold only the indented interior. |
| Dropping a table while keeping the test that indexes it | Keep the definition, fold its interior. |
| Explaining removed code in a prose comment | Removal and compression only. Never invent text. |

## Self-healing

This skill is the single source of truth for the abridging workflow. When
something here is wrong, fix the source file in this directory before finishing
the turn — do not work around it silently for one run.

Fix here when:

- **`abridge.py` rejects a plan that the rubric endorses**, or accepts one that
  produces a broken diff (orphan delimiter, mismatched triple quote, a fold that
  swallowed an anchor). Fix the validation or the applier, add the case to
  `selftest()`, and re-run `python3 abridge.py selftest`.
- **The import pass drops a behavioral row, or misses an import form** in a
  language the diff actually used. Adjust `RE_IMPORT_LINE` / `RE_IMPORT_OPEN`,
  add the case to `selftest()`, re-run it.
- **The rubric gave no answer, or the wrong answer**, for a real diff. Add the
  rule or the worked example to `rubric.md`.
- **A step here was ambiguous or out of order** in practice. Correct this file.

`selftest()` must pass before the turn ends:

```bash
python3 "$SKILL"/abridge.py selftest
```

Say what was changed and why in the final response. A fix that is not written
back is a bug that gets rediscovered next session.
