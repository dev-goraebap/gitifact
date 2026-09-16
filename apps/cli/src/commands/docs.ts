import { readFile } from 'node:fs/promises';

export const docTopics = ['workflow', 'spec', 'design', 'product', 'commit'] as const;
export type DocTopic = typeof docTopics[number];
const summaries: Record<DocTopic, string> = {
  workflow: '시작 시 확인할 것, 요구사항으로 남길 요청의 구분, 마무리 보고',
  spec: '사용자 스토리·수용 조건 형식, ID 규칙, spec save 입력',
  design: 'design.md 목차, 참조 주석, 개정 방식',
  product: 'PRODUCT.md와 guides 문서의 역할과 저장 명령',
  commit: 'spec commit 입력, 이유 기록, 실패 후 복구',
};
export interface DocsControls { readDoc?: (topic: DocTopic) => Promise<string> }
export const isDocTopic = (value: string): value is DocTopic => (docTopics as readonly string[]).includes(value);
// Bundled Markdown ships next to the built entry point as dist/docs/<topic>.md.
const readBundled = (topic: DocTopic) => readFile(new URL('./docs/' + topic + '.md', import.meta.url), 'utf8');
export function listDocTopics() {
  const width = Math.max(...docTopics.map(topic => topic.length));
  return docTopics.map(topic => topic.padEnd(width) + '  ' + summaries[topic]).join('\n') + '\n';
}
export async function runDocs(topic: string | undefined, controls: DocsControls = {}) {
  if (topic === undefined) { process.stdout.write(listDocTopics()); return; }
  if (!isDocTopic(topic)) {
    const failure = { contract: 'docs', version: 1, ok: false, error: { code: 'UNKNOWN_TOPIC', message: '알 수 없는 주제입니다: ' + topic + '. 사용 가능: ' + docTopics.join(', ') } };
    process.stderr.write(JSON.stringify(failure) + '\n'); process.exitCode = 1; return;
  }
  process.stdout.write(await (controls.readDoc ?? readBundled)(topic));
}
