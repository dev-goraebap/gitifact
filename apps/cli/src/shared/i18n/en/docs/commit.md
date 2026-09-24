---
title: Final changes at commit time
description: Commit input, committing with records, splitting commits, recovery after failure
---

Automatic recording does not authorize a commit. Commit on user request or under an explicit project policy. The absence of a policy is not permission to auto-commit; do not ask again for permission already granted. Pushing requires separate authorization.

## Procedure

1. Review the actual diff and relevant tests, then run `gitifact changes list`. It shows the documents changed since HEAD, the uncommitted records and the documents each explains, changes, moves and deletions without a record, the document check result and the commit input path.
2. Write the input below as UTF-8 JSON to that path and run `gitifact changes commit --file <that-path>`. Add `--dry-run` to inspect scope and missing records first; it writes no files and makes no commit. After a successful commit the CLI removes the input file.
3. Check the result and the actual Git status. Report any documents left in `withoutRecord` as missing records.

```json
{
  "paths": [".gitifact/records/20260924/DR-actual-value.md", ".gitifact/spec/posts/requirements/delete.md", ".gitifact/spec/posts/design/overview.md", "src/posts.ts", "test/posts.test.ts"],
  "message": "Message following project conventions",
  "authorization": { "basis": "user-request", "evidence": "Actual commit request and authorized scope" }
}
```

Do not copy example paths, IDs or evidence literally. The input holds only these three fields. `basis` is `user-request` or `project-policy`. The CLI cannot judge whether natural-language authorization is genuine.

## Input rules

- **Records:** a record is the file created with `gitifact records new` when the decision was made (`gitifact guide show records`). List the record files to commit in `paths`. Records not listed stay in the working tree for a later commit. A committed record that still has `draft: true` is refused.
- **Changes that need a record:** an existing document changed, moved or deleted without a record naming it is reported in `withoutRecord`. It does not block the commit. A new document needs no record. Do not invent reasons you do not know.
- **`paths`:** the document files, record files and related code and tests this commit takes. Not every changed document has to be included; the rest stays for a later commit. A moved document needs both its old and new path. For a deleted document, list the deleted path. Include new assets the documents reference (`.gitifact/assets/…`).
- **Committed records:** if a committed record is edited or deleted, `changes list` and `docs check` report it and `changes commit` refuses. Restore it from HEAD and write the changed decision as a new record.
- **Checks:** the same checks as `docs check` run just before the commit. A problem, or `draft: true` left in a document or in a record being committed, stops the commit. Link and asset warnings do not.
- **Staging:** do not stage before running. Existing staging or intent-to-add entries are refused. Unstage anything you created (`git mv`, `git rm`, …) with `git restore --staged`, keep the files, and run again. To delete or move files, use ordinary file operations instead of `git rm` or `git mv`.
- **After a failure:** if a hook or similar rejects the commit and HEAD is unchanged, the index returns to its prior state and the files are left as they were. Fix the cause and rerun the same input. Do not disable hooks or signing after a failure. If the error says the result could not be verified (HEAD may have changed), do not retry; inspect the recovery data and HEAD. Do not delete the lock folder or index backup, or reset the commit.

A commit reference is not a declaration that implementation is complete. Report actual test results and remaining limits separately.

## What goes into one commit

By default, one commit holds one decision: its record, the documents it changed, and the code and tests that implement it. `changes list` shows the documents each record explains; split along those. Records that explain the same document (`Documents two records explain`) go into one commit. The CLI cannot assign code files to records, so decide which decision each belongs to, and commit a file that spans two decisions with both.

When a task is finished but not committed and the next one is about to start, suggest a commit once. Say in one line that if the next task edits the same files, two decisions end up in one file, the work can no longer be committed decision by decision, and the history blurs which change belongs to which decision. A suggestion is not permission to commit: do not commit before the user answers, and if they decline, do not ask again in the same session.

If the project has its own rules for grouping commits, follow them. Under a split policy, commit documents and records first, then explain the related documents in the following code and test commit messages. Do not remove existing user changes or staging, and do not include unrelated changes.

## Message and trailers

Follow the project's commit message convention. If none exists, state briefly what changed on the first line and why in the body. The CLI adds trailers for the changed documents and the documents records name (`Gitifact-Req` for requirements, `Gitifact-Design` for designs, `Gitifact-Doc` for features and instructions, `Gitifact-Record` for records). A message with a line starting `Gitifact-` is refused.
