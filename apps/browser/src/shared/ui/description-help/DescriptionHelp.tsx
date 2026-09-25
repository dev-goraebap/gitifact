import { useEffect, useRef, useState } from 'react';
import { HoverCard } from '@astryxdesign/core/HoverCard';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Text } from '@astryxdesign/core/Text';
import { HgiHelp } from '../icons/HgiHelp';
import { t, useLanguage } from '../../i18n';
import styles from './description-help.module.css';

/**
 * A list page's short description, available on hover, focus, click, and touch. The card is always controlled here:
 * hovering or focusing shows it, a press pins it open, a second press closes it until the pointer leaves, and Escape or
 * a press outside closes it. Leaving part of the state to HoverCard let a hover reopen a card a press had just closed.
 */
export function DescriptionHelp({ title, description }: { title: string; description: string }) {
  useLanguage();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  // After a press closes the card, the hover that is still on the button must not open it again.
  const [suppressed, setSuppressed] = useState(false);
  const isOpen = !suppressed && (pinned || hovered);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const close = () => { setPinned(false); setHovered(false); };
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || triggerRef.current?.contains(target)) return;
      const cardId = triggerRef.current?.getAttribute('aria-controls');
      if (cardId && document.getElementById(cardId)?.contains(target)) return;
      close();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { close(); setSuppressed(true); } };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape); };
  }, [isOpen]);
  // A controlled HoverCard leaves hover and focus to its owner: the card shows a moment after the pointer or focus
  // arrives, and goes a moment after it leaves, so passing over the button does not flash it.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hoverAfter = (value: boolean, ms: number) => { clearTimeout(timer.current); timer.current = setTimeout(() => setHovered(value), ms); };
  useEffect(() => () => clearTimeout(timer.current), []);
  return <HoverCard label={title} content={<Text>{description}</Text>} className={styles.helpCard} placement="below" alignment="start"
    touchTrigger="none" focusTrigger="never" hasHoverIndication={false} isOpen={isOpen}>
    <IconButton ref={triggerRef} label={t('common.description', { title })} icon={<HgiHelp/>} variant="ghost" size="sm"
      onClick={() => { if (pinned) { setPinned(false); setSuppressed(true); } else { setPinned(true); setSuppressed(false); } }}
      onMouseEnter={() => hoverAfter(true, 150)} onMouseLeave={() => { setSuppressed(false); hoverAfter(false, 150); }}
      onFocus={() => hoverAfter(true, 0)} onBlur={() => hoverAfter(false, 0)}/>
  </HoverCard>;
}
