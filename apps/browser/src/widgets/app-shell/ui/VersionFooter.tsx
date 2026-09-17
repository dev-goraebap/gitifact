import { useState } from 'react';
import { HStack } from '@astryxdesign/core/HStack';
import { Button } from '@astryxdesign/core/Button';
import { useQuery } from '@tanstack/react-query';
import { sessionOptions } from '../../../entities/project';
import { RouterLink } from '../../../shared/ui/router-link/RouterLink';
import { UpdateDialog } from './UpdateDialog';
import { t } from '../../../shared/i18n';

/** Running CLI version (links to the release notes) and, only when the server found one, the newer release. */
export function VersionFooter() {
  const session = useQuery(sessionOptions());
  const [open, setOpen] = useState(false);
  // No version is shown until the session answers; a placeholder would look like a real release.
  if (!session.data) return null;
  const { cliVersion, update } = session.data;
  return (
    <HStack gap={1} padding={3} hAlign="start" vAlign="center" wrap="wrap">
      <Button label={t('shell.version', { version: cliVersion })} variant="ghost" size="sm" href="/changelog" as={RouterLink} tooltip={t('shell.versionTooltip')} />
      {update.status === 'available' && update.latestVersion && <>
        <Button label={t('shell.updateAvailable', { version: update.latestVersion })} variant="secondary" size="sm" onClick={() => setOpen(true)} />
        {open && <UpdateDialog current={cliVersion} latest={update.latestVersion} close={() => setOpen(false)} />}
      </>}
    </HStack>
  );
}
