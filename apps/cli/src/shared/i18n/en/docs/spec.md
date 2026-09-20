# Markdown specification format

Each feature has a `.gitifact/spec/<feature>/requirements.md` containing its requirements. Its design is in `design.md` in the same folder (`gitifact docs design`); reasons for changes are in `history.jsonl`.

## Files and IDs

Use S-IDs and R-IDs exactly as issued by the CLI. They have the form `S-<random>` and `R-<random>`, with ten lowercase base32 characters. Do not put feature names into R-IDs or invent example IDs for actual saves. Files start with frontmatter; each requirement heading is immediately followed by its ID comment.

```markdown
---
id: S-issued-by-the-CLI
---

# Posts

## Create a post
<!-- gitifact-req: R-issued-by-the-CLI -->

As a post author, I want to save a title and body so that I can return to my writing later.

### Acceptance criteria

1. Condition: The user requests a save with an empty title.
   Expected behavior: The system asks for a title and does not save the post.
```

These IDs illustrate the structure and are not valid input. Frontmatter contains only `id`. Use one top-level heading (`#`) and `##` for requirements. Do not add other gitifact comments to the body. Links to other documents are relative to this file, such as `../../wiki/architecture.md` or `../../assets/flow.png`. The browser resolves them to their destinations. `spec working` reports missing targets as `MISSING_LINK_TARGET`.

## Saving

Use the stamp from `spec working` to prepare this JSON, write it to the returned `inputs.save` path, and run `spec save --file <that-path>`. The CLI removes the input file on success. On failure, the file remains; correct it and retry.

```json
{
  "expected": "actual stamp from working",
  "operations": [
    { "type": "create", "feature": "posts", "title": "Posts" },
    { "type": "add", "feature": "posts", "title": "Create a post", "body": "As a post author, I want to save a title and body so that I can return to my writing later.\n\n### Acceptance criteria\n\n1. Condition: The user requests a save with an empty title.\n   Expected behavior: The system asks for a title and does not save the post." },
    { "type": "set-design", "feature": "posts", "title": "Posts design", "body": "## Overview\n\nAgreed approach and scope.\n\n## Structure and data\n\nComponents and storage needed for implementation." }
  ]
}
```

The command group is `gitifact spec`. Use `update` with id, title, and body for an existing requirement; `move` with id and feature to move one; and `rename-spec` with id and title to rename a specification. Pass actual R-IDs or S-IDs obtained from a query. Dedicated requirement deletion and feature-folder renaming commands are not available. Do not invent commands or migration procedures for unsupported operations.

Include designs in the same request with `set-design` (type, feature, title, body, and optional sources). Read `gitifact docs design` for design rules and `gitifact docs wiki` for wiki pages and assets.

Follow `gitifact docs writing` for prose. Its style rules do not replace the user-story structure and condition/expected-behavior format below. Write project content in the project's language; the language of these instructions does not change it.

## Grouping features

Group requirements into cohesive features that mean something to users. Do not reproduce code modules or DDD layers. Check whether an existing specification is a suitable home first. Keep a requirement's ID when its title or folder changes, including when correcting a misplaced requirement. Do not duplicate it under a new ID. Use the feature name as the specification title without a suffix such as “requirements.”

## User stories and acceptance criteria

Start each requirement with a user story: one or two sentences explaining who wants what and why. The default pattern is “As a [role], I want [goal] so that [reason],” expressed naturally in the project's language. Use an actual user or operator of the product. Do not copy the post author in this example, or a Gitifact user, into an unrelated product.

Follow the story with an acceptance-criteria heading and numbered condition/expected-behavior pairs, in the project's language. Do not substitute paths, IDs, or storage conventions for user goals. Put additional agreed constraints in a scope-and-constraints section and implementation details in the design. Base roles, goals, and reasons on the conversation and verified context. Do not invent motives to fill the template; ask only for information needed to settle the meaning.

Apply this to new requirements and those being revised for the current request. Preserve existing IDs, agreed constraints, and the meaning of acceptance criteria. Do not rewrite unrelated requirements in bulk. Before saving, check that the story states a role, goal, and reason, and that its criteria determine success or failure. The CLI does not enforce particular sentences or validate user intent.

Refine specification drafts during the conversation. Do not record a reason or event for every intermediate edit. While changing code and tests, bring requirements into line with the final agreement.
