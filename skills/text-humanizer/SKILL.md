---
name: text-humanizer
description: Use when the user asks to humanize or de-AI a text, to "make it sound like me", or to check a text for AI tells; when they paste a draft with just "fix this" or "this sounds like ChatGPT"; to draft a reply or post in their voice: blog posts, tweets/X and LinkedIn posts, social or marketing copy, comment replies, emails, docs, release notes, bios; or to write questions with proposed defaults for someone who decides. Also use as the last gate before any text this session wrote goes public. Not for interface copy such as buttons, labels and error messages (that is UX writing).
---

# Text humanizer

Turns a draft into something a specific person plausibly wrote. Three jobs:

1. **Humanize a draft** the user pastes (or that another skill just generated).
2. **Draft a reply/post from scratch** in a voice, when there is no draft yet (comment replies, DMs, short posts).
3. **Check only**, when the user asks whether a text reads as AI: run step 2, then report instead of rewriting. Quote each match with its `ai-tells.md` section, and give a verdict using that file's threshold (one match is coincidence, several is the tell). Rewrite only if asked.

The engine is the same every way: know the voice, remove the tells, keep the facts.

## Workflow

1. **Pin the job, the medium, and the voice.**
   - Medium matters more than length: a comment reply, a LinkedIn post, and a changelog entry fail differently.
   - Voice source, in order: a project voice profile (found as in Voice profiles below) → the user's personal voice profile, when their standing instructions (global CLAUDE.md or memory) name one and the text goes out under the user's own name → samples of the user's own writing in the repo or the conversation → ask one question (who is writing, for whom). If the answer still gives no voice, use the `references/voice-profile.md` Part 1 defaults. Never invent a persona.
   - If the user gave no draft and no facts, ask for the facts. Do not fill gaps with invented specifics.
2. **Scan for tells.** Read `references/ai-tells.md` and check the draft (or your own draft) against every section. Read it, don't work from memory: the vocabulary list is the part that decays.
3. **Rewrite in the voice.** Use the voice source pinned in step 1. Keep every real fact; delete sentences that carry none.
4. **Self-check.** Re-scan your output against the same checklist. Rewrites reintroduce tells, especially rule-of-three and sentence-final "-ing" clauses. Anything that survives gets fixed before you answer.
5. **Deliver ready to paste.** For a check, deliver the job-3 report instead. Otherwise the final text, in the target medium's format, set apart from anything else you say. Outside it: no change log, at most one sentence on the biggest change. Never imply anything was sent, posted, or published.

## Voice profiles

A voice profile is a file the humanizer reads, either the project's or the user's personal one: who the writer is, core traits, hard bans, tone dials, and calibration pairs (bad version vs. voice version of the same content). Calibration pairs do more work than any rule list.

- Project has one → read it and defer to it. To find it, use the path the calling skill or the project's CLAUDE.md gives. If neither gives one, use the first `voice-profile.md` in the repo, skipping this skill's own folder. If you find none, the project has no profile.
- Project has none → continue down the step 1 chain, and offer once to write a profile if the user expects to do this repeatedly.
- Any voice profile, project or personal, outranks `ai-tells.md` in steps 2 and 4: where it gives an explicit rule for something the checklist also covers (a ban, emoji, emoticons, em dashes), that rule replaces the matching checklist item. The checklist fills every gap.

## Decision questions

When the text asks someone to decide (open product questions, choices with a default, approvals), it has this shape:

1. An opening of three lines at most: what the questions are for, that our proposal sits under each one, and that the reader replies only with the numbers they disagree with. Anything the reader must send either way comes next, in up to four short lines: what it is, where it was asked for, what it is used for, and what stands in until it arrives.
2. Each decision is exactly two lines, then a blank line:
   - the numbered question, ending in a question mark;
   - the proposal label (`Our proposal:`, or the voice profile's label for the language), then the answer first (yes, no, or the choice), then at most one sentence: the reason or its main cost. The reason names its source: the reader's own words, quoted, or `our guess` when no message from them asks for it.
3. One decision per number, and only decisions the reader has to make.

```
1. Can a patient cancel an appointment online?
Our proposal: Yes, up to 2 hours before. A later cancellation leaves a slot the clinic can't refill.
```

## Hard rules

- **Never fake humanity with errors.** No injected typos, no lowercase "i", no dropped capitals, no broken grammar. Casual comes from rhythm and word choice.
- **Never invent specifics.** No made-up numbers, dates, anecdotes, quotes, or sources. Ask, or keep the claim modest.
- **Never thesaurus-swap within the same register.** "leverage" → "utilize" is not a fix; "use" is.
- **Never keep an AI draft's shape and only change its words.** A listicle of abstractions gets restructured, not repainted.
- **Preserve meaning.** Humanizing removes puffery and hedging theater, not facts, caveats that matter, licenses, safety notes, or required disclosures.

## Boundaries

This skill rewrites and drafts words. It does not decide strategy (what to post, when, whether to reply at all), and it does not generate structured marketing kits — if a project has skills for those, they produce the draft and this one is the last gate before it ships.

## References

- `references/ai-tells.md` — the detection and removal checklist. Read in step 2 and again for the self-check.
- `references/voice-profile.md` — default voice, plus the template for writing a project voice profile.
