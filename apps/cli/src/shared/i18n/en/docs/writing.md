---
title: Document style
description: Shared style for wiki pages, requirements and designs, quotations and alerts, removing AI slop
---

Apply this to wiki pages, requirements, and designs. Use the project's language, independently of the CLI display language. Write direct, declarative prose and descriptive headings. Preserve UI text, quotations, and code.

## Prose and structure

- Start with the subject and rule. Explain responsibilities, dependency direction, or conditions directly instead of opening with “This document defines…”
- Keep one topic per paragraph. Include only the background and reasoning needed to understand the rule.
- Summarize system components and boundaries in architecture overviews; link to detailed rules instead of copying them.
- Use numbered lists for procedures, tables for comparisons and conditional behavior, and paragraphs for explanations. Avoid excessive headings or tables for short material.
- Use terminology consistently. Prefer familiar words and avoid repeatedly restating terms in another language.

## Specificity and accuracy

- Describe what happens and how, rather than claiming it “improves flexibility” or “strengthens reliability.”
- For work instructions, state where to run them, conditions, commands, and completion criteria. Distinguish failure from checks not performed.
- Distinguish current implementation, agreed rules, and proposed changes. Do not describe planned features or unperformed checks as complete.
- Preserve scope, exceptions, and constraints when shortening prose. Style edits must not alter decisions, ADR statuses or dates, identifiers, commands, or code examples.

## Quotations and alerts

Use ordinary blockquotes for quotations from documents or people. To call out supplementary information, prerequisites, or cautions, use [GitHub alert syntax](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts) when needed.

- `NOTE`: supplementary information that is easy to miss
- `TIP`: optional advice that helps with the task
- `IMPORTANT`: a prerequisite to know before starting
- `WARNING`: something to watch for to avoid a problem
- `CAUTION`: a risk such as data loss

```markdown
> [!IMPORTANT]
> Start Docker before running integration tests.
```

Skip alerts when ordinary prose is sufficient. One or two per document is the default, with more only where needed. Avoid consecutive alerts or nesting them inside lists or quotes. Each alert covers one topic in one or two sentences; give long explanations their own section. Do not convert ordinary quotations wholesale.

Use diagrams on the same basis: add a `mermaid` fence where a flow or state transition is easier to understand visually. Do not duplicate the same explanation in prose and a diagram. Designs may use diagrams too; one or two per document is the default.

## Remove filler

- Remove stock introductions and conclusions, repetitive summaries, and sentences that merely address the reader.
- Use emphasis and contrasts such as “What matters is…” or “Not just X, but Y” only when they make a necessary distinction.
- Remove unsupported adjectives such as “systematic,” “efficient,” “powerful,” and “seamless,” or replace them with specific behavior.
- Keep obvious explanations, narration of the writing process, and task-completion reports out of the document body. Put necessary change records in history documents.
- Avoid repeated bold text and warnings. Reserve warnings for conditions that can cause data loss or incorrect execution if missed.
- After editing, check whether each sentence conveys a rule, fact, reason, or procedure. Delete sentences that add no information.

| Avoid | Write instead |
| :--- | :--- |
| Perform thorough validation to ensure reliable merges. | Do not merge an MR when required CI checks fail. |
| Separate concerns clearly to improve maintainability. | The UI handles input and display; the server validates permissions and business rules. |
| It is important to keep documentation consistent. | Maintain shared rules in one document and link to it elsewhere. |

Apply these principles to user stories and acceptance criteria too. Preserve the story and condition/expected-behavior structure required by `gitifact docs spec`.
