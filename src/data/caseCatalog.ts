import generatedCatalog from '../generated/case-catalog.json' with {type: 'json'};
import generatedSeries from '../generated/case-series.json' with {type: 'json'};

export type CaseSeries = string;

export type CaseSeriesEntry = {
  id: string;
  label: string;
  description: string;
  order: number;
  show_on_homepage: boolean;
};

export type CaseDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type SourceKind =
  | 'official-docs'
  | 'open-source-project'
  | 'classic-paper'
  | 'engineering-blog'
  | 'reference-architecture';

export type CaseCatalogEntry = {
  title: string;
  slug: string;
  summary: string;
  difficulty: CaseDifficulty;
  series: CaseSeries;
  catalog_order: number;
  featured: boolean;
  source_kinds: SourceKind[];
  migration_targets: string[];
  tags: string[];
};

export type CatalogFilters = {
  series: CaseSeries | '';
  difficulty: CaseCatalogEntry['difficulty'] | '';
  sourceKind: SourceKind | '';
  migrationTarget: string;
};

const registryKeys = ['schema_version', 'series'];
const seriesEntryKeys = [
  'description',
  'id',
  'label',
  'order',
  'show_on_homepage',
];
const prototypeNames = new Set(['__proto__', 'constructor', 'prototype', 'toString']);

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

export function assertCaseSeriesRegistry(value: unknown): asserts value is {
  schema_version: 1;
  series: CaseSeriesEntry[];
} {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !hasExactKeys(value as Record<string, unknown>, registryKeys) ||
    (value as Record<string, unknown>).schema_version !== 1 ||
    !Array.isArray((value as Record<string, unknown>).series)
  ) {
    throw new Error('Generated case-series registry has an invalid exact shape.');
  }

  const entries = (value as {series: unknown[]}).series;
  const ids = new Set<string>();
  const orders = new Set<number>();

  entries.forEach((candidate, index) => {
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      Array.isArray(candidate) ||
      !hasExactKeys(candidate as Record<string, unknown>, seriesEntryKeys)
    ) {
      throw new Error(`Case-series entry ${index} has invalid exact keys.`);
    }

    const entry = candidate as Record<string, unknown>;
    if (
      typeof entry.id !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) ||
      prototypeNames.has(entry.id)
    ) {
      throw new Error(
        `Case-series entry ${index} has an invalid, non-kebab-case, or reserved id.`,
      );
    }
    if (
      typeof entry.label !== 'string' ||
      entry.label.trim() === '' ||
      typeof entry.description !== 'string' ||
      entry.description.trim() === ''
    ) {
      throw new Error(`Case-series entry ${entry.id} has blank label or description text.`);
    }
    if (!Number.isInteger(entry.order) || (entry.order as number) <= 0) {
      throw new Error(`Case-series entry ${entry.id} has an invalid order.`);
    }
    if (typeof entry.show_on_homepage !== 'boolean') {
      throw new Error(`Case-series entry ${entry.id} has an invalid homepage flag.`);
    }
    if (ids.has(entry.id)) {
      throw new Error(`Case-series registry contains duplicate id ${entry.id}.`);
    }
    if (orders.has(entry.order as number)) {
      throw new Error(`Case-series registry contains duplicate order ${entry.order}.`);
    }

    ids.add(entry.id);
    orders.add(entry.order as number);
  });
}

const importedSeries: unknown = generatedSeries;
assertCaseSeriesRegistry(importedSeries);

export const caseSeries = [...importedSeries.series].sort(
  (left, right) => left.order - right.order,
);

export const caseSeriesById = new Map(caseSeries.map((entry) => [entry.id, entry]));

export const seriesLabels = Object.fromEntries(
  caseSeries.map(({id, label}) => [id, label]),
) as Record<string, string>;

export const sourceKindLabels: Record<SourceKind, string> = {
  'official-docs': '官方文档',
  'open-source-project': '开源项目',
  'classic-paper': '经典论文',
  'engineering-blog': '工程博客',
  'reference-architecture': '参考架构',
};

const difficulties = new Set<CaseDifficulty>(['beginner', 'intermediate', 'advanced']);
const sourceKinds = new Set<SourceKind>([
  'official-docs',
  'open-source-project',
  'classic-paper',
  'engineering-blog',
  'reference-architecture',
]);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function assertCatalogEntry(value: unknown, index: number): asserts value is CaseCatalogEntry {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Catalog entry ${index} must be an object.`);
  }

  const entry = value as Record<string, unknown>;
  if (
    typeof entry.title !== 'string' ||
    typeof entry.slug !== 'string' ||
    typeof entry.summary !== 'string' ||
    typeof entry.catalog_order !== 'number' ||
    typeof entry.featured !== 'boolean' ||
    !isStringArray(entry.migration_targets) ||
    !isStringArray(entry.tags)
  ) {
    throw new Error(`Catalog entry ${index} has an invalid generated shape.`);
  }

  if (!difficulties.has(entry.difficulty as CaseDifficulty)) {
    throw new Error(`Catalog entry ${entry.slug} has an unknown difficulty.`);
  }
  if (!caseSeriesById.has(String(entry.series))) {
    throw new Error(`Catalog entry ${entry.slug} has no series label.`);
  }
  if (
    !Array.isArray(entry.source_kinds) ||
    !entry.source_kinds.every((sourceKind) => sourceKinds.has(sourceKind as SourceKind))
  ) {
    throw new Error(`Catalog entry ${entry.slug} has an unknown source kind.`);
  }
}

export function assertCaseCatalog(value: unknown): asserts value is CaseCatalogEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Generated case catalog must not be empty.');
  }

  const slugs = new Set<string>();
  const orders = new Set<number>();

  value.forEach((entry, index) => {
    assertCatalogEntry(entry, index);
    if (slugs.has(entry.slug)) {
      throw new Error(`Generated case catalog contains duplicate slug ${entry.slug}.`);
    }
    if (orders.has(entry.catalog_order)) {
      throw new Error(
        `Generated case catalog contains duplicate order ${entry.catalog_order}.`,
      );
    }
    slugs.add(entry.slug);
    orders.add(entry.catalog_order);
  });
}

const importedCatalog: unknown = generatedCatalog;
assertCaseCatalog(importedCatalog);

export const caseCatalog: readonly CaseCatalogEntry[] = importedCatalog;
export const featuredCases = caseCatalog.filter(({featured}) => featured);
export const secondCollectionCases = caseCatalog.filter(({featured}) => !featured);
