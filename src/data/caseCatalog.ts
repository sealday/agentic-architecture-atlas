import generatedCatalog from '../generated/case-catalog.json' with {type: 'json'};

export type CaseSeries =
  | 'ai-native'
  | 'classic-distributed'
  | 'frontend-architecture'
  | 'edge-physical';

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

export const seriesLabels: Record<CaseSeries, string> = {
  'ai-native': 'AI 原生架构',
  'classic-distributed': '经典分布式架构迁移',
  'frontend-architecture': '前端协同与组合架构',
  'edge-physical': '边缘与物理智能体',
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
  if (!((entry.series as string) in seriesLabels)) {
    throw new Error(`Catalog entry ${entry.slug} has no series label.`);
  }
  if (
    !Array.isArray(entry.source_kinds) ||
    !entry.source_kinds.every((sourceKind) => sourceKinds.has(sourceKind as SourceKind))
  ) {
    throw new Error(`Catalog entry ${entry.slug} has an unknown source kind.`);
  }
}

function assertCatalog(value: unknown): asserts value is CaseCatalogEntry[] {
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
assertCatalog(importedCatalog);

export const caseCatalog: readonly CaseCatalogEntry[] = importedCatalog;
export const featuredCases = caseCatalog.filter(({featured}) => featured);
export const secondCollectionCases = caseCatalog.filter(({featured}) => !featured);
