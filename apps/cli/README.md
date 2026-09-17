# Gitifact CLI

Git-backed requirements and change history for coding agents. New projects use `schemaVersion: 1`, Markdown specifications and per-feature change reasons. Requires Node.js 24.x and Git.

Install with `npm install -g gitifact`. Run `gitifact init`, then read the GITIFACT block it writes into the project's agent instruction file and follow it in the current session.

```sh
gitifact init --dry-run
gitifact init
gitifact docs
gitifact docs spec
gitifact update
gitifact spec working
gitifact spec save --file input.json
gitifact spec changes
gitifact spec commit --file commit.json --dry-run
gitifact spec commit --file commit.json
gitifact spec read --ref HEAD
gitifact spec diff --from BEFORE --to AFTER
```

Initialization creates the configuration and the Git adoption baseline, then installs a managed block between `<!-- GITIFACT:START -->` and `<!-- GITIFACT:END -->` in the agent instruction files. Existing `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `.cursorrules`, `.hermes.md` and `HERMES.md` all receive the block, except files that only `@`-import another one; when none exist, `AGENTS.md` is created. `--agent claude|cursor|codex|hermes|all` targets one tool's file instead, `--remove-agents` removes the block, and `--skip-agents` leaves instruction files alone. Text outside the markers is never touched; re-running `init` refreshes the block after a CLI update and refuses files with a broken marker pair. Initialization requires Git, accepts an unborn repository, preserves unrelated work and staging, and never performs a commit. Existing legacy configuration requires an explicit separate transition.

`gitifact docs` lists the guidance topics (`workflow`, `spec`, `design`, `product`, `commit`) and `gitifact docs <topic>` prints the bundled Markdown for one. The block summarises the rules and points agents at these topics for the exact input formats.

The legacy `req`, `note`, `mode`, `brief`, `commit plan/apply` and `init --mode` commands and the `spec-preview` alias have been removed. Historical JSON projects require the old `@tryce/cli@0.4.0` or earlier. `browser` serves requirement history, current features and contributors from Markdown/Git.

The `spec` commands use the input objects described by `gitifact docs spec` and `gitifact docs commit`. Their output envelope is `contract: "spec", version: 1`. For a project with schemaVersion 1, config bytes are bound to working stamps and commit plans. Creation and edits never imply user approval or implementation completion.

## Updates

`gitifact update` reports the running version, whether a newer release exists, and the install command for npm global installs (`npm install -g gitifact@<version>`); other install methods update their own way. It never installs anything itself. In an initialized project it also rewrites the GITIFACT block in files that already carry one, so run it again after installing. Output is `contract: "update", version: 1`; add `--format text` for a readable form.

`gitifact browser` and `gitifact update` make the only outbound request of the CLI: one GET to `https://registry.npmjs.org/gitifact` for the latest version. No project information is sent, the request has a short timeout, and a failure never blocks anything. Turn it off with `gitifact browser --no-update-check` or `GITIFACT_NO_UPDATE_CHECK=1`.

## Browser

Run `gitifact browser` inside your project. It prints a local URL and stops with Ctrl+C. The read-only browser displays requirement history with before/after content, current feature specifications and Git contributors. History loads in pages; filtering applies to loaded results. No project records are changed by browsing. The side menu footer shows the running CLI version and links to the release notes page, which lists added, changed, removed and fixed items per version. When the server found a newer release, a button next to the version opens a prompt to hand to your agent and the npm command to copy; the browser never installs anything.

## Commit

`changes` compares HEAD with the final working draft and returns `pendingReasons` and `expected`. It is optional before committing.

`commit --file` records the final change reasons and commits the related files in one command. Add `--dry-run` to see the result, missing reasons and rejections without writing files or committing.

```json
{
  "reasons": [{ "requirements": ["R-…"], "reason": "…" }],
  "paths": [".gitifact/spec/posts/requirements.md", ".gitifact/spec/posts/history.jsonl", "src/posts.ts"],
  "message": "…",
  "authorization": { "basis": "user-request", "evidence": "Actual request or policy basis" }
}
```

`reasons` is the complete list of uncommitted reasons. Committed history is preserved, repeating the same reasons reuses IDs, and reverted requirements need no new reason. Omit `reasons` to keep reasons already written. Requirement changes without a reason still commit and are reported in `withoutReason`; reasons are never invented. `project-policy` is the other allowed basis; absence of policy is not authorization. Optional `requirements` references existing R-IDs for code-only commits, `policyFiles` adds instruction files to recheck, and `expected` from `changes` rejects specification edits made after it. Moves record reasons at the destination, deletions at the source; retain an empty specification when it owns past history.

By default, agents select related specifications, reasons, source and tests together. For a split policy, commit specification/reason files first and reference R-IDs from the later code commit. Changed specification/reason files must all be selected; partial selection of pending specifications is unsupported. A selected reason file with nothing to record is skipped. Do not stage files first. Existing staging, including intent-to-add, is preserved by refusing execution.

The command rechecks content, instructions and HEAD under a lock, stages selected paths in an isolated index, and runs normal Git hooks and signing. A rejected commit with unchanged HEAD restores the reason files and the original index, so the same input can be retried. If another process edited a reason file meanwhile, that file is kept with recovery data under the Git directory's `gitifact-spec-preview.lock`. An uncertain outcome after HEAD changes keeps all files and recovery evidence under `gitifact-spec-commit.lock`; inspect HEAD and both indexes before recovery and do not blindly retry. Automatic crash recovery and migration of existing projects are not supported.

`prepare`, `verify`, `commit-plan` and `commit-apply` are deprecated. Their previous removal target belonged to the Gitifact release line; a Gitifact removal version has not been assigned.

## Compatibility and limits

Legacy JSON projects are not converted automatically and are not read by this CLI; the browser requires schemaVersion 1. The new format does not provide approval bundles or notes. Browser editing, implementation-completion inference and full history validation are not available. Execution has been tested on Windows; macOS and Linux have not been verified.

## License

MIT. Bundled dependency notices are included in `dist/THIRD_PARTY_NOTICES.txt`.

## Feature designs

The development build supports optional `design.md` next to requirements.md. `gitifact docs design` tells agents to create both by default for new features. Add `{type: "set-design", feature, title, body}` to spec save operations; use `{type: "delete-design", feature}` to remove it. The CLI writes the owning S-ID, while explicit `gitifact-ref` annotations link actual R-IDs. Missing current references return warnings.

Commit reasons may add `designs: ["S-…"]` alongside `requirements`. For a design-only reason, use `requirements: []`. Design changes have `kind: "design"` and do not become requirement changes. Use spec commit; deprecated commit-plan/apply do not accept new design changes. The browser displays designs in feature tabs and specification history. This extension is not yet published.
