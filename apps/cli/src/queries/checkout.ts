import type { DocProblem } from '@gitifact/core';
import type { FeatureRow, SpecFeature, SpecInstruction } from '@gitifact/contracts';
import type { FolderAuthors, Person } from '../adapters/cache/index.js';
import { pageOf, type PageRequest } from './paging.js';

/**
 * The working tree as the browser reads it, before any screen's shape: features and instructions with where each
 * stands and who wrote them, whether anything is uncommitted, and the stamp. The server reads it
 * (`server/checkout/checkout-reader.ts`); the functions here give each screen what it draws.
 */
export interface CheckoutBase {
  head: string | null; stamp: string; observedAt: string; working: boolean; problems: DocProblem[];
  features: SpecFeature[]; instructions: Omit<SpecInstruction, 'files' | 'filesLimited'>[];
  people: Person[]; folders: Map<string, FolderAuthors>;
}

/** Requirement rows a feature shows in the list before the rest are left to its page. */
const SHOWN_REQUIREMENTS = 12;

/**
 * Every document and person by name, without bodies: what links resolve with, crumbs name and filters offer. It is not
 * paged — a link may point at any document — and holds no text but titles.
 */
export function checkoutIndex(base: CheckoutBase) {
  return {
    features: base.features.map(f => ({ id: f.id, path: f.path, title: f.title, state: f.state,
      requirements: f.requirements.map(r => ({ id: r.id, path: r.path, title: r.title, description: r.description })),
      designs: f.designs.map(d => ({ id: d.id, path: d.path, title: d.title })) })),
    instructions: base.instructions.map(k => ({ id: k.id, name: k.name, path: k.path, title: k.title })),
    people: base.people.map(p => ({ name: p.name, email: p.email })),
  };
}

// The acceptance section heading in either language the guides write: `### 수용 조건` or `### Acceptance criteria`.
const acceptanceHeading = /^###\s+(?:수용 조건|acceptance criteria)\s*$/i;
/**
 * How many acceptance criteria a requirement body lists: the numbered items under its acceptance heading, up to the
 * next heading. A body without that heading has no count; the list says nothing rather than zero.
 */
export function acceptanceCount(body: string): number | null {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex(line => acceptanceHeading.test(line.trim()));
  if (start < 0) return null;
  let count = 0;
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(line)) break;
    if (/^\d+\.\s/.test(line)) count++;
  }
  return count || null;
}

export interface FeatureFilter { q?: string | undefined; design?: 'yes' | 'no' | undefined; author?: string | undefined; sort?: 'title' | 'requirements' | 'updated' | undefined; dir?: 'asc' | 'desc' | undefined }

/**
 * The feature list: the features that match, in the asked order, a page of whole features. A word may name a feature
 * (its title or ID), which keeps all its requirements, or a requirement, which keeps that one, so the list answers
 * with the requirement rather than the document holding it. Most recent first by default; a name reads ascending, a
 * count and a date descending, and `dir` turns either way. A feature shows its first requirements and how many more
 * there are. A cursor that is gone answers undefined.
 */
export function listFeatures(base: CheckoutBase, filter: FeatureFilter, request: PageRequest) {
  const query = filter.q?.trim().toLowerCase();
  const named = (f: SpecFeature) => !query || (f.title + ' ' + f.id).toLowerCase().includes(query);
  const key = filter.sort ?? 'updated';
  const opens = { title: 'asc', requirements: 'desc', updated: 'desc' } as const;
  const way = (filter.dir ?? opens[key]) === 'asc' ? 1 : -1;
  const groups = base.features
    .filter(f => !filter.design || (filter.design === 'yes') === f.designs.length > 0)
    .filter(f => !filter.author || f.contributors.some(p => p.email === filter.author))
    .map(f => ({ feature: f, requirements: named(f) ? f.requirements : f.requirements.filter(r => (r.title + ' ' + r.id).toLowerCase().includes(query!)) }))
    .filter(g => named(g.feature) || g.requirements.length)
    // The order is the features', not the rows': a requirement keeps the place its document gives it.
    .sort((a, b) => way * (key === 'requirements' ? a.feature.requirements.length - b.feature.requirements.length
      : key === 'title' ? a.feature.title.localeCompare(b.feature.title)
      : (a.feature.updatedAt ?? '').localeCompare(b.feature.updatedAt ?? '')) || a.feature.title.localeCompare(b.feature.title));
  const page = pageOf(groups, g => g.feature.id, request);
  if (!page) return undefined;
  const features = page.rows.map(({ feature: f, requirements }): FeatureRow => {
    const designed = new Set(f.designs.flatMap(d => d.requirements));
    return { id: f.id, path: f.path, title: f.title, description: f.description, state: f.state, designs: f.designs.length,
      contributors: f.contributors, updatedAt: f.updatedAt, requirementCount: f.requirements.length,
      requirements: requirements.slice(0, SHOWN_REQUIREMENTS).map(r => ({ id: r.id, title: r.title, description: r.description, state: r.state,
        acceptance: acceptanceCount(r.body), designed: designed.has(r.id) })),
      hidden: Math.max(0, requirements.length - SHOWN_REQUIREMENTS) };
  });
  return { total: page.total, all: base.features.length, requirements: groups.reduce((sum, g) => sum + g.requirements.length, 0),
    mostRequirements: Math.max(0, ...base.features.map(f => f.requirements.length)), next: page.next, features };
}

/** One feature as written, with its authors and last change; undefined when the checkout has no such feature. */
export const featureOf = (base: CheckoutBase, id: string) => base.features.find(f => f.id === id);

/**
 * The contributors whose name or email holds the words, most commits first, a page at a time, each with how many
 * features they touched. A cursor (an email) that is gone answers undefined.
 */
export function listContributors(base: CheckoutBase, q: string | undefined, request: PageRequest) {
  const query = q?.trim().toLowerCase();
  const people = base.people.filter(p => !query || (p.name + ' ' + p.email).toLowerCase().includes(query));
  const page = pageOf(people, p => p.email, request);
  if (!page) return undefined;
  const touched = (email: string) => base.features.filter(f => f.contributors.some(c => c.email === email)).length;
  return { total: page.total, next: page.next, people: page.rows.map(p => ({ ...p, features: touched(p.email) })) };
}

/** One contributor and the features they touched, in feature order; undefined for someone who never committed. */
export function contributorOf(base: CheckoutBase, email: string) {
  const person = base.people.find(p => p.email === email);
  if (!person) return undefined;
  const features = base.features.flatMap(f => { const share = f.contributors.find(c => c.email === email);
    return share ? [{ id: f.id, title: f.title, commits: share.commits, requirements: f.requirements.length }] : []; });
  return { person, features };
}

/** The three who committed most, and how many others there are with their commits between them: the overview's chart. */
export function topContributors(people: Person[]) {
  const rest = people.slice(3);
  return { total: people.length, top: people.slice(0, 3), rest: { count: rest.length, commits: rest.reduce((sum, p) => sum + p.commits, 0) } };
}
