# tryce

Git-backed project context and decision notes for coding agents.

This is an early prototype. It supports project initialization, append-only
discovery/constraint/rejection notes, session briefings, Git status, a read-only
local browser, and project skill installation for Codex and Claude Code.

## Install

Requires **Node.js 24.x** and **Git** on PATH. Execution has been tested on Windows;
macOS and Linux are not yet verified.

```sh
npm install -g tryce
tryce --version
```

Run inside the Git project you want to use:

```sh
tryce init --mode prototype
tryce note enable
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

Requirements tracking, approvals, history checks, source-template upgrades, full
eject, and Git hooks are not implemented. `brief` reports checks as not run.
Default brief output may be truncated; inspect omission counts and use `--all` or
`note show` to read the original records. Failed commands exit with code 1 and
write diagnostic JSON to stderr, including partial brief results when available.

Project settings and notes are stored under `.tryce` and can be committed with
your project. Existing settings, baselines, notes, and user skill modifications
are preserved. Initialization and note-format activation are separate commands.

See the [project documentation](https://github.com/dev-goraebap/tryce) for detailed
contracts and supported recovery procedures.

## License

MIT. Bundled dependency notices are included in `dist/THIRD_PARTY_NOTICES.txt`.
