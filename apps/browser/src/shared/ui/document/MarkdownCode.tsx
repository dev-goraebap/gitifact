import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { MermaidDiagram } from './MermaidDiagram';
import styles from './document.module.css';

/**
 * Astryx Markdown `components.code`: a `mermaid` fence becomes a diagram, every other fence keeps the code block
 * Astryx renders by default. Overriding this slot replaces Astryx's wrapper too, so the block spacing comes from
 * the class here instead of `.astryx-markdown-codeblock`.
 */
export function MarkdownCode({ code, language }: { code: string; language?: string }) {
  if (language?.toLowerCase() === 'mermaid') return <MermaidDiagram code={code}/>;
  return <CodeBlock code={code} language={language ?? 'plaintext'} width="100%" isCollapsible className={styles.codeblock}/>;
}
