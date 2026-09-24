## Gitifact Guide

gitifact v{version} · {language} · storage schemaVersion 3

CLI: use `npx --yes gitifact@{version} <cmd>` by default. Below, `gitifact` stands for this invocation. Follow the project's instructions if they specify another method, such as a local installation or global command.

### At the start

- A global installation is optional. Version-pinned npx uses a matching project dependency or downloads the package to the npm cache. If execution or downloading is blocked, request the required approval and explain the cause. Do not issue document IDs, check documents or commit by hand instead of running the CLI, or claim that work is done without it.
- Once per new session, run `gitifact update --check` with the pinned version. If the result is `available`, ask whether to update; run the suggested new-version `update` command only with consent. If declined, unavailable, or disabled, continue with the pinned version and do not ask again in that session. After updating, reread the block and use its new version. Commit and push only when separately authorized.
- Run `gitifact docs list` to read the list of features, requirements, designs, and instructions. Check git status and existing staging. Read the documents you need with `gitifact docs show <ID>`.
- This block is a summary. Read `gitifact guide show <topic>` for detailed formats instead of relying on memory.

### What belongs in requirements

Record product behavior and constraints that must be maintained.

| Request | Treatment |
| --- | --- |
| Let users delete their posts | Record as a requirement |
| Rename this internal function | An implementation change |
| Push now | A work instruction; do not register it |
| It must work without external services | Record as a product constraint |

### Rules

- Read `gitifact guide show spec` before creating documents. Create each new document with `gitifact docs new` to get its ID, edit the file directly, and verify with `gitifact docs check`.
- For a new feature, prepare requirements and designs together (`gitifact guide show design`). Follow a request for requirements only.
- Before changing requirements, designs, or code, find the project instructions (`.gitifact/instructions/`) for the work in the index outside this block, read them and follow them.
- Keep rules and decisions that span features in project instructions. Read `gitifact guide show instructions` before creating or changing instructions or the index. Write the index outside this block.
- Before writing instruction, requirement, or design content, follow `gitifact guide show writing`. Use the project's language for its documents, independently of the CLI display language.
- When asked to commit, read `gitifact guide show commit` and commit related specifications, reasons, code, and tests together.
- Automatic recording does not authorize commits. Commit only on user request or under an explicit project policy. Pushing requires separate authorization.
- Ask only about unclear product behavior and continue independent work. Derive all existing features only when asked.
- SELF-CHECK: before preparing documents or commit input, reread the relevant guide and compare formats. If unsure, run `gitifact guide show <topic>` instead of guessing.
- Write commit JSON to the input path reported by `changes list`. The CLI removes the file on success. Do not save query results or guide output to files; rerun them when needed.
- When the user asks to see requirements, project status, or change history, start `gitifact browser` in the background and share its URL. Do not substitute a chat summary.
### Commands

- `guide list`, `guide show <topic>`: writing guides ({topics})
- `docs list`·`search`·`show <ID…>`·`new <kind> <path>`·`check`·`history <ID>`: list without bodies, search, a document with its references, ID and skeleton (`draft: true`), whole-set check, reasons (options in `--help`)
- `changes list`: documents changed since HEAD, documents without a reason, and the commit input path
- `changes commit --file <json|-> [--dry-run]`: check documents, then record reasons and commit in one operation
- `browser`: run the read-only browser server; prints a URL and keeps running
- `update [--check | --commit]`: `--check` only checks versions. Without it, refresh this block to the running version; `--commit` commits block-only changes with a fixed message
- `init`: create configuration and this block when adopting Gitifact

---
