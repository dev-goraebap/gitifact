import type { ReactNode } from 'react';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { ProjectName } from '../../../entities/project';
import { HgiFolder } from '../../../shared/ui/icons/HgiFolder';
import styles from './page-header.module.css';
export function PageHeader({ page, actions }: { page: string; actions?: ReactNode }) {
  return (
    <HStack as="header" aria-label="현재 위치" gap={3} className={styles.bar}>
      <HStack gap={2} className={styles.trail}>
        <HgiFolder />
        <ProjectName />
        <Text type="supporting" color="secondary">/</Text>
        <Text type="supporting">{page}</Text>
      </HStack>
      {actions}
    </HStack>
  );
}
