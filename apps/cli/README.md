# Getting started

[한국어](https://github.com/dev-goraebap/gitifact/blob/main/packages/intro/ko/getting-started.md)

## Install and set up

Give this prompt to the agent you use in your project:

```text
Run npx --yes gitifact init in this project.
If the command is blocked, don't hand it to me: show me the exact command and ask for my approval.
Read the GITIFACT block that init adds to AGENTS.md or the relevant agent instructions file, and follow it from this session onward.
```

## Keep developing

After setup, ask your agent to work as usual.

```text
Let users delete their posts.
```

The agent organizes requirements and designs as the GITIFACT block instructs. When the work is ready, ask it to “Commit the changes.” It will include the relevant specifications and reasons along with the code.

For an existing project, you can start with the features you work on next. To document the whole product first, ask:

```text
Document this project's requirements and designs.
```

## View documents and history

Tell your agent what you want to see. For example:

- “I'd like to see the requirements.”
- “Show me the product specifications.”
- “Show me recent changes.”
- “Open the Gitifact browser.”

The browser viewer includes:

| Page | Contents |
| :--- | :--- |
| Dashboard | Project size and recent activity |
| Features | Current requirements and designs by feature |
| Decision records | Committed decision records and the before/after content of the documents they explain |
| Contributors | Contributions by Git author |
| Git status | Changed files in the working directory |

Requirements and designs show the working copy. Decision records show committed history.

## Send feedback on Gitifact

To report a bug in Gitifact or suggest an improvement, tell your agent.

```text
Report this bug to Gitifact as an issue.
```

The agent shows you the title and body first and sends the issue to the Gitifact repository once you confirm. If the GitHub CLI (`gh`) is signed in, the issue is created under your account; otherwise you get the new-issue page with everything filled in. Only the Gitifact, OS and Node versions are appended; no project files are sent.

## Language

Choose English, 한국어, or Browser default in the viewer's Settings. The selection is saved in that browser. Project documents stay in their original language.

The CLI follows your environment's language and uses English for unsupported languages. To choose explicitly, use `gitifact --lang en <command>` or `gitifact --lang ko <command>`. You can also set `GITIFACT_LANG` to `en` or `ko` for your shell. The language of the GITIFACT blocks is recorded as `language` in `.gitifact/config.json` and stays through updates unless you supply `--lang`.

## Update

When a newer version is out, or a teammate moves the project to one, gitifact commands print a one-line notice before their output. Your agent then shows the update command and asks whether to update now or later, and once you allow it, runs it itself. You can also ask at any time:

```text
Update Gitifact.
```

To update, run `npx --yes gitifact@<new-version> update` once. `update` moves the GITIFACT block in your agent instruction files, the project's version (`cli`) in `.gitifact/config.json` and the launcher `.gitifact/bin/cli.mjs` to the new version. Commit them, and teammates' launchers fetch the new version on their next run. To update later, `gitifact update --later` quiets that version's notice for 24 hours. Restart the browser server with the new version.

> [!IMPORTANT]
> From 0.8.3, `.gitifact/config.json` records `cli` and `language`. CLI 0.8.2 and earlier cannot read it and stop with `INVALID_CONFIG`, so move everyone to 0.8.3 or later before updating.

Projects recorded with 0.7 (storage schemaVersion 2) need a one-time move, because the document layout changed in 0.8.0. After an update your agent tells you so, and if you agree it moves the documents following `gitifact guide show migrate`, keeping their IDs and reasons.

## Run commands yourself

Gitifact requires Node.js 24.x and Git. Run commands inside the target Git repository.

```sh
npx --yes gitifact init
node .gitifact/bin/cli.mjs browser
```

Open the local URL printed by `browser`. Press Ctrl+C in the terminal to stop the server.

The launcher `init` writes, `.gitifact/bin/cli.mjs`, fetches the `cli` version in `.gitifact/config.json` into this computer's user cache on its first run and runs that version from then on. Nothing is installed globally, and projects on different versions do not affect each other. Commit the launcher, and teammates who clone the repository use it as it is. Agents run commands through the launcher too. If the agent tool blocks a command, the agent points you to that tool's approval (a prompt or a permission setting).

If Windows PowerShell says `npx.ps1` cannot be loaded, running scripts is disabled. Use `npx.cmd` instead.

> [!NOTE]
> To type a short `gitifact` in the terminal, you can still install it globally with `npm install -g gitifact`. When the global installation and the project's version differ, commands print a notice first.

### Common commands

`gitifact` in the tables below is the launcher `node .gitifact/bin/cli.mjs` (or a global installation).

| Command | Purpose |
| :--- | :--- |
| `gitifact init --dry-run` | Preview setup without changing files |
| `gitifact init` | Set up Gitifact and install or refresh agent instructions |
| `gitifact browser` | Start the browser viewer |
| `gitifact update --check` | Check for a newer version without changing files |
| `gitifact update` | Move the GITIFACT block and the project's version to the installed version |
| `gitifact update --later` | Quiet the announced newer version for 24 hours |
| `gitifact guide list` | List agent guide topics |
| `gitifact guide show spec` | Requirement file format and writing rules |
| `gitifact guide show design` | Feature design rules |
| `gitifact guide show records` | When to write a decision record and its format |
| `gitifact guide show commit` | Commit changes with their records and related files |

### Read documents and commit

Requirements and designs are Markdown files under `.gitifact/` that you edit directly. New documents are created through the CLI, which issues their IDs.

| Command | Purpose |
| :--- | :--- |
| `gitifact specs list` | Features, requirements and designs (IDs, titles, descriptions, no bodies); filter with `--uncovered`, `--changed-since`, `--q` and more |
| `gitifact specs show <ID>` | A document's source and the designs pointing to it; `--ref <commit>` for past text |
| `gitifact records list --doc <ID>` | Decision records and commits for a document |
| `gitifact specs new requirement <feature>/<name>` | Create a document with an issued ID and a skeleton |
| `gitifact check` | Check format, IDs and references across all documents |
| `gitifact changes list` | Documents changed since HEAD, uncommitted records, and changes without a record |
| `gitifact changes commit --file <input-file> --dry-run` | Preview the commit without changing files |
| `gitifact changes commit --file <input-file>` | Commit the selected documents, records and related files |

See `gitifact guide show commit` for the input format.

### Setup and runtime options

| Option | Purpose |
| :--- | :--- |
| `gitifact init --agent codex` | Install instructions for a tool: `claude`, `cursor`, `codex`, `hermes`, or `all` |
| `gitifact init --skip-agents` | Set up without changing agent instruction files |
| `gitifact init --remove-agents` | Remove GITIFACT blocks from agent instructions |
| `gitifact browser --port 4317` | Choose the browser server port |
| `gitifact --lang en <command>` | Use English for output and any generated agent blocks |

`--remove-agents` removes only GITIFACT blocks; it preserves project records.

Add `--help` to any command to see its options.
