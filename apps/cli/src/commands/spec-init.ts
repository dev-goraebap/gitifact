import { InitError, parseManagedConfig, parseDocument, renderDocument, SCHEMA_VERSION, WIKI_DIR, WIKI_ENTRY_PATH, type SpecProjectConfig } from '@gitifact/core';
import { projectInitV5, type UpdateStateV1 } from '@gitifact/contracts';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { initRepository } from '../adapters/git/init-repository.js';
import { fileInfo, publishConfig, readConfigFile } from '../adapters/filesystem/config-file.js';
import { applyAgentDocs, planAgentDocs, skippedAgentDocs, type AgentDocsOptions } from './agent-docs.js';
import { readBundledDoc } from './docs.js';
import { generatePreviewId } from '../adapters/filesystem/spec-preview-store.js';
import { disabledUpdate, npmGlobalInstall } from '../shared/update-check.js';
import { getLanguage, t } from '../shared/i18n/index.js';

export async function initializeSpecProject(cwd: string, dryRun = false, env = process.env, beforePublish?: () => Promise<void>, agentDocs?: AgentDocsOptions,
  readDoc: (name: string) => Promise<string> = name => readBundledDoc(name, getLanguage()), update: UpdateStateV1 | Promise<UpdateStateV1> = disabledUpdate) {
  const repo = initRepository(cwd, env); const first = await repo.inspect(); const root = first.state.repository.rootPath;
  // Agent-doc targets are read and validated first so malformed markers refuse the run before any write.
  const docsPlan = agentDocs ? await planAgentDocs(root, agentDocs) : skippedAgentDocs;
  const result = async (config: SpecProjectConfig, outcome: 'planned' | 'created' | 'replaced' | 'already-initialized') => {
    const checked = await update;
    return projectInitV5.parse({ contract: 'project-init', version: 5, ok: true, outcome,
      rootPath: root, configPath: '.gitifact/config.json', schemaVersion: config.schemaVersion, baseline: config.baseline,
      agentDocs: { mode: docsPlan.mode, paths: docsPlan.paths }, update: checked,
      install: checked.status === 'available' ? { npmGlobal: npmGlobalInstall(checked.latestVersion!) } : null });
  };
  const existing = async (text: string) => {
    const config = parseManagedConfig(text);
    if (!('schemaVersion' in config)) throw new InitError('MIGRATION_REQUIRED', t('init.migrationRequired'));
    await repo.validateBaseline(config, root, first.state.head.commit, first.state.repository.objectFormat);
    const unchanged = async () => {
      if ((await repo.inspect()).stamp !== first.stamp || await readConfigFile(root) !== text) throw new InitError('INPUT_CHANGED', t('init.inputChanged'));
    };
    await unchanged();
    if (!dryRun) await applyAgentDocs(root, docsPlan, unchanged);
    return result(config, 'already-initialized');
  };
  const config: SpecProjectConfig = { schemaVersion: SCHEMA_VERSION, baseline: first.state.head.commit
    ? { kind: 'commit', objectFormat: first.state.repository.objectFormat, commit: first.state.head.commit } : { kind: 'empty' } };
  const text = JSON.stringify(config, null, 2) + '\n';
  // A configuration written by an earlier release (0.4.x wrote schemaVersion 1) is not converted. When nothing but that
  // file is in the store, there is nothing to lose: init replaces it, as deleting it and initialising again would.
  // Anything else in the store means records of the earlier convention, and init leaves the project as it is.
  const replaceLegacy = async (before: string, version: number) => {
    const onlyConfig = async () => {
      const entries = await readdir(join(root, '.gitifact'));
      if (await fileInfo(join(root, 'specs')) || entries.some(name => name !== 'config.json' && !/^\.init-[a-f0-9-]+\.tmp$/.test(name))) {
        throw new InitError('UNSUPPORTED_SCHEMA', t('init.legacyRecords', { version: String(version) }));
      }
    };
    const recheck = async () => {
      await onlyConfig(); await repo.checkIgnore(root);
      if ((await repo.inspect()).stamp !== first.stamp) throw new InitError('INPUT_CHANGED', t('init.headOrIndexChanged'));
      if (await readConfigFile(root) !== before) throw new InitError('INPUT_CHANGED', t('init.inputChanged'));
    };
    await recheck(); if (dryRun) return result(config, 'planned');
    await publishConfig(root, text, recheck, beforePublish, true);
    return finish('replaced');
  };
  const finish = async (outcome: 'created' | 'replaced') => {
    const published = async () => {
      if ((await repo.inspect()).stamp !== first.stamp || await readConfigFile(root) !== text) throw new InitError('INPUT_CHANGED_AFTER_WRITE', t('init.changedAfterWrite'));
    };
    await published();
    await applyAgentDocs(root, docsPlan, published);
    await writeWikiPolicy(root, readDoc);
    return result(config, outcome);
  };
  const old = await readConfigFile(root);
  if (old !== undefined) { const legacy = legacySchemaVersion(old); return legacy === undefined ? existing(old) : replaceLegacy(old, legacy); }
  if (first.trackedConfig) throw new InitError('CONFIG_DELETED', t('init.configDeleted'));
  const checkRecords = async () => {
    if (await fileInfo(join(root, 'specs'))) throw new InitError('EXISTING_RECORDS', t('init.existingSpecs'));
    const entries = await readdir(join(root, '.gitifact')).catch(e => { if (e.code === 'ENOENT') return []; throw e; });
    if (entries.some(name => !/^\.init-[a-f0-9-]+\.tmp$/.test(name))) throw new InitError('EXISTING_RECORDS', t('init.orphanStore'));
  };
  const recheck = async () => {
    await checkRecords(); await repo.checkIgnore(root);
    if ((await repo.inspect()).stamp !== first.stamp) throw new InitError('INPUT_CHANGED', t('init.headOrIndexChanged'));
    if (await readConfigFile(root) !== undefined) throw new InitError('CONFIG_APPEARED', t('init.configAppeared'));
  };
  await recheck(); if (dryRun) return result(config, 'planned');
  try { await publishConfig(root, text, recheck, beforePublish); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST' || (error instanceof InitError && error.code === 'CONFIG_APPEARED')) {
      const concurrent = await readConfigFile(root); if (concurrent !== undefined) return existing(concurrent);
    }
    throw error;
  }
  return finish('created');
}

// The schemaVersion of a configuration from an earlier storage convention, or undefined for anything else. A newer
// convention is not earlier: an older CLI must never replace it.
function legacySchemaVersion(text: string) {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return undefined; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const version = (value as { schemaVersion?: unknown }).schemaVersion;
  return Number.isInteger(version) && (version as number) < SCHEMA_VERSION ? version as number : undefined;
}

/**
 * The wiki ships with its operating policy: the first adoption writes `.gitifact/wiki/README.md` from the bundled
 * template. Re-running init never writes it again, so a README the user deleted or rewrote stays as they left it.
 */
async function writeWikiPolicy(root: string, readDoc: (name: string) => Promise<string>) {
  if (await fileInfo(join(root, ...WIKI_DIR.split('/')))) return;
  // The template ships beside the built entry point. In-process test builds have no bundled Markdown and skip it;
  // the built CLI and the package check assert that a real install writes the README.
  const template = await readDoc('wiki.default').catch(e => { if (e.code === 'ENOENT') return undefined; throw e; });
  if (template === undefined) return;
  const doc = { id: generatePreviewId('W'), path: WIKI_ENTRY_PATH, title: t('init.wikiReadmeTitle'), body: template.trim() };
  const text = renderDocument(doc); parseDocument(doc.path, text);
  await mkdir(join(root, ...WIKI_DIR.split('/')), { recursive: true });
  await writeFile(join(root, ...WIKI_ENTRY_PATH.split('/')), text, { flag: 'wx' });
}
