import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseChangelog } from '../dist/index.js';

const valid = [
  '## 1.2.0 - 2026-10-01',
  '### Added',
  '- 새 명령',
  '- 두 번째 기능',
  '### Fixed',
  '- 경로 오류',
  '',
  '## 1.1.9 - 2026-09-30',
  '### Removed',
  '- 옛 옵션',
  '',
].join('\n');

test('a fixed changelog parses newest first with empty sections present', () => {
  assert.deepEqual(parseChangelog(valid), [
    { version: '1.2.0', date: '2026-10-01', added: ['새 명령', '두 번째 기능'], changed: [], removed: [], fixed: ['경로 오류'] },
    { version: '1.1.9', date: '2026-09-30', added: [], changed: [], removed: ['옛 옵션'], fixed: [] },
  ]);
  assert.deepEqual(parseChangelog(valid.replace(/\n/g, '\r\n')), parseChangelog(valid));
});

test('section titles outside the four English tokens are refused', () => {
  for (const title of ['### 추가', '### Security', '### added', '#### Added', '## Added']) {
    assert.throws(() => parseChangelog(valid.replace('### Added', title)), { code: 'INVALID_CHANGELOG' }, title);
  }
});

test('version headings with a malformed or impossible date are refused', () => {
  for (const heading of ['## 1.2.0 - 2026/10/01', '## 1.2.0 - 26-10-01', '## 1.2.0 2026-10-01', '## 1.2.0 - 2026-02-30', '## 1.2.0 - 2026-13-01', '## v1.2.0 - 2026-10-01']) {
    assert.throws(() => parseChangelog(valid.replace('## 1.2.0 - 2026-10-01', heading)), { code: 'INVALID_CHANGELOG' }, heading);
  }
});

test('order, empty versions, stray items and duplicate sections are refused', () => {
  const cases = {
    ascending: valid.replace('## 1.1.9 - 2026-09-30', '## 1.3.0 - 2026-09-30'),
    duplicate: valid.replace('## 1.1.9 - 2026-09-30', '## 1.2.0 - 2026-09-30'),
    empty: '## 1.2.0 - 2026-10-01\n\n## 1.1.9 - 2026-09-30\n### Added\n- x\n',
    trailingEmpty: valid + '## 1.1.8 - 2026-09-29\n',
    itemFirst: '- x\n' + valid,
    sectionFirst: '### Added\n- x\n' + valid,
    twice: valid.replace('### Fixed', '### Added'),
    prose: valid.replace('- 경로 오류', '경로 오류'),
    nothing: '\n\n',
  };
  for (const [name, text] of Object.entries(cases)) assert.throws(() => parseChangelog(text), { code: 'INVALID_CHANGELOG' }, name);
});

test('the shipped Korean changelog is valid', () => {
  const source = readFileSync(new URL('../../../apps/cli/src/shared/i18n/ko/changelog.md', import.meta.url), 'utf8');
  const entries = parseChangelog(source);
  assert.deepEqual(entries.map(entry => entry.version), ['0.3.1', '0.3.0', '0.2.0', '0.1.0']);
});
