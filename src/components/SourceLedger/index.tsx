import Link from '@docusaurus/Link';
import {usePluginData} from '@docusaurus/useGlobalData';
import sourceLedger from '@site/src/generated/source-ledger.json';
import styles from './styles.module.css';
import {
  buildSourceLedgerSections,
  type HealthStatus,
  type SourceLedgerCard,
  type SourceLedgerProps,
  type SourceTier,
} from './sourceLedgerModel';

const healthLabels: Record<HealthStatus, string> = {
  healthy: '健康',
  'auth-required': '需要登录',
  retired: '已退役',
  stale: '待复核',
};

const discoveryWarning = '选题/学习导航，不是事实证据';

type SourceLedgerPluginData = {
  tiers: {
    tier: SourceTier;
    label: string;
    warning: string | null;
    count: number;
    pageCount: number;
    route: string;
  }[];
};

export function SourceLedgerCards({sources}: {sources: SourceLedgerCard[]}) {
  return (
    <ul className={styles.grid}>
      {sources.map((source) => (
        <li key={source.id}>
          <article id={source.id}>
            <h4>
              {source.externalHref ? (
                <a href={source.externalHref}>{source.title}</a>
              ) : (
                source.title
              )}
            </h4>
            <dl>
              <dt>作者或机构</dt>
              <dd>{source.authorOrOrg}</dd>
              <dt>来源层级</dt>
              <dd>{source.tierLabel}</dd>
              <dt>来源类型</dt>
              <dd>{source.kindLabel}</dd>
              <dt>版本</dt>
              <dd>{source.version}</dd>
              <dt>核查日期</dt>
              <dd>{source.checkedAt}</dd>
              <dt>许可证</dt>
              <dd>{source.license}</dd>
              <dt>版权处理</dt>
              <dd>{source.copyrightPolicyLabel}</dd>
              <dt>可支持的证据角色</dt>
              <dd>{source.evidenceRoleLabels.join('、')}</dd>
              <dt>署名说明</dt>
              <dd>
                {source.attributionNotes.length > 0
                  ? source.attributionNotes.join('；')
                  : '当前没有文档引用'}
              </dd>
              <dt>使用边界</dt>
              <dd>{source.usageBoundary}</dd>
              <dt>使用位置</dt>
              <dd>
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
              <dd>
                <strong>{healthLabels[source.healthSummary]}</strong>
                {source.healthChecks.length > 0 && (
                  <ul className={styles.usedBy}>
                    {source.healthChecks.map((check) => (
                      <li key={check.transportLocator}>
                        {healthLabels[check.status]}；最近尝试：
                        {check.lastAttemptAt}；最近成功：
                        {check.lastSuccessAt ?? '尚无成功记录'}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </dl>
          </article>
        </li>
      ))}
    </ul>
  );
}

export default function SourceLedger(_props: SourceLedgerProps) {
  const pluginData = usePluginData(
    'source-ledger-pages',
  ) as SourceLedgerPluginData;
  const canonicalSections = buildSourceLedgerSections(sourceLedger);
  const tiers =
    pluginData?.tiers ??
    canonicalSections.map((section) => ({
      tier: section.tier,
      label: section.label,
      warning: section.warning,
      count: section.sources.length,
      pageCount: Math.ceil(section.sources.length / 20),
      route: `/references/${section.tier}`,
    }));

  return (
    <div className={styles.ledger}>
      <ul className={styles.tierGrid}>
        {tiers.map((tier) => (
          <li key={tier.tier}>
            <Link
              className={styles.tierLink}
              data-noBrokenLinkCheck
              to={tier.route}>
              <strong>{tier.label}</strong>
              <span>
                {tier.count} 条来源 · {tier.pageCount} 页
              </span>
              {tier.warning && (
                <small>
                  {tier.tier === 'discovery'
                    ? discoveryWarning
                    : tier.warning}
                </small>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
