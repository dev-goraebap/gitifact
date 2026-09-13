import { availabilityMessage } from '../model/availability';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Markdown } from '@astryxdesign/core/Markdown';
import { Token } from '@astryxdesign/core/Token';
import type { BrowserProjectV1 } from '../../../entities/project';
import type { WorkspaceSearch } from '../model/search';
import styles from './workspace.module.css';
type Notes = NonNullable<BrowserProjectV1['brief']['report']>['notes'];
export function DecisionsPanel({
  notes,
  search,
  onSearch,
}: {
  notes: Notes | undefined;
  search: WorkspaceSearch;
  onSearch: (next: WorkspaceSearch, replace?: boolean) => void;
}) {
  if (!notes || notes.state !== 'available')
    return (
      <VStack padding={6} role={notes?.state === 'error' ? 'alert' : 'status'}>
        <Text>
          {!notes ? '기록을 읽지 못했습니다.' : notes.state === 'error' ? notes.error.message : availabilityMessage(notes.reason)}
        </Text>
      </VStack>
    );
  const items = notes.data.items.filter(
    (n) => !search.q || (n.id + n.text).toLowerCase().includes(search.q.toLowerCase()),
  );
  return (
    <VStack gap={0}>
      <HStack padding={4} gap={4} wrap="wrap">
        <TextInput
          label="판단 검색"
          isLabelHidden
          placeholder="판단 검색…"
          value={search.q ?? ''}
          onChange={(q) => onSearch({ ...search, q: q || undefined }, true)}
          hasClear
        />
        <Text type="supporting">{items.length}개</Text>
      </HStack>
      {items.length === 0 && (
        <VStack padding={6}>
          <Text>표시할 판단 기록이 없습니다.</Text>
        </VStack>
      )}
      {items.map((note) => (
        <VStack as="article" key={note.id} padding={5} gap={3} className={styles.row}>
          <HStack gap={3} wrap="wrap">
            <Token
              size="sm"
              label={{ discovery: '발견', constraint: '제약', rejected: '기각' }[note.type]}
              color={note.type === 'constraint' ? 'orange' : 'default'}
            />
            <Text type="supporting" color="secondary">
              {note.recordedAt} · {note.author ?? '작성자 미상'}
            </Text>
          </HStack>
          <Markdown headingLevelStart={2} density="compact">
            {note.text}
          </Markdown>
          <Text type="supporting" color="secondary">
            {note.id}
          </Text>
          {note.supersedes && <Text type="supporting">정정 대상: {note.supersedes}</Text>}
          {note.correctedBy.length > 0 && (
            <Text type="supporting">이후 정정됨: {note.correctedBy.join(', ')}</Text>
          )}
          {note.references.length > 0 && <Text type="supporting">참조: {note.references.join(', ')}</Text>}
        </VStack>
      ))}
    </VStack>
  );
}
