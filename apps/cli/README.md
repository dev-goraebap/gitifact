# Getting started

[한국어](https://github.com/dev-goraebap/gitifact/blob/main/packages/intro/ko/getting-started.md)

## Install and set up

Give this prompt to the agent you use in your project:

```text
Install Gitifact with npm install -g gitifact and run gitifact init in this project.
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

## Write project instructions

Keep development rules and architecture decisions as project instructions, one per kind of task. Decide with your agent which instructions to keep and when each should be read.

```text
Write our project's development rules as project instructions.
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
| Project instructions | AGENTS.md and per-task instructions such as development rules and architecture decisions |
| Decision records | Committed decision records and the before/after content of the documents they explain |
| Contributors | Contributions by Git author |
| Git status | Changed files in the working directory |

Requirements, designs, and instructions show the working copy. Decision records show committed history.

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

When a newer version is out, or a teammate moves the project to one, gitifact commands print a one-line notice before their output. Your agent then asks whether to update now or later. You can also ask at any time:

```text
Update Gitifact.
```

To update, install with `npm install -g gitifact@<new-version>` and run `gitifact update`. `update` moves the GITIFACT block in your agent instruction files and the project's version (`cli`) in `.gitifact/config.json` to the new version. Commit both, and teammates see the notice on their next command. To update later, `gitifact update --later` quiets that version's notice for 24 hours. If you use a project dependency, update it that way and run `update` with the updated installation. Restart the browser server with the new version.

> [!IMPORTANT]
> From 0.8.3, `.gitifact/config.json` records `cli` and `language`. CLI 0.8.2 and earlier cannot read it and stop with `INVALID_CONFIG`, so move everyone to 0.8.3 or later before updating.

Projects recorded with 0.7 (storage schemaVersion 2) need a one-time move, because the document layout changed in 0.8.0. After an update your agent tells you so, and if you agree it moves the documents following `gitifact guide show migrate`, keeping their IDs and reasons.

## Run commands yourself

Gitifact requires Node.js 24.x and Git. Install it globally and run commands inside the target Git repository.

```sh
npm install -g gitifact
gitifact init
gitifact browser
```

Open the local URL printed by `browser`. Press Ctrl+C in the terminal to stop the server.

Agents use the global `gitifact`. If it is missing, they suggest `npm install -g gitifact@<version>` with the `cli` version in `.gitifact/config.json`.

> [!NOTE]
> You can also run `npx gitifact@<version> <command>` without installing. Each call then takes about 1.7 seconds longer, and agents call the CLI often, so a global installation is recommended.

### Install in a project

In a Node.js project, you can add Gitifact as a development dependency so the team shares a version. Use the project's existing package manager. For npm:

```sh
npm install --save-dev --save-exact gitifact@latest
npx gitifact init
npx gitifact browser
```

The version is recorded in `package.json` and the lockfile. Tell agents to use the project installation in AGENTS.md, outside the GITIFACT block.

### Common commands

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
| `gitifact guide show instructions` | Project instruction format and the AGENTS.md index |
| `gitifact guide show records` | When to write a decision record and its format |
| `gitifact guide show commit` | Commit changes with their records and related files |

### Read documents and commit

Requirements, designs and instructions are Markdown files under `.gitifact/` that you edit directly. New documents are created through the CLI, which issues their IDs.

| Command | Purpose |
| :--- | :--- |
| `gitifact specs list` | Features, requirements and designs (IDs, titles, descriptions, no bodies); filter with `--uncovered`, `--changed-since`, `--q` and more |
| `gitifact instructions list` | AGENTS.md and the project instructions |
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
