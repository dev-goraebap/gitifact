import type { BrowserCheckoutV1 } from '@gitifact/contracts';

/**
 * Where a document is shown now, found in the checkout's index: its feature, the requirement or design on its tab, or
 * its instruction. A document the working tree no longer holds has no page, and undefined says so.
 */
export function currentLink(index: BrowserCheckoutV1['index'], id: string) {
  if (index.instructions.some(i => i.id === id)) return { to: '/instructions/$instructionId', params: { instructionId: id } } as const;
  for (const feature of index.features) {
    if (feature.id === id) return { to: '/features/$featureId', params: { featureId: id } } as const;
    if (feature.requirements.some(r => r.id === id)) return { to: '/features/$featureId', params: { featureId: feature.id }, search: { selected: id, tab: 'requirements' as const }, hash: id } as const;
    if (feature.designs.some(d => d.id === id)) return { to: '/features/$featureId', params: { featureId: feature.id }, search: { selected: id, tab: 'design' as const }, hash: id } as const;
  }
  return undefined;
}
