This wiki holds architecture decision records (ADRs).

## Decision records

When making or changing a structural or technical choice that spans features, add a record under `adr/`. File names use a four-digit number followed by lowercase letters, digits and hyphens, such as `0001-use-postgres.md`. Numbers only increase. Choices confined to one feature belong in that feature's design (`design/overview.md`).

```markdown
---
id: W-issued-by-the-CLI
title: Decision NNNN. Title
description: What was decided, in one line
---

Status: Accepted · YYYY-MM-DD

## Context
The problem and constraints.

## Decision
What was decided and how it will work.

## Consequences
Benefits, costs, rejected alternatives, and reasons.
```

Statuses are `Proposed`, `Accepted`, `Deprecated`, and `Superseded by NNNN`. Do not rewrite existing records. When a decision changes, add a new record and change only the old record's status to `Superseded by NNNN`.

## Agents

- Read and follow relevant decision records before changing requirements, designs, or code.
- When a choice merits a record, propose adding one; if the user agrees, create it with `gitifact docs new wiki adr/NNNN-<name>.md` and fill it in.
