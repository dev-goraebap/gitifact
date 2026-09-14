import { InitError, RepositoryReadError, initialConfig, parseProjectConfig } from '@tryce/core';
import type { ProjectConfig, ProjectMode } from '@tryce/core';
import { projectInitV1, projectInitV2 } from '@tryce/contracts';
import { initRepository } from '../adapters/git/init-repository.js';
import { publishConfig, readConfigFile } from '../adapters/filesystem/config-file.js';
import { readRequirementSets } from '../adapters/filesystem/workflow-store.js';
import { readNotes } from '../adapters/filesystem/note-store.js';
import { initializeSpecProject } from './spec-init.js';

export interface InitOptions { mode?: ProjectMode; dryRun?: boolean; format?: 'json' | 'text' }
export async function initializeProject(cwd: string, options: InitOptions, env = process.env, beforePublish?: () => Promise<void>) {
  const repository = initRepository(cwd, env);
  const first = await repository.inspect();
  const root = first.state.repository.rootPath;
  const result = (config: ProjectConfig, outcome: 'created' | 'planned' | 'already-initialized') => (config.format === 'workflow-1' ? projectInitV2 : projectInitV1).parse({
    contract: 'project-init', version: config.format === 'workflow-1' ? 2 : 1, ok: true, outcome, rootPath: root, configPath: '.tryce/config.json',
    projectFormat: config.format, mode: config.mode, baseline: config.baseline,
    hasUncommittedChanges: first.state.changes.length > 0,
    configChanged: outcome !== 'already-initialized' || first.state.changes.some(change => change.path === '.tryce/config.json'),
    integrations: { skills: 'not-installed-by-init', hooks: 'not-installed-by-init' },
  });
  const existing = async (text: string) => {
    const config = parseProjectConfig(text);
    if (options.mode && options.mode !== config.mode) throw new InitError('MODE_CONFLICT', 'init으로 기존 모드를 변경하지 않습니다.');
    await repository.validateBaseline(config, root, first.state.head.commit, first.state.repository.objectFormat);
    if ((await repository.inspect()).stamp !== first.stamp || await readConfigFile(root) !== text) throw new InitError('INPUT_CHANGED', '조회 중 입력이 바뀌었습니다. 다시 실행하세요.');
    return result(config, 'already-initialized');
  };
  const text = await readConfigFile(root);
  if (text !== undefined) return existing(text);
  if (first.trackedConfig) throw new InitError('CONFIG_DELETED', 'HEAD 또는 index의 설정이 작업 폴더에서 삭제됐습니다. 재생성하지 않습니다.');
  await repository.checkIgnore(root);
  const config = initialConfig(options.mode, first.state.head.commit, first.state.repository.objectFormat);
  const verifyEmptyRecords = async () => {
    if (config.format === 'workflow-1' && ((await readRequirementSets(root)).sets.length || (await readNotes(root)).notes.length)) throw new InitError('EXISTING_RECORDS', '설정 없는 기존 기록을 자동 채택하지 않습니다. 기존 설정과 이력을 확인하세요.');
  };
  await verifyEmptyRecords();
  const recheck = async () => {
    await verifyEmptyRecords();
    if ((await repository.inspect()).stamp !== first.stamp) throw new InitError('INPUT_CHANGED', 'HEAD·index 또는 저장소가 변경됐습니다. 다시 실행하세요.');
    await repository.checkIgnore(root);
    if (await readConfigFile(root) !== undefined) throw new InitError('CONFIG_APPEARED', '다른 실행이 설정을 생성했습니다. 다시 확인합니다.');
  };
  if (options.dryRun) { await recheck(); return result(config, 'planned'); }
  try { await publishConfig(root, JSON.stringify(config, null, 2) + '\n', recheck, beforePublish); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST' || (error instanceof InitError && error.code === 'CONFIG_APPEARED')) {
      const concurrent = await readConfigFile(root);
      if (concurrent !== undefined) return existing(concurrent);
    }
    throw error;
  }
  const final = await repository.inspect();
  const finalText = await readConfigFile(root);
  if (final.stamp !== first.stamp || finalText !== JSON.stringify(config, null, 2) + '\n') {
    throw new InitError('INPUT_CHANGED_AFTER_WRITE', '설정 확정 후 입력이 변경됐습니다. 생성된 설정을 보존했습니다. 상태를 확인하세요.');
  }
  return result(config, 'created');
}

export async function runInit(options: InitOptions) {
  try {
    if (!options.mode) {
      const dto = await initializeSpecProject(process.cwd(), options.dryRun);
      process.stdout.write(options.format === 'text' ? `${dto.outcome}: ${dto.rootPath}/.tryce/config.json\n형식: spec-1\n스킬·훅은 설치하지 않았습니다.\n` : JSON.stringify(dto) + '\n');
      return;
    }
    const dto = await initializeProject(process.cwd(), options);
    if (!dto.ok) throw new Error('Unexpected init result');
    process.stdout.write(options.format === 'text'
      ? `${dto.outcome}: ${dto.rootPath}/.tryce/config.json\n모드: ${dto.mode}\n기준선: ${dto.baseline.kind === 'empty' ? '기존 커밋 없음' : dto.baseline.commit}\n미커밋 변경은 기준선에 포함되지 않습니다. 스킬·훅은 설치하지 않았습니다.\n`
      : JSON.stringify(dto) + '\n');
  } catch (error) {
    const known = error instanceof InitError || error instanceof RepositoryReadError;
    const dto = projectInitV1.parse({ contract: 'project-init', version: 1, ok: false, error: {
      code: known ? error.code : 'INIT_FAILED', message: known ? error.message : '초기화에 실패했습니다. 파일 접근 권한과 생성된 설정·임시 파일을 확인하세요.',
    } });
    process.stderr.write(options.format === 'text' && !dto.ok ? dto.error.code + ': ' + dto.error.message + '\n' : JSON.stringify(dto) + '\n');
    process.exitCode = 1;
  }
}
