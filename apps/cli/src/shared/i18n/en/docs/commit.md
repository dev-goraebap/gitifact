---
title: Final changes at commit time
description: Commit input, recording reasons, recovery after failure
---

Automatic recording does not authorize a commit. Commit on user request or under an explicit project policy. The absence of a policy is not permission to auto-commit; do not ask again for permission already granted. Pushing requires separate authorization.

## Procedure

1. Review the actual diff and relevant tests, then run `gitifact changes list`. It shows the documents changed since HEAD, documents without a reason, the document check result and the commit input path.
2. Write the input below as UTF-8 JSON to that path and run `gitifact changes commit --file <that-path>`. Add `--dry-run` to inspect scope and missing reasons first; it writes no files and makes no commit. After a successful commit the CLI removes the input file.
3. Check the result and the actual Git status. Report any documents left in `withoutReason` as missing reasons.

```json
{
  "reasons": [
    { "docs": ["R-actual-id", "D-actual-id"], "reason": "Reason established in the conversation or decision" }
  ],
  "paths": [".gitifact/spec/posts/requirements/delete.md", ".gitifact/spec/posts/design/overview.md", ".gitifact/history.jsonl", "src/posts.ts", "test/posts.test.ts"],
  "message": "Message following project conventions",
  "authorization": { "basis": "user-request", "evidence": "Actual commit request and authorized scope" }
}
```

Do not copy example paths, IDs or evidence literally. The input holds only these four fields (`reasons` may be omitted). `basis` is `user-request` or `project-policy`. The CLI cannot judge whether natural-language authorization is genuine.

## Input rules

- **`reasons`:** each reason is `{docs: [document IDs…], reason}`. List in `docs` the IDs of the requirements (R-), designs (D-), features (S-) and wiki pages (W-) that changed for that reason, whatever their kind. Put the documents one reason explains in one entry; give separate reasons separate entries. IDs of documents this commit deletes may be listed.
- **Reason IDs:** the CLI issues an `H-` ID for each and appends one line per reason to `.gitifact/history.jsonl`. Do not edit that file by hand. If a committed line is changed or removed, `changes list` reports it and `changes commit` refuses; restore the line to HEAD and write the correction as a new reason.
- **Without reasons:** omit `reasons` to commit without one. Changed documents without a reason are reported in `withoutReason`. Do not invent reasons you do not know.
- **`paths`:** the changed document files, `.gitifact/history.jsonl` when recording reasons, and related code and tests. Every changed document file must be selected. For a moved document include the old and the new path; for a deleted one, the deleted path. Include new referenced assets (`.gitifact/assets/…`). If unrelated work is mixed in, report the limitation instead of forcing it into the commit.
- **Check:** the same check as `docs check` runs just before the commit. Problems or a remaining `draft: true` stop the commit. Link and asset warnings do not.
- **Staging:** do not stage anything before running the command. The CLI refuses when staging or intent-to-add already exists. If you created staging yourself (`git mv`, `git rm` and the like), unstage it with `git restore --staged`, leave the files as they are and run again. Delete or move files with plain file operations rather than `git rm` or `git mv`.
- **After a failure:** if a hook or another check rejects the commit and HEAD is unchanged, the reason lines and index written in this run are restored. Fix the cause and rerun the same input. Do not disable hooks or signing after a failure. If the error says the outcome could not be verified (HEAD may have moved), do not retry; inspect the recovery data it names and HEAD. Do not delete lock folders or index backups, or reset commits.

Committing the same input twice records its reason lines twice. After a success, do not rerun the same file.

A commit reference does not declare implementation complete. Report actual test results and remaining limitations separately.

## Commit scope

Keep related documents, reasons, source and tests in one commit by default. If project policy separates them, commit documents and reasons first and describe the related documents in the message of the following code and test commit. Preserve user changes and staging; exclude unrelated edits.

## Message and trailers

Follow the project's commit message convention. If none exists, state briefly what changed on the first line and why in the body. The CLI adds trailers for the changed documents and the documents reasons name (`Gitifact-Req` for requirements, `Gitifact-Design` for designs, `Gitifact-Doc` for features and wiki pages). A message with a line starting `Gitifact-` is refused.

## Reasons

State only facts established in the conversation and decisions. Say why the change was made rather than what changed. Include rejected alternatives when they affect future work. Document bodies hold only what is current (`gitifact guide show writing`), so history left out of the body, such as the old approach, what prompted the change, or measurements, goes here. Each reason is at most 4,000 characters. Past text is read from Git with `gitifact docs show <ID> --ref <commit>` and the course of reasons with `gitifact docs history <ID>`, so do not copy text, authors or times into a reason.
