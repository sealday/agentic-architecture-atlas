import type {
  CaseCatalogEntry,
  CaseDifficulty,
  CaseSeries,
  CatalogFilters,
  SourceKind,
} from '../../data/caseCatalog';
// @ts-expect-error TS5097: Node's native TS loader requires the explicit .ts extension in tests.
import * as caseCatalogModule from '../../data/caseCatalog.ts';

const {caseSeries} = caseCatalogModule;

export type CaseSeriesGroup = {
  series: CaseSeries;
  cases: CaseCatalogEntry[];
};

export type CatalogFilterOptions = {
  series: CaseSeries[];
  difficulties: CaseDifficulty[];
  sourceKinds: SourceKind[];
  migrationTargets: string[];
};

const seriesOrder = caseSeries.map(({id}) => id);

function byCatalogOrder(left: CaseCatalogEntry, right: CaseCatalogEntry): number {
  return left.catalog_order - right.catalog_order;
}

export function filterCases(
  cases: readonly CaseCatalogEntry[],
  filters: CatalogFilters,
): CaseCatalogEntry[] {
  return cases
    .filter(
      (entry) =>
        (!filters.series || entry.series === filters.series) &&
        (!filters.difficulty || entry.difficulty === filters.difficulty) &&
        (!filters.sourceKind || entry.source_kinds.includes(filters.sourceKind)) &&
        (!filters.migrationTarget ||
          entry.migration_targets.includes(filters.migrationTarget)),
    )
    .sort(byCatalogOrder);
}

export function groupCasesBySeries(
  cases: readonly CaseCatalogEntry[],
): CaseSeriesGroup[] {
  return seriesOrder.flatMap((series) => {
    const seriesCases = cases.filter((entry) => entry.series === series).sort(byCatalogOrder);

    return seriesCases.length === 0 ? [] : [{series, cases: seriesCases}];
  });
}

export function collectFilterOptions(
  cases: readonly CaseCatalogEntry[],
): CatalogFilterOptions {
  const sortedCases = [...cases].sort(byCatalogOrder);
  const availableSeries = new Set(sortedCases.map(({series}) => series));

  return {
    series: seriesOrder.filter((series) => availableSeries.has(series)),
    difficulties: [...new Set(sortedCases.map(({difficulty}) => difficulty))],
    sourceKinds: [...new Set(sortedCases.flatMap(({source_kinds}) => source_kinds))],
    migrationTargets: [
      ...new Set(sortedCases.flatMap(({migration_targets}) => migration_targets)),
    ],
  };
}
