import type { RepositoryState } from '../domain/repository-status.js';

export interface RepositoryReader {
  read(): Promise<RepositoryState>;
}
