## Gitifact Guide

gitifact v{version} · {language} · storage schemaVersion 2

CLI: use `npx --yes gitifact@{version} <cmd>` by default. Below, `gitifact` stands for this invocation. Follow the project's instructions if they specify another method, such as a local installation or global command.

### At the start

- A global installation is optional. Version-pinned npx uses a matching project dependency or downloads the package to the npm cache. If execution or downloading is blocked, request the required approval and explain the cause. Do not substitute manual specification saves or commits, or claim completion without running the CLI.
- Once per new session, run `gitifact update --check` with the pinned version. If the result is `available`, ask whether to update; run the suggested new-version `update` command only with consent. If declined, unavailable, or disabled, continue with the pinned version and do not ask again in that session. After updating, reread the block and use its new version. Commit and push only when separately authorized.
- Run `gitifact spec working` to read wiki pages, feature specifications, and warnings. Check git status and existing staging.
- This block is a summary. Read `gitifact docs <topic>` for detailed formats instead of relying on memory.

### What belongs in requirements

Record product behavior and constraints that must be maintained.

| Request | Treatment |
| --- | --- |
| Let users delete their posts | Record as a requirement |
| Rename this internal function | An implementation change |
| Push now | A work instruction; do not register it |
| It must work without external services | Record as a product constraint |

### Rules

- Read `gitifact docs spec` before saving specifications. Use only IDs issued by the CLI.
- For a new feature, prepare requirements.md and design.md together (`gitifact docs design`). Follow a request for requirements only.
- Before changing requirements, designs, or code, read `gitifact docs wiki` and the relevant wiki pages named by its guidelines.
- To tailor the wiki guidelines, update `.gitifact/wiki/README.md` through `spec save`. Its contents become the guidelines in `docs wiki`.
- Before writing wiki, requirements, or design content, follow `gitifact docs writing`. Use the project's language for its documents, independently of the CLI display language.
- When asked to commit, read `gitifact docs commit` and commit related specifications, reasons, code, and tests together.
- Automatic recording does not authorize commits. Commit only on user request or under an explicit project policy. Pushing requires separate authorization.
- Ask only about unclear product behavior and continue independent work. Derive all existing features only when asked.
- SELF-CHECK: before preparing save or commit input, reread the relevant docs and compare formats. If unsure, run `gitifact docs <topic>` instead of guessing.
- Write save and commit JSON to the inputs paths returned by `spec working`. The CLI removes the file on success. Do not save query results or docs output to files; rerun them when needed.
- When the user asks to see requirements, project status, or change history, start `gitifact browser` in the background and share its URL. Do not substitute a chat summary.
### Commands

- `docs <topic>`: {topics}
- `spec working`: all current specifications and wiki pages, warnings, stamp, and input paths (`--stamp`, `--feature <name>`, `--ids`)
- `spec save --file <json|->`: save requirements, designs, and wiki pages
- `spec commit --file <json|->`: record reasons and commit in one operation
- `browser`: run the read-only browser server; prints a URL and keeps running
- `update [--check | --commit]`: `--check` only checks versions. Without it, refresh this block to the running version; `--commit` commits block-only changes with a fixed message
- `init`: create configuration and this block when adopting Gitifact

---
