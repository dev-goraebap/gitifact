# Development CLI: Markdown specifications

The development build defaults to `spec-1`; published 0.3.0 is unchanged.

```sh
tryce init --dry-run
tryce init
tryce skills install --agent codex
tryce spec working
tryce spec save --file input.json
tryce spec changes
tryce spec prepare --file reasons.json
tryce spec commit-plan --file input.json
tryce spec commit-apply --file plan.json
tryce spec read --ref HEAD
tryce spec diff --from BEFORE --to AFTER
```

Initialization creates only configuration and the Git adoption baseline. It requires Git, accepts an unborn repository, preserves unrelated work and staging, and never performs a commit. Existing legacy configuration requires an explicit separate transition. Skill installation preserves edited sources; the agent handles AGENTS.md/CLAUDE.md linkage and reads the installed skill in the current session.

`req`, `note`, `mode`, and `init --mode` are deprecated compatibility commands. Help marks them deprecated; JSON stdout and stderr error contracts remain unchanged. They still work for legacy projects. Removal follows validated transition support, not a fixed number of development turns. `spec-preview --experimental` remains a compatibility entry point. `brief` and the current browser do not yet support spec-1 records.

The `spec` commands use the same input objects as the experimental commands documented below, without `--experimental`. Their output envelope is `contract: "spec", version: 1`. For a configured spec-1 project, config bytes are bound to working stamps and commit plans. Creation and edits never imply user approval or implementation completion.

## Legacy release reference

# tryce

Version **0.3.0** adds a read-only requirements browser with revision and confirmation history, decision notes, and faster project reads. Auto and approval modes, grouped confirmation, and guarded Git commits remain supported. Existing configurations are never migrated implicitly.

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

On a Git execution failure, inspect HEAD, the original index, `index.lock` and `tryce-index-*` recovery files before removing anything. The CLI intentionally preserves recovery artifacts when commit success is uncertain. See [workflow format and limits](https://github.com/dev-goraebap/tryce/blob/479d392a93fa40e7a95993d4979417beae869723/docs/specs/workflow-format.md) for the full storage, contract and recovery rules. Completion inference and full history checks remain unavailable.

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

Browser editing, completion inference, full history checks, source-template
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

## Experimental specification tools (development build)

The development source includes opt-in reading, comparison and draft editing for the proposed Markdown/JSONL format. These are not migration commands or features of the published 0.3.0 release.

```sh
tryce spec-preview read --experimental --ref HEAD
tryce spec-preview diff --experimental --from HEAD~1 --to HEAD
```

Both commands read committed Git snapshots, not the working tree or index. JSON output is labelled `spec-preview` / `experimental`. The comparison distinguishes requirement creation, deletion, movement and content changes, and attaches newly recorded reasons by requirement ID. Existing JSON requirements are rejected with guidance to use `req`. No files or commits are written. The preview grammar, limits and unimplemented cases are described in [the transition plan](../../docs/mvp-transition.md).

```sh
tryce spec-preview working --experimental
tryce spec-preview save --experimental --file ./draft-edit.json
```

`working` returns current Markdown and a `stamp`. `save` accepts that stamp as `expected` plus an `operations` array: `create`, `add`, `update`, `move`, or `rename-spec`. It allocates S-/R- IDs, validates the complete draft and writes affected `requirements.md` files. It does not write history, configuration, staging or commits. Existing configured projects require a separate migration and are refused. See the transition plan for exact input fields.

Detected write failures restore original files when safe. An interrupted process or conflicting external edit can leave `tryce-spec-preview.lock/recovery.json` in the worktree's Git directory. Inspect original/current contents before recovery; do not remove the lock blindly. Automatic crash recovery and production adoption remain pending.

```sh
tryce spec-preview changes --experimental
tryce spec-preview prepare --experimental --file ./reasons.json
tryce spec-preview verify --experimental --file ./verification.json --staged
```

`changes` compares HEAD with the final working draft and returns `expected` plus `pendingReasons`. `prepare` accepts `{ "expected": "…", "reasons": [{ "requirements": ["R-…"], "reason": "…" }] }`. It preserves committed history and replaces only uncommitted reasons with this complete list. Repeating the same preparation reuses IDs; reverted requirements need no new reason. Unknown reasons are reported in `withoutReason`, never invented.

Save the returned `verification` object to use `verify`. With `--staged`, it checks that staged specification/history bytes match the prepared working files; otherwise it checks the working files only. These commands do not stage or commit anything, and verification is not approval or a guarantee against later edits. Moves record reasons at the destination, deletions at the source; retain an empty specification when it owns past history. Merge/rebase workflows and automatic commit execution remain unsupported by these experimental commands.

```sh
tryce spec-preview commit-plan --experimental --file ./commit-input.json
tryce spec-preview commit-apply --experimental --file ./commit-plan.json
```

The separate commit commands connect preparation to Git execution. Input contains `verification` from prepare, exact `paths`, a `message`, and `authorization: { "basis": "user-request", "evidence": "Actual request or policy basis" }`. `project-policy` is the other allowed basis; absence of policy is not authorization. Save the returned `plan` object for apply. Optional `requirements` references existing R-IDs, and `policyFiles` adds instruction files to recheck.

For commit-plan/apply, do not stage files first: apply builds and checks its isolated index internally. The earlier verify --staged example is for an agent using Git directly.

By default, agents select related specifications, reasons, source and tests together. For a split policy, commit specification/reason files first and reference R-IDs from the later code commit. Changed specification/reason files must all be selected in this initial implementation; partial selection of pending specifications is unsupported. Existing staging, including intent-to-add, is preserved by refusing execution. The agent does not need to ask for separate approval of each internal command when the work is already authorized.

Apply revalidates content and instructions, stages selected paths in an isolated index, and runs normal Git hooks and signing. A rejected commit with unchanged HEAD preserves the original index and permits retry. An uncertain outcome after HEAD changes keeps recovery evidence under the worktree Git directory's `tryce-spec-commit.lock`; inspect HEAD and both indexes before recovery and do not blindly retry. This remains experimental, without automatic crash recovery or migration of existing projects.

## License

MIT. Bundled dependency notices are included in `dist/THIRD_PARTY_NOTICES.txt`.
