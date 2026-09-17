import { t } from '../shared/i18n/index.js';

// Codes are the stable contract (repository-status v1 lists the same set); messages come from the catalog.
export const repositoryReadErrorCodes = [
  'GIT_NOT_FOUND',
  'GIT_CONTEXT_OVERRIDE',
  'NOT_A_REPOSITORY',
  'UNSUPPORTED_REPOSITORY',
  'GIT_UNSUPPORTED',
  'GIT_FAILED',
  'INVALID_GIT_OUTPUT',
  'UNSUPPORTED_PATH_ENCODING',
  'REPOSITORY_CHANGED',
  'READ_LIMIT_EXCEEDED',
] as const;
export type RepositoryReadErrorCode = typeof repositoryReadErrorCodes[number];
export class RepositoryReadError extends Error {
  readonly code: RepositoryReadErrorCode;
  constructor(code: RepositoryReadErrorCode) {
    super(t(`readError.${code}`));
    this.name = 'RepositoryReadError';
    this.code = code;
  }
}
