---
name: pr-summary
description: Use when pulling a pull request or work item/issue into the session as a reviewable page — a PR link or id from Azure DevOps or GitHub ("pull PR 532", "make a summary page of these two PRs", "get the azure item here with its comments/screenshots"), single PR or a work item's PR bundle — or when publishing session findings as a new or updated work item ("create a work item for this", "log this for the backend team"), including any request naming a description language ("write it in Turkish too", "German as primary").
---

# pr-summary

Round-trip between the team's trackers/repos and the session: import a pull request (or a work item's PR bundle) as a published summary page, import a work item/issue as a reviewable HTML artifact, or export session findings as a well-formed work item.

**REQUIRED BACKGROUND:** the `azure-devops` skill owns the az CLI gotchas (PAT scopes, org URL format, flag parity, HTML field behavior). Azure MCP tools (`mcp__azure-devops__*`, load via ToolSearch) come first; az CLI is the fallback when MCP is absent or a call fails.

## Import: pull request(s) → summary page

The deliverable is a published artifact page, never terminal text. One page carries the whole story of a change: a single PR, or every PR of one work item — one color lane per PR.

**The page answers three questions in this order: WHY the change exists, HOW it works now, WHAT changed.** First screen = the whole picture; depth arrives by scrolling; exact code stays in Azure/GitHub, not on the page.

### Gather

Resolve the provider from the URL or context, then collect all four:

| Need | Azure DevOps | GitHub |
|---|---|---|
| PR meta | `repo_pull_request` get, with `includeWorkItemRefs`, `includeLabels` (az: `az repos pr show`) | `gh pr view <url> --json title,body,state,author,baseRefName,headRefName,files,additions,deletions,mergedAt,url,closingIssuesReferences,statusCheckRollup` |
| Review threads | `repo_pull_request_thread` list (az: `az devops invoke --area git --resource pullRequestThreads`) | `gh api repos/<o>/<r>/pulls/<n>/comments` and `gh pr view --json comments,reviews` |
| Linked work item / issue | `wit_work_item` get | `closingIssuesReferences` → `gh issue view` |
| Diff + file list | `git fetch origin <target> <source>` then `git diff origin/<target>...origin/<source>` (`--stat` for the file list and +/− counts) | `gh pr diff <url>` |

On Azure, file lists and counts come from git, not MCP — `repo_pull_request`'s `includeChangedFiles` returns an empty summary.

Read the entire diff before writing a word — every claim on the page traces to the diff, the PR description, a review thread, or a linked item. When the diff is too big to read row by row, run `abridge-diff` and read its output instead. The diff is input only: the page never carries a diff or changed-rows section — counts (files, +/−) yes, rows no. Keeping rows off the page is also what keeps generation fast and the artifact small.

### Build

Copy `pr-page-template.html` (next to this file) and fill its slots. The template is the design system and the section contract: extend it when this change deserves a section it doesn't have; never restyle or re-derive what's there. Delete unused section markup, variants, and slot comments — but leave the CSS block untouched even when some selectors go unused.

Required on every page:

1. **Sticky nav** — one chip per section that exists.
2. **Header** — kicker (work item · branch · state · date; the PR's state lives here when it isn't merged), an h1 that names the change (a short name, not the PR title verbatim — the `<title>` carries the same name), a one-paragraph gist with the single idea in bold, one link chip per PR (merged badge only when merged).
3. **TL;DR** — 3–5 lane-dotted bullets, whole picture, each opening bold.
4. **WHY** — pick the matching variant: before/after compare for redesigns, numbered failure chain for bug fixes.
5. **WHAT, one card per PR** — lane tag (repo · N files), thesis h3, context line, change bullets as `<b>what.</b> <span class="why">why.</span>` (grouplabels when more than ~6), verify chips carrying real test numbers.
6. **Footer** — provenance: date, diff range, sources.

**The required sections are the floor, not the menu.** The PR decides the ceiling: put on the page everything the gathered material offers a reader — behavior/contract tables (request → old vs new result), migration or rollout order, config and env changes, perf numbers, screenshots carried by the PR or work item (download + embed as `data:` URIs, same rule as work-item images), anything else worth knowing. Build new sections and components for it in the template's style. The one hard exclusion stands: no exact code changes — no diff rows, no change snippets; identifiers, paths, and API shapes in `<code>` are fine.

Sections that recur — include when true:

- **Journey chain** — the mechanism spans layers → trace one concrete thing end to end (HOW).
- **Contract table** — the PR changes an API or rule → cases as rows, old/new results as columns (template has the table styles).
- **Fit / merge order** — more than one PR → what blocks what, which debt retires when.
- **Leftovers** — named debt or handoffs exist → each named and tracked.
- **Security** — quiet security fixes worth remembering.

Voice: headings are theses ("A refresh token is enough authority to end its own session"), never labels ("Changes"). Review catches become "Caught in review" callouts — what was wrong, what it would have cost, the test that pins it — sourced from wherever the catch is recorded (threads, the PR description, a spec/ADR); threads are never transcribed as a comment feed. Numbers are real (file counts, test counts). Load the `ux-writing` skill for every label, heading, and one-liner.

Publish with the Artifact tool: title = the page's short name, favicon stable across redeploys.

## Import: work item / issue → HTML artifact

1. **Fields + relations** — MCP `wit_work_item` get with `expand: All` (description is HTML; attachments and links live in `relations`). az fallback:
   ```bash
   az boards work-item show --id <id> --org https://dev.azure.com/<org> --expand all -o json
   ```
2. **Comments** — MCP `wit_work_item` list_comments. az fallback (`--resource workitems` crashes; this form works):
   ```bash
   az devops invoke --area wit --resource comments \
     --route-parameters project=<project> workItemId=<id> \
     --api-version 7.1-preview -o json
   ```
3. **Images/attachments** — `relations[?rel=='AttachedFile']` plus any `<img src>` URLs inside the description HTML. Both need auth to download:
   ```bash
   curl -s -u ":$AZURE_DEVOPS_EXT_PAT" "<url>" -o <name>
   ```
4. **Render one artifact**: title + state/type header, the description HTML as-is, comments in chronological order (author, date, body), images placed next to the text that references them. Embed every image as a `data:` URI — the artifact CSP blocks requests to dev.azure.com, so remote `<img>` URLs render as broken boxes.

A GitHub issue follows the same shape: `gh issue view <url> --json title,body,state,author,labels,comments`, images downloaded and embedded the same way. Other trackers (Jira, GitLab): gather the equivalent fields through whatever authenticated access exists and render the same artifact; if none exists, say so and stop rather than scraping.

## Export: findings → work item

Draft the description as plain HTML (fields are HTML by default; markdown shows literal `**`). Structure: what was found, evidence (file/handler references), what is proposed, ordering/dependencies. Mark unverified claims as proposals, not facts.

**Language contract** — resolve the layout from what the user asked, then stop; no follow-up questions about other languages:

| Request says | Description layout |
|---|---|
| nothing about language | English only, full detail |
| a language, no role — or "as secondary" | English full detail first, `<hr>`, then a **shorter summary** in that language |
| a language "as primary" | that language full detail first, `<hr>`, then a **shorter English summary** |

English always appears. Exactly two sections when a language is named — the named language plus English, never a third. Match the title's language to the team's recent work items (`az boards work-item list` or a known item), not to the contract.

Create and link:
```bash
az boards work-item create --org https://dev.azure.com/<org> --project <project> \
  --type Issue --title "<title>" --description "$(cat body.html)"
az boards work-item relation add --id <new> --relation-type related --target-id <source-item>
```

Creating or updating a work item is visible to the whole team: show the draft and get a yes first, unless the user already said to create it.

## Common mistakes

| Mistake | Fix |
|---|---|
| Presenting a PR as terminal markdown | The deliverable is the published artifact page. |
| Fresh CSS / restyled page per PR | `pr-page-template.html` is the design system — fill and extend it, never re-derive it. |
| Any diff / changed-rows section on the page | Never include one — the reader has Azure/GitHub for exact changes; rows blow up size and generation time. |
| Treating the section lists as a cap | They are the floor. The PR's material decides what else the page carries — everything except code rows. |
| A comments section transcribing threads | Distill catches into `Caught in review` callouts. |
| Writing the page before reading the diff | Every claim traces to diff/description/threads; read (or abridge) first. |
| `az devops invoke --area wit --resource workitems` | Crashes (`KeyError: 'type'`). Use MCP `wit_work_item` or `az boards work-item show/create/update`. |
| `az boards` 401s while `az repos` works | PAT lacks the Work Items scope — extend it, `az devops login` again. |
| `--description` on update to "append" | It replaces. Fetch the current HTML, concatenate, send combined. |
| Remote image URLs in the artifact | CSP blocks them — download with the PAT and embed as `data:` URIs. |
| Asking which languages to include | The contract above already answers it. |
