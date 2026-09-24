## Gitifact Guide

gitifact v{version} · {language} · storage schemaVersion 3

CLI: use the global `gitifact` command at version {version}. Below, `gitifact` stands for this invocation. Follow the project's instructions if they specify another method, such as a local installation.

### At the start

- In a new session, check `gitifact --version`. If the command is missing or not {version}, suggest `npm i -g gitifact@{version}` to the user, and until it is installed, or if they decline, run `npx --yes gitifact@{version} <cmd>`. If execution or downloading is blocked, request the required approval and explain the cause. Do not issue document IDs, check documents or commit by hand instead of running the CLI, or claim that work is done without it.
- Once per new session, run `gitifact update --check` with the pinned version. If the result is `available`, ask whether to update; only with consent, install the new version (globally: `npm i -g gitifact@<new version>`) and run `update`. If declined, unavailable, or disabled, continue with the pinned version and do not ask again in that session. After updating, reread the block and use its new version. Commit and push only when separately authorized.
- Run `gitifact specs list` and `gitifact instructions list` to read the specs and instructions. Check git status and existing staging. Read the documents you need with `specs show <ID>` or `instructions show <name>`.
- This block is a summary. Read `gitifact guide show <topic>` for detailed formats instead of relying on memory. Do not save query results or guide output to files; rerun them when needed.

### What belongs in requirements

Record product behavior and constraints that must be maintained.

| Request | Treatment |
| --- | --- |
| Let users delete their posts | Record as a requirement |
| Rename this internal function | An implementation change |
| Push now | A work instruction; do not register it |
| It must work without external services | Record as a product constraint |

### Rules

- Read `gitifact guide show spec` before creating documents. Create each new document with `gitifact specs new` or `instructions new` to get its ID, edit the file directly, and verify with `gitifact check`.
- For a new feature, prepare requirements and designs together (`gitifact guide show design`). Follow a request for requirements only.
- When an existing requirement, design or instruction changes, or one of several options is chosen, write a record then with `gitifact records new` (`gitifact guide show records`). Before changing a document, read how its decisions went with `gitifact records list --doc <ID>`.
- Before changing requirements, designs, or code, find the project instructions (`.gitifact/instructions/`) for the work in the index outside this block, read them and follow them. Rules that span features belong in instructions; read `gitifact guide show instructions` before changing instructions or the index outside this block.
- Before writing instruction, requirement, or design content, follow `gitifact guide show writing`. Use the project's language for its documents, independently of the CLI display language.
- When asked to commit, read `gitifact guide show commit`. By default, one decision is committed with its record, documents, code, and tests. Write commit JSON to the input path reported by `changes list`; the CLI removes the file on success.
- Automatic recording does not authorize commits. Commit only on user request or under an explicit project policy. Pushing requires separate authorization. When a task is finished but not committed and the next one begins, suggest a commit once (two tasks mixed in the same files are hard to commit decision by decision). If the user declines, do not ask again.
- Ask only about unclear product behavior and continue independent work. Derive all existing features only when asked.
- SELF-CHECK: before preparing documents or commit input, reread the relevant guide and compare formats. If unsure, run `gitifact guide show <topic>` instead of guessing.
- When the user asks to see requirements, project status, or change history, start `gitifact browser` in the background and share its URL. Do not substitute a chat summary.
- When the user wants to report a Gitifact bug or idea, show the draft, get confirmation, then send it with `gitifact feedback`.

### Commands

- `guide list`, `guide show <topic>`: writing guides ({topics})
- `list`, `show`, `new` of `specs`, `instructions` and `records`: lists (filters by relation, history and state; `--fields`), a document with its references, ID and skeleton (`draft: true`). `records list --doc <ID>` is one document's decisions; `check` checks everything (options in `--help`)
- `changes list`: documents changed since HEAD, uncommitted records, changes without a record, and the commit input path. `changes commit --file <json|-> [--dry-run]`: check documents, then commit the selected files and records
- `browser`: run the read-only browser server; prints a URL and keeps running
- `feedback --file <json|-> [--dry-run]`: send an issue to Gitifact's repository (`type`, `title`, `body`; a new-issue address without gh)
- `update [--check | --commit]`: `--check` only checks versions. Without it, refresh this block to the running version; `--commit` commits block-only changes with a fixed message. `init`: create configuration and this block when adopting Gitifact

---
