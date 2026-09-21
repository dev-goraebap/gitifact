import { HStack } from '@astryxdesign/core/HStack';
import { Button } from '@astryxdesign/core/Button';
import { useQuery } from '@tanstack/react-query';
import { sessionOptions } from '../../../entities/project';
import { RouterLink } from '../../../shared/ui/router-link/RouterLink';
import styles from './app-shell.module.css';
import { t, useLanguage } from '../../../shared/i18n';

/** Running CLI version with a link to the bundled release notes. */
export function VersionFooter() {
  useLanguage();
  const session = useQuery(sessionOptions());
  // No version is shown until the session answers; a placeholder would look like a real release.
  if (!session.data) return null;
  const { cliVersion } = session.data;
  return (
    <HStack gap={1} hAlign="start" vAlign="center" wrap="wrap" className={styles.versionFooter}>
      <Button label={t('shell.version', { version: cliVersion })} variant="ghost" size="sm" href="/changelog" as={RouterLink} tooltip={t('shell.versionTooltip')} />
    </HStack>
  );
}
