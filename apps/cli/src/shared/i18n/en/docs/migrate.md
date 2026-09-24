---
title: Migrating a 0.7 project
description: Steps, checks and the migration commit for moving a schemaVersion 2 project to the 0.8.0 document format
---

When the user asks to move a 0.7 project (`schemaVersion: 2` in `.gitifact/config.json`) to the 0.8.0 document format (schemaVersion 3), follow these steps. The CLI has no conversion command, so the agent reads the old files and writes the new structure itself. Finish with a report in the form of the "Report" section.

In this guide, `gitifact` means the way to run the CLI that printed it (0.8.0 or later). Do not use a 0.7.x CLI. The 0.8.0 CLI refuses to read a schemaVersion 2 project, so read the files directly until step 3 changes the configuration.

## 1. Before you start

- `git status` must be clean. If there are uncommitted changes or staged files, stop and tell the user.
- If an **open branch** changed `.gitifact/` in the old format, tell the user to merge it before the migration and ask whether to merge or continue. Merging an old-format branch after the migration mixes the two formats, and `gitifact check` fails.
- The migration ends in a single commit. Confirm that you may commit. When possible, work on a new branch and merge after verification.
- Section 3 of this guide describes the whole new format. If a detail is unclear, run `gitifact init` and `gitifact specs new feature|requirement|design|instruction …` in an empty Git repository outside the project to see the skeletons the CLI writes, and check them with `gitifact check`.

## 2. Reading the old format

| Old file | Format |
| :--- | :--- |
| `.gitifact/spec/<feature>/requirements.md` | Frontmatter `id: S-…`, first body line `# Feature title`. A paragraph between `# title` and the first `## ` is the feature's introduction. Each requirement is a `## Requirement title` followed by a `<!-- gitifact-req: R-… -->` line; everything below it up to the next `## ` (outside code blocks) is the requirement body |
| `.gitifact/spec/<feature>/design.md` (when present) | Frontmatter `id` (the feature's S-) and optional `sources` (`title`, `path` or `url`, `note`). First body line `# Design title`; sections carry `<!-- gitifact-ref: R-…[, R-…] -->` |
| `.gitifact/spec/<feature>/history.jsonl` | One line per reason: `{"id":"H-…","requirements":[R-…],"designs":[S-…]?,"documents":[W-…]?,"reason":"…"}` |
| `.gitifact/wiki/**/*.md` | Frontmatter `id: W-…`, first body line `# Page title` |
| `.gitifact/wiki/history.jsonl` | The same reason lines, usually with `documents` |

Count before you start: features (`requirements.md` files), requirements (`gitifact-req` comments), designs (`design.md` files) and wiki pages. Section 4 compares against these counts.

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
4. **Designs:** for each feature with an old design.md, run `gitifact specs new design <feature>/overview --title "<old design title>" --description "<one line>"` to get a D- ID. Replace the body of the `design/overview.md` it created with the old design body (without its first line `# Design title`) and remove the `draft: true` line. Then:
   - Remove the old `<!-- gitifact-ref: … -->` lines and list every R- ID they named, without duplicates, in the frontmatter `requirements`.
   - Move old `sources`: a `path` becomes `- id: W-…` for the wiki page it points to (with its `note`, if any); a `url` becomes `- title: …` / `url: …`. The W- becomes the I- of the instruction that page moves to in step 5.
   - Leave the rest of the body unchanged. Keep the `order: 10` that `specs new` wrote. Do not split a design into files per concern (data, interface, ui, errors, …) in the migration commit. Move it as one overview so the moved body can be compared, and split it afterwards in a separate commit following `gitifact guide show design`.
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
       - id: I-…
         note: the old note (if any)
       - title: Outside document title
         url: https://…
     ---
     ```
5. **Wiki → instructions:** in 0.8.0 the wiki became project instructions (`gitifact guide show instructions`). `check` refuses pages left in `.gitifact/wiki/` with `WIKI_REMOVED`, so move every page into an instruction folder. Before moving, show the user a table of which page becomes which file of which instruction and get their confirmation. If the user changes the grouping, follow it.

   | Old location | New location |
   | :--- | :--- |
   | `wiki/README.md` (policy and entry page) | If it is still the default policy `init` wrote (decision records collected under `adr/`), delete it without moving. If the project rewrote it, move it like a root page to the `index.md` of instruction `overview`. Whether its wiki rules move to AGENTS.md is decided in section 6 |
   | Root page `wiki/<name>.md` | `index.md` of instruction `<name>`. Upper-case names become lower case (`ARCHITECTURE.md` → `architecture`) |
   | Top-level folder `wiki/<folder>/` | Instruction `<folder>`. The folder's `README.md`, if any, becomes `index.md`; the other pages become `references/<path inside the folder>` |
   | Folder with the same name as a root page | One instruction; the root page is `index.md` |

   - For each instruction, run `gitifact instructions new <name> --title "<title>" --description "<one line>"` to get an I- ID. The title is the old title of the page that becomes `index.md`. For a folder without such a page, name the topic the folder holds (for example `handbook` → Team handbook). The description says what the instruction holds and for which work to read it.
   - For the page that becomes `index.md`, drop the first body line `# Title` and move the rest unchanged: replace the body `specs new` wrote with it and remove the `draft: true` line. If a folder has no page to become `index.md`, write one line per reference file in the body, with its old title and a link.
   - Pages moved to references keep the old file as it is (including the `# Title` line); remove only the frontmatter and the blank line after it, so the file starts with `# Title`. Reference files are not parsed as documents and have no ID.
   - Move images and other non-Markdown files from the wiki folder into the instruction folder that uses them.
   - Instructions cannot point at specs (`INSTRUCTION_SPEC_LINK`). In the moved files, reduce links under `.gitifact/spec/` from `[text](path)` to their text. Other relative links are fixed for the new location in step 6.
   - Design `sources` that named a wiki page W- in step 4 now name the I- of the instruction that page moved to. If a design ends up naming the same instruction twice, merge the two and join the notes with `; `.
   - The old W- IDs disappear from documents and stay only in the reasons of 0.7 commits.
   - Do not turn the wiki's decision record (ADR) pages into record files or regroup instructions in the migration commit. Move bodies unchanged so they can be compared, and polish them in a separate commit after the migration.
6. **Relative links:** requirements and designs moved, so fix relative links in document bodies that point to the old `requirements.md` or `design.md`, or that break because a file moved (requirement and design bodies are now one folder deeper). Point links to wiki pages at the instruction files the pages moved to, and fix links inside moved instruction files for their new location. Do not edit bodies beyond fixing links.
7. **Reasons:** do not move the reasons in the old history.jsonl files. They stay in the 0.7 commits and remain visible in the history (`records list --doc`, the browser) after the migration. Reasons for changes from 0.8.0 on are kept in records (`gitifact guide show records`). The migration commit gets no records; it is hidden from the history.
8. **Delete the old files:** remove every `.gitifact/spec/<feature>/requirements.md`, `design.md`, `history.jsonl` and the whole `.gitifact/wiki/` folder (including `wiki/history.jsonl`), once step 5 has moved every page, with a plain file deletion. Do not use `git rm`: it stages the deletion and the commit in section 5 refuses existing staging. If something is staged, unstage it with `git restore --staged <path>`.

The mechanical parts (splitting files, moving wiki pages) may be done with a one-off script. Keep the script outside the project and never commit it. Write slugs, descriptions and feature bodies yourself after reading the content. Every feature, requirement and instruction needs a description, which makes this the largest part of the migration (68 for a project with 18 features, 45 requirements and 5 instructions). A description should let a reader recognize in one line of a list what the document requires or covers; do not repeat the title, condense the user story or the first paragraph instead.

**Allowed exceptions:** normally only the CLI issues IDs and committed reasons are never edited. For this migration only, existing S- and R- IDs are copied over. Never invent IDs (designs get their D- and instructions their I- from `specs new`).

## 4. Checks

1. `gitifact check` must report no problems. Fix anything it reports.
2. Compare with the counts from section 2: features = number of `index.md`, requirements, designs (`design/overview.md` per feature), wiki pages (the `index.md` and reference files in the step 5 table together). Count documents with `gitifact specs list --format json` and `gitifact instructions list --format json`.
3. Check that every old ID is present. Collect old IDs from `git grep -ohE '(S|R)-[a-z2-7]{10}' HEAD -- .gitifact` at their definitions (frontmatter `id`, `gitifact-req` comments) and new IDs from `documents[].id` of `gitifact specs list --format json`. No `.gitifact/wiki/` or `history.jsonl` file may remain and no design `sources` may name a W-.
4. The last lines of `gitifact changes list` must include `Document check: no problems`. Its other output is expected at this point: the old format does not parse as documents, so every document shows as `created`. New documents need no record. None of this blocks the commit.

## 5. Commit

Write JSON to the input path that `gitifact changes list` reports and run `gitifact changes commit --file <that path>`, first with `--dry-run`. `paths` is every path in `git status --porcelain --untracked-files=all` (`.gitifact/cache/` excludes itself and does not appear). Quote the user's request for the migration and the commit in `evidence`.

```json
{
  "paths": ["<every changed, new or deleted path: .gitifact/config.json, the new documents, the deleted old files>"],
  "message": "chore(gitifact): migrate to the 0.8.0 document format",
  "authorization": { "basis": "user-request", "evidence": "<the user's words asking for the migration and commit>" },
  "migration": true
}
```

- `migration: true` adds the `Gitifact-Migration: 0.8.0` trailer. That commit becomes the history boundary: activity before it stays visible in the viewer, and the commit itself does not appear as activity.
- Add no records; the 0.7 reasons are read from the 0.7 commits.
- The deleted old files must be in `paths`; without them the CLI refuses the commit.

## 6. After the migration

- Refresh the GITIFACT block in the agent instruction files with `gitifact update`. If project instructions outside the block (AGENTS.md, CLAUDE.md, …) mention old commands such as `spec working`, `spec save`, `spec commit` or `docs <topic>`, ask the user whether to replace them with the new ones (`list`, `show` and `new` of `specs`, `instructions` and `records`, `check`, `changes list`·`commit`, `guide show`) in a separate commit.
- If the old index of the 0.7.x browser exists at `<git common dir>/gitifact/` (usually `.git/gitifact/`), tell the user it can be deleted. 0.8.0 does not use it; leave the deletion to the user.
- The 0.8.0 cache lives in `.gitifact/cache/` and keeps itself out of Git. The first query reads the history from the start and may take a few seconds.
- If the wiki README moved to instruction `overview` holds rules for running the wiki (what goes where), agree with the user whether to move them to AGENTS.md or another instruction. Then write the instruction index outside the GITIFACT block of AGENTS.md: one line per instruction saying for which work to read it ("The AGENTS.md index" in `gitifact guide show instructions`). Ask the user whether to record this in a commit separate from the migration.
- Turning the ADRs moved to references into records (`gitifact guide show records`) while leaving only the rules to keep in the instruction body, and regrouping instructions, are agreed with the user and done in a separate commit. The migration commit is hidden, so records written in that later commit are the ones the history shows.
- The migration commit leaves bodies as they were, so instructions or specification bodies may still describe the old format (`requirements.md`, `spec save`, …) or refer to the wiki. Report where, and agree with the user on fixing them in a separate commit.

## 7. Report

- Moved counts: features, requirements, designs, wiki pages (with the old counts), and the table of instructions the wiki pages moved to
- The `check` result and the comparison result
- Relative links fixed, anything not moved or that needed a judgment call
- The commit hash (if committed) and what remains (old commands in instructions, the old index)
