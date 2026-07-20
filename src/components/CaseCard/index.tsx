import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import type {FeaturedCase} from '@site/src/data/featuredCases';

import styles from './styles.module.css';

type CaseCardProps = {
  caseStudy: FeaturedCase;
};

export default function CaseCard({caseStudy}: CaseCardProps): ReactNode {
  const {number, title, subtitle, href, patterns, evidenceLabel} = caseStudy;

  return (
    <article className={styles.card}>
      <Link className={styles.cardLink} to={href} aria-label={`阅读案例：${title}`}>
        <div className={styles.archiveLine}>
          <span className={styles.number} aria-hidden="true">
            CASE {number}
          </span>
          <span className={styles.evidence}>{evidenceLabel}</span>
        </div>
        <Heading as="h3" className={styles.title}>
          {title}
        </Heading>
        <p className={styles.subtitle}>{subtitle}</p>
        <ul className={styles.patterns} aria-label="涉及的架构主题">
          {patterns.slice(0, 3).map((pattern) => (
            <li key={pattern}>{pattern}</li>
          ))}
        </ul>
        <span className={styles.readMore} aria-hidden="true">
          打开研究档案 <span>→</span>
        </span>
      </Link>
    </article>
  );
}
