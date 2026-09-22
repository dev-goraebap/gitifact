---
title: Feature design format
description: Design outline, references and sources, revisions
---

A feature's `design.md` explains the shared structure and processing that implement its requirements.

## File structure

The CLI writes the owning specification's S-ID as `id` in frontmatter. List reference documents in frontmatter `sources`. Each entry has a `title`, either a `path` (a relative path from this file to a `.md` wiki page) or a `url` (http/https), and an optional `note`. Use this list to manage references instead of scattering them throughout the body. The browser shows them as cards on the design tab; it does not fetch external titles or previews.

```markdown
---
id: S-actual-owning-specification-ID
sources:
  - title: Architecture
    path: ../../wiki/architecture.md
    note: Layers and dependency direction
  - title: Library documentation
    url: https://example.test/docs
---

# Posts design

## Overview
Scope and implementation approach.

## Processing flow
<!-- gitifact-ref: R-actual-related-requirement-ID -->
The main flow from input to result.
```

This is a structural example. Fill it with known project details before saving; do not save placeholder IDs or instructional sentences. Reference actual requirements at section level with `<!-- gitifact-ref: R-ID, R-ID -->`. Examples inside code fences do not count as references. The browser resolves body links such as `../../assets/flow.png` to their destinations.

Follow `gitifact docs writing` for prose, diagrams, and alerts. Use the project's language.

## Saving and references

Use `set-design` in `spec save` operations (type, feature, title, body, and optional sources array). A single request may include create, add, and set-design to save both files. The CLI writes frontmatter; it does not create empty designs automatically. Obtain new R-IDs from the result, then add references to the relevant design sections in a follow-up save. Never invent IDs in advance. Delete a design with `delete-design` (type and feature).

For `MISSING_DESIGN_REFERENCE` warnings from working/save, check the source and whether the requirement was deleted or moved, then correct it where appropriate. `MISSING_LINK_TARGET` means a sources path or body link has no target. Do not claim a link is valid while ignoring the warning.

## When to write a design

Prepare requirements.md and design.md together for a new feature by default. Follow a request for requirements only, and do not generate designs for every existing specification just because they are missing. Designs are optional in the format; no staged approval process is required. Ask about consequential uncertainties only. tasks.md is not supported yet.

## Sections

Use only the sections needed from this outline: Overview / Structure and data / Processing flow / Error handling and validation / Key design decisions / Open questions. Distinguish agreements, observations, and proposals. Explain consequential alternatives and reasons for the choice. A list of decisions does not replace an implementation explanation. Omit open questions if there are none.

Before writing a design, read the wiki's architecture and rules pages and list the ones followed in `sources`. If the design conflicts with wiki guidance, agree with the user whether to revise that guidance first.

## Revisions

Read the existing design and related requirements before changing affected sections. Maintain the current design instead of rewriting the entire document each time; Git preserves earlier versions. Review the design when requirements change. A design-only change does not require a manufactured requirements change.
