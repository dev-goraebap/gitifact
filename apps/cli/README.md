# tryce

Version **0.2.0** supports auto and approval modes, requirement capture and grouped confirmation, and guarded Git commits. Existing configurations are never migrated implicitly.

## Agent workflow

Load the project's `tryce-workflow/SKILL.md` in the current session. Users describe their product; the agent runs these commands, observes existing instructions, and records actual decisions.

New `tryce init` defaults to auto mode. Use `init --mode approval` for confirmation before implementation, or explicitly migrate an existing project with `mode set approval --reason "User requested confirmation"`. Notes work in both modes.

```sh
tryce req draft --spec search --title "Search" --file ./requirement.txt --author Codex --reason "User request"
tryce req list
tryce req review ACTUAL_REQUIREMENT_ID
tryce req activate ACTUAL_REVIEW_ID --by Codex --evidence "Clear user intent in the current conversation"
tryce req approve ACTUAL_REVIEW_ID --by ACTUAL_USER --evidence "Actual confirmation and context"
tryce brief --format text
```

`activate` is for automatic confirmation in auto mode; `approve` records an actual user confirmation. These are separate alternatives. For approval after automatic activation, prepare a new review. A changed revision invalidates a pending review. `req revise ID --expected REVISION_ID` adds a revision and requires title, body, author and reason; confirmed requirements additionally require `--amend` for changes that preserve meaning. New meaning gets a new ID.

For a permitted commit, inspect exact related files and prepare `commit plan --path FILE --path RELATED_RECORD --message MESSAGE --policy no-policy|permitted --evidence CONTEXT`. Use `--policy-file PATH` for additional repository instructions. Save only the returned `data.plan` object to a UTF-8 temporary JSON file, then run `commit apply --file PLAN_FILE` after checking current authority. Existing staging, changed inputs and omitted pending records stop automatic construction. Never discard unrelated work to make a plan succeed. Hooks and signing remain enabled; no push is performed.

The CLI writes `Tryce-Format: workflow-1` and validated requirement/spec references. For implementation commits, explicitly pass `--req ACTIVE_REQUIREMENT_ID --implement`; these references do not claim completion or passing tests. Other event trailer semantics and full history validation are not implemented in this development format.

New requirement records use `.tryce/spec/<spec>/tryce.json` starting in 0.2.1. Records created by 0.2.0 under `specs/<spec>/tryce.json` remain readable and writable in place. All agents working with the new location need CLI 0.2.1 or later.

On a Git execution failure, inspect HEAD, the original index, `index.lock` and `tryce-index-*` recovery files before removing anything. The CLI intentionally preserves recovery artifacts when commit success is uncertain. See [workflow format and limits](../../docs/specs/workflow-format.md) for the full storage, contract and recovery rules. GUI requirement views, completion inference and full history checks remain unavailable.

Git-backed project context and decision notes for coding agents.

This is an early prototype. It also supports project initialization, append-only
discovery/constraint/rejection notes, session briefings, Git status, a read-only
local browser, and project skill installation for Codex and Claude Code.

## Install

Requires **Node.js 24.x** and **Git** on PATH. Execution has been tested on Windows;
macOS and Linux are not yet verified.

```sh
npm install -g @tryce/cli
tryce --version
```

Run inside the Git project you want to use:

```sh
tryce init
tryce skills install --agent claude
tryce brief --format text
tryce browser
```

Use `--agent codex` for Codex. The shared skill source lives in `.agents/skills`;
Claude's copy and local ownership metadata are excluded from Git. Skill presence
does not prove that a running agent selected or loaded it.

`browser` prints a local URL. Open it in your browser and stop the server with
Ctrl+C. It does not edit the project.

## Record and continue work

```sh
tryce note add --type discovery --message "Observed behavior and supporting evidence"
tryce note list --format text
tryce brief --all
tryce skills sync
```

Agents can use the installed workflow skill to read context and write significant
notes during development. Notes are not automatic transcripts. Corrections use a
new note with `--ref` or `--supersedes`; existing notes stay intact.

`skills sync` updates the local copy from the project source, preserving local
edits by refusing to overwrite them. `skills remove` removes the managed Claude
copy; it preserves the source and does **not** disable Codex discovery. Commands
do not automatically stage or commit changes.

## Limits and data

Requirement GUI views, completion inference, full history checks, source-template
upgrades, full eject, and Git hooks are not implemented. `brief` reports checks as not run.
Default brief output may be truncated; inspect omission counts and use `--all` or
`note show` to read the original records. Failed commands exit with code 1 and
write diagnostic JSON to stderr, including partial brief results when available.

Project settings and notes are stored under `.tryce` and can be committed with
your project. Existing settings, baselines, notes, and user skill modifications
are preserved. New projects use workflow-1 with notes enabled; legacy prototype
projects can continue using `note enable` without changing their recording mode.

See the [project documentation](https://github.com/dev-goraebap/tryce) for detailed
contracts and supported recovery procedures.

## License

MIT. Bundled dependency notices are included in `dist/THIRD_PARTY_NOTICES.txt`.
