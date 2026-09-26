import { InitError, formatManagedConfig, parseManagedConfig, SCHEMA_VERSION, type SpecProjectConfig } from '@gitifact/core';
import { projectInitV8, type UpdateStateV1 } from '@gitifact/contracts';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { initRepository } from '../adapters/git/init-repository.js';
import { publishConfig, readConfigFile } from '../adapters/filesystem/config-file.js';
import { LINE_ENDINGS_PATH, writeLineEndings } from '../adapters/filesystem/document-file.js';
import { applyAgentDocs, planAgentDocs, skippedAgentDocs, type AgentDocsOptions } from './agent-docs.js';
import { projectSettings, settleConfig } from './project-settings.js';
import { disabledUpdate, isNewerRelease, npmGlobalInstall, npxUpdate } from '../shared/update-check.js';
import { t } from '../shared/i18n/index.js';

export async function initializeSpecProject(cwd: string, dryRun = false, env = process.env, beforePublish?: () => Promise<void>, agentDocs?: AgentDocsOptions,
  update: UpdateStateV1 | Promise<UpdateStateV1> = disabledUpdate) {
  const repo = initRepository(cwd, env); const first = await repo.inspect(); const root = first.state.repository.rootPath;
  // Agent-doc targets are read and validated first so malformed markers refuse the run before any write. The block
  // language comes from the config when there is one; checking the config itself is left to the steps below.
  const language = projectSettings(await readConfigFile(root).catch(() => undefined)).language;
  let docsPlan = agentDocs ? await planAgentDocs(root, { ...agentDocs, language }) : skippedAgentDocs(language);
  const result = async (config: SpecProjectConfig, outcome: 'planned' | 'created' | 'already-initialized', lineEndings = false) => {
    const checked = await update;
    return projectInitV8.parse({ contract: 'project-init', version: 8, ok: true, outcome,
      rootPath: root, configPath: '.gitifact/config.json', schemaVersion: config.schemaVersion, baseline: config.baseline,
      agentDocs: { mode: docsPlan.mode, paths: docsPlan.paths }, lineEndings: { path: LINE_ENDINGS_PATH, created: lineEndings }, update: checked,
      install: checked.status === 'available' ? { npx: npxUpdate(checked.latestVersion!), npmGlobal: npmGlobalInstall(checked.latestVersion!) } : null });
  };
  const existing = async (text: string) => {
    const config = parseManagedConfig(text);
    await repo.validateBaseline(config, root, first.state.head.commit, first.state.repository.objectFormat);
    let current = text;
    const unchanged = async () => {
      if ((await repo.inspect()).stamp !== first.stamp || await readConfigFile(root) !== current) throw new InitError('INPUT_CHANGED', t('init.inputChanged'));
    };
    await unchanged();
    // A project already on a newer release keeps its blocks: this CLI's text is the older one. Removing them still works.
    if (agentDocs && config.cli && isNewerRelease(config.cli, agentDocs.version) && docsPlan.mode === 'install') docsPlan = skippedAgentDocs(docsPlan.language);
    if (dryRun) return result(config, 'already-initialized');
    // Running init again settles the project on this release and the block language, as update does.
    const settled = agentDocs ? settleConfig(config, agentDocs.version, docsPlan.language) : { config, changed: false };
    if (settled.changed) {
      const next = formatManagedConfig(settled.config, text);
      await publishConfig(root, next, unchanged, undefined, true);
      current = next;
    }
    await applyAgentDocs(root, docsPlan, unchanged);
    return result(settled.config, 'already-initialized', await writeLineEndings(root));
  };
  const base: SpecProjectConfig = { schemaVersion: SCHEMA_VERSION, baseline: first.state.head.commit
    ? { kind: 'commit', objectFormat: first.state.repository.objectFormat, commit: first.state.head.commit } : { kind: 'empty' } };
  const config = agentDocs ? settleConfig(base, agentDocs.version, docsPlan.language).config : base;
  const text = formatManagedConfig(config);
  const finish = async (outcome: 'created') => {
    const published = async () => {
      if ((await repo.inspect()).stamp !== first.stamp || await readConfigFile(root) !== text) throw new InitError('INPUT_CHANGED_AFTER_WRITE', t('init.changedAfterWrite'));
    };
    await published();
    await applyAgentDocs(root, docsPlan, published);
    return result(config, outcome, await writeLineEndings(root));
  };
  const old = await readConfigFile(root);
  if (old !== undefined) return existing(old);
  if (first.trackedConfig) throw new InitError('CONFIG_DELETED', t('init.configDeleted'));
  const checkRecords = async () => {
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

