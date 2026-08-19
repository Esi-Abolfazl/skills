---
name: task-summary
description: Use when pulling a work item, issue, or task into the session as a reviewable artifact — "pull issue 612", "get the azure item here with its comments/screenshots", "make an artifact of the work item" — or when creating or editing one ("create a work item for this", "log this for the backend team", "update the description of item 616", "add a comment to the issue"), including any request naming a description language ("write it in Turkish too", "German as primary").
---

# task-summary

Round-trip between the team's tracker and the session: import a work item/issue as a reviewable HTML artifact, create one from session findings, or edit an existing one. Azure DevOps and GitHub today; the same shape extends to Jira/GitLab through whatever authenticated access exists — if none exists, say so and stop rather than scraping.

**REQUIRED BACKGROUND:** the `azure-devops` skill owns the az CLI gotchas (PAT scopes, org URL format, flag parity, HTML field behavior). Azure MCP tools (`mcp__azure-devops__*`, load via ToolSearch) come first; az CLI is the fallback when MCP is absent or a call fails.

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

A GitHub issue follows the same shape: `gh issue view <url> --json title,body,state,author,labels,comments`, images downloaded and embedded the same way.

## Create: findings → work item

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

GitHub: `gh issue create --title ... --body-file body.md` (markdown there, not HTML).

## Edit: update an existing item

```bash
az boards work-item update --id <id> --org https://dev.azure.com/<org> \
  --title/--state/--description ...        # fields to change
az boards work-item update --id <id> --discussion "<comment HTML>"   # add a comment instead
```

`--description` **replaces** — to append, fetch the current HTML (`wit_work_item` get), concatenate, send the combined body. The language contract above applies to any description content you write. GitHub: `gh issue edit` / `gh issue comment`.

Creating, editing, or commenting is visible to the whole team: show the draft and get a yes first, unless the user already said to do it.

## Common mistakes

| Mistake | Fix |
|---|---|
| `az devops invoke --area wit --resource workitems` | Crashes (`KeyError: 'type'`). Use MCP `wit_work_item` or `az boards work-item show/create/update`. |
| `az boards` 401s while `az repos` works | PAT lacks the Work Items scope — extend it, `az devops login` again. |
| `--description` on update to "append" | It replaces. Fetch the current HTML, concatenate, send combined. |
| Remote image URLs in the artifact | CSP blocks them — download with the PAT and embed as `data:` URIs. |
| Markdown in Azure description fields | They are HTML; markdown shows literal `**`. (GitHub is the reverse: markdown, not HTML.) |
| Asking which languages to include | The contract above already answers it. |
