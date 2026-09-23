---
title: Feature design format
description: Design axes and splitting files, frontmatter, diagrams, revisions
---

A feature's design is the set of files under its `design/` folder. It explains the structure and processing that implement the feature's requirements. Each file covers one view (axis) of the design.

## Axes and splitting files

| File | Covers |
| :--- | :--- |
| `overview.md` (required) | Scope and approach, components and boundaries, decision table, open questions |
| `data.md` | Storage format, data structures and relations, caches, state and lifetime |
| `interface.md` | Commands, APIs and contracts, inputs and outputs, boundaries with other modules |
| `ui.md` | Screen layout and routes, display flow, interaction |
| `errors.md` | Error handling, input validation, recovery, what is tested |

A feature with any design must have `overview.md`. The other axes are recommended; create only the ones you need. If the feature is small and each view fits in a paragraph or two, keep everything in `overview.md`. Move a view into its own axis file when it grows to several sections or changes independently of the others. Do not create empty axis files or files that only fill in a template. If a view outside the table is needed, add a file with a lowercase, digits and hyphens slug.

Do not write the same content in two files. `overview.md` does not repeat the details of other axes; it is enough that a reader can tell which axis files exist.

## File structure

Create a file with `gitifact docs new design <feature>/<axis> --title "<title>" --description "<one line>"`. The CLI issues a D- ID, sets `order` to the highest in the folder plus 10, and adds `draft: true`. After writing the body, delete the `draft: true` line and check with `gitifact docs check`. Do not make up IDs.

```markdown
---
id: D-value-issued-by-the-CLI
title: Post storage
description: Storage format for posts and attachments and the cleanup order on delete
order: 20
requirements:
  - R-actual-related-requirement
sources:
  - id: W-actual-wiki-page-consulted
    note: Layers and dependency direction
  - title: Library docs
    url: https://example.test/docs
---

Posts are ...
```

The IDs and sentences above illustrate the structure. Fill in real values; do not save the example as is.

- **`title`, `description`:** Required, one line each. Do not repeat the title as a `#` heading in the body. Body sections start at `##` and contain no gitifact comments.
- **`order`:** Order the files so the feature is easy to follow. Overview comes first; the default after it is data → interface → ui → errors. Values must not repeat within the folder.
- **`requirements`:** Only the R- IDs this file actually explains. Several design files may point to the same requirement. Do not copy every requirement of the feature into every file.
- **`sources`:** Documents this file is based on. Documents in the repository are listed by ID as `{id, note?}`; external material as `{title, url, note?}`. The browser shows this list as source cards. It does not fetch titles or previews of external pages.

Relative links in the body (such as `../../../assets/flow.png`) are relative to this file, and the browser links them to their targets. Relations between documents are expressed in frontmatter, not links.

## Writing the body

Follow `gitifact guide show writing` for style. The body describes the current structure and behavior; how it changed, when, and the old approach go into the commit's change reason. Separate what is decided, what was observed in the implementation, and what is proposed. A list of decisions does not replace an explanation of the implementation.

Decisions that are hard to reverse and rejected alternatives go one per row in a table under `## Decisions` in `overview.md`. Other axis files do not restate the reasons for those decisions.

```markdown
## Decisions

| Decision | Reason | Rejected |
| :--- | :--- | :--- |
| A cleanup job deletes attachments after a post is deleted | The delete request does not slow down with the number of files | Deleting them in the request (times out with many attachments) |
```

For diagrams, follow `gitifact guide show writing` for choosing the kind and drawing it, and place each in the file for the axis it explains. Each axis has kinds that suit it: `erDiagram` and a `flowchart` of cache or read flows for data, a `sequenceDiagram` of requests between components for interface, a `stateDiagram-v2` of screen states for ui, and failure and recovery flows for errors.

Before writing a design, read the wiki's structure and rules pages and list the pages you followed in `sources`. If the design conflicts with the wiki, agree with the user on which document to change first.

## When to write one

When shaping a new feature, write requirements and design together by default. If the user asks only for requirements, do that, and do not bulk-create designs for existing features that have none. Do not enforce step-by-step approval; ask only about important unknowns.

## Revisions

Before revising, read the feature's design files and the related requirements, and change only the files affected. Rewrite the sentences that changed instead of appending “previously we …” sentences. How it changed goes into the change reason, and Git keeps the old text. When a decision changes, edit its row in the decision table. When a requirement changes, review the designs that point to it ("Referenced by" in `gitifact docs show <R-ID>`); when only the design changes, do not force changes to requirements.

When splitting a large file into axes or merging files, only move sentences; do not edit content in the same commit. After moving, check that every sentence of the old file is present in the new files. Keep IDs when moving files, and make sure the `requirements` of a deleted file moved to the remaining files. When committing, list the D- IDs of changed designs in the change reason's `docs` (`gitifact guide show commit`).
