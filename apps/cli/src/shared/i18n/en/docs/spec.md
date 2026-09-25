---
title: Requirement format
description: Feature and requirement files, frontmatter, user stories and acceptance criteria, creating, editing and moving
---

A feature is one folder, `.gitifact/spec/<feature>/`. The feature introduction is `index.md`, each requirement is its own `requirements/<slug>.md`, and the design is the files under `design/` (`gitifact guide show design`). Why a document changed is kept in records (`.gitifact/records/`, `gitifact guide show records`).

```text
.gitifact/spec/posts/
  index.md                 feature introduction (S-)
  requirements/
    create.md              one requirement (R-)
    delete.md
  design/
    overview.md            design (D-)
```

## Creating

Create files through the CLI. It issues the ID, fills in the frontmatter and writes a body skeleton.

```text
gitifact specs new feature posts --title "Posts" --description "Writing, editing and deleting posts"
gitifact specs new requirement posts/create --title "Create a post" --description "An author saves a post with a title and body"
```

A new file carries `draft: true`. Fill in the body, remove that line and run `gitifact check`. While the line remains, `check` and `changes commit` fail. Do not invent IDs or copy another document's ID.

## File structure

```markdown
---
id: R-issued-by-the-CLI
title: Create a post
description: An author saves a post with a title and body
order: 10
---

As a post author, I want to save a title and body so that I can return to my writing later.

### Acceptance criteria

1. Condition: The user requests a save with an empty title.
   Expected: The system asks for a title and does not save the post.
```

These IDs and sentences illustrate the structure and are not valid input.

- **`id`:** issued by the CLI. Features use `S-`, requirements `R-`, followed by ten lowercase base32 characters. It stays the same when the file moves or its title changes.
- **`title` and `description`:** required, one line each. Do not repeat the title as a `#` heading in the body. Write the description so that the list (`specs list`) tells what the document is without opening it.
- **`order`:** requirements only. Number them in the order of the feature's use; two in one feature may not share a number. `specs new` uses the folder's highest value plus 10, leaving room to insert between.
- **Body:** required. Do not use a `#` heading or gitifact comments (`<!-- gitifact-… -->`). The body of a feature's `index.md` states in a paragraph or two what the feature is and where it ends.

Put no other keys in the frontmatter. Relations between documents are expressed by a design's `requirements` and `sources`; the folder decides which feature a requirement belongs to.

Links to other documents are relative to this file (from a requirement to an asset: `../../../assets/flow.png`). The browser opens their destinations. `check` and `changes list` report a missing target as a `MISSING_LINK_TARGET` warning. Warnings do not block a commit.

## Reading

| Command | When |
| :--- | :--- |
| `gitifact specs list [--feature <feature>]` | IDs, titles and descriptions of features, requirements and designs, without bodies |
| `gitifact specs list --uncovered` | Requirements no design covers. `--without-design` finds features without a design, `--draft` documents still marked draft |
| `gitifact specs list --changed-since <date\|commit>` | Documents changed since then. Combine with `--author` and `--sort updated` |
| `gitifact specs list --q <query>` | Finding text in bodies that titles and descriptions do not mention |
| `gitifact specs show <ID…>` | The source of the chosen documents and the designs that point to them. `--ref <commit>` shows them as of that commit |
| `gitifact records list --doc <ID>` | Why a document changed over time, with its records and commits |

Lists show 20 at a time (the default order 20 features with all their documents). Read the next page with the `--after <value>` printed at the end, or everything with `--all`. A document not committed yet ends its line with added, modified or to be deleted, and a deleted one stays listed as to be deleted until the commit. Choose with the list's conditions, then `show` only the documents you need. A list also gives only the columns you ask for (`--fields id,title`) or JSON (`--format json`). This reads far less than grepping or opening every file.

## Editing, moving and deleting

Edit the files directly; there is no save command. Afterwards run `gitifact check` to verify format and references.

| Task | How |
| :--- | :--- |
| Change content | Edit `title`, `description` and the body. Keep the ID |
| Move to another feature | Move the file into that feature's `requirements/`, keep the ID, and adjust `order` to its place there |
| Rename the slug | Rename the file only. ID and content stay |
| Delete | Delete the file. Remove its ID from the `requirements` of any design that pointed to it, or `check` fails |
| Rename a feature (folder) | Move the folder. The S- ID in `index.md` stays |

Do not duplicate a document under a new ID when moving or renaming it, and do not reuse a deleted ID. When a requirement changes, review the designs that point to it (“Referenced by” in `specs show <R-ID>`).

## Grouping features

Group requirements into cohesive features that mean something to users. Do not reproduce code modules or DDD layers. Before creating a feature, check whether an existing one is a suitable home. Use the feature name as its title without a suffix such as “requirements.” Slugs and folder names use lowercase letters, digits and hyphens.

## User stories and acceptance criteria

Start each requirement with a user story: one or two sentences explaining who wants what and why. The default pattern is “As a [role], I want [goal] so that [reason],” expressed naturally in the project's language. Use an actual user or operator of the product. Do not copy the post author in this example, or a Gitifact user, into an unrelated product.

Follow the story with an acceptance-criteria heading (`###`) and numbered condition/expected pairs, in the project's language. Do not substitute paths, IDs or storage conventions for user goals. Put additional agreed constraints in a scope-and-constraints section and implementation details in the design. Base roles, goals and reasons on the conversation and verified context. Do not invent motives to fill the template; ask only for information needed to settle the meaning.

Apply this to new requirements and those being revised for the current request. Preserve existing IDs, agreed constraints and the meaning of acceptance criteria. Do not rewrite unrelated requirements in bulk. When done, check that the story states a role, goal and reason, and that its criteria determine success or failure. The CLI does not enforce particular sentences or validate user intent.

Follow `gitifact guide show writing` for prose. Its style rules do not replace the user-story pattern and the condition/expected format above. Write project content in the project's language; the language of these instructions does not change it.

Refine the files during the conversation. When an existing requirement changes or one of several options is chosen, write a draft record then (`gitifact guide show records`). Simply adding a requirement needs no record. While changing code and tests, bring requirements into line with the final agreement.
