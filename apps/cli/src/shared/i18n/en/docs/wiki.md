# Project wiki format

Content that does not belong to an individual feature lives in `.gitifact/wiki/`: what the product is, whom it serves, how it is built, and the rules to follow. Keep feature behavior in specifications rather than repeating it in the wiki. The first part of this output describes the format validated by the CLI. The “Wiki guidelines” section that follows contains the project's `.gitifact/wiki/README.md` body, or the built-in defaults if no README exists.

## File structure

Pages are Markdown files under `.gitifact/wiki/`, with any subfolder structure. Folder and file names use lowercase letters, digits, and hyphens. Only root pages may use uppercase names such as `README.md` or `ARCHITECTURE.md`. `README.md` is both the wiki entry point and its operating guidelines. `init` creates it with defaults; user edits then become the agent's guidelines. The browser and GitHub show this page when opening its folder.

Each file contains frontmatter with a CLI-issued `W-<random>` ID, a top-level heading, and the body. Do not put other gitifact comments in the body. Save through `spec save` instead of creating files by hand. All wiki reasons accumulate in `.gitifact/wiki/history.jsonl`.

```markdown
---
id: W-issued-by-the-CLI
---

# Architecture

Layers and dependency direction.
```

Links to pages, specifications, or assets are relative to this file. Examples: `conventions/code-style.md`, `../spec/posts/requirements.md`, `../assets/diagrams/flow.png`. Editors and GitHub treat them as file links; the browser resolves them to pages, features, or assets. Links to repository files outside Gitifact documents cannot be opened in the viewer; their paths can be copied. `spec working` reports absent targets as `MISSING_LINK_TARGET`.

Follow `gitifact docs writing` for page content and keep the project's language.

## Assets

Put images, PDFs, and other non-Markdown files under `.gitifact/assets/`. Subfolders are unrestricted and assets have no IDs. Copy files directly and reference them with relative links. Recommended extensions are png, jpg, gif, webp, svg, and pdf; recommended sizes are at most 1 MB per file and 50 MB in total. Larger or other files still save and commit, with `ASSET_SIZE`, `ASSET_EXTENSION`, or `ASSETS_TOTAL_SIZE` warnings from `spec working`. Unreferenced files produce `UNREFERENCED_ASSET`. The browser displays images inline and offers other files for download. Update references when renaming an asset.

## Saving

Use `spec save` operations: `create-doc` (type, path, title, body), `update-doc` (type, id, title, body), `move-doc` (type, id, path), and `delete-doc` (type, id). Paths are relative to `.gitifact/wiki/` and end in `.md`.

```json
{
  "expected": "actual stamp from working",
  "operations": [
    { "type": "create-doc", "path": "README.md", "title": "Product name", "body": "A short definition, intended users, principles, scope exclusions, and links to other pages." },
    { "type": "create-doc", "path": "conventions/code-style.md", "title": "Code style", "body": "Rules and their reasons." }
  ]
}
```

At commit time, pass wiki reasons as `{requirements: [], documents: [actual W-ID], reason: actual reason}` (`gitifact docs commit`).
