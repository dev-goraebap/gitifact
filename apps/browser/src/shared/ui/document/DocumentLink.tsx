import type { ReactNode } from 'react';
import { Link as RouterLink } from '@tanstack/react-router';
import { Link } from '@astryxdesign/core/Link';
import { Text } from '@astryxdesign/core/Text';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { useToast } from '@astryxdesign/core/Toast';
import { RouterLink as AppLink } from '../router-link/RouterLink';
import type { ResolvedLink } from './resolveDocumentLink';
import styles from './document.module.css';
import { t, useLanguage } from '../../i18n';

/**
 * One resolved document link as something the reader can act on. Features and instructions open in the app, assets and
 * external sites open in a new tab, a missing page is inert text, and a file the browser cannot show copies its path instead
 * of navigating, so no relative link ever lands on a 404.
 */
export function DocumentLink({ link, children }: { link: ResolvedLink; children: ReactNode }) {
  useLanguage();
  const toast = useToast();
  switch (link.kind) {
    case 'external': return <a href={link.href} target="_blank" rel="noopener noreferrer">{children}</a>;
    case 'asset': return <a href={link.url} target="_blank" rel="noopener noreferrer">{children}</a>;
    case 'anchor': return <a href={link.href}>{children}</a>;
    case 'app': return <AppLink href={link.href}>{children}</AppLink>;
    case 'instruction': return <RouterLink to="/instructions/$instructionId" params={{ instructionId: link.instructionId }} search={link.file ? { file: link.file } : {}} {...(link.hash.length > 1 ? { hash: link.hash.slice(1) } : {})}>{children}</RouterLink>;
    case 'agents': return <RouterLink to="/instructions/agents" {...(link.hash.length > 1 ? { hash: link.hash.slice(1) } : {})}>{children}</RouterLink>;
    case 'feature': return <RouterLink to="/features/$featureId" params={{ featureId: link.featureId }} search={{ tab: link.tab }} {...(link.hash.length > 1 ? { hash: link.hash.slice(1) } : {})}>{children}</RouterLink>;
    // Plain text rather than a disabled control: a disabled button never receives the hover that would show the hint.
    case 'missing': return <Tooltip content={t('link.missing', { path: link.path })}><Text as="span" type="inherit" color="secondary" hasStrikethrough className={styles.missingLink}>{children}</Text></Tooltip>;
    case 'outside': {
      const copy = async () => {
        try { await navigator.clipboard.writeText(link.path); toast({ body: t('link.copied'), uniqueID: 'document-link-copy' }); }
        catch { toast({ body: t('link.copyFailed', { path: link.path }), type: 'error', uniqueID: 'document-link-copy' }); }
      };
      return <Tooltip content={t('link.outside')}><Link color="secondary" type="inherit" hasUnderline className={styles.outsideLink} onClick={() => { void copy(); }}>{children}</Link></Tooltip>;
    }
  }
}
