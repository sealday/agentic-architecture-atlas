import Link from '@docusaurus/Link';
import sourceLedger from '@site/src/generated/source-ledger.json';
import styles from './styles.module.css';
import {
  buildSourceLedgerSections,
  type SourceLedgerProps,
} from './sourceLedgerModel';

export default function SourceLedger({tier}: SourceLedgerProps) {
  const sections = buildSourceLedgerSections(sourceLedger, tier);

  return (
    <div className={styles.ledger}>
      {sections.map((section) => {
        const headingId = `source-ledger-${section.tier}`;

        return (
          <section
            className={styles.section}
            data-source-tier-section={section.tier}
            aria-labelledby={headingId}
            key={section.tier}>
            <h3 id={headingId}>{section.label}</h3>
            {section.warning && (
              <p className={styles.warning}>选题/学习导航，不是事实证据</p>
            )}
            <ul className={styles.grid}>
              {section.sources.map((source) => (
                <li key={source.id}>
                  <article
                    className={styles.card}
                    data-source-id={source.id}
                    data-source-tier={source.tier}
                    data-source-kind={source.sourceKind}>
                    <h4>
                      {source.externalHref ? (
                        <a href={source.externalHref}>{source.title}</a>
                      ) : (
                        source.title
                      )}
                    </h4>
                    <dl className={styles.metadata}>
                      <dt>作者或机构</dt>
                      <dd data-source-field="author">{source.authorOrOrg}</dd>
                      <dt>来源层级</dt>
                      <dd data-source-field="tier">{source.tierLabel}</dd>
                      <dt>来源类型</dt>
                      <dd data-source-field="kind">{source.kindLabel}</dd>
                      <dt>版本</dt>
                      <dd data-source-field="version">{source.version}</dd>
                      <dt>核查日期</dt>
                      <dd data-source-field="checked-at">{source.checkedAt}</dd>
                      <dt>许可证</dt>
                      <dd data-source-field="license">{source.license}</dd>
                      <dt>版权处理</dt>
                      <dd data-source-field="copyright-policy">
                        {source.copyrightPolicyLabel}
                      </dd>
                      <dt>可支持的证据角色</dt>
                      <dd data-source-field="evidence-roles">
                        {source.evidenceRoleLabels.join('、')}
                      </dd>
                      <dt>署名说明</dt>
                      <dd data-source-field="attribution">
                        {source.attributionNotes.length > 0
                          ? source.attributionNotes.join('；')
                          : '当前没有文档引用'}
                      </dd>
                      <dt>使用边界</dt>
                      <dd data-source-field="usage-boundary">
                        {source.usageBoundary}
                      </dd>
                      <dt>使用位置</dt>
                      <dd data-source-field="used-by">
                        {source.usedBy.length > 0 ? (
                          <ul className={styles.usedBy}>
                            {source.usedBy.map((document) => (
                              <li key={document.slug}>
                                <Link to={document.slug}>{document.title}</Link>
                                <span>（文档复核：{document.reviewedAt}）</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          '当前没有文档引用'
                        )}
                      </dd>
                      <dt>链接状态</dt>
                      <dd data-source-field="health">Task 6 接入后显示</dd>
                    </dl>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
