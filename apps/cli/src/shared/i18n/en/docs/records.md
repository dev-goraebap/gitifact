---
title: Record format
description: When to write a record, the file and its sections, from draft to commit, and how to read records
---

A record keeps why a document looks the way it does. A document body holds only what is valid now, so the context and the options chosen that the body cannot explain go into records. A committed record is never edited. When a decision changes, write a new record; reading one document's records in order shows how its decisions went.

## When to write one

| Case | Record |
| :--- | :--- |
| Changing or removing what an existing requirement, design or instruction says | Write one. The old text is gone, so a record is the only place for the context |
| Choosing one of several options while creating or changing something | Write one. Alternatives considered do not go into the document body |
| Simply adding a new requirement | None. The user story is the reason |
| A document changed as a consequence of another decision | None of its own. Add the document to that decision's `docs` |
| A typo or wording fix | None |

Record a decision when it is made. Written at commit time from memory, context such as the alternatives considered gets lost. One task with several decisions has several records.

## The file

A record is one file, `.gitifact/records/<yyyymmdd>/<DR-ID>.md`. Create it with the CLI, which issues the ID and writes it in the folder of today's date (created on the first record of the day) with the required sections and `draft: true`.

```text
gitifact records new --title "30-day retention of deleted posts" --docs R-…,D-…
```

```markdown
---
id: DR-value-issued-by-the-cli
title: 30-day retention of deleted posts
docs:
  - R-actual-changed-requirement
  - D-actual-changed-design
---

## Context

About 20 requests a month ask to restore a post deleted by mistake.

## Decision

A deleted post stays in the trash for 30 days; a cleanup job then removes it for good.

## Alternatives considered

- Remove at once (restore requests cannot be met)
- Keep forever (storage keeps growing)
```

The ID and sentences above only show the structure. Fill in the sections, then remove the `draft: true` line; a record that still has it cannot be committed.

- **`title`:** one line of at most 80 characters. It names the record on the browser's decision records page and in `docs history`. Write a short noun phrase naming what was decided (for example `500-character section limit`, `Removal of decision tables from documents`, `One decision per commit recommended`), not a sentence, not only the topic (`500-character section limit`, not `Section length`); the reason goes in a section.
- **`docs`:** IDs of the documents the record explains, including ones it deletes. Documents changed as a consequence go here too.
- **Author and time:** not in the file. They are read from the commit that added the record.

| Section | Required | Content |
| :--- | :--- | :--- |
| Context | Yes | What called for the decision: the problem, request or constraint |
| Decision | Yes | What was decided |
| Alternatives considered | No | Options actually weighed and not chosen, with why |

The body holds only these `##` sections. Headings may be in English (`## Context`) or Korean (`## 맥락`). A section not in the list, or one that appears twice, is a `docs check` problem. Write alternatives only when options were actually weighed; do not make them up. When there were none, as in most requirement changes, leave the section out.

## Length

Write two to five sentences each for the context and the decision. The context says what the problem was (what was seen and any numbers measured), who asked for what, and the constraints to keep. The decision says what was decided, how far it applies and its exceptions. Do not pad a section with what nothing supports. A section over 500 characters is a `docs check` problem (`RECORD_SECTION_TOO_LONG`). List alternatives one per line with why they were not chosen in brackets. Leave out the history, the measuring and the old ways. API fields, implementation steps and test notes stay in the design or the commit, not the record. If a longer explanation is needed, put it in the design or instruction body and keep only the gist in the record. Follow `gitifact guide show writing` for the prose.

## Committing

Commit a record with the documents it explains by listing its file in the commit input's `paths` (`gitifact guide show commit`). One decision per commit is the default, together with its documents, code and tests. When a file spans two decisions, commit both records together. `changes list` shows which documents each record explains and which documents two records explain.

A committed record is not edited or deleted. If it is, `docs check` reports `RECORD_ALTERED` and the commit is refused; restore it from HEAD and write the changed decision as a new record.

## Reading

| Command | When |
| :--- | :--- |
| `gitifact docs history <ID>` | Before changing a document, read how its decisions went: each record's title and sections with its commit |
| `gitifact records show <DR-ID>` | One record as written and the commit that added it |

Do not read or grep every file under `.gitifact/records/`. Records are placed only by day and ID, so gathering them by document means reading them all; `docs history` finds them through the cache's index.
