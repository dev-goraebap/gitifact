import type { SpecEvent } from '@tryce/contracts';
import { LinePath } from '@visx/shape';
import { curveMonotoneY } from '@visx/curve';
import { HISTORY_GRAPH_WIDTH, HISTORY_ROW_HEIGHT, layoutHistory } from '../model/history-layout';
import styles from './product.module.css';
const colors = ['var(--color-text-blue)', 'var(--color-text-purple)', 'var(--color-text-teal)', 'var(--color-text-orange)'];
export function HistoryGraph({events, selected}: {events:SpecEvent[]; selected?:string | undefined}) {
  const { nodes, edges } = layoutHistory(events);
  if (!edges.length) return null;
  const selectedId = events.find(event => event.key === selected)?.id;
  const color = (lane: number | undefined) => lane === undefined ? 'var(--color-text-secondary)' : colors[lane % colors.length];
  return <svg className={styles.graph} width={HISTORY_GRAPH_WIDTH} height={events.length*HISTORY_ROW_HEIGHT} viewBox={`0 0 ${HISTORY_GRAPH_WIDTH} ${Math.max(HISTORY_ROW_HEIGHT,events.length*HISTORY_ROW_HEIGHT)}`} preserveAspectRatio="none" aria-label="같은 요구사항의 변경 관계" role="img">
    {edges.map(edge => <LinePath key={edge.key} data={edge.points} x={point=>point.x} y={point=>point.y} curve={curveMonotoneY}
      fill="none" stroke={color(edge.lane)} strokeWidth={selectedId===edge.id?3:2} strokeLinecap="round" opacity={selectedId && selectedId !== edge.id ? 0.25 : 0.85}/>) }
    {nodes.filter(node => node.lane !== undefined).map(node => <circle key={node.key} cx={node.x} cy={node.y} r={node.key===selected?5:4}
      fill="var(--color-background-surface)" stroke={color(node.lane)} strokeWidth={2} opacity={selectedId && selectedId !== node.id ? 0.35 : 1}/>) }
  </svg>;
}
