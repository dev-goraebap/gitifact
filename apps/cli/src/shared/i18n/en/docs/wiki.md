---
title: Project wiki format
description: Project wiki format, asset rules, and this project's wiki guidelines (wiki/README.md)
---

Content that does not belong to an individual feature lives in `.gitifact/wiki/`: what the product is, whom it serves, how it is built, and the rules to follow. Keep feature behavior in specifications rather than repeating it in the wiki. The first part of this output describes the format the CLI checks. The “Wiki guidelines” section that follows contains the project's `.gitifact/wiki/README.md` body, or the built-in defaults if no README exists.

## File structure

Pages are Markdown files under `.gitifact/wiki/`, with any subfolder structure. Folder and file names use lowercase letters, digits and hyphens. Only root pages may use uppercase names such as `README.md` or `ARCHITECTURE.md`. `README.md` is both the wiki entry point and its operating guidelines. `init` creates it with defaults; user edits then become the agent's guidelines. The browser and GitHub show this page when opening its folder.

Create new pages through the CLI. It issues a `W-` ID, fills in the frontmatter and adds `draft: true`. Fill in the body, remove that line and run `gitifact docs check`.

```text
gitifact docs new wiki conventions/code-style.md --title "Code style" --description "Naming and file layout rules"
```

```markdown
---
id: W-issued-by-the-CLI
title: Code style
description: Naming and file layout rules
---

Rules and their reasons.
```

The ID and text illustrate the structure. The frontmatter holds only `id`, `title` and `description`, all required. Do not repeat the title as a `#` heading; start sections at `##` and put no gitifact comments in the body. Edit existing pages directly. To move or rename one, move the file and keep its ID; to delete one, delete the file. If a design's `sources` points to a deleted page, fix that design too or `docs check` fails.

Links to pages, specifications or assets are relative to this file. Examples: `conventions/code-style.md`, `../spec/posts/requirements/create.md`, `../assets/diagrams/flow.png`. Editors and GitHub treat them as file links; the browser resolves them to pages, features or assets. Links to repository files outside Gitifact documents cannot be opened in the viewer; their paths can be copied. `docs check` and `changes list` report absent targets as a `MISSING_LINK_TARGET` warning.

Follow `gitifact guide show writing` for page content and keep the project's language.

## Assets

Put images, PDFs and other non-Markdown files under `.gitifact/assets/`. Subfolders are unrestricted and assets have no IDs. Copy files directly and reference them with relative links. Recommended extensions are png, jpg, gif, webp, svg and pdf; recommended sizes are at most 1 MB per file and 50 MB in total. Larger or other files still commit, with `ASSET_SIZE`, `ASSET_EXTENSION` or `ASSETS_TOTAL_SIZE` warnings from `docs check` and `changes list`. Unreferenced files produce `UNREFERENCED_ASSET`. The browser displays images inline and offers other files for download. Update references when renaming an asset.

## Committing

Give the reason for a wiki change the same way as for other documents, `{docs: [actual W-ID], reason}`. Reasons are recorded in `.gitifact/history.jsonl`, so include the changed pages and that file in `paths` (`gitifact guide show commit`).
