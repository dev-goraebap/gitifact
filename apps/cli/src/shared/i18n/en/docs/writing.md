---
title: Document style
description: Shared style for instructions, requirements and designs, body versus change reasons, quotations, alerts and diagrams, removing AI slop
---

Apply this to project instructions, requirements, and designs. Use the project's language, independently of the CLI display language. Write direct, declarative prose and descriptive headings. Preserve UI text, quotations, and code.

## Prose and structure

- Start with the subject and rule. Explain responsibilities, dependency direction, or conditions directly instead of opening with “This document defines…”
- Keep one topic per paragraph and put its point in the first sentence. Aim for three or four sentences per paragraph. When a paragraph runs longer, check whether it holds two topics and split it or move it into a table.
- Summarize system components and boundaries in architecture overviews; link to detailed rules instead of copying them.
- Use numbered lists for procedures, tables for comparisons and conditional or case-by-case behavior, diagrams for flows, state transitions and component relations, and paragraphs for explanations. Avoid excessive headings or tables for short material.
- Use terminology consistently. Prefer familiar words and avoid repeatedly restating terms in another language.

## Specificity and accuracy

- Describe what happens and how, rather than claiming it “improves flexibility” or “strengthens reliability.”
- For work instructions, state where to run them, conditions, commands, and completion criteria. Distinguish failure from checks not performed.
- Distinguish current implementation, agreed rules, and proposed changes. Do not describe planned features or unperformed checks as complete.
- Preserve scope, exceptions, and constraints when shortening prose. Style edits must not alter decisions, ADR statuses or dates, identifiers, commands, or code examples.

## What is current and how it got there

The body states only the behavior and rules that hold now. “We used to … but changed it because …”, the date and trigger of a change, the old approach, and the measurements behind a choice stay out of the body and go into the commit's change reason (`gitifact guide show commit`). Readers find reasons with `gitifact docs history <ID>` and old text with `gitifact docs show <ID> --ref <commit>`.

When revising, rewrite the sentences that changed instead of appending sentences about the old behavior. Decisions that must not be reversed and rejected alternatives are current constraints, not history. In a design they go one per row in the decision table of `overview.md` (`gitifact guide show design`); when they span features, they go in the decision table of that area's instruction (`gitifact guide show instructions`).

## Quotations and alerts

Use ordinary blockquotes for quotations from documents or people. Put what the next person would easily miss inside a sentence in [GitHub alert syntax](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts).

| Kind | Where it goes | Examples in designs and instructions |
| :--- | :--- | :--- |
| `IMPORTANT` | Invariants that must not be broken, prerequisites to know before starting | Source files are never modified; failures are never swallowed |
| `WARNING` | Conditions whose breach causes a security problem or wrong behavior | Do not widen a route that is open without authentication |
| `CAUTION` | Risks that are hard to undo, such as data loss | This command deletes records |
| `NOTE` | Known limits, planned removals, supplementary information that is easy to miss | This case cannot be told apart; this code is removed in the next major version |
| `TIP` | Optional advice that helps with the task | A command for checking the result |

```markdown
> [!IMPORTANT]
> Start Docker before running integration tests.
```

Skip alerts when ordinary prose is sufficient. One or two per file is the norm, with more only where needed. Avoid consecutive alerts or nesting them inside lists or quotes. Each alert covers one topic in one or two sentences; give long explanations their own section. Do not convert ordinary quotations wholesale.

## Diagrams

Add a ` ```mermaid ` fence where a flow, an exchange, states or relations read faster as a picture than as text. Pick the kind that fits the content first.

| Content | Kind |
| :--- | :--- |
| A processing flow that branches or joins, decisions | `flowchart` |
| Requests and responses passed between components in turn | `sequenceDiagram` |
| The states something goes through and what moves it | `stateDiagram-v2` |
| Tables or entities of a storage structure and their relations | `erDiagram` |
| The shape of commit history, such as branches and merges | `gitGraph` |
| Dependencies and composition of modules or types | `classDiagram`, or groups in a `flowchart` |

Some content does not fit a picture: a sequence that runs in one line is a numbered list, and a mapping from conditions to results is a table.

- Name boxes with short nouns. Details such as commands, paths and settings go in a table or prose below the diagram.
- Keep to ten boxes or fewer, and five or fewer side by side. When longer, draw top to bottom (`TD`) or split the diagram.
- Declare the main flow first and branches after it. Use diamonds only for decisions, with labels of a few words.
- Group boxes of the same source or module in a `subgraph`. Label edges only with conditions, in two or three words.
- Do not use colors, `classDef` or `style`; the reader's display mode and palette decide colors.
- Do not retell in prose what the diagram shows; the prose adds only the conditions and exceptions it leaves out.

## Remove filler

- Remove stock introductions and conclusions, repetitive summaries, and sentences that merely address the reader.
- Use emphasis and contrasts such as “What matters is…” or “Not just X, but Y” only when they make a necessary distinction.
- Remove unsupported adjectives such as “systematic,” “efficient,” “powerful,” and “seamless,” or replace them with specific behavior.
- Keep obvious explanations, narration of the writing process, and task-completion reports out of the document body. Put how something changed in the commit's change reason.
- Avoid repeated bold text and warnings. Emphasize only where “Quotations and alerts” calls for it.
- After editing, check whether each sentence conveys a rule, fact, reason, or procedure. Delete sentences that add no information.

| Avoid | Write instead |
| :--- | :--- |
| Perform thorough validation to ensure reliable merges. | Do not merge an MR when required CI checks fail. |
| Separate concerns clearly to improve maintainability. | The UI handles input and display; the server validates permissions and business rules. |
| It is important to keep documentation consistent. | Maintain shared rules in one document and link to it elsewhere. |

Apply these principles to user stories and acceptance criteria too. Preserve the story and condition/expected-behavior structure required by `gitifact guide show spec`.
