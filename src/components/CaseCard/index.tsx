import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import {
  sourceKindLabels,
  type CaseCatalogEntry,
} from '@site/src/data/caseCatalog';

import styles from './styles.module.css';

type CaseCardProps = {
  caseStudy: CaseCatalogEntry;
};

export default function CaseCard({caseStudy}: CaseCardProps): ReactNode {
  const {
    catalog_order,
    title,
    slug,
    summary,
    migration_targets,
    source_kinds,
  } = caseStudy;
  const caseNumber = String(catalog_order).padStart(2, '0');
  const evidenceLabel = source_kinds
    .map((sourceKind) => sourceKindLabels[sourceKind])
    .join(' · ');

  return (
    <article className={styles.card}>
      <Link className={styles.cardLink} to={slug} aria-label={`阅读案例：${title}`}>
        <div className={styles.archiveLine}>
          <span className={styles.number} aria-hidden="true">
            CASE {caseNumber}
          </span>
          <span className={styles.evidence}>{evidenceLabel}</span>
        </div>
        <Heading as="h3" className={styles.title}>
          {title}
        </Heading>
        <p className={styles.subtitle}>{summary}</p>
        <ul className={styles.patterns} aria-label="涉及的架构主题">
          {migration_targets.slice(0, 3).map((migrationTarget) => (
            <li key={migrationTarget}>{migrationTarget}</li>
          ))}
        </ul>
        <span className={styles.readMore} aria-hidden="true">
          打开研究档案 <span>→</span>
        </span>
      </Link>
    </article>
  );
}
