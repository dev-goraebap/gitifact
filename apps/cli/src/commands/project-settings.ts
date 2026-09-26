import { CLI_VERSION_PATTERN, type ProjectLanguage, type SpecProjectConfig } from '@gitifact/core';
import { isNewerRelease } from '../shared/update-check.js';

/**
 * The config after init or update: `cli` rises to the running release and `language` becomes the block language. A
 * project already set to a newer release keeps it, since an older CLI must not pull the team back. A build whose version
 * is not a plain release (a local pre-release) leaves `cli` as it is.
 */
export function settleConfig(config: SpecProjectConfig, version: string, language: ProjectLanguage): { config: SpecProjectConfig; changed: boolean } {
  const cli = !CLI_VERSION_PATTERN.test(version) || (config.cli !== undefined && !isNewerRelease(version, config.cli)) ? config.cli : version;
  const next: SpecProjectConfig = { ...config, ...(cli === undefined ? {} : { cli }), language };
  return { config: next, changed: next.cli !== config.cli || next.language !== config.language };
}

/** The project's release and block language from config text, for reads that must not fail on a broken file. */
export function projectSettings(text: string | undefined): { cli?: string; language?: ProjectLanguage } {
  if (text === undefined) return {};
  try {
    const value = JSON.parse(text) as { cli?: unknown; language?: unknown };
    return {
      ...(typeof value.cli === 'string' && CLI_VERSION_PATTERN.test(value.cli) ? { cli: value.cli } : {}),
      ...(value.language === 'ko' || value.language === 'en' ? { language: value.language } : {}),
    };
  } catch { return {}; }
}
