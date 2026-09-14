# tryce 0.4.0

Git-backed requirements and change history for coding agents. New projects use `schemaVersion: 1`, Markdown specifications and per-feature change reasons. Requires Node.js 24.x and Git.

Install with `npm install -g @tryce/cli`. Load the installed tryce-workflow skill in the current agent session.

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

`req`, `note`, `mode`, and `init --mode` are deprecated compatibility commands. Help marks them deprecated; JSON stdout and stderr error contracts remain unchanged. They still work for legacy projects. Removal follows validated transition support, not a fixed number of development turns. `spec-preview --experimental` remains a compatibility entry point. `brief` does not yet support the new schema. `browser` serves requirement history, current features and contributors from Markdown/Git.

The `spec` commands use the same input objects described by the installed workflow skill, without `--experimental`. Their output envelope is `contract: "spec", version: 1`. For a project with schemaVersion 1, config bytes are bound to working stamps and commit plans. Creation and edits never imply user approval or implementation completion.

## Browser

Run `tryce browser` inside your project. It prints a local URL and stops with Ctrl+C. The read-only browser displays requirement history with before/after content, current feature specifications and Git contributors. History loads in pages; filtering applies to loaded results. No project records are changed by browsing.

## Prepare and commit

`changes` compares HEAD with the final working draft and returns `expected` plus `pendingReasons`. `prepare` accepts `{ "expected": "…", "reasons": [{ "requirements": ["R-…"], "reason": "…" }] }`. It preserves committed history and replaces only uncommitted reasons with this complete list. Repeating the same preparation reuses IDs; reverted requirements need no new reason. Unknown reasons are reported in `withoutReason`, never invented.

Save the returned `verification` object to use `verify`. With `--staged`, it checks that staged specification/history bytes match the prepared working files; otherwise it checks the working files only. These commands do not stage or commit anything, and verification is not approval or a guarantee against later edits. Moves record reasons at the destination, deletions at the source; retain an empty specification when it owns past history. Use the separate commit commands below to execute an authorized commit.

```sh
tryce spec commit-plan --file ./commit-input.json
tryce spec commit-apply --file ./commit-plan.json
```

The separate commit commands connect preparation to Git execution. Input contains `verification` from prepare, exact `paths`, a `message`, and `authorization: { "basis": "user-request", "evidence": "Actual request or policy basis" }`. `project-policy` is the other allowed basis; absence of policy is not authorization. Save the returned `plan` object for apply. Optional `requirements` references existing R-IDs, and `policyFiles` adds instruction files to recheck.

For commit-plan/apply, do not stage files first: apply builds and checks its isolated index internally. The earlier verify --staged example is for an agent using Git directly.

By default, agents select related specifications, reasons, source and tests together. For a split policy, commit specification/reason files first and reference R-IDs from the later code commit. Changed specification/reason files must all be selected in this initial implementation; partial selection of pending specifications is unsupported. Existing staging, including intent-to-add, is preserved by refusing execution. The agent does not need to ask for separate approval of each internal command when the work is already authorized.

Apply revalidates content and instructions, stages selected paths in an isolated index, and runs normal Git hooks and signing. A rejected commit with unchanged HEAD preserves the original index and permits retry. An uncertain outcome after HEAD changes keeps recovery evidence under the worktree Git directory's `tryce-spec-commit.lock`; inspect HEAD and both indexes before recovery and do not blindly retry. Automatic crash recovery and migration of existing projects are not supported.

## Compatibility and limits

Legacy JSON projects are not converted automatically. Their deprecated req/note/mode commands remain available; the new browser requires schemaVersion 1. The new format does not provide approval bundles or notes. Brief integration, browser editing, implementation-completion inference and full history validation are not available. Execution has been tested on Windows; macOS and Linux have not been verified.

## License

MIT. Bundled dependency notices are included in `dist/THIRD_PARTY_NOTICES.txt`.
