import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  buildSourceLedgerSections,
  sourceTiers,
} from '../../src/components/SourceLedger/sourceLedgerModel.ts';

export const SOURCE_LEDGER_PAGE_SIZE = 20;

function pageRoute(tier, pageNumber) {
  return pageNumber === 1
    ? `/references/${tier}`
    : `/references/${tier}/page/${pageNumber}`;
}

function validatePages(pages, canonicalSourceCount) {
  const ids = pages.flatMap(({sources}) => sources.map(({id}) => id));
  if (
    pages.length === 0 ||
    pages.some(
      ({pageNumber, pageCount, sources}) =>
        !Number.isInteger(pageNumber) ||
        !Number.isInteger(pageCount) ||
        pageNumber < 1 ||
        pageNumber > pageCount ||
        sources.length === 0 ||
        sources.length > SOURCE_LEDGER_PAGE_SIZE,
    ) ||
    ids.length !== canonicalSourceCount ||
    new Set(ids).size !== canonicalSourceCount
  ) {
    throw new Error('source ledger static page plan is incomplete or invalid');
  }
}

export function buildSourceLedgerPages(ledger) {
  const sections = buildSourceLedgerSections(ledger);
  if (
    sections.length !== sourceTiers.length ||
    sections.some((section, index) => section.tier !== sourceTiers[index])
  ) {
    throw new Error('source ledger tier plan is incomplete or out of order');
  }

  const pages = sections.flatMap((section) => {
    const pageCount = Math.ceil(
      section.sources.length / SOURCE_LEDGER_PAGE_SIZE,
    );
    if (pageCount === 0) {
      throw new Error(`source ledger tier ${section.tier} has no sources`);
    }
    const pageLinks = Array.from({length: pageCount}, (_, index) => ({
      number: index + 1,
      route: pageRoute(section.tier, index + 1),
    }));

    return pageLinks.map(({number, route}) => ({
      tier: section.tier,
      label: section.label,
      warning: section.warning,
      route,
      pageNumber: number,
      pageCount,
      previousRoute:
        number > 1 ? pageRoute(section.tier, number - 1) : null,
      nextRoute:
        number < pageCount ? pageRoute(section.tier, number + 1) : null,
      pageLinks,
      sources: section.sources.slice(
        (number - 1) * SOURCE_LEDGER_PAGE_SIZE,
        number * SOURCE_LEDGER_PAGE_SIZE,
      ),
    }));
  });

  validatePages(
    pages,
    sections.reduce((count, section) => count + section.sources.length, 0),
  );
  return pages;
}

export default function sourceLedgerPagesPlugin(context) {
  const component = fileURLToPath(
    new URL('./SourceLedgerPage.tsx', import.meta.url),
  );
  const ledgerPath = path.join(
    context.siteDir,
    'src/generated/source-ledger.json',
  );

  return {
    name: 'source-ledger-pages',

    async loadContent() {
      let ledger;
      try {
        ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
      } catch (error) {
        throw new Error(`Cannot load generated source ledger: ${error.message}`);
      }
      const pages = buildSourceLedgerPages(ledger);
      return {
        pages,
        tiers: sourceTiers.map((tier) => {
          const tierPages = pages.filter((page) => page.tier === tier);
          return {
            tier,
            label: tierPages[0].label,
            warning: tierPages[0].warning,
            count: tierPages.reduce(
              (count, page) => count + page.sources.length,
              0,
            ),
            pageCount: tierPages.length,
            route: tierPages[0].route,
          };
        }),
      };
    },

    async contentLoaded({content, actions}) {
      const pages = Array.isArray(content) ? content : content?.pages;
      if (!Array.isArray(pages)) {
        throw new Error('source ledger plugin content is missing pages');
      }
      validatePages(
        pages,
        pages.reduce((count, page) => count + page.sources.length, 0),
      );

      const tiers = Array.isArray(content) ? [] : content.tiers;
      actions.setGlobalData?.({tiers});

      for (const page of pages) {
        const dataPath = await actions.createData(
          `source-ledger-${page.tier}-${page.pageNumber}.json`,
          JSON.stringify(page),
        );
        actions.addRoute({
          path: page.route,
          component,
          exact: true,
          modules: {pageData: dataPath},
        });
      }
    },
  };
}
