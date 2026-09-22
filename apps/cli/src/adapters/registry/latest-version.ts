import type { FetchLatestVersion } from '../../shared/update-check.js';

// The only outbound request the CLI makes: the public npm manifest of this package. Nothing about the
// project is sent. The abridged manifest keeps the answer small as releases accumulate.
const manifestUrl = 'https://registry.npmjs.org/gitifact';

export const fetchLatestVersion: FetchLatestVersion = async signal => {
  const response = await fetch(manifestUrl, { signal, redirect: 'error', headers: { Accept: 'application/vnd.npm.install-v1+json' } });
  if (!response.ok) throw new Error('registry status ' + response.status);
  const manifest = await response.json() as { 'dist-tags'?: { latest?: unknown } };
  const latest = manifest['dist-tags']?.latest;
  if (typeof latest !== 'string') throw new Error('registry answer has no latest tag');
  return latest;
};
