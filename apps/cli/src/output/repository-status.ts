import { RepositoryReadError } from '@gitifact/core';
import type { RepositoryObservation } from '@gitifact/core';
import { repositoryStatusFailureV1, repositoryStatusSuccessV1 } from '@gitifact/contracts';
import type { RepositoryStatusSuccessV1 } from '@gitifact/contracts';
import { t } from '../shared/i18n/index.js';

export function statusDto(observation: RepositoryObservation) {
  return repositoryStatusSuccessV1.parse({
    contract: 'repository-status', version: 1, ok: true,
    observation: { ...observation.observation },
    repository: { ...observation.repository },
    head: { ...observation.head },
    changes: observation.changes.map((change) => ({ ...change })),
    summary: { ...observation.summary },
    checks: { state: 'not-run', reason: 'git-status-only' },
  });
}
export function failureDto(error: unknown) {
  const known = error instanceof RepositoryReadError ? error : new RepositoryReadError('GIT_FAILED');
  return repositoryStatusFailureV1.parse({
    contract: 'repository-status', version: 1, ok: false,
    error: { code: known.code, message: known.message },
  });
}
export function escapeTerminal(value: string): string {
  return JSON.stringify(value).replace(/[\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g,
    (character) => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
}
export function statusText(value: RepositoryStatusSuccessV1): string {
  const { head, summary } = value;
  const lines = [
    t('status.text.repository', { path: escapeTerminal(value.repository.rootPath) }),
    'HEAD: ' + head.state + (head.branch ? ' ' + escapeTerminal(head.branch) : '') + (head.commit ? ' ' + head.commit : ''),
    t('status.text.changes', { count: value.changes.length }),
    'staged ' + summary.staged + ' / unstaged ' + summary.unstaged + ' / untracked ' + summary.untracked + ' / conflicted ' + summary.conflicted,
    t('status.text.observed', { at: value.observation.completedAt }),
  ];
  for (const change of value.changes) {
    let line = (change.xy ?? '??') + ' ' + escapeTerminal(change.path);
    if (change.submodule) line += ' submodule=' + JSON.stringify(change.submodule);
    lines.push(line);
  }
  return lines.join('\n') + '\n';
}
