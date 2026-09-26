## 0.8.3 - 2026-09-26
### Added
- Every command prints one version notice before its result: when a newer release is out, when the project is set to a newer version than this CLI, and when this CLI is newer than the project's version. The newer release is read from the user's cache and checked in the background at most once an hour, so commands never wait on the network. `GITIFACT_NO_UPDATE_CHECK` turns off only the release check.
- `update --later` quiets the announced release for 24 hours. A release newer than it is announced at once.
- `.gitifact/config.json` records the project's version (`cli`) and the language of the instruction block (`language`). `init` and `update` write them, and the project's version is never lowered. A field this CLI does not know no longer stops it.
### Changed
- 0.8.3 or later is required. A config with `cli` stops 0.8.2 and earlier with `INVALID_CONFIG`, so move everyone before running `update`.
- Installation guidance is a global install (`npm install -g gitifact@<version>`, then `gitifact update`). The instruction block, README and getting started point at the global command instead of npx.
- The first line of the instruction block (version, language, schemaVersion) is gone. Instead of checking the version and running `update --check` at the start of a session, agents ask whether to update now or later when a version notice appears. A release that leaves the block text alone leaves the block alone.
- The block follows the config's `language` and changes only with `--lang`. A block written by 0.8.2 or earlier has its first-line language moved to the config once.
- `update --commit` commits a `config.json` whose only changes are `cli` and `language` together with the blocks, as `chore(gitifact): update project to gitifact v<version>`. The `update` JSON is v6: it carries `project`, and `install` holds only `npmGlobal`.
- `update` and `init` from a CLI older than the project's version leave the instruction blocks alone.
- The browser shows one rocket loader for every screen instead of per-screen skeletons. Moving to another screen keeps the current one under a veil, with the loader, until the next is drawn whole.
- In the browser's feature list, only the words of a row's title and description open the feature; the empty part of the row does not.
### Fixed
- `changes commit` refused the `.gitifact/.gitattributes` that `init` writes, so a project had no way to commit it.

## 0.8.2 - 2026-09-26
### Changed
- The browser asks the server for as much of a list as it shows. Feature requirements read on twenty features at a time with "More features" instead of page numbers, contributors twenty at a time, a commit's code tab twenty files at a time, and a record's documents twenty at a time. The checkout a screen reads first went from 354 KB to 18 KB in this repository.
- The search box shows five hits in each group — features, requirements, designs, instructions, decision records and commits — and "N more" reads on in that group without closing the box. A decision record appears once per record file, and a commit is found by seven or more characters of its hash. The "Change history" group with one hit per document change is gone.
- Contributors and each feature's authors count every commit rather than the latest 10,000. The commit log is read into the cache once and new commits are added to it, and list commands no longer read Git history again for the same HEAD (`records list` 639 ms → 256 ms in a repository of 5,000 commits).
- The cache format changed, so it is rebuilt once on the first run. Dropping the search rows kept per document change made it about 40% smaller.
### Fixed
- The code tab of a commit could not show files past the first 500.
- A record's page could miss documents of its record in a commit of more than 500 changes.

## 0.8.1 - 2026-09-25
### Added
- Lists show where each document stands against the last commit. A document not committed yet ends its line (in the browser, a light background and a badge) with added, modified or to be deleted, and a deleted document stays listed as to be deleted until the commit. A moved document is one modified line.
- The browser's decision records list starts with a "Not committed yet" entry. `/records/working` compares the uncommitted records and changed documents with the last commit, and an uncommitted record opens at its record address too.
- Coming back to the browser tab after documents or commits changed shows a notice with a refresh.
- `init` writes `.gitifact/.gitattributes` so documents are stored and checked out with LF on every OS. The root `.gitattributes` is left alone.
- The browser's commit page splits into records, documents and code tabs; documents and code show the chosen file's comparison beside the file list. A record's page leads from its head to the commit, the commit's other records and its code.
- A `?` beside the titles of the feature requirements, decision records and project instructions lists shows what the screen is for.
### Changed
- A reference file of an instruction folder (Markdown other than `index.md`) must carry `title` and `description` in its frontmatter; `check` reports one without them. `instructions list` and `show` print each file's path, title and description, and the browser names files by that title.
- The browser's instruction sidebar gives files an icon for their kind and folds folders, and a press anywhere on a row opens it.- Every list shows 20 at a time; read on with the `--after <value>` printed at the end (`--all` shows everything). Specs page by feature and the history by commit, and JSON carries `page`.
- Agents read every instruction at the start of a session and read specs when product behavior comes up or before changing code. Run `update` to refresh the block.
- The instruction block is shorter: what to read and do in each situation is one table, and overlapping rules are merged.
- The history index no longer holds document texts; they are read from Git when a comparison is opened, which halves its size. Existing indexes rebuild themselves, and a first build reads files side by side.
- The browser loads the decision records twenty commits at a time and a commit page twenty documents at a time without their text, reading only the text of the document opened.
### Fixed
- A migration commit for a 0.7 project hit the 128-path limit and could not finish as one commit. A commit with `migration: true` now takes up to 5,000 paths, and a long selection no longer runs into the command-line length limit.
- The migration notice `update` shows in a 0.7 project named the removed `docs` command.
- In the browser, a file or screen opened while the wheel was still gliding was pulled back to the old scroll position.

## 0.8.0 - 2026-09-25
### Added
- Project instructions: ways of working that span features, such as architecture rules or verification steps, live as instructions under `.gitifact/instructions/<name>/`, and the AGENTS.md index says which one to read for which work. The browser's project instructions page shows AGENTS.md, the instructions and the files in their folders.
- Decision records: when an existing document changes or one of several options is chosen, the agent writes the context, decision and alternatives considered under `.gitifact/records/` with `records new` and commits them with the documents. The browser's decision records page reads them by commit and record, and `records list --doc <ID>` shows one document's decisions.
- Document lists pick what grep cannot see. `specs list` filters with `--uncovered` (requirements no design covers), `--without-design`, `--draft`, `--changed-since <date|commit>`, `--author` and `--q`, and every list gives only the columns you ask for with `--fields`, or JSON with `--format json`.
- `feedback`: tell your agent about a Gitifact bug or idea and it shows you a draft, then sends it as an issue to the Gitifact repository once you confirm. Without the GitHub CLI (`gh`), you get the new-issue page with everything filled in.
- The browser dashboard shows the project's size and latest decision records, and a commit page shows document changes as a git-style diff together with the source files the commit changed.
- `guide show migrate` walks agents through moving a 0.7 project to the new document format, and `update` tells a 0.7 project that it needs the move.
- When a task is finished but not committed and the next one begins, the agent suggests a commit once.
### Changed
- Document format (storage schemaVersion 3): one document per file. A feature folder holds `index.md`, `requirements/` and `design/`, and IDs, titles and relations live in the frontmatter. Agents edit the files directly and verify with `check`. Projects recorded with 0.7 need to be moved once with `guide show migrate`.
- Commands are organized by resource: `list`, `show` and `new` of `specs`, `instructions` and `records`, the whole-set `check`, `changes list` and `commit`, and `guide list` and `show`.
- Agents use the global `gitifact` at the version in the block. If it is missing or another version, they suggest installing it and run the same version through npx until then.
- The browser's product overview became the dashboard and activity became decision records; the old addresses (`/product`, `/activity`) are gone. Document lists and bodies are set in Pretendard.
- The history index lives in the working tree at `.gitifact/cache/index.db`. It stays out of commits and is rebuilt when deleted.
### Removed
- The wiki (`.gitifact/wiki/`), replaced by project instructions. `check` reports pages left there.
- `spec working`, `save`, `read`, `diff`, `changes` and `commit`, `docs <topic>` and `status`, replaced by editing files directly and the `specs`, `changes` and `guide` commands.
- The reason file `history.jsonl`, replaced by decision records. Reasons in 0.7 commits still show in the history.
- The Tryce-era formats (`.tryce` paths, `tryce-*` markers, schemaVersion 1) and the `migrate` command that moved them.
### Fixed
- On narrow browser screens, the side gutters differed between screens and the filters and feature list overflowed a single row.
- A 0.7 reason that explained several documents in one commit repeated once per document in the decision record list.

## 0.7.1 - 2026-09-21
### Added
- Agent instructions now ask agents to check for updates at the start of a session and refresh the instructions with the user's consent. The new `update --check` command checks for updates without changing files.
### Changed
- Setup guidance now uses npx without requiring a global install. Agent instructions pin the CLI version, while everyday examples in the README and Getting started use the shorter `npx gitifact` command.
### Removed
- Removed browser update notifications and server-side update checks. The current version and release notes remain available. Also removed the `browser --no-update-check` option.
### Fixed
- Merged work now retains the original commit's author and reasons instead of being attributed to the person who merged it. Ordinary merges no longer duplicate activity, while records edited during a merge remain attributed to that merge commit. Existing history indexes are rebuilt automatically.
- Fixed the project name, search, and refresh header disappearing when scrolling a long, paginated feature requirements list.

## 0.7.0 - 2026-09-20
### Added
- A GitHub link at the bottom of the sidebar opens the project repository in a new tab.
- English and Korean in the browser and CLI. Choose a language in browser Settings or use the CLI's `--lang en` / `--lang ko` option. Unsupported environment languages fall back to English.
- A Getting started page below About, covering setup, development, the wiki, viewing records, and CLI commands.
### Changed
- The repository and npm README now open in English, with links to Korean documentation.
- Existing agent instruction blocks retain their language during updates unless `--lang` is supplied. Project documents, IDs, history, and storage schemaVersion 2 remain unchanged.

## 0.6.2 - 2026-09-20
### Added
- The feature list shows each requirement beneath its feature. Selecting one opens it directly, with an address that can be shared or bookmarked. Pagination keeps each feature's requirements together.
- Requirements link to the design sections that reference them, complementing the links from designs to requirements.
### Changed
- Each activity entry now represents one commit. A reason appears once above the records it changed, without truncation or repetition for each record. Date labels separate days.
- Recent changes on the product overview is now Latest activity, using the activity timeline. Each commit shows up to ten records, with a link to Activity for the rest.
- Following a link to a requirement or design section highlights its heading, replacing the vertical marker beside the section.
- Feature sorting moved from a separate selector to table headers. Select Feature, Requirements, or Last changed to sort; select again to reverse the order.
- The sidebar logo and footer version align with menu items.
### Fixed
- Direct links to requirements and design sections now scroll to their targets.
- The product overview shows a loading state while counting history instead of prematurely displaying zero activity.

## 0.6.1 - 2026-09-19
### Added
- The browser indexes history locally in `.git/gitifact/index.sqlite`. Restarting reads only new commits. The index stays outside the working tree and `git status`, and is rebuilt if deleted or damaged.
- Search (`Ctrl`/`Cmd`+`K`) finds past changes by title and reason. Selecting one opens it in Activity.
### Changed
- Activity filters and search cover the entire history, including entries not yet loaded. The list reports the loaded count and total, loading 50 changes at a time.
- The product overview's change-type chart and 21-day chart count all history. Recent changes shows up to 12 records per commit, linking to Activity for the rest.
- Contributor details show that person's ten latest changes regardless of how much history is loaded.
- Change details load when opened. Links to changes outside the loaded list also work.
- Returning to Activity after loading many pages renders faster: about 0.4 seconds instead of 2.9 seconds for 334 entries. Load-more performance stays consistent as the list grows.
- Light-mode text and the logo are lighter; the logo is smaller. The two overview charts have equal height.
- Contributor avatars use hand-drawn faces.
### Fixed
- Mermaid diagrams render in palettes other than Stone.
- The wiki loading skeleton follows the tree, breadcrumb, and document layout.
- Search no longer flashes an empty-document message while typing; it shows result-shaped placeholders while waiting.

## 0.6.0 - 2026-09-19
### Added
- The browser renders Mermaid code fences as diagrams and GitHub alerts such as `> [!NOTE]` as labeled callouts. Rendering code is bundled and uses no external service.
- Document search opens with `Ctrl`/`Cmd`+`K` or the search button in each page header. It searches feature specifications, requirements, designs, and wiki pages by title and body, groups results by kind, and opens the selected document.
- Filter features by design presence or contributor, and sort by latest change, requirement count, or name. The URL preserves selections when navigating away and back.
- `gitifact docs writing` covers prose style, quotations, alerts, diagrams, and removal of formulaic AI wording. The spec, design, and wiki guides reference it.
### Changed
- The product overview places recent changes in its main content. A project-size summary and two charts replace five summary tiles, followed by commit reasons and affected records.
- Loaded history survives page navigation. Current specifications, wiki pages, and contributors are included only on the first history page, avoiding repeated data on Load more.
- Search runs 500 ms after typing stops, consistently across activity, features, contributors, and document search.
- The feature table no longer repeats design presence in every row; only missing designs are marked beside titles. Requirement counts include proportional bars, and rows have equal height.
- The GITIFACT block lists `docs writing` and instructs agents to follow it before writing documents. Run `update` or `init` to refresh the block.
### Removed
- Removed the deprecated `spec prepare`, `spec verify`, `spec commit-plan`, and `spec commit-apply` commands, as announced in 0.5.0. Use `spec commit` for recording reasons and committing.

## 0.5.1 - 2026-09-18
### Changed
- `init` checks for updates and reports them in `update` and `install`, including when setting up with an older CLI. Setup continues if the check fails. Disable it with `GITIFACT_NO_UPDATE_CHECK`. The init output contract is version 5.
- The introduction's setup prompt runs `npm install -g gitifact@latest` even when Gitifact is already installed.
- Projects using a newer storage schema are prompted to update the CLI.
### Fixed
- Fixed a setup dead end where 0.5.0 instructed 0.4.x projects to rerun init but then rejected them. If `.gitifact` contains only configuration, init replaces it with the current schema and reports `replaced`. If older specifications or records exist, it preserves them and explains the next step.

## 0.5.0 - 2026-09-18
### Added
- A project wiki under `.gitifact/wiki/`, with flexible subfolders for product context, architecture, and rules. Pages have CLI-issued W-IDs and use `create-doc`, `update-doc`, `move-doc`, and `delete-doc` in `spec save`. Reasons are recorded at commit time.
- The wiki README defines its operating guidelines. init creates default ADR guidelines; after edits, `docs wiki` shows the project's own text.
- Store images and PDFs in `.gitifact/assets/` and reference them with relative links. `spec working` warns about missing link targets, large files, nonrecommended extensions, and unreferenced assets.
- Design frontmatter `sources` appears as a reference list above the browser's design tab.
- A Project wiki menu with a tree on the left and folder contents or a page on the right.
- Relative document links resolve to wiki pages, features, and assets. For repository files outside `.gitifact`, the viewer offers path copying rather than opening the file.
- When init writes an AGENTS.md block and CLAUDE.md is absent, it creates CLAUDE.md containing `@AGENTS.md`. update reports the missing file without creating it.
### Changed
- Storage uses schemaVersion 2, with file IDs in frontmatter. Projects created by 0.4.x (schemaVersion 1) are not readable by this version and have no migration tool. The CLI explains the limitation and asks for fresh setup.
- The browser opens at Product overview. Activity moved to `/activity`; old activity URLs containing filters or a selection lead to the corresponding Activity view.
- Renamed the requirements menu to Features.
- The GITIFACT block tells agents to check `docs wiki` before changing requirements, designs, or code, and to edit the wiki README to change its guidelines. Run `update` or `init` to refresh it.
- Specification examples use the feature name as the title without a “requirements” suffix.
- The update output contract is version 3, with absent CLAUDE.md reported in `agentDocs.missing`.
### Removed
- Removed the product-document and guides folders and the browser's Guides menu. Their content belongs in the wiki.
### Fixed
- Fixed Korean IME composition being interrupted or duplicated in browser search fields.

## 0.4.4 - 2026-09-17
### Added
- `update --commit` commits instruction files whose changes are confined to GITIFACT blocks, using `chore(gitifact): refresh GITIFACT block to v<version>`. It preserves other staging and runs normal hooks and signing. Untracked files, changes outside blocks, or Git rejection result in an explanation without a commit.
- The GITIFACT block explains what to do when the command is unavailable: inform the user and obtain consent to install the version named in the block.
### Changed
- Reformatted the block with a `## Gitifact Guide` heading, sections, lists, and a closing separator so commands remain readable in Markdown. Run `update` or `init` to refresh it.
- Browser update prompts include `gitifact update --commit` after installation.
- The update output contract is version 2, with a `commit` result field.

## 0.4.3 - 2026-09-17
### Fixed
- Fixed clipping of the title and close button at the edges of the update dialog.
- Moved copy buttons to code-block title rows so they do not overlap the update prompt.

## 0.4.2 - 2026-09-17
### Added
- `spec working` and `spec changes` return `inputs.save` and `inputs.commit` paths. These use the OS temporary directory, falling back to Git-ignored `.gitifact/tmp/` if needed.
- Successful saves and commits remove input files at those paths and report `inputRemoved`. Failure, dry runs, and uncertain commit results preserve inputs. Queries clean up files older than seven days.
- `spec save` and `spec commit` accept stdin through `--file -`.
- `spec working` supports `--stamp`, `--feature <folder>`, and `--ids` for smaller output.
### Changed
- The block and workflow guide instruct agents to use returned input paths and avoid saving query output. Run `update` or `init` to refresh the block.
- Agents are instructed to start the browser in the background and share its URL when asked to show requirements, project status, or history.

## 0.4.1 - 2026-09-17
### Added
- Browser Settings offers system, light, and dark modes and five palettes: Stone, Sage & Cream, Olive & Warm Gray, Slate & Blue, and Sand & Clay. Preferences are stored in that browser only.
- The product overview opens product documents on a separate reading page.
### Changed
- Improved document typography and layout: 16 px body text, aligned paragraph/code/table widths, and revised headings, spacing, tables, quotes, and links.
- Added syntax colors to code blocks.
- Guide folder rows show document counts and match document-row heights.
- Simplified activity comparison boxes to top and bottom borders.
- The sidebar footer shows only the version.
### Fixed
- Fixed activity detail content overlapping the sticky heading while scrolling.

## 0.4.0 - 2026-09-17
### Added
- The browser reports new versions and offers copyable agent prompts and npm installation commands. It does not install updates automatically.
- The sidebar footer displays the running CLI version.
- A release-notes page lists additions, changes, removals, and fixes newest first.
- `update` checks for a new version, shows installation instructions, and refreshes project GITIFACT blocks to the installed version.
- Disable update checks with `browser --no-update-check` or `GITIFACT_NO_UPDATE_CHECK`.
### Changed
- Browser startup checks registry.npmjs.org once for the latest version. It sends no project information and remains usable if the check fails.
- The browser-session contract is version 2, adding `cliVersion` and `update`.
- The block's command list includes `update`. Run `update` or `init` to refresh it.

## 0.3.2 - 2026-09-17
### Added
- Release notes are included in the package.
- Added help descriptions for `spec changes`, `working`, `save`, `read`, and `diff`.
- Updated the browser introduction and added the logo.
### Changed
- The block's first line identifies its language (`ko`). Rerun init to refresh it; older block formats remain readable.
### Fixed
- Corrected the CLI guidance for old JSON projects from the nonexistent `gitifact@0.4.0` to `@tryce/cli@0.4.0`.

## 0.3.1 - 2026-09-17
### Added
- Product overview dashboard and About page.
- A column view and preview for guide documents.
- Last-observed timestamps in headers and an uncommitted-change indicator on the Git status menu.
### Changed
- Revised requirements menu naming and order.

## 0.3.0 - 2026-09-16
### Added
- init writes `GITIFACT:START`/`GITIFACT:END` blocks in AGENTS.md, CLAUDE.md, `.cursorrules`, and other agent instruction files. Subsequent runs update only the block.
- Added `--agent`, `--remove-agents`, and `--skip-agents` to init.
- `docs <topic>` prints five bundled guides: workflow, spec, design, product, and commit.
### Changed
- The project-init contract is version 4.
### Removed
- Removed `skills install`, `skills sync`, `skills remove`, and distributed skill files. Skills installed by 0.2.0 are not automatically removed; delete those installed files manually and rerun init.

## 0.2.0 - 2026-09-15
### Added
- Larger default browser text on displays at least 1920 px wide.
### Changed
- Updated contributor-page terminology.
- Feature and contributor details moved to `/features/<S-ID>` and `/contributors/<email>`. Old `?feature=` and `?author=` links are not redirected.
- Aligned the Git status page structure with other pages.

## 0.1.0 - 2026-09-15
### Added
- A migrate command converts older `@tryce/cli` repositories to Gitifact while preserving access to past commit records.
### Changed
- Renamed Tryce to Gitifact: package and command `gitifact`, storage `.gitifact`, and skill `gitifact-workflow`.
