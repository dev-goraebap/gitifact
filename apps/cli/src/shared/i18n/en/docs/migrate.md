---
title: Migrating a 0.7 project
description: Steps, checks and the migration commit for moving a schemaVersion 2 project to the 0.8.0 document format
---

When the user asks to move a 0.7 project (`schemaVersion: 2` in `.gitifact/config.json`) to the 0.8.0 document format (schemaVersion 3), follow these steps. The CLI has no conversion command, so the agent reads the old files and writes the new structure itself. Finish with a report in the form of the "Report" section.

In this guide, `gitifact` means the way to run the CLI that printed it (0.8.0 or later). Do not use a 0.7.x CLI. The 0.8.0 CLI refuses to read a schemaVersion 2 project, so read the files directly until step 3 changes the configuration.

## 1. Before you start

- `git status` must be clean. If there are uncommitted changes or staged files, stop and tell the user.
- If an **open branch** changed `.gitifact/` in the old format, tell the user to merge it before the migration and ask whether to merge or continue. Merging an old-format branch after the migration mixes the two formats, and `gitifact docs check` fails.
- The migration ends in a single commit. Confirm that you may commit. When possible, work on a new branch and merge after verification.
- Section 3 of this guide describes the whole new format. If a detail is unclear, run `gitifact init` and `gitifact docs new feature|requirement|design|wiki …` in an empty Git repository outside the project to see the skeletons the CLI writes, and check them with `gitifact docs check`.

## 2. Reading the old format

| Old file | Format |
| :--- | :--- |
| `.gitifact/spec/<feature>/requirements.md` | Frontmatter `id: S-…`, first body line `# Feature title`. A paragraph between `# title` and the first `## ` is the feature's introduction. Each requirement is a `## Requirement title` followed by a `<!-- gitifact-req: R-… -->` line; everything below it up to the next `## ` (outside code blocks) is the requirement body |
| `.gitifact/spec/<feature>/design.md` (when present) | Frontmatter `id` (the feature's S-) and optional `sources` (`title`, `path` or `url`, `note`). First body line `# Design title`; sections carry `<!-- gitifact-ref: R-…[, R-…] -->` |
| `.gitifact/spec/<feature>/history.jsonl` | One line per reason: `{"id":"H-…","requirements":[R-…],"designs":[S-…]?,"documents":[W-…]?,"reason":"…"}` |
| `.gitifact/wiki/**/*.md` | Frontmatter `id: W-…`, first body line `# Page title` |
| `.gitifact/wiki/history.jsonl` | The same reason lines, usually with `documents` |

Count before you start: features (`requirements.md` files), requirements (`gitifact-req` comments), designs (`design.md` files), wiki pages, and reason lines (non-empty lines of every history.jsonl). Section 4 compares against these counts.

## 3. Moving to the new structure

Every structural fact lives in frontmatter only. Bodies carry no `#` title and no `<!-- gitifact-` comments (code blocks excepted). `title` (200 characters) and `description` (300 characters) are single lines and both are required.

1. **Configuration:** set `schemaVersion` in `.gitifact/config.json` to 3. Leave `baseline` as it is.
2. **Features:** create `.gitifact/spec/<feature>/index.md`.
   ```markdown
   ---
   id: S-…            # the old requirements.md id, unchanged
   title: Feature title    # the old # title, unchanged
   description: One line saying what this feature is
   ---

   (The old introduction paragraph if there is one; otherwise one or two sentences on the feature's scope and purpose. A body is required.)
   ```
3. **Requirements:** create `.gitifact/spec/<feature>/requirements/<slug>.md` for each requirement. The slug names the title in lowercase English letters, digits and hyphens (80 characters at most). `order` follows the old file: 10, 20, 30… Move the old requirement body **without changing a character** (keep the `###` subheadings); only trim blank lines at its start and end.
   ```markdown
   ---
   id: R-…
   title: Requirement title
   description: One line saying what it requires
   order: 10
   ---

   (the old body, unchanged)
   ```
4. **Designs:** for each feature with an old design.md, run `gitifact docs new design <feature>/overview --title "<old design title>" --description "<one line>"` to get a D- ID. Replace the body of the `design/overview.md` it created with the old design body and remove the `draft: true` line. Then:
   - Remove the old `<!-- gitifact-ref: … -->` lines and list every R- ID they named, without duplicates, in the frontmatter `requirements`.
   - Move old `sources`: a `path` becomes `- id: W-…` for the wiki page it points to (with its `note`, if any); a `url` becomes `- title: …` / `url: …`.
   - Leave the rest of the body unchanged. Keep the `order: 10` that `docs new` wrote. Do not split a design into files per concern (data, interface, ui, errors, …) in the migration commit. Move it as one overview so the moved body can be compared, and split it afterwards in a separate commit following `gitifact guide show design`.
   - The frontmatter ends up like this. Sources in the new format have no `title`, so the old title of a wiki source is dropped.
     ```markdown
     ---
     id: D-…
     title: Old design title
     description: One line
     order: 10
     requirements:
       - R-…
       - R-…
     sources:
       - id: W-…
         note: the old note (if any)
       - title: Outside document title
         url: https://…
     ---
     ```
5. **Wiki:** pages stay where they are. Move the first body line `# Title` into the frontmatter `title` and add a `description`. Leave the rest of the body unchanged.
6. **Relative links:** requirements and designs moved, so fix relative links in document bodies that point to the old `requirements.md` or `design.md`, or that break because a file moved (requirement and design bodies are now one folder deeper). Do not edit bodies beyond fixing links.
7. **Reason file:** move the lines of every old history.jsonl into the single `.gitifact/history.jsonl`.
   - Each line is exactly `{"id":"H-…","docs":[…],"reason":"…"}`. Keep `id` and `reason` **unchanged**.
   - `docs` = the old `requirements` + `documents` + the old `designs`, with each S- replaced by that feature's new design D-. Remove duplicates; it must not be empty.
   - Oldest first is preferred (sort by `author-time` from `git blame --line-porcelain <file>`). For equal times, order by feature folder name, the wiki last, then the order within the file. If you cannot tell, keep each file's order.
   - Keep IDs of documents that were deleted long ago. A reason may name a deleted document.
8. **Delete the old files:** remove every `.gitifact/spec/<feature>/requirements.md`, `design.md`, `history.jsonl` and `.gitifact/wiki/history.jsonl` with a plain file deletion. Do not use `git rm`: it stages the deletion and the commit in section 5 refuses existing staging. If something is staged, unstage it with `git restore --staged <path>`.
9. **Merge rule:** run `gitifact init --skip-agents`. In an initialized project it changes no settings and only adds `/.gitifact/history.jsonl merge=union` to `.gitattributes`.

The mechanical parts (splitting files, converting reason lines) may be done with a one-off script. Keep the script outside the project and never commit it. Write slugs, descriptions and feature bodies yourself after reading the content. Every document needs a description, which makes this the largest part of the migration (82 for a project with 45 requirements and 19 wiki pages). A description should let a reader recognize in one line of a list what the document requires or covers; do not repeat the title, condense the user story or the first paragraph instead.

**Allowed exceptions:** normally only the CLI issues IDs and committed reasons are never edited. For this migration only, existing S-, R-, W- and H- IDs are copied over and reason lines change format. Never invent IDs (designs get their D- from `docs new`).

## 4. Checks

1. `gitifact docs check` must report no problems. Fix anything it reports.
2. Compare with the counts from section 2: features = number of `index.md`, requirements, designs (`design/overview.md` per feature), wiki pages, reason lines. Count documents with `gitifact docs list --format json` and reasons as lines of `.gitifact/history.jsonl`.
3. Check that every old ID is present. Collect old IDs from `git grep -ohE '(S|R|W)-[a-z2-7]{10}' HEAD -- .gitifact` at their definitions (frontmatter `id`, `gitifact-req` comments) and new IDs from `features[].id`, `features[].requirements[].id` and `wiki[].id` of `gitifact docs list --format json`. Every old reason's H- ID must be in `.gitifact/history.jsonl`.
4. The last lines of `gitifact changes list` must include `Document check: no problems`. Its other output is expected at this point: the old format does not parse as documents, so every document shows as `created`, every moved reason line as an uncommitted reason, and documents no old reason named (usually the features' S-) as documents without a reason. None of this blocks the commit.

## 5. Commit

Write JSON to the input path that `gitifact changes list` reports and run `gitifact changes commit --file <that path>`, first with `--dry-run`. `paths` is every path in `git status --porcelain --untracked-files=all` (`.gitifact/cache/` excludes itself and does not appear). Quote the user's request for the migration and the commit in `evidence`.

```json
{
  "paths": ["<every changed, new or deleted path: .gitifact/config.json, .gitattributes, the new documents, .gitifact/history.jsonl, the deleted old files>"],
  "message": "chore(gitifact): migrate to the 0.8.0 document format",
  "authorization": { "basis": "user-request", "evidence": "<the user's words asking for the migration and commit>" },
  "migration": true
}
```

- `migration: true` adds the `Gitifact-Migration: 0.8.0` trailer. That commit becomes the history boundary: activity before it stays visible in the viewer, and the commit itself does not appear as activity.
- Leave out `reasons`; the moved reason lines are enough.
- The deleted old files must be in `paths`; without them the CLI refuses the commit.

## 6. After the migration

- Refresh the GITIFACT block in the agent instruction files with `gitifact update`. If project instructions outside the block (AGENTS.md, CLAUDE.md, …) mention old commands such as `spec working`, `spec save`, `spec commit` or `docs <topic>`, ask the user whether to replace them with the new ones (`docs list`·`show`·`new`·`check`, `changes list`·`commit`, `guide show`) in a separate commit.
- If the old index of the 0.7.x browser exists at `<git common dir>/gitifact/` (usually `.git/gitifact/`), tell the user it can be deleted. 0.8.0 does not use it; leave the deletion to the user.
- The 0.8.0 cache lives in `.gitifact/cache/` and keeps itself out of Git. The first query reads the history from the start and may take a few seconds.
- The migration commit leaves bodies as they were, so wiki rules or specification bodies may still describe the old format (`requirements.md`, `spec save`, …). Report where, and agree with the user on fixing them in a separate commit.

## 7. Report

- Moved counts: features, requirements, designs, wiki pages, reasons (with the old counts)
- The `docs check` result and the comparison result
- Relative links fixed, anything not moved or that needed a judgment call
- The commit hash (if committed) and what remains (old commands in instructions, the old index)
