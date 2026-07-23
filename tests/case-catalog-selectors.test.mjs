import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertCaseCatalog,
  caseCatalog,
  featuredCases,
  secondCollectionCases,
  seriesLabels,
  sourceKindLabels,
} from '../src/data/caseCatalog.ts';
import {
  collectFilterOptions,
  filterCases,
  groupCasesBySeries,
} from '../src/components/CaseCatalog/filterCases.ts';

const seriesCounts = {
  'ai-native': 5,
  'classic-distributed': 5,
  'frontend-architecture': 2,
  'edge-physical': 3,
};

const seriesStart = {
  'ai-native': 1,
  'classic-distributed': 6,
  'frontend-architecture': 11,
  'edge-physical': 13,
};

const difficulties = ['beginner', 'intermediate', 'advanced'];
const sourceKinds = [
  'official-docs',
  'open-source-project',
  'classic-paper',
  'engineering-blog',
  'reference-architecture',
];

function fixtureEntry(series, offset) {
  const order = seriesStart[series] + offset;

  return {
    title: `Case ${order}`,
    slug: `/cases/case-${order}`,
    summary: `Summary ${order}`,
    difficulty: difficulties[(order - 1) % difficulties.length],
    series,
    catalog_order: order,
    featured: series === 'ai-native',
    source_kinds: [sourceKinds[(order - 1) % sourceKinds.length]],
    migration_targets: [`target-${order}`],
    tags: [`tag-${order}`],
  };
}

const fixture = Object.entries(seriesCounts).flatMap(([series, count]) =>
  Array.from({length: count}, (_, offset) => fixtureEntry(series, offset)),
);

fixture[5].migration_targets = ['target-6', 'shared-migration'];
fixture[14].migration_targets = ['target-15', 'shared-migration'];
fixture[14].source_kinds = ['reference-architecture', 'classic-paper'];

const noFilters = {
  series: '',
  difficulty: '',
  sourceKind: '',
  migrationTarget: '',
};

test('derives the current featured and second-collection views from generated data', () => {
  assert.equal(caseCatalog.length, 18);
  assert.equal(featuredCases.length, 5);
  assert.deepEqual(
    featuredCases.map(({catalog_order}) => catalog_order),
    [1, 2, 3, 4, 5],
  );
  assert.equal(secondCollectionCases.length, 13);
  assert.deepEqual(
    secondCollectionCases.map(({catalog_order}) => catalog_order),
    [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
  );
  assert.deepEqual(
    groupCasesBySeries(caseCatalog).map(({series, cases}) => [series, cases.length]),
    [
      ['ai-native', 8],
      ['classic-distributed', 5],
      ['frontend-architecture', 2],
      ['edge-physical', 3],
    ],
  );
  assert.ok(featuredCases.every((entry) => caseCatalog.includes(entry)));
  assert.deepEqual(
    Object.keys(seriesLabels),
    ['ai-native', 'classic-distributed', 'frontend-architecture', 'edge-physical'],
  );
});

test('provides the shared Chinese source-kind labels for catalog consumers', () => {
  assert.deepEqual(sourceKindLabels, {
    'official-docs': '官方文档',
    'open-source-project': '开源项目',
    'classic-paper': '经典论文',
    'engineering-blog': '工程博客',
    'reference-architecture': '参考架构',
  });
});

test('rejects prototype-inherited names as generated catalog series', () => {
  for (const series of ['constructor', 'toString', '__proto__']) {
    assert.throws(
      () => assertCaseCatalog([{...fixture[0], series}]),
      /has no series label/,
      series,
    );
  }
});

test('groups a complete fixture in fixed series order and omits empty groups', () => {
  assert.equal(new Set(fixture.map(({slug}) => slug)).size, 15);
  assert.equal(new Set(fixture.map(({catalog_order}) => catalog_order)).size, 15);

  const secondCollection = fixture.filter(({featured}) => !featured);
  const secondCollectionGroups = groupCasesBySeries(secondCollection);
  assert.equal(secondCollection.length, 10);
  assert.deepEqual(
    secondCollectionGroups.map(({series, cases}) => [series, cases.length]),
    [
      ['classic-distributed', 5],
      ['frontend-architecture', 2],
      ['edge-physical', 3],
    ],
  );
  assert.equal(
    secondCollectionGroups.some(({series}) => series === 'ai-native'),
    false,
  );
});

test('filters independently by series', () => {
  assert.deepEqual(
    filterCases(fixture, {...noFilters, series: 'frontend-architecture'}).map(
      ({catalog_order}) => catalog_order,
    ),
    [11, 12],
  );
});

test('filters independently by difficulty', () => {
  assert.deepEqual(
    filterCases(fixture, {...noFilters, difficulty: 'beginner'}).map(
      ({catalog_order}) => catalog_order,
    ),
    [1, 4, 7, 10, 13],
  );
});

test('filters independently by source kind', () => {
  assert.deepEqual(
    filterCases(fixture, {...noFilters, sourceKind: 'classic-paper'}).map(
      ({catalog_order}) => catalog_order,
    ),
    [3, 8, 13, 15],
  );
});

test('matches a selected migration target against any target on a case', () => {
  assert.deepEqual(
    filterCases(fixture, {...noFilters, migrationTarget: 'shared-migration'}).map(
      ({catalog_order}) => catalog_order,
    ),
    [6, 15],
  );
});

test('intersects all selected filter dimensions', () => {
  assert.deepEqual(
    filterCases(fixture, {
      series: 'edge-physical',
      difficulty: 'advanced',
      sourceKind: 'classic-paper',
      migrationTarget: 'shared-migration',
    }).map(({catalog_order}) => catalog_order),
    [15],
  );
});

test('sorts results by catalog order without mutating the input', () => {
  const reversed = [...fixture].reverse();

  assert.deepEqual(
    filterCases(reversed, noFilters).map(({catalog_order}) => catalog_order),
    Array.from({length: 15}, (_, index) => index + 1),
  );
  assert.equal(reversed[0].catalog_order, 15);
});

test('returns an empty result when no case satisfies every dimension', () => {
  assert.deepEqual(
    filterCases(fixture, {
      ...noFilters,
      series: 'frontend-architecture',
      migrationTarget: 'shared-migration',
    }),
    [],
  );
});

test('collects stable unique options from cases in catalog order', () => {
  assert.deepEqual(collectFilterOptions([...fixture].reverse()), {
    series: [
      'ai-native',
      'classic-distributed',
      'frontend-architecture',
      'edge-physical',
    ],
    difficulties: ['beginner', 'intermediate', 'advanced'],
    sourceKinds: [
      'official-docs',
      'open-source-project',
      'classic-paper',
      'engineering-blog',
      'reference-architecture',
    ],
    migrationTargets: [
      'target-1',
      'target-2',
      'target-3',
      'target-4',
      'target-5',
      'target-6',
      'shared-migration',
      'target-7',
      'target-8',
      'target-9',
      'target-10',
      'target-11',
      'target-12',
      'target-13',
      'target-14',
      'target-15',
    ],
  });
});
