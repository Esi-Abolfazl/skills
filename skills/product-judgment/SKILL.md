---
name: product-judgment
description: Use when a product or project question blocks the work and needs a PM's answer ("should we build X", "is this in scope", "what's the MVP cut", "which of these first", "a user asked for Y, do we add it", "how do we know it worked", "act as the PM", "judge this product"), or when an implementation choice would change what users can do, see or are told.
---

# product-judgment

Answers a product question the way a PM on this project would: from the project's own decisions first, then from established product practice, with every claim labelled by where it came from. The project's documents outrank good ideas.

## When to use

- Mid-task, a choice changes user-facing behavior, scope or a product rule, and nothing in the task settles it.
- The user asks for a PM view: prioritize, cut scope, judge a request, define success, review direction.
- Not for how to build something already decided (engineering), and not for writing the project's board or product docs: propose the change and hand it to whatever owns them.

## Steps

1. **State the question as a decision.** Who is affected, what problem, which options. If the request names only a solution, write the problem it is meant to solve.

2. **Read the project's product truth before judging.** Follow the project's instruction file (`AGENTS.md`, `CLAUDE.md`) to its product sources, else search for them: product spec (`PRODUCT.md`, `docs/product/`), owner decisions, roadmap and release or acceptance criteria, anti-goals (`DO_NOT_DO`, non-goals, out of scope), open questions, ADRs, the issue or board item. Grep them for the question's nouns. Where the project says which source wins, follow it.

3. **Classify the answer. Exactly one fits:**

   | Found | Answer |
   |---|---|
   | A decided rule covers it | Apply it, cite `file:line`. Not reopened unless the user asks; then name who decides. |
   | An anti-goal or out-of-scope line covers it | Reject by quoting the line. |
   | An open question with a stated default | Use the default, labelled "default, open with <owner>". Never settle it yourself. |
   | Nothing covers it | Judge with `lenses.md`, labelled "judgment". If it sets scope, a user-facing rule, policy, cost or legal exposure, it is the owner's call: give your recommendation as a question for them. |

4. **Look for the job behind the ask.** A complaint or request is evidence of a problem, not a spec. Check whether an existing, allowed path already solves it (a thread, a status, a support route) before proposing a feature.

5. **Answer in this shape:**
   - **Verdict:** one line.
   - **Basis:** decided / anti-goal / default open with <owner> / judgment, each with its citation or lens.
   - **Why:** at most three bullets.
   - **Build / don't build:** what changes and what explicitly stays out.
   - **Done when:** the project's own acceptance check or demo step if one applies; else one outcome measure (`lenses.md` § How will we know).
   - **For the owner:** the one question only they can answer, with your proposed default; "none" when the basis is decided or an anti-goal.

## Common mistakes

| Mistake | Fix |
|---|---|
| Answering from general PM sense without opening the project's docs | Step 2 comes first, every time; the docs routinely forbid the "obvious" feature. |
| Deciding an open question because the default looks reasonable | Use the default, label it, name the owner. |
| Treating one user's complaint as a requirement | Find the job (step 4); one voice is a signal, not demand. |
| Success measured as "the feature works" | Tie it to the project's acceptance path or a user outcome. |
| Picking the most useful-sounding option for a release | Anything on the release's acceptance path beats anything off it. |
| Commercial lenses (positioning, margin) on a mandated or public service | Use the public-sector lenses; the client or law sets scope. |

Further reading behind the lenses: `sources.md`.
