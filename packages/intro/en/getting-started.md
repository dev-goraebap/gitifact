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

The agent organizes requirements and designs according to the project guidelines. When the work is ready, ask it to “Commit the changes.” It will include the relevant specifications and reasons along with the code.

For an existing project, you can start with the features you work on next. To document the whole product first, ask:

```text
Document this project's requirements and designs.
```

## Tailor the wiki

Use the wiki for development rules and architecture decisions. You can adjust its structure and guidelines with your agent.

```text
Add our project's development rules to the wiki.
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
| Product overview | Project size and recent activity |
| Features | Current requirements and designs by feature |
| Project wiki | Development rules, architecture decisions, and other project documents |
| Activity | Reasons for committed changes and before/after content |
| Contributors | Contributions by Git author |
| Git status | Changed files in the working directory |

Requirements, designs, and wiki pages show the working copy. Activity shows committed history.

## Language

Choose English, 한국어, or Browser default in the viewer's Settings. The selection is saved in that browser. Project documents stay in their original language.

The CLI follows your environment's language and uses English for unsupported languages. To choose explicitly, use `npx gitifact --lang en <command>` or `npx gitifact --lang ko <command>`. You can also set `GITIFACT_LANG` to `en` or `ko` for your shell. Updating an existing project preserves the language of its GITIFACT blocks unless you supply `--lang`.

## Update

At the start of a new session, your agent checks for a newer version and asks whether to update. You can also ask at any time:

```text
Update Gitifact.
```

For npx, run `npx gitifact@latest update` to refresh the project instructions. If you use a project dependency or global installation, update it using that method and run `update` with the updated installation. Restart the browser server with the new version.

## Run commands yourself

Gitifact requires Node.js 24.x and Git. Run commands inside the target Git repository. A global installation is optional.

```sh
npx gitifact@latest init
npx gitifact browser
```

Open the local URL printed by `browser`. Press Ctrl+C in the terminal to stop the server.

Agents use the version recorded in the project instructions.

### Install in a project

In a Node.js project, you can add Gitifact as a development dependency so the team shares a version. Use the project's existing package manager. For npm:

```sh
npm install --save-dev --save-exact gitifact@latest
npx gitifact init
npx gitifact browser
```

The version is recorded in `package.json` and the lockfile. Tell agents to use the project installation in your project instructions. If you prefer a global command, you can still install it with `npm install -g gitifact@latest`.

### Common commands

| Command | Purpose |
| :--- | :--- |
| `npx gitifact init --dry-run` | Preview setup without changing files |
| `npx gitifact init` | Set up Gitifact and install or refresh agent instructions |
| `npx gitifact browser` | Start the browser viewer |
| `npx gitifact status` | Read the current Git status |
| `npx gitifact update --check` | Check for a newer version without changing files |
| `npx gitifact@latest update` | Refresh project instructions with the latest version |
| `npx gitifact docs` | List agent guide topics |
| `npx gitifact docs spec` | Requirements format and writing rules |
| `npx gitifact docs design` | Feature design rules |
| `npx gitifact docs wiki` | Wiki format and this project's guidelines |
| `npx gitifact docs commit` | Commit changes with their reasons and related files |

### Read and save specifications

| Command | Purpose |
| :--- | :--- |
| `npx gitifact spec working` | Read current specifications, wiki pages, and save metadata |
| `npx gitifact spec save --file <input-file>` | Save requirements, designs, and wiki pages |
| `npx gitifact spec changes` | Compare working specifications with HEAD and read uncommitted reasons |
| `npx gitifact spec commit --file <input-file> --dry-run` | Preview the commit without changing files |
| `npx gitifact spec commit --file <input-file>` | Record reasons and commit related files |
| `npx gitifact spec read --ref HEAD` | Read specifications at a commit |
| `npx gitifact spec diff --from <earlier-commit> --to <later-commit>` | Compare specifications between commits |

See `npx gitifact docs spec` and `npx gitifact docs commit` for input formats.

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
