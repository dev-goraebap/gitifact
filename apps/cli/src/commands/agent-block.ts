import { InitError } from '@gitifact/core';
import { docTopics } from './docs.js';

// Pure text logic for the managed GITIFACT block in agent instruction files. No filesystem access.
export const AGENT_START = '<!-- GITIFACT:START -->';
export const AGENT_END = '<!-- GITIFACT:END -->';
export const candidatePaths = ['AGENTS.md', 'CLAUDE.md', '.claude/CLAUDE.md', '.cursorrules', '.hermes.md', 'HERMES.md'] as const;
export type CandidatePath = typeof candidatePaths[number];
export type AgentPreset = 'claude' | 'cursor' | 'codex' | 'hermes' | 'all';
export const agentPresetNames: readonly AgentPreset[] = ['claude', 'cursor', 'codex', 'hermes', 'all'];
// Search order per tool; the first existing file wins and the last entry is created when none exist.
export const agentPresets: Record<Exclude<AgentPreset, 'all'>, readonly CandidatePath[]> = {
  claude: ['CLAUDE.md', '.claude/CLAUDE.md'],
  cursor: ['.cursorrules', 'AGENTS.md'],
  codex: ['AGENTS.md'],
  hermes: ['.hermes.md', 'HERMES.md', 'AGENTS.md'],
};
export function boilerplateFor(path: string) {
  const name = path === 'AGENTS.md' ? path : path.split('/').pop()!.replace(/^\./, '').replace(/\.md$/, '');
  return '# ' + name + '\n\nProject-specific guidance for AI coding agents.\n';
}
export function renderAgentBlock(version: string) {
  const lines = [
    AGENT_START,
    'gitifact v' + version + ' · 저장 규약 schemaVersion 1',
    'CLI: 모든 명령은 `gitifact <cmd>`로 실행한다. 프로젝트 지침이 다른 실행 방법을 지정하면 그것을 따른다.',
    '',
    '시작할 때:',
    '- `gitifact spec working`으로 제품 설명·지침·기능 명세를 읽고 git status와 기존 staging을 확인한다.',
    '- 이 블록은 요약이다. 상세 형식은 `gitifact docs <topic>`으로 읽고 기억으로 채우지 않는다.',
    '',
    '무엇을 요구사항으로 남기는가 (제품 동작과 유지할 제약만):',
    '| 요청 | 처리 |',
    '| --- | --- |',
    '| 게시물을 삭제할 수 있게 해주세요 | 요구사항으로 정리한다 |',
    '| 이 내부 함수 이름을 바꿔주세요 | 일반 구현 변경이다 |',
    '| 지금 푸시해주세요 | 작업 지시다. 등록하지 않는다 |',
    '| 외부 서비스 없이 동작해야 합니다 | 제품 제약으로 명세에 반영한다 |',
    '',
    '규칙:',
    '- 명세를 저장하기 전에 `gitifact docs spec`을 읽는다. ID는 CLI가 발급한 값만 쓴다.',
    '- 새 기능은 requirements.md와 design.md를 함께 정리한다(`gitifact docs design`). 요구사항만 요청받으면 따른다.',
    '- 커밋 요청을 받으면 `gitifact docs commit`을 읽고 명세·이유·코드·테스트를 함께 커밋한다.',
    '- 자동 기록은 커밋 권한이 아니다. 사용자 요청이나 명시적 프로젝트 정책이 있을 때만 커밋하고 푸시는 별도 요청을 따른다.',
    '- 불명확한 제품 동작만 질문하고 독립적인 작업은 진행한다. 기존 기능 전체 도출은 요청받았을 때 한다.',
    '- SELF-CHECK: save·commit 입력을 만들기 전에 해당 docs를 다시 읽고 형식을 대조한다. 확실하지 않으면 추측하지 말고 `gitifact docs <topic>`을 실행한다.',
    '',
    'MORE CLI:',
    '  docs <topic>     ' + docTopics.join(', '),
    '  spec working     현재 명세·제품·지침 전체와 stamp',
    '  spec save        --file <json>: 요구사항·설계·문서 저장',
    '  spec commit      --file <json>: 변경 이유 기록과 커밋을 한 번에',
    '  browser          읽기 전용 브라우저 열기',
    '  init             다시 실행하면 이 블록을 갱신한다',
    AGENT_END,
  ];
  return lines.join('\n');
}
export function parseAgentBlock(text: string) {
  const match = /^gitifact v(\S+) · 저장 규약 schemaVersion (\d+)$/m.exec(text);
  return match ? { version: match[1]!, schemaVersion: Number(match[2]) } : null;
}
export function findBlock(text: string) {
  const start = text.indexOf(AGENT_START);
  if (start === -1) {
    if (text.includes(AGENT_END)) throw new InitError('AGENT_DOCS_MALFORMED', '시작 마커 없이 종료 마커만 있습니다. 블록을 정리한 뒤 다시 실행하세요.');
    return null;
  }
  const end = text.indexOf(AGENT_END, start + AGENT_START.length);
  if (end === -1) throw new InitError('AGENT_DOCS_MALFORMED', '종료 마커가 없는 GITIFACT 블록이 있습니다. 블록을 정리한 뒤 다시 실행하세요.');
  if (text.indexOf(AGENT_START, start + AGENT_START.length) !== -1) throw new InitError('AGENT_DOCS_MALFORMED', 'GITIFACT 시작 마커가 여러 개입니다. 중복 블록을 정리한 뒤 다시 실행하세요.');
  return { start, end: end + AGENT_END.length };
}
// A file whose only content is `@` imports of other candidate files loads them instead of holding its own rules.
// A block an earlier run expanded there does not change that, so it is ignored when classifying.
export function isWrapperFile(text: string) {
  const found = findBlock(text);
  const own = found ? text.slice(0, found.start) + text.slice(found.end) : text;
  const lines = own.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines.length > 0 && lines.every(line => /^@(?:\.\/)?[^\s]+$/.test(line) && (candidatePaths as readonly string[]).includes(line.replace(/^@(?:\.\/)?/, '')));
}
export function resolveAgentPaths(preset: AgentPreset | undefined, existing: ReadonlyMap<CandidatePath, string>): { inject: CandidatePath[]; create: CandidatePath | null } {
  if (preset && preset !== 'all') {
    const order = agentPresets[preset];
    const found = order.find(path => existing.has(path));
    return found ? { inject: [found], create: null } : { inject: [], create: order[order.length - 1]! };
  }
  const inject = candidatePaths.filter(path => existing.has(path) && !isWrapperFile(existing.get(path)!));
  if (inject.length > 0) return { inject, create: null };
  return { inject: [], create: 'AGENTS.md' };
}
const eolOf = (text: string | null) => text?.includes('\r\n') ? '\r\n' : '\n';
export function injectBlock(text: string | null, block: string, boilerplate: string) {
  const eol = eolOf(text);
  const body = block.split('\n').join(eol);
  if (text === null) return boilerplate.split('\n').join(eol) + eol + body + eol;
  const found = findBlock(text);
  if (found) return text.slice(0, found.start) + body + text.slice(found.end);
  const head = text.replace(/\s+$/, '');
  return (head ? head + eol + eol : '') + body + eol;
}
export function removeBlock(text: string, boilerplate: string): string | null {
  const found = findBlock(text);
  if (!found) return text;
  const eol = eolOf(text);
  const before = text.slice(0, found.start).replace(/\s+$/, '');
  const after = text.slice(found.end).replace(/^\s+/, '');
  const rest = before && after ? before + eol + eol + after : before ? before + eol : after;
  const normalize = (value: string) => value.replace(/\r\n/g, '\n').trim();
  if (!normalize(rest) || normalize(rest) === normalize(boilerplate)) return null;
  return rest;
}
