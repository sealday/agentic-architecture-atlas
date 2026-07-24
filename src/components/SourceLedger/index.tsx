import Link from '@docusaurus/Link';
import {usePluginData} from '@docusaurus/useGlobalData';
import styles from './styles.module.css';
import {
  type SourceLedgerProps,
  type SourceTier,
} from './sourceLedgerModel';

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

export default function SourceLedger(_props: SourceLedgerProps) {
  const {tiers} = usePluginData(
    'source-ledger-pages',
  ) as SourceLedgerPluginData;

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
