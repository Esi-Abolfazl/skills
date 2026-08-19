---
name: pr-summary
description: Use when pulling one or more pull requests into the session as a summary page — a PR link or id from Azure DevOps or GitHub ("pull PR 532", "make a summary page of these two PRs", "summarize what changed in PR 482 as a page", "make an ADHD-friendly page for this PR"), a single PR or a work item's PR bundle.
---

# pr-summary

Turn a pull request (or a work item's PR bundle) into one published HTML summary page. The page is ADHD-friendly by design — built for a reader who loses focus fast: the whole picture on the first screen, depth behind scrolling, never a wall of code — so the PR can be understood and acted on quickly.

**REQUIRED BACKGROUND:** the `azure-devops` skill owns the az CLI gotchas (PAT scopes, org URL format, flag parity). Azure MCP tools (`mcp__azure-devops__*`, load via ToolSearch) come first; az CLI is the fallback when MCP is absent or a call fails.

The deliverable is a published artifact page, never terminal text. One page carries the whole story of a change: a single PR, or every PR of one work item — one color lane per PR.

**The page answers three questions in this order: WHY the change exists, HOW it works now, WHAT changed.** First screen = the whole picture; depth arrives by scrolling; exact code stays in Azure/GitHub, not on the page.

## Gather

Resolve the provider from the URL or context, then collect all four:

| Need | Azure DevOps | GitHub |
|---|---|---|
| PR meta | `repo_pull_request` get, with `includeWorkItemRefs`, `includeLabels` (az: `az repos pr show`) | `gh pr view <url> --json title,body,state,author,baseRefName,headRefName,files,additions,deletions,mergedAt,url,closingIssuesReferences,statusCheckRollup` |
| Review threads | `repo_pull_request_thread` list (az: `az devops invoke --area git --resource pullRequestThreads`) | `gh api repos/<o>/<r>/pulls/<n>/comments` and `gh pr view --json comments,reviews` |
| Linked work item / issue | `wit_work_item` get | `closingIssuesReferences` → `gh issue view` |
| Diff + file list | `git fetch origin <target> <source>` then `git diff origin/<target>...origin/<source>` (`--stat` for the file list and +/− counts) | `gh pr diff <url>` |

On Azure, file lists and counts come from git, not MCP — `repo_pull_request`'s `includeChangedFiles` returns an empty summary.

Read the entire diff before writing a word — every claim on the page traces to the diff, the PR description, a review thread, or a linked item. When the diff is too big to read row by row, run `abridge-diff` and read its output instead. The diff is input only: the page never carries a diff or changed-rows section — counts (files, +/−) yes, rows no. Keeping rows off the page is also what keeps generation fast and the artifact small.

## Build

Copy `pr-page-template.html` (next to this file) and fill its slots. The template is the design system and the section contract: extend it when this change deserves a section it doesn't have; never restyle or re-derive what's there. Delete unused section markup, variants, and slot comments — but leave the CSS block untouched even when some selectors go unused.

Required on every page:

1. **Sticky nav** — one chip per section that exists.
2. **Header** — kicker (work item · branch · state · date; the PR's state lives here when it isn't merged), an h1 that names the change (a short name, not the PR title verbatim — the `<title>` carries the same name), a one-paragraph gist with the single idea in bold, one link chip per PR (merged badge only when merged).
3. **TL;DR** — 3–5 lane-dotted bullets, whole picture, each opening bold.
4. **WHY** — pick the matching variant: before/after compare for redesigns, numbered failure chain for bug fixes.
5. **WHAT, one card per PR** — lane tag (repo · N files), thesis h3, context line, change bullets as `<b>what.</b> <span class="why">why.</span>` (grouplabels when more than ~6), verify chips carrying real test numbers.
6. **Footer** — provenance: date, diff range, sources.

**The required sections are the floor, not the menu.** The PR decides the ceiling: put on the page everything the gathered material offers a reader — behavior/contract tables (request → old vs new result), migration or rollout order, config and env changes, perf numbers, screenshots carried by the PR or work item (download + embed as `data:` URIs — the artifact CSP blocks remote images), anything else worth knowing. Build new sections and components for it in the template's style. The one hard exclusion stands: no exact code changes — no diff rows, no change snippets; identifiers, paths, and API shapes in `<code>` are fine.

Sections that recur — include when true:

- **Journey chain** — the mechanism spans layers → trace one concrete thing end to end (HOW).
- **Diagram / chart** — the story has a shape prose can't carry: a branching or parallel flow, a before/after topology, a state machine, numbers worth comparing (see mechanics below).
- **Contract table** — the PR changes an API or rule → cases as rows, old/new results as columns (template has the table styles).
- **Fit / merge order** — more than one PR → what blocks what, which debt retires when.
- **Leftovers** — named debt or handoffs exist → each named and tracked.
- **Security** — quiet security fixes worth remembering.

Diagram mechanics: flow/sequence/state diagrams go in a `<pre class="mermaid">` block inside a card — artifacts render mermaid natively, no libraries. Charts and custom diagrams are inline SVG colored with the template's CSS variables so both themes stay legible; load the `artifact-diagramming` skill (and `dataviz` for charts) when available before drawing. The template's chain already does linear step sequences — mermaid earns its place only when the shape branches or runs parallel. External chart/diagram libraries never work: the artifact CSP blocks them.

Voice: headings are theses ("A refresh token is enough authority to end its own session"), never labels ("Changes"). Review catches become "Caught in review" callouts — what was wrong, what it would have cost, the test that pins it — sourced from wherever the catch is recorded (threads, the PR description, a spec/ADR); threads are never transcribed as a comment feed. Numbers are real (file counts, test counts). Load the `ux-writing` skill for every label, heading, and one-liner.

Publish with the Artifact tool: title = the page's short name, favicon stable across redeploys.

## Common mistakes

| Mistake | Fix |
|---|---|
| Presenting a PR as terminal markdown | The deliverable is the published artifact page. |
| Fresh CSS / restyled page per PR | `pr-page-template.html` is the design system — fill and extend it, never re-derive it. |
| Any diff / changed-rows section on the page | Never include one — the reader has Azure/GitHub for exact changes; rows blow up size and generation time. |
| Treating the section lists as a cap | They are the floor. The PR's material decides what else the page carries — everything except code rows. |
| A comments section transcribing threads | Distill catches into `Caught in review` callouts. |
| Writing the page before reading the diff | Every claim traces to diff/description/threads; read (or abridge) first. |
| Remote image URLs in the page | CSP blocks them — download with the PAT (or `gh`) and embed as `data:` URIs. |
| Chart.js / D3 / any CDN script for a chart | CSP blocks external libraries — `<pre class="mermaid">` blocks and inline SVG only. |
| Mermaid for a straight line of steps | The template's chain does linear better; mermaid is for branching/parallel shapes. |
| `az boards` 401s while `az repos` works | PAT lacks the Work Items scope — extend it, `az devops login` again. |
