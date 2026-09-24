import type { SpecRecord } from '@gitifact/contracts';

/**
 * The first line of a record's decision as plain text, for a one-line preview in a list: the list draws text, not
 * Markdown, so code marks, emphasis and link targets are dropped rather than shown as symbols.
 */
export function decisionPreview(record: SpecRecord): string {
  const body = (record.sections.find(s => s.key === 'decision') ?? record.sections[0])?.body ?? '';
  const line = body.split('\n').map(l => l.trim()).find(Boolean) ?? '';
  return line.replace(/^[-*]\s+/, '').replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
}
