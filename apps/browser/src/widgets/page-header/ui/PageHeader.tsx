import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@tanstack/react-router';
import { ProjectName } from '../../../entities/project';
import { HgiFolder } from '../../../shared/ui/icons/HgiFolder';
import { SearchTrigger } from '../../search-palette';
import styles from './page-header.module.css';
import { t } from '../../../shared/i18n';

/** One breadcrumb level after the project root; levels with a route render as links, the last one as plain text. */
export interface Crumb { label: string; to?: string; search?: Record<string, string | undefined> }

export function PageHeader({ trail, actions }: { trail: Crumb[]; actions?: ReactNode }) {
  return (
    <HStack as="header" aria-label={t('header.location')} gap={3} className={styles.bar}>
      <HStack gap={2} className={styles.trail}>
        <HgiFolder />
        <ProjectName />
        {trail.map((crumb, index) => <Fragment key={index}>
          <Text type="supporting" color="secondary">/</Text>
          {crumb.to && index < trail.length - 1
            ? <Link to={crumb.to} search={crumb.search ?? {}} className={styles.crumb}>{crumb.label}</Link>
            : <Text type="supporting" maxLines={1}>{crumb.label}</Text>}
        </Fragment>)}
      </HStack>
      <HStack gap={3} className={styles.tools}>
        <SearchTrigger/>
        {actions}
      </HStack>
    </HStack>
  );
}
