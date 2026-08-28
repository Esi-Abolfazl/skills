---
name: brand-identity
description: Use when a project needs brand identity design or any part of it — a logo, wordmark, brand mark, monogram, favicon/app-icon set, color palette, typography pairing, imagery direction, a brand board, or a logo/identity refresh — including one-line briefs like "make me a logo for X" or "we need the whole look".
---

# Brand Identity Design

## Overview

A brand identity is one system — logo, color, typography, imagery — all serving one positioning sentence. Logo is where this skill goes deepest. The failures that make a delivery amateur: a single concept, the literal cliché, no positioning behind the decisions, and — on identity work — a logo dropped into a vacuum with no system around it.

## Scope — pick by the ask

| Ask looks like | Run |
|---|---|
| "logo for X" | Strategy → Logo → Delivery |
| "brand identity" / "the whole look" | all four phases |
| refresh, or an existing logo/identity is supplied | Equity inventory first, then the phases the brief touches |
| production on an approved mark (favicon set, colorway, cleanup) | steps 7–8 → Delivery only |

NOT this skill: verbal identity — voice, messaging, taglines (`brand`); AI-raster asset packs / CIP (`design`); banners (`banner-design`).

## Phase 1 — Strategy (always)

1. **Brief.** Answer the 9 brief questions ([reference.md](reference.md)). If the user is reachable, ask the ≤3 questions that most change the design; otherwise assume plausibly and mark every guess `(assumed)`.
2. **Position.** One sentence: "For [audience], [name] is the [category] that [differentiator]." Every later rationale traces back to it.
3. **Scan the landscape.** Industry visual defaults + 3–5 competitor identities (knowledge or quick search — label which). List this industry's clichés (map in reference.md). Decide conform vs differentiate, with a reason.
4. **Refresh briefs only — equity inventory before any redesign.** List what customers already recognize (mark silhouette, colors, type style, name treatment); classify each **keep / evolve / replace** with a reason. Evolution over reset — confusing regulars costs more than staleness. Show old vs new side by side on the board.

## Phase 2 — Logo (the specialty)

5. **Diverge.** Write 10+ idea one-liners before drawing. The first ones will be the literal ones — the name illustrated ("Dawnroast" → sun + cup); every competitor had those too. Keep going past them, then group survivors into 2–3 named directions.
6. **Concepts.** Draft ≥3 concepts from ≥2 directions — each gets a name, a one-line idea, and a rough SVG sketch. Wordmark-first: a symbol only if its idea survives one sentence without the name next to it.
7. **Recommend one**, citing the positioning sentence and the landscape call, plus one honest line per runner-up. Then build the recommended concept only: horizontal lockup, mark-only (if a mark exists), stacked where useful; full-color, single-color black, white/reverse. Masters are paths only — outline any font text (tested snippet in reference.md).
8. **Validate by rendering.** Rasterize at 16/32/48 px and full size, mono and reverse — then LOOK at the renders and fix what breaks. If the mark thins out at small sizes, cut a bolder small-size variant for ≤48 px. A legibility claim without an inspected render is not validation.

## Phase 3 — Identity system (identity-scope asks)

9. **Color system.** 1 primary, 1–2 secondary, 2 neutrals, 1 accent — max 6 total; HEX + a stated job per color (+ RGB/CMYK when print is in scope). Compute WCAG contrast ratios (snippet in reference.md) and **name the failing pairs in the spec** — don't hide them.
10. **Typography.** Display + text families (≤2), freely licensed with the license noted, fallback stacks, a size scale (~1.25 factor).
11. **Imagery direction.** 3 adjectives + one do/don't line for photography/illustration style.
12. **Applications.** ≥3 mockups (website hero, business card, social avatar) built only from the defined system.

## Phase 4 — Delivery (always)

13. **Board** — one self-contained HTML file, section order in reference.md.
14. **Spec/guidelines** — variant use-case table (when horizontal / stacked / mark-only / small cut), fixed vs flexible elements, clearspace, minimum sizes per colorway, 3 don'ts.
15. **Files** organized `svg/` + `png/` (+ `fonts/` with licenses), and a name-collision flag if a quick search shows the name visibly taken.

## Quality gates

| Gate | Pass = |
|---|---|
| Scope match | the ask's scope-table row ran — no logo-only answer to an identity ask, no full ceremony for a production ask |
| Concepts | ≥3 on the board, from ≥2 directions, each named + idea line |
| Positioning | sentence exists; recommendation cites it |
| Cliché | industry clichés listed; one appears only with a named twist |
| Fonts | `grep -l 'font-family\|<text' svg/*.svg` returns nothing; every font freely licensed, license noted |
| Small size | 16 px render inspected and survives (small cut made if needed) |
| Colorways | mono black + reverse white built and rendered |
| System | ≤6 colors each with a job; ≤2 type families; contrast ratios computed with failing pairs named |
| Imagery | direction stated (identity scope) |
| Variant uses | every variant/colorway names when to use it; fixed vs flexible marked |
| Refresh | equity inventory (keep/evolve/replace) precedes redesign; old vs new shown |
| Rationale | one line per major decision, strategic — not only aesthetic |

## Common mistakes

- **"One direction executed fully."** Execution completeness doesn't replace concept work — the client chooses from presented options.
- **Identity ask answered with a logo alone.** The system — color, type, imagery, applications — is the deliverable, not a bonus.
- **Refresh treated as reset.** Discarding recognized equity beyond what the brief justifies; inventory first.
- **Shipping the literal idea.** Name-as-picture survives only as a runner-up unless the landscape scan shows the space is empty.
- **Differentiation by accident.** If the distinctiveness claim fits any competitor, it isn't differentiation.
- **Legibility asserted, never rendered.** And failing contrast pairs silently omitted from the spec.
- **Building every concept fully.** Sketches for the board; full variants only for the recommendation.
