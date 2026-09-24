# Getting started

[한국어](https://github.com/dev-goraebap/gitifact/blob/main/packages/intro/ko/getting-started.md)

## Install and set up

Give this prompt to the agent you use in your project:

```text
Run npx gitifact@latest init in this project.
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

## Language

Choose English, 한국어, or Browser default in the viewer's Settings. The selection is saved in that browser. Project documents stay in their original language.

The CLI follows your environment's language and uses English for unsupported languages. To choose explicitly, use `npx gitifact --lang en <command>` or `npx gitifact --lang ko <command>`. You can also set `GITIFACT_LANG` to `en` or `ko` for your shell. Updating an existing project preserves the language of its GITIFACT blocks unless you supply `--lang`.

## Update

At the start of a new session, your agent checks for a newer version and asks whether to update. You can also ask at any time:

```text
Update Gitifact.
```

For npx, run `npx gitifact@latest update` to refresh the GITIFACT block in your agent instruction files. If you use a project dependency or global installation, update it using that method and run `update` with the updated installation. Restart the browser server with the new version.

Projects recorded with 0.7 (storage schemaVersion 2) need a one-time move, because the document layout changed in 0.8.0. After an update your agent tells you so, and if you agree it moves the documents following `npx gitifact guide show migrate`, keeping their IDs and reasons.

## Run commands yourself

Gitifact requires Node.js 24.x and Git. Run commands inside the target Git repository. A global installation is optional.

```sh
npx gitifact@latest init
npx gitifact browser
```

Open the local URL printed by `browser`. Press Ctrl+C in the terminal to stop the server.

Agents use the version recorded in the GITIFACT block.

### Install in a project

In a Node.js project, you can add Gitifact as a development dependency so the team shares a version. Use the project's existing package manager. For npm:

```sh
npm install --save-dev --save-exact gitifact@latest
npx gitifact init
npx gitifact browser
```

The version is recorded in `package.json` and the lockfile. Tell agents to use the project installation in AGENTS.md, outside the GITIFACT block. If you prefer a global command, you can still install it with `npm install -g gitifact@latest`.

### Common commands

| Command | Purpose |
| :--- | :--- |
| `npx gitifact init --dry-run` | Preview setup without changing files |
| `npx gitifact init` | Set up Gitifact and install or refresh agent instructions |
| `npx gitifact browser` | Start the browser viewer |
| `npx gitifact update --check` | Check for a newer version without changing files |
| `npx gitifact@latest update` | Refresh the GITIFACT block in agent instruction files with the latest version |
| `npx gitifact guide list` | List agent guide topics |
| `npx gitifact guide show spec` | Requirement file format and writing rules |
| `npx gitifact guide show design` | Feature design rules |
| `npx gitifact guide show instructions` | Project instruction format and the AGENTS.md index |
| `npx gitifact guide show records` | When to write a decision record and its format |
| `npx gitifact guide show commit` | Commit changes with their records and related files |

### Read documents and commit

Requirements, designs and instructions are Markdown files under `.gitifact/` that you edit directly. New documents are created through the CLI, which issues their IDs.

| Command | Purpose |
| :--- | :--- |
| `npx gitifact specs list` | Features, requirements and designs (IDs, titles, descriptions, no bodies); filter with `--uncovered`, `--changed-since`, `--q` and more |
| `npx gitifact instructions list` | AGENTS.md and the project instructions |
| `npx gitifact specs show <ID>` | A document's source and the designs pointing to it; `--ref <commit>` for past text |
| `npx gitifact records list --doc <ID>` | Decision records and commits for a document |
| `npx gitifact specs new requirement <feature>/<name>` | Create a document with an issued ID and a skeleton |
| `npx gitifact check` | Check format, IDs and references across all documents |
| `npx gitifact changes list` | Documents changed since HEAD, uncommitted records, and changes without a record |
| `npx gitifact changes commit --file <input-file> --dry-run` | Preview the commit without changing files |
| `npx gitifact changes commit --file <input-file>` | Commit the selected documents, records and related files |

See `npx gitifact guide show commit` for the input format.

### Setup and runtime options

| Option | Purpose |
| :--- | :--- |
| `npx gitifact init --agent codex` | Install instructions for a tool: `claude`, `cursor`, `codex`, `hermes`, or `all` |
| `npx gitifact init --skip-agents` | Set up without changing agent instruction files |
| `npx gitifact init --remove-agents` | Remove GITIFACT blocks from agent instructions |
| `npx gitifact browser --port 4317` | Choose the browser server port |
| `npx gitifact --lang en <command>` | Use English for output and any generated agent blocks |

`--remove-agents` removes only GITIFACT blocks; it preserves project records.

Add `--help` to any command to see its options.
