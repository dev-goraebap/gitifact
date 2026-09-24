import type { InstructionColor } from '../model/instruction-color';
import styles from './instructions.module.css';

/**
 * A rounded square in the instruction's own colour with the first letter of its title; AGENTS.md takes a plain one.
 * Decorative: the title is beside it.
 */
export function InstructionMark({ color, title, size = 'md' }: { color: InstructionColor | 'agents' | undefined; title: string; size?: 'md' | 'lg' }) {
  return <span aria-hidden="true" data-instruction-color={color} className={size === 'lg' ? `${styles.mark} ${styles.markLarge}` : styles.mark}>
    {[...title.trim()][0]?.toUpperCase() ?? '?'}
  </span>;
}
