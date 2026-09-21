# Getting started

[한국어](https://github.com/dev-goraebap/gitifact/blob/main/packages/intro/ko/getting-started.md)

## Install and set up

Give this prompt to the agent you use in your project:

```text
Run npx --yes gitifact@latest init in this project.
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

The CLI follows your environment's language and uses English for unsupported languages. To choose explicitly, use `gitifact --lang en <command>` or `gitifact --lang ko <command>`. You can also set `GITIFACT_LANG` to `en` or `ko` for your shell. Updating an existing project preserves the language of its GITIFACT blocks unless you supply `--lang`.

## Update

When the viewer shows a new version, ask your agent to update:

```text
Update Gitifact.
```

For npx, run `npx --yes gitifact@latest update` to refresh the project instructions. If you use a project dependency or global installation, update it using that method and run `update` with the updated installation. Restart the browser server with the new version.

## Run commands yourself

Gitifact requires Node.js 24.x and Git. Run commands inside the target Git repository. A global installation is optional.

```sh
npx --yes gitifact@latest init
npx --yes gitifact@latest browser
```

Open the local URL printed by `browser`. Press Ctrl+C in the terminal to stop the server.

In the command tables, `gitifact` stands for the invocation in your GITIFACT block. After setup, use the version specified there.

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
| `gitifact init --dry-run` | Preview setup without changing files |
| `gitifact init` | Set up Gitifact and install or refresh agent instructions |
| `gitifact browser` | Start the browser viewer |
| `gitifact status` | Read the current Git status |
| `gitifact update` | Check for a new version and refresh project instructions |
| `gitifact docs` | List agent guide topics |
| `gitifact docs spec` | Requirements format and writing rules |
| `gitifact docs design` | Feature design rules |
| `gitifact docs wiki` | Wiki format and this project's guidelines |
| `gitifact docs commit` | Commit changes with their reasons and related files |

### Read and save specifications

| Command | Purpose |
| :--- | :--- |
| `gitifact spec working` | Read current specifications, wiki pages, and save metadata |
| `gitifact spec save --file <input-file>` | Save requirements, designs, and wiki pages |
| `gitifact spec changes` | Compare working specifications with HEAD and read uncommitted reasons |
| `gitifact spec commit --file <input-file> --dry-run` | Preview the commit without changing files |
| `gitifact spec commit --file <input-file>` | Record reasons and commit related files |
| `gitifact spec read --ref HEAD` | Read specifications at a commit |
| `gitifact spec diff --from <earlier-commit> --to <later-commit>` | Compare specifications between commits |

See `gitifact docs spec` and `gitifact docs commit` for input formats.

### Setup and runtime options

| Option | Purpose |
| :--- | :--- |
| `gitifact init --agent codex` | Install instructions for a tool: `claude`, `cursor`, `codex`, `hermes`, or `all` |
| `gitifact init --skip-agents` | Set up without changing agent instruction files |
| `gitifact init --remove-agents` | Remove GITIFACT blocks from agent instructions |
| `gitifact browser --port 4317` | Choose the browser server port |
| `gitifact browser --no-update-check` | Start without checking npm for updates |
| `gitifact --lang en <command>` | Use English for output and any generated agent blocks |

`--remove-agents` removes only GITIFACT blocks; it preserves project records.

Add `--help` to any command to see its options.
