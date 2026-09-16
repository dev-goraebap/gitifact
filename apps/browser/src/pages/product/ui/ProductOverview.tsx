import type { SpecDocument } from '@gitifact/contracts';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Markdown } from '@astryxdesign/core/Markdown';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Link } from '@tanstack/react-router';
import styles from './product.module.css';
import { PageState } from '../../../shared/ui/page-state';

/** Relative image links in PRODUCT.md point at files beside it; the server exposes those by file name only. */
export function productImageSources(body: string) {
  return body.replace(/(!\[[^\]]*\]\()(?:\.\/)?([A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|gif|svg|webp))(\s*(?:"[^"]*")?\))/gi, '$1/api/v1/product/assets/$2$3');
}

/** The product description is one page rendered as written; nothing to browse, only to read. */
export function ProductOverview({ product }: { product: SpecDocument | undefined }) {
  if (!product) return <PageState kind="empty" title="제품 개요가 아직 없습니다" description="에이전트와 제품의 목적·대상 사용자·원칙·범위를 정리하면 .gitifact/product/PRODUCT.md로 저장되어 이곳에 나타납니다."/>;
  return <VStack as="article" aria-label="제품 개요" gap={0} className={styles.featureDetail}>
    <VStack gap={3} className={styles.documentHeading}>
      <Heading level={1}>{product.title}</Heading>
      <HStack gap={4} wrap="wrap" className={styles.entryLine}>
        <Text type="supporting" color="secondary">{product.id}</Text>
        {product.updatedAt ? <Timestamp value={product.updatedAt} format="relative"/> : <Text type="supporting" color="secondary">작업 중</Text>}
        <Link to="/" search={{ document: 'product' }}>제품 개요 변경 이력 →</Link>
      </HStack>
    </VStack>
    <VStack gap={0} className={styles.productBody}><Markdown headingLevelStart={2}>{productImageSources(product.body)}</Markdown></VStack>
  </VStack>;
}
