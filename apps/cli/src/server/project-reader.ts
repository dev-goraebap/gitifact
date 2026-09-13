import { requirementViews } from '@tryce/core';
import { browserProjectV1 } from '@tryce/contracts';
import type { BrowserProjectV1 } from '@tryce/contracts';
import { readBrief } from '../commands/brief.js';
import { requirementPath } from '../adapters/filesystem/workflow-store.js';

export async function readBrowserProject(cwd: string, env = process.env, onVerified?: (verify: () => Promise<void>) => void): Promise<BrowserProjectV1> {
  let requirements: BrowserProjectV1['requirements'] = {
    state: 'not-available',
    reason: '요구사항을 읽으려면 workflow-1 설정이 필요합니다.',
  };
  let verify: (() => Promise<void>) | undefined;
  const brief = await readBrief(cwd, { all: true }, env, undefined, (records, recheck) => {
    verify = recheck;
    requirements = { state: 'available', data: records.sets.flatMap((set) =>
      requirementViews(set).map((v) => {
        const source = set.requirements.find((r) => r.id === v.id)!;
        const reviews = set.reviews.filter((r) => r.items.some((i) => i.id === v.id));
        return {
          id: v.id, spec: set.spec, path: requirementPath(set.spec, records.contents),
          title: v.title, text: v.text, state: v.state, approval: v.approval,
          implementation: v.implementation, verification: v.verification,
          revisions: source.revisions, reviews,
          decisions: set.decisions.filter((d) => reviews.some((r) => r.id === d.review)),
        };
      }),
    ) };
  });
  if (brief.version === 2 && brief.report?.requirements.state !== 'available') {
    requirements = brief.report?.requirements ?? { state: 'error', error: brief.ok
      ? { code: 'REQUIREMENTS_UNAVAILABLE', message: '요구사항을 읽지 못했습니다.' } : brief.error };
  }
  const result = browserProjectV1.parse({ contract: 'browser-project', version: 1, brief, requirements });
  if (brief.ok && verify) onVerified?.(verify);
  return result;
}

// One successful observation per server. Every reuse checks actual file contents,
// index bytes, Git state and locks; a timer or watcher alone cannot establish freshness.
export function createBrowserProjectReader(cwd: string, env = process.env) {
  let cached: { data: BrowserProjectV1; verify: () => Promise<void> } | undefined;
  let pending: Promise<BrowserProjectV1> | undefined;
  async function read() {
    if (cached) {
      try { await cached.verify(); return cached.data; }
      catch { cached = undefined; }
    }
    let verify: (() => Promise<void>) | undefined;
    const data = await readBrowserProject(cwd, env, value => { verify = value; });
    if (verify) cached = { data, verify };
    return data;
  }
  return () => pending ??= read().finally(() => { pending = undefined; });
}
