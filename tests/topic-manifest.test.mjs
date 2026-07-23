import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTopicManifest,
  indexedTopicTypes,
} from '../scripts/topic-manifest.mjs';

const backlog = (...rows) => rows.join('\n');

const topic = (id, priority, title = id, checked = false) =>
  `- [${checked ? 'x' : ' '}] **${id} ${priority}｜${title}**。`;

const publishedConcept = (overrides = {}) => ({
  file: 'concepts/architecture-scale.mdx',
  metadata: {
    title: '架构尺度边界',
    slug: '/concepts/architecture-scale',
    content_type: 'concept',
    status: 'reviewed',
    topic_id: 'FND-01',
    priority: 'P0',
    depends_on: [],
    related_cases: [],
    official_sources: ['https://example.com/architecture-scale'],
    analyzed_at: '2026-07-23',
    ...overrides,
  },
});

const caseMetadata = (overrides = {}) => ({
  title: 'OpenAI Agents SDK',
  slug: '/cases/openai-agents-sdk',
  summary: '比较 Manager、Handoff 与代码编排。',
  content_type: 'case',
  status: 'reviewed',
  difficulty: 'intermediate',
  analyzed_at: '2026-07-20',
  official_sources: [
    'https://openai.github.io/openai-agents-python/multi_agent/',
  ],
  series: 'ai-native',
  catalog_order: 2,
  featured: true,
  source_kinds: ['official-docs', 'open-source-project'],
  migration_targets: ['control-ownership'],
  tags: ['OpenAI', 'Agents SDK'],
  ...overrides,
});

test('projects backlog status without a second writer', () => {
  const result = buildTopicManifest({
    backlogSource: backlog(
      topic('FND-01', 'P0', '尺度边界'),
      topic('QA-01', 'P0', '质量属性场景', true),
    ),
    documents: [],
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.manifest.schema_version, 1);
  assert.deepEqual(
    result.manifest.topics.map(
      ({id, status, primary_sources, reviewed_at, published}) => ({
        id,
        status,
        primary_sources,
        reviewed_at,
        published,
      }),
    ),
    [
      {
        id: 'FND-01',
        status: {
          scope: 'backlog-projection',
          value: 'pending',
          source: 'docs/content-backlog.md',
        },
        primary_sources: [],
        reviewed_at: null,
        published: false,
      },
      {
        id: 'QA-01',
        status: {
          scope: 'backlog-projection',
          value: 'complete',
          source: 'docs/content-backlog.md',
        },
        primary_sources: [],
        reviewed_at: null,
        published: false,
      },
    ],
  );
});

test('merges published knowledge content by topic id', () => {
  const result = buildTopicManifest({
    backlogSource: topic('FND-01', 'P0', '计划标题'),
    documents: [publishedConcept()],
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.manifest.topics, [
    {
      id: 'FND-01',
      type: 'concept',
      title: '架构尺度边界',
      slug: '/concepts/architecture-scale',
      priority: 'P0',
      status: {
        scope: 'backlog-projection',
        value: 'pending',
        source: 'docs/content-backlog.md',
      },
      dependencies: [],
      primary_sources: ['https://example.com/architecture-scale'],
      related_cases: [],
      reviewed_at: '2026-07-23',
      published: true,
      presentation: {},
    },
  ]);
});

test('projects legacy documents with explicit compatibility defaults', () => {
  const result = buildTopicManifest({
    backlogSource: '',
    documents: [
      {file: 'cases/openai-agents-sdk.mdx', metadata: caseMetadata()},
      {
        file: 'cases/index.mdx',
        metadata: caseMetadata({slug: '/cases', title: '案例目录'}),
      },
      {
        file: 'references/index.mdx',
        metadata: {
          ...caseMetadata({
            content_type: 'reference',
            slug: '/references',
            title: '参考资料',
          }),
        },
      },
    ],
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.manifest.topics.length, 1);
  assert.deepEqual(result.manifest.topics[0], {
    id: 'DOC-CASE-OPENAI-AGENTS-SDK',
    type: 'case',
    title: 'OpenAI Agents SDK',
    slug: '/cases/openai-agents-sdk',
    priority: null,
    status: {
      scope: 'content-lifecycle',
      value: 'reviewed',
      source: 'content/cases/openai-agents-sdk.mdx',
    },
    dependencies: [],
    primary_sources: [
      'https://openai.github.io/openai-agents-python/multi_agent/',
    ],
    related_cases: [],
    reviewed_at: '2026-07-20',
    published: true,
    presentation: {
      case_catalog: {
        title: 'OpenAI Agents SDK',
        slug: '/cases/openai-agents-sdk',
        summary: '比较 Manager、Handoff 与代码编排。',
        difficulty: 'intermediate',
        series: 'ai-native',
        catalog_order: 2,
        featured: true,
        source_kinds: ['official-docs', 'open-source-project'],
        migration_targets: ['control-ownership'],
        tags: ['OpenAI', 'Agents SDK'],
      },
    },
  });
});

test('rejects manifest identity and relation conflicts', () => {
  const source = backlog(
    topic('FND-01', 'P0'),
    topic('FND-02', 'P0'),
    topic('FND-03', 'P0'),
  );

  const duplicate = buildTopicManifest({
    backlogSource: source,
    documents: [
      publishedConcept(),
      publishedConcept({slug: '/concepts/duplicate'}),
    ],
  });
  assert.match(duplicate.errors.join('\n'), /duplicate topic_id "FND-01"/);

  const typeMismatch = buildTopicManifest({
    backlogSource: source,
    documents: [publishedConcept({content_type: 'style'})],
  });
  assert.match(
    typeMismatch.errors.join('\n'),
    /topic_id "FND-01" has type "style"; expected "concept"/,
  );

  const priorityMismatch = buildTopicManifest({
    backlogSource: source,
    documents: [publishedConcept({priority: 'P2'})],
  });
  assert.match(
    priorityMismatch.errors.join('\n'),
    /topic_id "FND-01" has priority "P2"; expected "P0"/,
  );

  const missingKey = buildTopicManifest({
    backlogSource: source,
    documents: [],
    relations: {MISSING: {dependencies: []}},
  });
  assert.match(
    missingKey.errors.join('\n'),
    /relation topic "MISSING" does not exist/,
  );

  const missingDependency = buildTopicManifest({
    backlogSource: source,
    documents: [],
    relations: {'FND-01': {dependencies: ['MISSING']}},
  });
  assert.match(
    missingDependency.errors.join('\n'),
    /dependency "MISSING" for "FND-01" does not exist/,
  );

  const unknownKey = buildTopicManifest({
    backlogSource: source,
    documents: [],
    relations: {'FND-01': {status: 'complete'}},
  });
  assert.match(
    unknownKey.errors.join('\n'),
    /relation "FND-01" has unknown key "status"/,
  );

  const selfDependency = buildTopicManifest({
    backlogSource: source,
    documents: [],
    relations: {'FND-01': {dependencies: ['FND-01']}},
  });
  assert.match(
    selfDependency.errors.join('\n'),
    /topic "FND-01" cannot depend on itself/,
  );

  const cycle = buildTopicManifest({
    backlogSource: source,
    documents: [],
    relations: {
      'FND-01': {dependencies: ['FND-02']},
      'FND-02': {dependencies: ['FND-03']},
      'FND-03': {dependencies: ['FND-01']},
    },
  });
  assert.match(
    cycle.errors.join('\n'),
    /dependency cycle FND-01 -> FND-02 -> FND-03 -> FND-01/,
  );

  const unknownCase = buildTopicManifest({
    backlogSource: source,
    documents: [],
    relations: {
      'FND-01': {related_cases: ['/cases/not-published']},
    },
  });
  assert.match(
    unknownCase.errors.join('\n'),
    /related case "\/cases\/not-published" for "FND-01" is not a published case/,
  );

  const frontMatterConflict = buildTopicManifest({
    backlogSource: source,
    documents: [
      publishedConcept({depends_on: ['FND-02'], related_cases: []}),
    ],
    relations: {
      'FND-01': {dependencies: ['FND-03'], related_cases: []},
    },
  });
  assert.match(
    frontMatterConflict.errors.join('\n'),
    /topic "FND-01" dependencies conflict with data\/topic-relations\.json/,
  );
});

test('rejects duplicate slugs with both projection sources', () => {
  const result = buildTopicManifest({
    backlogSource: backlog(
      topic('FND-01', 'P0'),
      topic('FND-02', 'P0'),
    ),
    documents: [
      publishedConcept({
        topic_id: 'FND-02',
        slug: '/concepts/fnd-01',
      }),
    ],
  });

  assert.match(
    result.errors.join('\n'),
    /duplicate slug "\/concepts\/fnd-01"/,
  );
  assert.match(
    result.errors.join('\n'),
    /topic "FND-01" \(docs\/content-backlog\.md:1\)/,
  );
  assert.match(
    result.errors.join('\n'),
    /topic "FND-02" \(content\/concepts\/architecture-scale\.mdx\)/,
  );
});

test('reports relationship failures with edge provenance', () => {
  const source = backlog(
    topic('FND-01', 'P0'),
    topic('FND-02', 'P0'),
  );

  const frontMatter = buildTopicManifest({
    backlogSource: source,
    documents: [
      publishedConcept({
        depends_on: ['FND-01', 'MISSING'],
        related_cases: ['/cases/not-published'],
      }),
    ],
  });
  assert.match(
    frontMatter.errors.join('\n'),
    /content\/concepts\/architecture-scale\.mdx: topic "FND-01" cannot depend on itself/,
  );
  assert.match(
    frontMatter.errors.join('\n'),
    /content\/concepts\/architecture-scale\.mdx: dependency "MISSING" for "FND-01" does not exist/,
  );
  assert.match(
    frontMatter.errors.join('\n'),
    /content\/concepts\/architecture-scale\.mdx: related case "\/cases\/not-published" for "FND-01" is not a published case/,
  );

  const override = buildTopicManifest({
    backlogSource: source,
    documents: [],
    relations: {
      'FND-01': {
        dependencies: ['FND-01', 'MISSING'],
        related_cases: ['/cases/not-published'],
      },
    },
  });
  assert.match(
    override.errors.join('\n'),
    /data\/topic-relations\.json: topic "FND-01" cannot depend on itself/,
  );
  assert.match(
    override.errors.join('\n'),
    /data\/topic-relations\.json: dependency "MISSING" for "FND-01" does not exist/,
  );
  assert.match(
    override.errors.join('\n'),
    /data\/topic-relations\.json: related case "\/cases\/not-published" for "FND-01" is not a published case/,
  );

  const cycle = buildTopicManifest({
    backlogSource: source,
    documents: [publishedConcept({depends_on: ['FND-02']})],
    relations: {
      'FND-02': {dependencies: ['FND-01']},
    },
  });
  const cycleErrors = cycle.errors.join('\n');
  assert.match(
    cycleErrors,
    /dependency cycle FND-01 -> FND-02 -> FND-01/,
  );
  assert.match(
    cycleErrors,
    /FND-01 -> FND-02 \(content\/concepts\/architecture-scale\.mdx\)/,
  );
  assert.match(
    cycleErrors,
    /FND-02 -> FND-01 \(data\/topic-relations\.json\)/,
  );
});

test('rejects invalid published source and review metadata', () => {
  const source = topic('FND-01', 'P0');

  const emptySources = buildTopicManifest({
    backlogSource: source,
    documents: [publishedConcept({official_sources: []})],
  });
  assert.match(
    emptySources.errors.join('\n'),
    /content\/concepts\/architecture-scale\.mdx: published topic "FND-01" must have at least one primary source/,
  );

  for (const invalidSources of [
    ['http://example.com/insecure'],
    ['/img/local-only.png'],
    [42],
  ]) {
    const invalid = buildTopicManifest({
      backlogSource: source,
      documents: [publishedConcept({official_sources: invalidSources})],
    });
    assert.match(
      invalid.errors.join('\n'),
      /content\/concepts\/architecture-scale\.mdx: published topic "FND-01" primary source .* must be an HTTPS URL/,
    );
  }

  for (const invalidDate of ['2026-02-30', '23-07-2026', 'not-a-date']) {
    const invalidReview = buildTopicManifest({
      backlogSource: source,
      documents: [publishedConcept({analyzed_at: invalidDate})],
    });
    assert.match(
      invalidReview.errors.join('\n'),
      /published topic "FND-01" has invalid reviewed_at/,
      invalidDate,
    );
  }
});

test('sorts manifest indexes deterministically', () => {
  const source = backlog(
    topic('FND-03', 'P0'),
    topic('FND-01', 'P0'),
    topic('FND-02', 'P0'),
    topic('DST-01', 'P1'),
  );
  const result = buildTopicManifest({
    backlogSource: source,
    documents: [],
    relations: {
      'FND-03': {dependencies: ['FND-02']},
      'FND-02': {dependencies: ['FND-01']},
    },
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(Object.keys(result.indexes), indexedTopicTypes);
  assert.deepEqual(
    result.manifest.topics.map(({id}) => id),
    ['FND-01', 'FND-02', 'FND-03', 'DST-01'],
  );
  assert.deepEqual(
    result.indexes.concept.map(({id}) => id),
    ['FND-01', 'FND-02', 'FND-03', 'DST-01'],
  );
  for (const type of indexedTopicTypes.slice(1)) {
    assert.deepEqual(result.indexes[type], []);
  }
});

test('derives published case catalog data from manifest projections', () => {
  const documents = [
    {
      file: 'cases/second.mdx',
      metadata: caseMetadata({
        title: 'Second',
        slug: '/cases/second',
        catalog_order: 2,
      }),
    },
    {
      file: 'cases/first.mdx',
      metadata: caseMetadata({
        title: 'First',
        slug: '/cases/first',
        catalog_order: 1,
      }),
    },
  ];
  const {manifest, errors} = buildTopicManifest({
    backlogSource: '',
    documents,
  });

  assert.deepEqual(errors, []);
  documents[0].metadata.title = 'raw documents are no longer consulted';
  const compatibilityCatalog = manifest.topics
    .filter(({type, published}) => type === 'case' && published)
    .map(({presentation}) => presentation.case_catalog)
    .sort((left, right) => left.catalog_order - right.catalog_order);

  assert.deepEqual(
    compatibilityCatalog.map(({title, catalog_order}) => ({
      title,
      catalog_order,
    })),
    [
      {title: 'First', catalog_order: 1},
      {title: 'Second', catalog_order: 2},
    ],
  );
});
