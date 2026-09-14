import type { SpecEvent } from '@tryce/contracts';

export const HISTORY_ROW_HEIGHT = 64;
export const HISTORY_GRAPH_WIDTH = 88;

/** Reserve a lane for the visible lifetime of a requirement, then reuse it. */
export function layoutHistory(events: Pick<SpecEvent, 'id' | 'key'>[]) {
  const groups = new Map<string, number[]>();
  events.forEach((event, index) => {
    const rows = groups.get(event.id) ?? [];
    rows.push(index);
    groups.set(event.id, rows);
  });
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();
  for (const [id, rows] of groups) {
    if (rows.length < 2) continue;
    let lane = laneEnds.findIndex(end => end < rows[0]!);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = rows[rows.length - 1]!;
    lanes.set(id, lane);
  }
  const spacing = Math.min(16, 56 / Math.max(1, laneEnds.length));
  const nodes = events.map((event, index) => {
    const rows = groups.get(event.id)!;
    const lane = lanes.get(event.id);
    const endpoint = index === rows[0] || index === rows[rows.length - 1];
    return { ...event, x: endpoint || lane === undefined ? 16 : 16 + (lane + 1) * spacing,
      y: index * HISTORY_ROW_HEIGHT + HISTORY_ROW_HEIGHT / 2, lane };
  });
  const edges = [...groups].flatMap(([id, rows]) => rows.slice(1).map((row, index) => {
    const source = nodes[rows[index]!]!;
    const target = nodes[row]!;
    const lane = lanes.get(id)!;
    const x = 16 + (lane + 1) * spacing;
    return { key: `${source.key}:${target.key}`, id, lane, points: [
      { x: source.x, y: source.y }, { x, y: source.y + 24 },
      { x, y: target.y - 24 }, { x: target.x, y: target.y },
    ] };
  }));
  return { nodes, edges, laneCount: laneEnds.length };
}
