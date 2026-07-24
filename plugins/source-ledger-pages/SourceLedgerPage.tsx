import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

import {
  SourceLedgerCards,
} from '../../src/components/SourceLedger/SourceLedgerCards';
import type {
  SourceLedgerCard,
  SourceTier,
} from '../../src/components/SourceLedger/sourceLedgerModel';
import styles from '../../src/components/SourceLedger/styles.module.css';

type PageLink = {
  number: number;
  route: string;
};

type SourceLedgerPageData = {
  tier: SourceTier;
  label: string;
  warning: string | null;
  route: string;
  pageNumber: number;
  pageCount: number;
  previousRoute: string | null;
  nextRoute: string | null;
  pageLinks: PageLink[];
  sources: SourceLedgerCard[];
};

export default function SourceLedgerPage({
  pageData,
}: {
  pageData: SourceLedgerPageData;
}) {
  const title = `${pageData.label} · 第 ${pageData.pageNumber} 页`;

  return (
    <Layout title={title} description={`${pageData.label}来源清单`}>
      <main className="container margin-vert--lg">
        <p>
          <Link to="/references">资料库</Link>
          {' / '}
          {pageData.label}
        </p>
        <h1>{title}</h1>
        <p>
          本页显示 {pageData.sources.length} 条来源；每条来源完整保留证据角色、
          版权边界、使用位置与已审链接状态。
        </p>
        {pageData.warning && (
          <p className={styles.warning}>{pageData.warning}</p>
        )}

        <SourceLedgerCards sources={pageData.sources} />

        <nav className={styles.pagination} aria-label="资料库分页">
          {pageData.previousRoute && (
            <Link data-noBrokenLinkCheck to={pageData.previousRoute}>
              上一页
            </Link>
          )}
          {pageData.pageLinks.map((page) =>
            page.number === pageData.pageNumber ? (
              <strong aria-current="page" key={page.number}>
                {page.number}
              </strong>
            ) : (
              <Link data-noBrokenLinkCheck key={page.number} to={page.route}>
                {page.number}
              </Link>
            ),
          )}
          {pageData.nextRoute && (
            <Link data-noBrokenLinkCheck to={pageData.nextRoute}>
              下一页
            </Link>
          )}
        </nav>
      </main>
    </Layout>
  );
}
