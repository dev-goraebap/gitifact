---
title: Project instruction format
description: The format of per-task instruction folders, the AGENTS.md index, how instructions relate to specs, assets and commits
---

Project instructions hold how work is done in this project: architecture rules, decisions that span features, writing style, verification steps. Requirements say what to build and a design says how one feature is built; instructions say how the project works regardless of feature. Keep feature behavior in specs and do not repeat it in instructions.

## Folders and files

An instruction is a folder, `.gitifact/instructions/<name>/`. Names use lowercase letters, digits and hyphens, up to 80 characters. The folder's `index.md` is the instruction document; split long content into files under `references/` in the same folder, and link to them from `index.md` with relative links.

```text
.gitifact/instructions/
  cli-architecture/
    index.md                 instruction document (I-)
    references/
      checklist.md           a long list
  verification/
    index.md
```

Create new instructions with the CLI. It issues an `I-` ID, fills in the frontmatter and adds `draft: true`. Write the body, remove that line and check with `gitifact check`.

```text
gitifact instructions new code-review --title "Code review" --description "What to check in a review and how to report it. Use when reviewing a change."
```

```markdown
---
id: I-value-issued-by-the-cli
title: Code review
description: What to check in a review and how to report it. Use when reviewing a change.
---

Rules and reasons. Long lists go in [references/checklist.md](references/checklist.md).
```

The ID and sentences above only show the structure. The frontmatter of `index.md` has only `id`, `title` and `description`, all required. The `description` says both what the instruction holds and for which work to read it. Do not repeat the title as a `#` heading in the body; start body sections at `##` and do not add gitifact comments. Reference files are not parsed as documents, so they have no frontmatter or ID and any format. Follow `gitifact guide show writing` for the prose.

Edit existing instructions directly. To rename one, move the folder and keep the ID; to delete one, delete the folder. If a design's `sources` still names a deleted instruction, fix that design too or `check` fails. An instruction folder without `index.md` is an `INSTRUCTION_INDEX_REQUIRED` problem.

## The AGENTS.md index

Agents read AGENTS.md in every session. Write, briefly and outside the GITIFACT block, which instruction to read for which work. The CLI rewrites the block, so do not put the index inside it.

```markdown
## Instructions by task

- When changing CLI code: `.gitifact/instructions/cli-architecture/index.md`
- Before verifying or committing a change: `.gitifact/instructions/verification/index.md`
```

When you create, rename or delete an instruction, update the index too. Short facts every session needs belong in AGENTS.md; content needed only for certain work belongs in an instruction.

## Relation to specs

Instructions do not point at specs. An instruction is knowledge that spans features; tied to one feature's spec, it goes stale when that spec changes. The only direction is a design listing the instructions it followed in `sources` as `{id: I-…}`. Markdown in an instruction folder that links under `.gitifact/spec/` is an `INSTRUCTION_SPEC_LINK` problem. A path pattern describing the storage format inside a code block is not a link.

Write links between instructions and to assets relative to the file, for example `../verification/index.md` or `../../assets/diagrams/flow.png`. `check` and `changes list` report a link without a target as a `MISSING_LINK_TARGET` warning.

## Decisions

An instruction keeps no decision table or decision log file of its own. Structure and technology choices that span features are written in the instruction body as rules; their context and the alternatives considered go into records that name the instruction (`gitifact guide show records`). Before changing an instruction, read how its decisions went with `gitifact records list --doc <I-ID>`. When a decision changes, change the rule in the body and write a new record.

When an instruction is created or widened, find the same content in designs with `gitifact specs list --q` and remove it there. Add the instruction to those designs' `sources`, and record the move in one record (`docs` naming the instruction and the designs changed).

## Assets

Keep images, PDFs and other non-Markdown files inside the instruction folder or under `.gitifact/assets/`: files one instruction uses go in its folder, files several documents share go in assets. For assets, the recommended extensions are png, jpg, gif, webp, svg and pdf, and the recommended size is at most 1 MB per file and 50 MB in total. Larger files can still be committed; `check` and `changes list` report them with `ASSET_SIZE`, `ASSET_EXTENSION` and `ASSETS_TOTAL_SIZE` warnings. Assets files no document references are reported with `UNREFERENCED_ASSET`.

## Commits

A change to an instruction is a change to its `index.md`; a record names it by its I- ID in `docs`. Other files of the folder may be listed in `paths` and committed along with it; a change to them alone needs no record (`gitifact guide show commit`).

## Agents

- Before changing requirements, designs or code, find the instructions for the area of work in the AGENTS.md index, read them and follow them. If none fits, say so and proceed.
- `gitifact instructions list` shows whether AGENTS.md exists and how many files each instruction folder holds. Read an instruction's `index.md` with `instructions show <name>` and a file of its folder with `instructions show <name> --file references/<file>`.
- If a request conflicts with an instruction, say so before proceeding. Whether to change the instruction is the user's call.
- When a new rule or decision spans features, suggest recording it in an instruction. If the user agrees, edit an existing instruction or create one with `gitifact instructions new`, and update the AGENTS.md index.
- The 0.7 wiki (`.gitifact/wiki/`) became instructions in 0.8.0. `check` reports any page left there as `WIKI_REMOVED`. Follow `gitifact guide show migrate` to move them.
