## Gitifact Guide

gitifact v{version} · {language} · storage schemaVersion 3

Product behavior (requirements and designs), instructions and decision records live in `.gitifact/` and are managed with the CLI `gitifact`. If the project specifies another way to run it, that is what `gitifact` means.

### At the start of a session

1. Check that `gitifact --version` is {version}. If it is missing or different, suggest `npm i -g gitifact@{version}`, and until then run `npx --yes gitifact@{version} <cmd>`. If execution is blocked, request approval.
2. Run `gitifact update --check` once. If a newer version exists, ask whether to update; only with consent, install it, run `update` and reread this block.
3. Read every instruction with `gitifact instructions list --all`, and check git status and existing staging.

### What belongs in requirements

Record product behavior and constraints that must be maintained.

| Request | Treatment |
| --- | --- |
| Let users delete their posts | Record as a requirement |
| Rename this internal function | An implementation change |
| Push now | A work instruction; do not register it |
| It must work without external services | Record as a product constraint |

### While working

| Situation | First |
| --- | --- |
| Product behavior comes up | Check existing specs and conflicts with `specs list --type requirement` |
| Before changing code or documents | Read the feature's requirements and designs (`specs show <ID>`), the instructions the index outside this block points to, and the document's decision flow (`records list --doc <ID>`) |
| Writing a new document | Read `guide show spec` (`design` for designs, `instructions` for instructions) and `guide show writing`. Get IDs with `specs new` or `instructions new`, and verify with `gitifact check` after editing |
| Changing a document or choosing between options | Write a decision record with `records new` (`guide show records`) |
| Asked to commit | Read `guide show commit`, write the input to the file `changes list` names, then run `changes commit` |
| Asked to show the records | Run `gitifact browser` in the background and give the URL |
| Reporting a Gitifact bug or idea | Confirm a draft with the user and send it with `gitifact feedback` |

### Rules

- Commit only on a user request or project policy; push only when asked separately. Commit each decision with its record, documents, code and tests, and suggest a commit once when work is finished and left uncommitted.
- Do not issue IDs, check or commit without running the CLI, or report that as done.
- Write requirements and designs together for a new feature, in the project's language. Ask only about unclear product behavior and carry on with the rest.
- SELF-CHECK: this block is a summary. Before writing a document or commit input, check the format again with `gitifact guide show <topic>` instead of relying on memory. Do not save query results to files.

### Commands

- `specs`·`instructions`·`records`: `list`·`show`·`new`. `check`: whole check. `changes list`·`changes commit --file <json> [--dry-run]`
- `browser`, `feedback`, `update [--check | --commit]`, `init`, `guide list`·`guide show <topic>` ({topics}). Lists show 20 at a time; read on with the `--after <value>` at the end (`--all` for everything). They take `--fields` and `--format json`; see `--help` for options.

---
