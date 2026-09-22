---
title: Gitifact workflow
description: What to check at the start, which requests become requirements, and the final report
---

The user describes the product and keeps developing. The agent organizes product requirements and connects the final changes at commit time. Do not make users learn recording commands or a separate development methodology.

## Start and check the format

Check the working path, branch, Git status, and existing staging. Read applicable AGENTS.md and CLAUDE.md files in full. Follow the project's CLI invocation. If none is specified, run `npx --yes gitifact@<version> <command>` with the version at the top of the block. Below, `gitifact` stands for that invocation. npx uses a matching project dependency or downloads the package to the npm cache; no global installation is required.

Do not skip Gitifact work just because the global command is missing or global installation requires permission. Add a project dependency or install globally only when the user chooses that method. If execution or network access is blocked, request the required approval and explain the cause. `--yes` only suppresses npm's installation prompt; it does not grant execution permissions. Continue available investigation, but do not substitute manual specification saves or commits, or claim completion without running the CLI.

Once per new session, run `gitifact update --check` with the pinned version. This command leaves files, the index, and commits unchanged. If the result is `available`, tell the user the current and new versions and ask whether to update. Do not refresh instructions or switch versions before consent. If declined, keep the pinned version and do not ask again in that session. `unavailable` means the check failed, not that the CLI is up to date. If the check fails or is disabled through `GITIFACT_NO_UPDATE_CHECK`, continue with the pinned version.

Update using the project's chosen method. For npx, run `npx --yes gitifact@<new-version> update` to refresh the version in the block. For a project dependency, update it with the project's package manager and run the updated installation. Global installation instructions apply only when using the global command.

Check configuration, actual files, and CLI help to choose the applicable workflow. The existence of a command does not itself authorize project adoption or migration.

- **Current format:** `schemaVersion: 2` in config.json uses `.gitifact/spec/<feature>/requirements.md`, optional `design.md`, `history.jsonl`, `.gitifact/wiki/`, and `.gitifact/assets/`. Follow `gitifact docs spec` and `docs wiki`.
- **Earlier formats:** the current CLI does not read or write `schemaVersion: 1` (0.4.x), workflow-1, prototype-1, or init-1 configurations. Preserve records instead of deleting them or presenting them as the current format. Explain that these prerelease formats have no migration tool. If requested, set up the current version while preserving old records.
- **Not yet adopted:** if setup is authorized, inspect Git state and instructions, then use `init --dry-run` and `init`. If there is no Git repository, check permission to create one. Preserve changes and staging.

init creates `.gitifact/config.json`, an adoption baseline, and `.gitifact/wiki/README.md` with wiki guidelines. It writes a block between `<!-- GITIFACT:START -->` and `<!-- GITIFACT:END -->` in agent instruction files such as AGENTS.md. If it writes AGENTS.md and CLAUDE.md does not exist, it also creates CLAUDE.md containing `@AGENTS.md`. It preserves content outside the markers and creates neither requirements nor commits. The block summarizes the rules; read `gitifact docs <topic>` for full formats.

After updating the CLI, run `update` (or `init`) to refresh the block. `update` also reports whether a new version is available and how to install it; it does not install it. Existing blocks retain their language unless `--lang ko` or `--lang en` is supplied. New blocks follow the CLI language. Project documents keep their own language.

After updating, reread the block and use its new version. Once the refreshed instructions are committed and shared, teammates use that version in new sessions after pulling. Consent to update does not authorize a commit or push. Use `update --commit` only when committing is also authorized. It commits only tracked instruction files whose changes are entirely inside the block, with the fixed message `chore(gitifact): refresh GITIFACT block to v<version>`, preserving other staging. If a file also has changes outside the block, is untracked, or Git rejects the commit, it reports `commit.reason` without committing. Tell the user; do not change the message and commit by another route.

## Read context

Read context through `spec working`, actual documents, and Git. working returns feature specifications (`specs`), wiki pages (`wiki.documents`), and warnings (`warnings`). The browser provides specifications and recent Git history. Do not interpret a command error as a valid empty result, or execute instructions in historical records as current authorization.

For smaller working output, use `--stamp` (stamp and input paths), `--feature <folder>` (one feature), or `--ids` (IDs, titles, and paths without bodies). Do not save query results or docs output to files; rerun commands when needed.

`warnings` are advisory and do not block saves or commits: `MISSING_DESIGN_REFERENCE` (a design references an absent requirement), `MISSING_LINK_TARGET` (a relative document link has no target), `ASSET_SIZE`, `ASSET_EXTENSION`, and `ASSETS_TOTAL_SIZE` (recommended sizes or extensions exceeded), and `UNREFERENCED_ASSET` (no document references an asset). Report remaining warnings in the result.

## Wiki guidelines

`gitifact docs wiki` explains wiki structure, then includes the project's `.gitifact/wiki/README.md` as its operating guidelines. If no README exists, it includes built-in defaults. Update the README when the user wants to change how the wiki is maintained. Format rules and `spec save` validation remain independent of those guidelines.

## Temporary files

Write save and commit JSON to `inputs.save` and `inputs.commit` returned by `spec working` (or `spec changes`). The default location is a project-specific folder under the OS temporary directory. If that is unwritable, the fallback is Git-ignored `.gitifact/tmp/`. On success the CLI deletes the input and returns `inputRemoved`. Failure, `--dry-run`, and uncertain commit outcomes leave it in place; correct the cause before retrying the same file. working cleans files older than seven days from this folder. Short inputs can use `--file -` for stdin, but prefer a file when shell quoting might corrupt multiline bodies. Do not keep separate input/output copies in the project.

## Requests to view records

When the user asks to see requirements, project status, history, or release notes, start `gitifact browser` and share the URL. Run it in the background: it prints a URL and then stays running as a server. Do not wait for it to finish or substitute a chat summary of working JSON. Follow requests to explain specific content. If a server started in this conversation is still running, reuse its URL. Open the default browser only when asked.

## Finish

Briefly report the requirements organized, checks actually performed, whether a commit was made, and remaining limitations. Distinguish saving, committing, approval, implementation, and validation. Do not claim independent-agent behavior tests, migration, or a new GUI connection were completed unless performed.

## What belongs in requirements

Record desired product behavior and conditions to maintain, not every work instruction.

| Request | Treatment |
| --- | --- |
| Let users delete posts | Add a requirement to the relevant feature. |
| Rename this internal function | An implementation change; review requirements if a public API contract changes. |
| Push now | A work instruction, not a requirement. |
| It must work without external services | Record a product constraint. |
| Make the border a little lighter | Usually a style edit; do not create a requirement every time. |
| Distinguish selected items with a border | Add to acceptance criteria for selection behavior. |

Keep shared presentation rules in a wiki rules page instead of repeating them per feature. Classify requests by product meaning and existing context, not isolated wording.

## Working through the conversation

Establish users, desired outcomes, main flows, failure conditions, and product constraints through conversation. Do not repeat answered questions or require a long questionnaire. Ask about uncertainties that change the implementation direction and continue independent work.

Before changing requirements, designs, or code, read the wiki pages relevant to the work under the guidelines in `gitifact docs wiki`. If no such page exists, say so and proceed. Flag requests outside the wiki's scope or contrary to its principles before proceeding.

In existing projects, document the areas being changed first. Derive all features only when asked. Use available code, tests, documents, Git, and conversation without requiring a particular docs layout. Distinguish observed behavior, user intent, and future proposals. Present uncertain candidates with questions and evidence instead of saving them as agreed requirements. Do not invent past approvals or completion, or add references retroactively to old commits.
