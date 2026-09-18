import { Text } from '@astryxdesign/core/Text';
import { useResolvedLink } from './document-scope';
import styles from './document.module.css';

/** Astryx Markdown `components.image`: store assets are served by the CLI, external images load as written, anything else shows its alt text. */
export function MarkdownImage({ src, alt }: { src: string; alt: string }) {
  const link = useResolvedLink(src);
  const url = link.kind === 'asset' ? link.url : link.kind === 'external' || link.kind === 'app' ? link.href : undefined;
  if (!url) return <Text type="supporting" color="secondary" display="block">[{alt}]</Text>;
  return <img src={url} alt={alt} className={styles.image}/>;
}
