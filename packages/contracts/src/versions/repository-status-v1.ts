import { z } from 'zod';

const path = z.string().min(1).refine(
  (value) => !value.includes('\0') && !/[\uD800-\uDFFF]/u.test(value),
  'Paths must be lossless Unicode strings without NUL.',
);
const relativePath = path.refine((value) =>
  !value.startsWith('/') && !/^[A-Za-z]:/.test(value)
  && !(value.endsWith('/') ? value.slice(0, -1) : value).split('/').some((part) => part === '.' || part === '..' || part === ''),
);
const oid = z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/).refine((v) => !/^0+$/.test(v));
const submodule = z.strictObject({
  commitChanged: z.boolean(), trackedChanges: z.boolean(), untrackedChanges: z.boolean(),
}).nullable();
const filePath = relativePath.refine((value) => !value.endsWith('/'));
const change = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('tracked'), path: filePath,
    xy: z.string().regex(/^[.MTAD]{2}$/).refine((v) => v !== '..'), submodule }),
  z.strictObject({ kind: z.literal('unmerged'), path: filePath,
    xy: z.enum(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']), submodule }),
  z.strictObject({ kind: z.literal('untracked'), path: relativePath, xy: z.null(), submodule: z.null() }),
]);
export const repositoryStatusSuccessV1 = z.strictObject({
  contract: z.literal('repository-status'), version: z.literal(1), ok: z.literal(true),
  observation: z.strictObject({
    id: z.uuid(),
    startedAt: z.iso.datetime(), completedAt: z.iso.datetime(),
    consistency: z.literal('best-effort'),
  }),
  repository: z.strictObject({
    key: z.string().regex(/^repo:[0-9a-f]{64}$/),
    worktreeKey: z.string().regex(/^worktree:[0-9a-f]{64}$/),
    rootPath: path.refine((v) => v.startsWith('/') || /^[A-Za-z]:[/\\]/.test(v) || v.startsWith('\\\\')),
    objectFormat: z.enum(['sha1', 'sha256']),
  }),
  head: z.discriminatedUnion('state', [
    z.strictObject({ state: z.literal('branch'), branch: path, commit: oid }),
    z.strictObject({ state: z.literal('detached'), branch: z.null(), commit: oid }),
    z.strictObject({ state: z.literal('unborn'), branch: path, commit: z.null() }),
  ]),
  changes: z.array(change),
  summary: z.strictObject({
    staged: z.int().nonnegative(), unstaged: z.int().nonnegative(),
    untracked: z.int().nonnegative(), conflicted: z.int().nonnegative(),
  }),
  checks: z.strictObject({ state: z.literal('not-run'), reason: z.literal('git-status-only') }),
}).superRefine((value, ctx) => {
  if (value.head.commit && value.head.commit.length !== (value.repository.objectFormat === 'sha1' ? 40 : 64)) {
    ctx.addIssue({ code: 'custom', message: 'Object ID does not match objectFormat.', path: ['head', 'commit'] });
  }
  const seen = new Set<string>();
  const totals = { staged: 0, unstaged: 0, untracked: 0, conflicted: 0 };
  for (const item of value.changes) {
    if (seen.has(item.path)) ctx.addIssue({ code: 'custom', message: 'Duplicate path.', path: ['changes'] });
    seen.add(item.path);
    if (item.kind === 'unmerged') totals.conflicted++;
    else if (item.kind === 'untracked') totals.untracked++;
    else {
      if (item.xy[0] !== '.') totals.staged++;
      if (item.xy[1] !== '.') totals.unstaged++;
    }
  }
  for (const key of ['staged', 'unstaged', 'untracked', 'conflicted'] as const) {
    if (value.summary[key] !== totals[key]) {
      ctx.addIssue({ code: 'custom', message: 'Summary does not match changes.', path: ['summary', key] });
    }
  }
});
export const repositoryStatusFailureV1 = z.strictObject({
  contract: z.literal('repository-status'), version: z.literal(1), ok: z.literal(false),
  error: z.strictObject({
    code: z.enum(['GIT_NOT_FOUND', 'GIT_CONTEXT_OVERRIDE', 'NOT_A_REPOSITORY',
      'UNSUPPORTED_REPOSITORY', 'GIT_UNSUPPORTED', 'GIT_FAILED', 'INVALID_GIT_OUTPUT',
      'UNSUPPORTED_PATH_ENCODING', 'REPOSITORY_CHANGED', 'READ_LIMIT_EXCEEDED']),
    message: z.string().min(1),
  }),
});
export const repositoryStatusV1 = z.union([repositoryStatusSuccessV1, repositoryStatusFailureV1]);
export type RepositoryStatusSuccessV1 = z.infer<typeof repositoryStatusSuccessV1>;
export type RepositoryStatusFailureV1 = z.infer<typeof repositoryStatusFailureV1>;
