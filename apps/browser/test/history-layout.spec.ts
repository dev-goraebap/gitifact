import { expect, test } from '@playwright/test';
import { layoutHistory } from '../src/pages/product/model/history-layout';

const events = (ids: string[]) => ids.map((id, index) => ({ id, key: String(index) }));

test('unrelated records stay aligned without fabricated connections', () => {
  const graph = layoutHistory(events(['A', 'B', 'C']));
  expect(graph.nodes.map(node => node.x)).toEqual([16, 16, 16]);
  expect(graph.edges).toEqual([]);
});

test('overlapping lifetimes get separate lanes; finished lanes are reused', () => {
  const graph = layoutHistory(events(['A', 'B', 'A', 'B', 'C', 'C']));
  expect(graph.edges.map(edge => edge.lane)).toEqual([0, 1, 0]);
  expect(graph.laneCount).toBe(2);
  expect(graph.edges[0]!.points).toEqual([
    { x: 16, y: 32 }, { x: 32, y: 56 }, { x: 32, y: 136 }, { x: 16, y: 160 },
  ]);
});

test('long chains retain their lane and dense history stays within the gutter', () => {
  const graph = layoutHistory(events(['A', 'B', 'A', 'B', 'A']));
  expect(graph.nodes[2]!.x).toBe(32);
  const ids = Array.from({ length: 20 }, (_, index) => String(index));
  const dense = layoutHistory(events([...ids, ...ids]));
  expect(dense.laneCount).toBe(20);
  expect(Math.max(...dense.edges.flatMap(edge => edge.points.map(point => point.x)))).toBeLessThanOrEqual(72);
});
