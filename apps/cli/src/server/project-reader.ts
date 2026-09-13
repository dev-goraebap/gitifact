import { requirementViews } from '@tryce/core';
import { browserProjectV1 } from '@tryce/contracts';
import type { BrowserProjectV1 } from '@tryce/contracts';
import { readBrief } from '../commands/brief.js';
import { workflowTransaction, requirementPath } from '../adapters/filesystem/workflow-store.js';

export async function readBrowserProject(cwd: string, env = process.env): Promise<BrowserProjectV1> {
  const brief = await readBrief(cwd, { all: true }, env);
  let requirements: BrowserProjectV1['requirements'] = {
    state: 'not-available',
    reason: '요구사항을 읽으려면 workflow-1 설정이 필요합니다.',
  };
  if (brief.version === 2 && brief.report) {
    if (brief.report.requirements.state !== 'available') {
      requirements = brief.report.requirements;
    } else {
      const expected = brief.report.requirements.data.items;
      try {
        const items = await workflowTransaction(
          cwd,
          false,
          async (c) => {
            const result = c.records.sets.flatMap((set) =>
              requirementViews(set).map((v) => {
                const source = set.requirements.find((r) => r.id === v.id)!;
                const reviews = set.reviews.filter((r) => r.items.some((i) => i.id === v.id));
                return {
                  id: v.id,
                  spec: set.spec,
                  path: requirementPath(set.spec, c.records.contents),
                  title: v.title,
                  text: v.text,
                  state: v.state,
                  approval: v.approval,
                  implementation: v.implementation,
                  verification: v.verification,
                  revisions: source.revisions,
                  reviews,
                  decisions: set.decisions.filter((d) => reviews.some((r) => r.id === d.review)),
                };
              }),
            );
            if (
              result.length !== expected.length ||
              result.some(
                (r) =>
                  !expected.some(
                    (e) =>
                      e.id === r.id &&
                      e.revision === r.revisions.at(-1)!.id &&
                      e.state === r.state &&
                      e.approval === r.approval,
                  ),
              )
            ) {
              throw new Error('조회 중 요구사항이 변경됐습니다. 다시 읽어주세요.');
            }
            await c.recheck();
            return result;
          },
          env,
        );
        requirements = { state: 'available', data: items };
      } catch {
        requirements = {
          state: 'error',
          error: {
            code: 'REQUIREMENTS_UNAVAILABLE',
            message: '요구사항을 일관되게 읽지 못했습니다. 잠금·파일 상태를 확인하고 다시 읽어주세요.',
          },
        };
      }
    }
  }
  return browserProjectV1.parse({ contract: 'browser-project', version: 1, brief, requirements });
}
