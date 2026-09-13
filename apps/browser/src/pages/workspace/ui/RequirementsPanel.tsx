import { useEffect, useRef } from 'react';
import { availabilityMessage } from '../model/availability';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import { Token } from '@astryxdesign/core/Token';
import { Link } from '@tanstack/react-router';
import type { BrowserProjectV1 } from '../../../entities/project';
import type { WorkspaceSearch } from '../model/search';
import { RequirementDetail } from './RequirementDetail';
import styles from './workspace.module.css';
export function RequirementsPanel({
  requirements,
  search,
  onSearch,
}: {
  requirements: BrowserProjectV1['requirements'];
  search: WorkspaceSearch;
  onSearch: (next: WorkspaceSearch, replace?: boolean) => void;
}) {
  const previousSelection = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!search.selected && previousSelection.current) {
      document.getElementById('requirement-' + previousSelection.current)?.focus();
    }
    previousSelection.current = search.selected;
  }, [search.selected]);
  if (requirements.state !== 'available')
    return (
      <VStack padding={6} role={requirements.state === 'error' ? 'alert' : 'status'}>
        <Text>{requirements.state === 'error' ? requirements.error.message : availabilityMessage(requirements.reason)}</Text>
      </VStack>
    );
  const selected = requirements.data.find((r) => r.id === search.selected);
  const items = requirements.data.filter(
    (r) =>
      (!search.q || (r.id + r.title + r.text).toLowerCase().includes(search.q.toLowerCase())) &&
      (!search.spec || r.spec === search.spec) &&
      (!search.state || (search.state === 'approved' ? r.approval === 'approved' : r.state === search.state)),
  );
  return (
    <VStack gap={0} className={selected ? styles.split : undefined}>
      <VStack gap={0} className={styles.list}>
        <HStack padding={4} gap={3} wrap="wrap">
          <TextInput
            label="요구사항 검색"
            isLabelHidden
            placeholder="요구사항 검색…"
            value={search.q ?? ''}
            hasClear
            onChange={(q) => onSearch({ ...search, q: q || undefined }, true)}
          />
          <Selector
            label="영역"
            isLabelHidden
            value={search.spec ?? ''}
            options={[
              { value: '', label: '모든 영역' },
              ...[...new Set(requirements.data.map((r) => r.spec))]
                .sort()
                .map((value) => ({ value, label: value })),
            ]}
            onChange={(spec) => onSearch({ ...search, spec: spec || undefined })}
          />
          <Selector
            label="상태"
            isLabelHidden
            value={search.state ?? ''}
            options={[
              { value: '', label: '모든 상태' },
              { value: 'draft', label: '초안' },
              { value: 'active', label: '확정' },
              { value: 'approved', label: '사용자 승인' },
            ]}
            onChange={(state) =>
              onSearch({ ...search, state: (state as WorkspaceSearch['state']) || undefined })
            }
          />
          <Text type="supporting" color="secondary">
            {items.length}개 / 전체 {requirements.data.length}개
          </Text>
        </HStack>
        {search.selected && !selected && (
          <VStack padding={4} role="status">
            <Text>선택한 요구사항을 찾을 수 없습니다.</Text>
          </VStack>
        )}
        {items.length === 0 ? (
          <VStack padding={6}>
            <Text>
              {requirements.data.length
                ? '검색 조건에 맞는 요구사항이 없습니다.'
                : '등록된 요구사항이 없습니다. 에이전트와 제품에 대해 이야기하며 기록을 시작하세요.'}
            </Text>
          </VStack>
        ) : (
          <Table
            data={items}
            idKey="id"
            density="compact"
            hasHover
            columns={[
              {
                key: 'title',
                header: '요구사항',
                width: proportional(3),
                renderCell: (item) => (
                  <VStack gap={1}>
                    <Link
                      id={'requirement-' + item.id}
                      to="/requirements"
                      search={{ ...search, selected: item.id }}
                      className={styles.link}
                    >
                      {item.title}
                    </Link>
                    <Text type="supporting" color="secondary">
                      {item.id}
                    </Text>
                  </VStack>
                ),
              },
              { key: 'spec', header: '영역', width: proportional(1) },
              {
                key: 'state',
                header: '기록 상태',
                width: pixel(100),
                renderCell: (item) => (
                  <Token
                    size="sm"
                    label={
                      item.state === 'draft'
                        ? '초안'
                        : item.approval === 'approved'
                          ? '사용자 승인'
                          : '자동 확정'
                    }
                    color={
                      item.state === 'draft' ? 'default' : item.approval === 'approved' ? 'green' : 'blue'
                    }
                  />
                ),
              },
            ]}
          />
        )}
      </VStack>
      {selected && (
        <RequirementDetail
          requirement={selected}
          onClose={() => {
            onSearch({ ...search, selected: undefined });
          }}
        />
      )}
    </VStack>
  );
}
