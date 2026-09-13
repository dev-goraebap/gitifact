import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { InitError } from '@tryce/core';
import { fileInfo } from './config-file.js';

export async function briefDocuments(root: string) {
  const items: { path: string; kind: 'instruction' | 'readme' | 'document' }[] = [];
  const rootNames = await readdir(root);
  for (const name of rootNames.sort()) {
    if (!['agents.md', 'readme.md'].includes(name.toLowerCase())) continue;
    const info = await fileInfo(join(root, name));
    if (!info || !info.isFile() || info.isSymbolicLink()) throw new InitError('DOCUMENT_PATH_CONFLICT', '지침·README가 일반 파일이 아닙니다: ' + name);
    items.push({ path: name, kind: name.toLowerCase() === 'agents.md' ? 'instruction' : 'readme' });
  }
  let entries = 0;
  const visit = async (path: string, depth: number): Promise<void> => {
    const info = await fileInfo(join(root, path));
    if (!info) return;
    if (!info.isDirectory() || info.isSymbolicLink()) throw new InitError('DOCUMENT_PATH_CONFLICT', '문서 디렉터리의 링크를 따라가지 않습니다: ' + path);
    if (depth > 8) throw new InitError('DOCUMENT_LIMIT', 'docs 탐색 깊이가 8을 초과합니다.');
    for (const name of (await readdir(join(root, path))).sort()) {
      entries++;
      if (entries > 1000) throw new InitError('DOCUMENT_LIMIT', 'docs 탐색 항목이 1,000개를 초과합니다.');
      const relative = path + '/' + name;
      const child = await fileInfo(join(root, relative));
      if (!child) throw new InitError('INPUT_CHANGED', '문서 목록이 변경됐습니다.');
      if (child.isSymbolicLink()) throw new InitError('DOCUMENT_PATH_CONFLICT', '문서 링크를 따라가지 않습니다: ' + relative);
      if (child.isDirectory()) await visit(relative, depth + 1);
      else if (child.isFile() && /\.md$/i.test(name)) items.push({ path: relative, kind: 'document' });
    }
  };
  await visit('docs', 0);
  return items;
}
