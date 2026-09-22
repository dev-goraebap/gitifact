import type { SpecFeature } from '@gitifact/contracts';

type Requirement = SpecFeature['requirements'][number];
/** A row of the feature list: a feature heading it, one of its requirements, or the rest of a long feature. */
export type FeatureRow = { id: string; kind: 'feature' | 'requirement' | 'more'; feature: SpecFeature;
  requirement?: Requirement; number?: number; hidden?: number; [key: string]: unknown };

/** Requirement rows drawn under one feature before the rest become a link into its detail. */
export const SHOWN_REQUIREMENTS = 12;
/** Rows a page aims for. A feature's rows are never split across two pages, so a page ends once it is past this. */
export const PAGE_ROWS = 40;

/** What one feature contributes: itself, the requirements to draw, and a tail row when it has more than fit. */
function rowsOf(feature: SpecFeature, requirements: Requirement[]): FeatureRow[] {
  const shown = requirements.slice(0, SHOWN_REQUIREMENTS);
  return [
    { id: feature.id, kind: 'feature', feature },
    ...shown.map((requirement, index) => ({ id: feature.id + ':' + requirement.id, kind: 'requirement' as const, feature, requirement, number: index + 1 })),
    ...(requirements.length > shown.length ? [{ id: feature.id + ':more', kind: 'more' as const, feature, hidden: requirements.length - shown.length }] : []),
  ];
}

/**
 * The list as rows, in pages that keep every feature whole.
 *
 * Paging by row would cut a feature's requirements in half across the fold, and paging by a fixed number of
 * features would let one introducing feature of two hundred requirements fill a page on its own. So a page takes
 * features until it is past PAGE_ROWS and always takes at least one, and a feature longer than that is capped by
 * rowsOf rather than by the page.
 */
export function pagesOf(features: { feature: SpecFeature; requirements: Requirement[] }[]): FeatureRow[][] {
  const pages: FeatureRow[][] = [];
  let page: FeatureRow[] = [];
  for (const entry of features) {
    const rows = rowsOf(entry.feature, entry.requirements);
    if (page.length && page.length + rows.length > PAGE_ROWS) { pages.push(page); page = []; }
    page.push(...rows);
  }
  if (page.length) pages.push(page);
  return pages;
}
