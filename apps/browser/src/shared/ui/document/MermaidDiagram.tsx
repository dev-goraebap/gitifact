import { useEffect, useId, useRef, useState } from 'react';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { useAppearance } from '../../lib/appearance';
import { t, useLanguage } from '../../i18n';
import styles from './document.module.css';

/**
 * A ```mermaid block drawn as a diagram. Mermaid is bundled, not fetched, and only its own chunk loads — the import
 * below is dynamic, so a document without a diagram never pays for it. Invalid source stays readable as code with the
 * parser message beside it, because a document must not lose content to a typo in one fence.
 */
type State = { kind: 'pending' } | { kind: 'ready'; svg: string } | { kind: 'failed'; message: string };

// Mermaid writes colors into the SVG, so it cannot read var(--color-*) itself. The tokens are resolved from the
// element that holds the diagram, which puts it under the same theme and mode as the surrounding text.
// A token is read as the colour it paints, not as its declared text: a theme may declare `light-dark(a, b)`, which
// only the browser resolves and mermaid cannot parse, and then nothing is drawn at all.
function themeVariables(host: HTMLElement): Record<string, string> {
  const style = getComputedStyle(host);
  const probe = host.appendChild(document.createElement('span'));
  const token = (name: string) => {
    if (!style.getPropertyValue(name).trim()) return '';
    probe.style.color = `var(${name})`;
    return getComputedStyle(probe).color;
  };
  const text = token('--color-text-primary');
  const line = token('--color-text-secondary');
  const border = token('--color-border-emphasized') || token('--color-border');
  // Boxes take the page's own surface with a thin border, so a diagram reads as part of the text, not a grey panel.
  const surface = token('--color-background-surface');
  const colors = {
    background: surface,
    primaryColor: surface, primaryTextColor: text, primaryBorderColor: border,
    secondaryColor: token('--color-background-muted'), secondaryTextColor: text, secondaryBorderColor: border,
    tertiaryColor: token('--color-accent-muted'), tertiaryTextColor: text, tertiaryBorderColor: border,
    lineColor: line, textColor: text, mainBkg: surface, nodeBorder: border,
    clusterBkg: surface, clusterBorder: token('--color-border'),
    titleColor: text, edgeLabelBackground: surface,
    // Notes in sequence and state diagrams: the muted fill of a quote, not mermaid's yellow sticky note.
    noteBkgColor: token('--color-background-muted'), noteBorderColor: token('--color-border'), noteTextColor: text,
    // Git graphs: left alone, the base theme derives the first branch from the text colour, which is black on a dark
    // page. The first branch is the neutral border colour and the others take the alert colours, each label in the
    // page's surface colour so it reads on its branch.
    ...Object.fromEntries(['--color-border-emphasized', '--color-icon-blue', '--color-icon-purple', '--color-icon-green', '--color-icon-yellow', '--color-icon-red', '--color-text-secondary', '--color-icon-blue']
      .flatMap((name, i) => [['git' + i, token(name)], ['gitBranchLabel' + i, surface]])),
    commitLabelColor: line, commitLabelBackground: surface,
  };
  probe.remove();
  // A step below the body size: labels are names, and a smaller face keeps the drawing within the column.
  return { ...colors, fontFamily: style.fontFamily, fontSize: '14px' };
}

// The SVG sits inline in the page, so these rules can use the theme tokens directly. Edge labels get a halo in the
// surface colour instead of mermaid's background box, which sits off the text and lets the line run through the
// words. Groups are a dashed outline with no fill, and the neo look's drop shadow is dropped: in dark mode it glows.
const themeCSS = `
  .node rect, .node polygon, .node circle, .node path { stroke-width:1px; }
  .node rect.basic, .node rect.label-container { rx:6px; ry:6px; }
  .node, .node *, .cluster, .cluster * { filter:none !important; }
  .cluster rect { rx:10px; ry:10px; stroke-dasharray:4 3; fill:transparent !important; }
  .cluster-label text { fill:var(--color-text-secondary) !important; font-size:13px; }
  .edgeLabel rect.background { display:none; }
  .edgeLabel text { font-size:13px; fill:var(--color-text-secondary) !important; paint-order:stroke; stroke:var(--color-background-surface); stroke-width:5px; stroke-linejoin:round; }
`;

// mermaid measures a diagram by putting it in the document first. Left to itself it appends that element to
// <body>, and a diagram wider than the page then pulls a horizontal scrollbar in and out on every render, which
// reads as the page shaking sideways. Measuring happens inside this one off-screen host instead; overflow to the
// left never scrolls, so the page never moves.
function measuringHost(): HTMLElement {
  const id = 'gitifact-mermaid-measuring';
  const existing = document.getElementById(id);
  if (existing) return existing;
  const host = document.createElement('div');
  host.id = id;
  host.setAttribute('aria-hidden', 'true');
  // Off-screen, but painted: mermaid sizes each box by measuring its label, and a hidden subtree measures as nothing,
  // which gives every box the same fallback width and cuts the longer labels.
  host.style.cssText = 'position:fixed;top:0;left:-99999px;pointer-events:none;';
  document.body.appendChild(host);
  return host;
}

// The resolved mode, not the stored one: 'system' follows the operating system, and the tokens change with it.
function useThemeSignature(): string {
  const { mode, palette } = useAppearance();
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setDark(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return `${palette}:${mode === 'system' ? (dark ? 'dark' : 'light') : mode}`;
}

export function MermaidDiagram({ code }: { code: string }) {
  useLanguage();
  const host = useRef<HTMLElement>(null);
  const [state, setState] = useState<State>({ kind: 'pending' });
  const signature = useThemeSignature();
  // useId returns a value with colons, which mermaid puts into a CSS selector; only letters and digits survive.
  const id = 'gitifact-diagram-' + useId().replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    void (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        // Mermaid sizes every box from the width it measures, so measuring before the theme font arrives leaves the
        // text hanging outside its box once the font swaps in.
        await document.fonts?.ready;
        // strict keeps mermaid's own sanitizer on and refuses click handlers in the source. Labels are plain SVG
        // text rather than HTML in a foreignObject, because a drawing wider than the column is scaled down to fit
        // and only SVG text scales with it; HTML labels keep their pixel size and spill out of their boxes.
        // The neo look draws rounded boxes with thin borders; rounded curves bend edges at corners instead of
        // sweeping splines, which keeps parallel edges from crossing each other's labels.
        mermaid.initialize({
          startOnLoad: false, securityLevel: 'strict', theme: 'base', look: 'neo', themeVariables: themeVariables(element), themeCSS,
          // The per-diagram switches alone leave the labels as HTML; the top-level one is what turns them off.
          htmlLabels: false, flowchart: { htmlLabels: false, curve: 'rounded', nodeSpacing: 36, rankSpacing: 44, padding: 12 }, class: { htmlLabels: false },
          // Commit labels upright; the actors once, at the top; entity boxes sized to their names.
          gitGraph: { rotateCommitLabel: false }, sequence: { mirrorActors: false }, er: { minEntityWidth: 80, minEntityHeight: 44, entityPadding: 12 },
          fontFamily: getComputedStyle(element).fontFamily,
        });
        const { svg } = await mermaid.render(id, code, measuringHost());
        if (!cancelled) setState({ kind: 'ready', svg });
      } catch (error) {
        if (!cancelled) setState({ kind: 'failed', message: error instanceof Error ? error.message : String(error) });
      }
    })();
    return () => { cancelled = true; };
  }, [code, signature, id]);

  if (state.kind === 'failed') return (
    <VStack gap={2} className={styles.codeblock}>
      <Text type="supporting" color="secondary">{t('markdown.diagramFailed', { message: state.message.split('\n')[0] ?? '' })}</Text>
      <CodeBlock code={code} language="plaintext" width="100%"/>
    </VStack>
  );
  // The figure carries the rendered SVG: mermaid returns markup, and it is the only element here with inner markup.
  return <figure ref={host} className={styles.diagram} role="img" aria-label={t('markdown.diagram')}
    {...(state.kind === 'ready' ? { dangerouslySetInnerHTML: { __html: state.svg } } : {})}/>;
}
