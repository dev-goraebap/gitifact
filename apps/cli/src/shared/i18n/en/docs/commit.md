---
title: Final changes at commit time
description: Commit input, recording reasons, recovery after failure
---

Automatic recording does not authorize a commit. Commit on user request or under an explicit project policy. The absence of a policy is not permission to auto-commit; do not ask again for permission already granted. Pushing requires separate authorization.

## Procedure

1. Review the actual diff and relevant tests. Use `spec changes` if needed to read final specification differences from HEAD and pendingReasons.
2. Write the input below as UTF-8 JSON to `inputs.commit` from `spec working` or `spec changes`, then run `spec commit --file <that-path>`. The CLI removes the input after a successful commit. Use `--dry-run` to inspect scope and missing reasons first; it writes no files and makes no commit.
3. Check the success result and actual Git status. Report any returned withoutReason entries as missing reasons.

```json
{
  "reasons": [{ "requirements": ["actual R-ID"], "reason": "Reason established in the conversation or decision" }],
  "paths": [".gitifact/spec/posts/requirements.md", ".gitifact/spec/posts/history.jsonl", "src/posts.ts", "test/posts.test.ts"],
  "message": "Message following project conventions",
  "authorization": { "basis": "user-request", "evidence": "Actual commit request and authorized scope" }
}
```

basis is either user-request or project-policy. Do not copy example paths or evidence literally. Supply additional policy files in policyFiles; for a code-only commit, use actual R-IDs in requirements to link it. If reasons were prepared from changes, pass its expected value to reject intervening specification edits. The CLI cannot judge whether natural-language authorization is genuine.

## Input rules

- reasons is the **complete list of uncommitted reasons**, including still-valid pendingReasons. Omitting it preserves prepared reasons. Do not invent unknown reasons. A commit can proceed without reasons; omissions are reported in withoutReason.
- For wiki pages, pass `{requirements: [], documents: [actual W-ID], reason: actual reason}`. Include the changed pages and `.gitifact/wiki/history.jsonl` in paths.
- For designs, pass `{requirements: [], designs: [actual S-ID], reason: actual reason}`. Use both arrays when requirements and designs share a reason. Include design.md and history.jsonl in paths. Do not fabricate a requirements change or completion for a design-only change.
- paths includes changed specifications, their history.jsonl files, and related code and tests. Include new referenced assets (`.gitifact/assets/…`). For a moved requirement, include both specifications. Skip history.jsonl files with no reasons to record. All uncommitted specifications and reasons must be selected; if unrelated work is mixed in, report the limitation instead of forcing it into the commit.
- Do not stage files before running the command. Preserve existing staging or intent-to-add and defer the commit if either is present.
- If edits were reverted and no final difference remains, there is no new reason. Do not overwrite committed history.jsonl records.
- History stores reasons and links to requirements, designs, and pages, not duplicate before/after text, authors, or timestamps. Read past specifications with `spec read --ref` and changes with `spec diff --from --to`. A Git author is not evidence of a user request or approval.
- If a hook or another check rejects the commit and HEAD is unchanged, the newly written reason files and index are restored. Fix the cause and retry the same input. Do not disable hooks or signing after failure. If HEAD changed and the outcome is uncertain, inspect recovery information instead of retrying. Do not arbitrarily delete locks or index backups, or reset commits.

A commit reference does not declare implementation complete. Report actual test results and remaining limitations separately.

## Commit scope

Keep related specifications, reasons, source, and tests in one commit by default. If project policy separates them, commit specifications and reasons first and reference actual R-IDs from the code/test commit. Preserve user changes and staging; exclude unrelated edits.

## Message

Follow the project's commit message convention. If none exists, briefly state what changed on the first line and why in the body. The CLI adds requirement, design, and page trailers; do not write them manually.

## Reasons

State only facts established in the conversation and decisions. Include rejected alternatives when they affect future work. Do not treat a commit reference as proof of implementation; report performed checks and remaining limitations separately.
