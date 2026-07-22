import {useMemo, useRef, useState, type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';

import {
  caseCatalog,
  seriesLabels,
  type CatalogFilters,
  type CaseDifficulty,
  type SourceKind,
} from '../../data/caseCatalog';
import {
  collectFilterOptions,
  filterCases,
  groupCasesBySeries,
} from './filterCases';
import styles from './styles.module.css';

const difficultyLabels: Record<CaseDifficulty, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高级',
};

const sourceKindLabels: Record<SourceKind, string> = {
  'official-docs': '官方文档',
  'open-source-project': '开源项目',
  'classic-paper': '经典论文',
  'engineering-blog': '工程博客',
  'reference-architecture': '参考架构',
};

const emptyFilters: CatalogFilters = {
  series: '',
  difficulty: '',
  sourceKind: '',
  migrationTarget: '',
};

export default function CaseCatalog(): ReactNode {
  const [filters, setFilters] = useState<CatalogFilters>(emptyFilters);
  const seriesSelectRef = useRef<HTMLSelectElement>(null);
  const filterOptions = useMemo(() => collectFilterOptions(caseCatalog), []);
  const filteredCases = useMemo(() => filterCases(caseCatalog, filters), [filters]);
  const groupedCases = useMemo(
    () => groupCasesBySeries(filteredCases),
    [filteredCases],
  );

  function clearFilters(): void {
    setFilters(emptyFilters);
    seriesSelectRef.current?.focus();
  }

  return (
    <section className={styles.catalog} aria-label="案例目录">
      <div className={styles.filters}>
        <div className={styles.filterGrid}>
          <div className={styles.filterField}>
            <label htmlFor="case-series">系列</label>
            <select
              id="case-series"
              ref={seriesSelectRef}
              value={filters.series}
              aria-controls="case-catalog-results"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  series: event.target.value as CatalogFilters['series'],
                }))
              }>
              <option value="">全部系列</option>
              {filterOptions.series.map((series) => (
                <option key={series} value={series}>
                  {seriesLabels[series]}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterField}>
            <label htmlFor="case-difficulty">阅读难度</label>
            <select
              id="case-difficulty"
              value={filters.difficulty}
              aria-controls="case-catalog-results"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  difficulty: event.target.value as CatalogFilters['difficulty'],
                }))
              }>
              <option value="">全部难度</option>
              {filterOptions.difficulties.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {difficultyLabels[difficulty]}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterField}>
            <label htmlFor="case-source-kind">来源类型</label>
            <select
              id="case-source-kind"
              value={filters.sourceKind}
              aria-controls="case-catalog-results"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  sourceKind: event.target.value as CatalogFilters['sourceKind'],
                }))
              }>
              <option value="">全部来源</option>
              {filterOptions.sourceKinds.map((sourceKind) => (
                <option key={sourceKind} value={sourceKind}>
                  {sourceKindLabels[sourceKind]}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterField}>
            <label htmlFor="case-migration-target">迁移目标</label>
            <select
              id="case-migration-target"
              value={filters.migrationTarget}
              aria-controls="case-catalog-results"
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  migrationTarget: event.target.value,
                }))
              }>
              <option value="">全部迁移目标</option>
              {filterOptions.migrationTargets.map((migrationTarget) => (
                <option key={migrationTarget} value={migrationTarget}>
                  {migrationTarget}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div
        id="case-catalog-results"
        className={styles.results}
        aria-live="polite">
        {groupedCases.length === 0 ? (
          <div className={styles.emptyState}>
            <p>没有匹配这些条件的案例。</p>
            <button type="button" className={styles.clearButton} onClick={clearFilters}>
              清除筛选
            </button>
          </div>
        ) : (
          <>
            <div className={styles.resultsHeader}>
              <p>共 {filteredCases.length} 个案例</p>
              <button type="button" className={styles.clearButton} onClick={clearFilters}>
                清除筛选
              </button>
            </div>

            {groupedCases.map((group) => (
              <section key={group.series} className={styles.seriesGroup}>
                <div className={styles.seriesHeading}>
                  <Heading as="h3">{seriesLabels[group.series]}</Heading>
                  <span>{group.cases.length} 个案例</span>
                </div>

                <ul className={styles.caseList}>
                  {group.cases.map((caseStudy) => (
                    <li key={caseStudy.slug}>
                      <article className={styles.caseCard}>
                        <Heading as="h4" className={styles.caseTitle}>
                          <Link to={caseStudy.slug}>{caseStudy.title}</Link>
                        </Heading>
                        <p className={styles.summary}>{caseStudy.summary}</p>

                        <dl className={styles.metadata}>
                          <div>
                            <dt>难度</dt>
                            <dd>
                              <span className={styles.tag}>
                                {difficultyLabels[caseStudy.difficulty]}
                              </span>
                            </dd>
                          </div>
                          <div>
                            <dt>来源</dt>
                            <dd>
                              <ul className={styles.tags}>
                                {caseStudy.source_kinds.map((sourceKind) => (
                                  <li key={sourceKind}>{sourceKindLabels[sourceKind]}</li>
                                ))}
                              </ul>
                            </dd>
                          </div>
                          <div>
                            <dt>迁移目标</dt>
                            <dd>
                              <ul className={styles.tags}>
                                {caseStudy.migration_targets.map((migrationTarget) => (
                                  <li key={migrationTarget}>{migrationTarget}</li>
                                ))}
                              </ul>
                            </dd>
                          </div>
                        </dl>
                      </article>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
