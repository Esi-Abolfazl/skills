# Abridging rubric

The judgment half of the skill: what to KEEP, REMOVE, FOLD, and ELIDE.
Adapted from the system prompt in [boldsoftware/meat](https://github.com/boldsoftware/meat)
(`meat/rubric.go`). `abridge.py` handles the mechanical half.

## Who you are reading for

A senior engineer reading a diff of **good** code. It compiles, its tests pass.
They are not hunting nil panics or style problems. They want the shape of the
change: what changed, where data came from, where it went, what new control
flow or behavior appeared.

Reason across the whole change. A line that looks like noise in one file is
often explained by a change in another. You have Read and Grep — use them when
a clue would change your judgment about whether something is load-bearing.
Do not over-investigate; most rows can be judged from the diff alone.

## Principles

1. **KEEP rows where everything matters.** A changed argument, a new condition,
   a different function being called, a changed return path — anything that
   alters behavior or data flow.

2. **COLLAPSE mechanical repetition.** Keep the semantic anchor that names the
   operation, then fold or remove the repeated members, calls, setup, and cases.
   For a rename or call-site migration repeated across hunks, keep one
   representative old/new anchor and drop the rest; retain another hunk only
   when it exposes a distinct condition, transformation, effect, or
   compatibility boundary. Fold when the omitted block's existence or nesting
   still helps the reader; remove when no placeholder is useful.

   Default unified-diff context is not valuable by default. File and hunk
   headings already orient the reader. Remove nearby blank lines, unchanged
   comments, and the usual three context rows unless they identify the owning
   definition, close a retained construct, establish data a surviving row uses,
   or show control flow needed to interpret the change. Treat comments and
   docstrings the same way: retain contracts, security and compatibility
   caveats, non-obvious rationale, and conditions the code does not make
   evident; drop issue restatements, changelog prose, and line-by-line
   narration.

3. **ELIDE error-message construction.** If a branch calls `t.Errorf`,
   `fmt.Errorf`, a logger, or returns an error, the reviewer trusts the message.
   Keep the control flow and the fact that it errors; replace the noisy message
   arguments with `...`. Keep the details when error identity, wrapping, type,
   status, or control behavior is itself what changed.

4. **DROP obvious, forced, behavior-neutral changes** entirely: a zero value
   added to a return list because a new return value appeared, formatter
   realignment, mechanical renames already obvious from a kept row.

5. **DROP generated code entirely.** Machine-generated files are outputs of the
   change, not the change. Remove the whole file section and mention the
   regeneration in the summary. Strong clues: a `Code generated ... DO NOT EDIT.`
   header, conventional generated paths (`*.pb.go`, `*_generated.*`,
   `schema.d.ts`). If unsure, Read or Grep the file. Keep the hand-written
   source change that drove the generation.

6. **Imports are removed automatically, without exception.** `abridge.py` strips
   imports, includes, requires, and use declarations from every result: package
   swaps, aliases, multiline blocks, unchanged framing rows, and import rows
   inside embedded source snippets or multiline test fixtures. Do not spend
   `remove`/`fold`/`replace` coordinates on those rows, and do not mention them
   in the summary. Shape only the behavioral rows around them.

7. **Treat behavioral moves symmetrically.** When a block moved across hunks or
   files, give both sides identical treatment — matching fold boundaries,
   equivalent elisions. A moved block must read as relocation, never as a
   one-sided deletion or a one-sided compression. Rows the import pass already
   removed need no matching coordinates.

8. **Never invent or alter program logic.** Removal and compression are allowed;
   lying is not. If unsure whether something matters, KEEP it.

9. **Preserve enough structure to locate every retained change.** Keep
   `diff`/`---`/`+++` and `@@` rows for partially retained files and hunks. If a
   whole file is noise, remove its entire section rather than leaving orphan
   metadata — `abridge.py` prunes headers whose body rows all vanished, so
   removing the body rows is enough. `index <blob>..<blob>` rows are dropped
   automatically; blob hashes orient nobody.

## Python: semantic skeletons and suites

For Python, abridge around a semantic skeleton rather than isolated interesting
lines. Preserve the smallest connected path that shows:

1. **Contract / definition** — the changed function, method, fixture, class,
   decorator, marker, or option.
2. **Behavior-changing condition** — guards, exception boundaries, precedence,
   async and lifecycle points, branches that determine when behavior applies.
3. **Transformation** — the non-obvious computation, normalization, lookup,
   mutation, or dispatch.
4. **Observable effect** — return/yield/raise, emitted response, state mutation,
   warning or log category, callback, external call.
5. **Test specification** — scenario identity, distinctive stimulus or
   configuration, expected result.

Compress everything around those anchors. Python's high-yield suites: decorator
stacks, docstrings, literal tables, fixture bodies, repeated call sites,
parametrized cases, assertion batches, exception setup. Keep the suite's owner
and its decisive rows, then fold the repetitive interior.

- **Decorators and the definition they govern are atomic.** Never leave a
  decorator detached. Keep decorators whose arguments define behavior: route
  paths and methods, pytest marks and parameters, fixture scope/autouse,
  dataclass and typing semantics, caching or registration, async/task behavior.
  Keep the anchor and fold only its indented interior.
- **Multiline expressions, calls, comprehensions, signatures, and strings must
  keep recognizable boundaries.** Fold complete interior rows while keeping the
  opener and the closer. Never leave a dangling delimiter, orphan continuation,
  or misleading fragment. Never change triple-quote parity within a hunk.
- **Multiline strings are often the stimulus or the expected output.** Keep the
  assignment or call and the distinctive rows that define the case. Fold the
  boring bulk only when what remains still communicates the string's role and
  shape. Never replace an entire stimulus call with one fold just because it is
  multiline.
- **Parametrization values are test specification, not boilerplate.** Keep the
  dimensions and the boundary/distinctive values; fold the repetitive middle.
  Keep each surviving expected outcome paired with its input.
- **Fixtures are semantic** when scope, autouse, setup/teardown, the yield
  boundary, monkeypatching, environment, or shared state matters. Keep those
  lifecycle edges; fold incidental construction.
- **Preserve async boundaries** (`async def`, `await`, task and context-manager
  lifecycle), exception type and control behavior, and warning category or
  filter when changed. Error prose may be elided unless the exact text is part
  of a public contract or a test assertion.
- Never delete a fixture, route, embedded config, or state transition that a
  retained stimulus depends on. A surviving loop, comprehension, or parametrized
  test must not refer to a table that was deleted so aggressively its role is
  unknowable — keep the definition and a representative shape, usually with a
  fold inside it.

## Worked examples

**Raw field copies.** Keep the comment that says why, keep one assignment
elided, drop the rest.

```
101|+    // Extra data used for cache management but not routing.
102|+    resp.SSHKeyID = rd.sshKeyID
103|+    resp.UserID = rd.userID
104|+    resp.BoxID = int64(rd.boxID)
105|+    resp.BoxName = rd.boxName
```

Keep 101. Remove 103-105. On 102, replace `.sshKeyID` with `...`, so the reading
result is `resp.SSHKeyID = rd...` — source-shaped, compact, made only by elision.

**Assertion with a noisy message.** Keep the condition, elide the message.

```
201|+    if rd.sshKeyID != sshKeyID {
202|+        t.Errorf("route SSH Key ID = %d, want %d", rd.sshKeyID, sshKeyID)
203|+    }
```

Keep all three. On 202, replace `"route SSH Key ID = %d, want %d", rd.sshKeyID, sshKeyID`
with `...` so it reads `t.Errorf(...)`. The checked condition stays visible.

**Python table and its consumer.** Keep the definition, fold the middle.

```
220|+CASES = [
221|+    ("empty", "", None),
222|+    ("simple", "a", "a"),
223|+    ("escaped", "a\\nb", "a\nb"),
224|+    ("unicode", "π", "π"),
225|+]
226|+
227|+@pytest.mark.parametrize("name, raw, expected", CASES)
228|+def test_parse(name, raw, expected):
229|+    assert parse(raw) == expected
```

Keep 220, the distinctive rows, 225, and 227-229. Fold 222-224 if repetitive.
Do not delete `CASES` while retaining a test that depends on it, and do not hide
the parametrization dimensions or the expected outcome.

**Multiline call.** Keep opener and closer.

```
240|+result = render_template(
241|+    template_name,
242|+    context,
243|+    locale=locale,
244|+)
```

Keep 240 and 244. Keep any argument whose changed value *is* the behavior; fold
only contiguous same-marker routine arguments. Never leave the call without its
closer.

**Exact move with reindentation.** Both sides get the same treatment.

```
601|-    config_filters = config.getini("filterwarnings")
602|-    apply_warning_filters(config_filters, cmdline_filters)
603|-    yield log
...
711|+        config_filters = config.getini("filterwarnings")
712|+        apply_warning_filters(config_filters, cmdline_filters)
713|+        yield log
```

Keep both spans, remove both, or fold both (601-603 and 711-713). Compressing
one side only makes relocation look like deletion.

**Context plumbing.** Usually forced, usually droppable.

```
303|-    m, err := meat.NewAnthropicFromEnv(*model)
304|+    m, err := meat.NewAnthropicFromEnv(ctx, *model)
```

If this is merely forced context forwarding and the meaningful origin or use of
`ctx` shows up elsewhere, remove the whole hunk or file section. Keep it when
timeout, cancellation, values, or `Done` behavior matters.

**Import churn.** Shape only the body.

```
501| import (
502| 	"fmt"
503|-	"math/rand"
504|+	"crypto/rand"
505|+	"encoding/hex"
506| )
507|@@
508|-    return fmt.Sprintf("%x", b)
509|+    if _, err := rand.Read(b); err != nil {
510|+        panic(err)
511|+    }
512|+    return hex.EncodeToString(b)
```

`abridge.py` removes 501-506 even when your plan is empty. Keep and shape only
508-512: `rand.Read` and the new return path already reveal the change.

**Plumbing before a call.** Precedence you cannot reconstruct must stay.

```
401|+    host := cfg.Host
402|+    if override != "" {
403|+        host = override
404|+    }
405|+    conn, err := dial(host)
```

The override precedence in 401-404 cannot be recovered by inventing a comment on
405. If it matters to the reviewer, keep it. Only remove it when the same
behavior is already explicit elsewhere in the retained change.

**Keep the changed argument when it is the point.**

```
-    p, err := parseSSHKeyPerms(permsJSON)
+    p, err := parseSSHKeyPerms(vals.Permissions)
```

## The bar

The result is a dense reading diff produced from the original by the automatic
import pass and your explicit local compressions — nothing else. Prefer
code-shaped evidence over explanatory prose, and prefer keeping uncertain code
over hiding something important.
