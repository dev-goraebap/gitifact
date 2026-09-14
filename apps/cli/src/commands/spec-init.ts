import { InitError, parseManagedConfig, type SpecProjectConfig } from '@tryce/core';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { initRepository } from '../adapters/git/init-repository.js';
import { fileInfo, publishConfig, readConfigFile } from '../adapters/filesystem/config-file.js';

export async function initializeSpecProject(cwd: string, dryRun = false, env = process.env, beforePublish?: () => Promise<void>) {
  const repo = initRepository(cwd, env); const first = await repo.inspect(); const root = first.state.repository.rootPath;
  const result = (config: SpecProjectConfig, outcome: string) => ({ contract: 'project-init', version: 3, ok: true, outcome,
    rootPath: root, configPath: '.tryce/config.json', schemaVersion: config.schemaVersion, baseline: config.baseline,
    integrations: { skills: 'not-installed-by-init', hooks: 'not-installed-by-init' } });
  const existing = async (text: string) => {
    const config = parseManagedConfig(text);
    if (!('schemaVersion' in config)) throw new InitError('MIGRATION_REQUIRED', '기존 형식은 별도 전환이 필요합니다. 설정과 기록을 보존하세요.');
    await repo.validateBaseline(config, root, first.state.head.commit, first.state.repository.objectFormat);
    if ((await repo.inspect()).stamp !== first.stamp || await readConfigFile(root) !== text) throw new InitError('INPUT_CHANGED', '초기화 조회 중 입력이 변경됐습니다.');
    return result(config, 'already-initialized');
  };
  const old = await readConfigFile(root); if (old !== undefined) return existing(old);
  if (first.trackedConfig) throw new InitError('CONFIG_DELETED', '기존 설정의 삭제를 신규 도입으로 처리하지 않습니다.');
  const checkRecords = async () => {
    if (await fileInfo(join(root, 'specs'))) throw new InitError('EXISTING_RECORDS', '기존 specs 경로를 확인하세요.');
    const entries = await readdir(join(root, '.tryce')).catch(e => { if (e.code === 'ENOENT') return []; throw e; });
    if (entries.some(name => !/^\.init-[a-f0-9-]+\.tmp$/.test(name))) throw new InitError('EXISTING_RECORDS', '설정 없는 .tryce 자료를 자동 채택하지 않습니다.');
  };
  const config: SpecProjectConfig = { schemaVersion: 1, baseline: first.state.head.commit
    ? { kind: 'commit', objectFormat: first.state.repository.objectFormat, commit: first.state.head.commit } : { kind: 'empty' } };
  const recheck = async () => {
    await checkRecords(); await repo.checkIgnore(root);
    if ((await repo.inspect()).stamp !== first.stamp) throw new InitError('INPUT_CHANGED', 'HEAD 또는 index가 변경됐습니다.');
    if (await readConfigFile(root) !== undefined) throw new InitError('CONFIG_APPEARED', '다른 실행이 설정을 만들었습니다.');
  };
  await recheck(); if (dryRun) return result(config, 'planned');
  try { await publishConfig(root, JSON.stringify(config, null, 2) + '\n', recheck, beforePublish); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST' || (error instanceof InitError && error.code === 'CONFIG_APPEARED')) {
      const concurrent = await readConfigFile(root); if (concurrent !== undefined) return existing(concurrent);
    }
    throw error;
  }
  if ((await repo.inspect()).stamp !== first.stamp || await readConfigFile(root) !== JSON.stringify(config, null, 2) + '\n') throw new InitError('INPUT_CHANGED_AFTER_WRITE', '설정 생성 후 입력이 변경됐습니다. 현재 파일을 확인하세요.');
  return result(config, 'created');
}
