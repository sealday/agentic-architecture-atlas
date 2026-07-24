import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTopicManifest as buildTopicManifestCore,
  indexedTopicTypes,
} from '../scripts/topic-manifest.mjs';

const backlog = (...rows) => rows.join('\n');

const topic = (id, priority, title = id, checked = false) =>
  `- [${checked ? 'x' : ' '}] **${id} ${priority}｜${title}**。`;

const primarySources = (...entries) =>
  new Map(entries.length ? entries : [
    [
      'concepts/architecture-scale.mdx',
      ['https://example.com/architecture-scale'],
    ],
  ]);

const buildTopicManifest = (options) =>
  buildTopicManifestCore({
    primarySourcesByFile: primarySources(),
    ...options,
  });

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

const publishedKnowledge = (id, type, overrides = {}) => ({
  file: `${type}s/${id.toLowerCase()}.mdx`,
  metadata: {
    title: id,
    slug: `/${type}s/${id.toLowerCase()}`,
    content_type: type,
    status: 'reviewed',
    topic_id: id,
    priority: 'P0',
    depends_on: [],
    adjacent_topics: [],
    related_cases: [],
    related_questions: [],
    analyzed_at: '2026-07-23',
    ...overrides,
  },
});

const publishedQuestion = (id, slug) => ({
  file: `questions/${id.toLowerCase()}.mdx`,
  metadata: {
    title: id,
    slug,
    content_type: 'question',
    status: 'reviewed',
    topic_id: id,
    priority: 'P1',
    analyzed_at: '2026-07-23',
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

test('projects the canonical Pattern group without changing the Pattern slug', () => {
  const result = buildTopicManifestCore({
    backlogSource: topic('REL-02', 'P0', 'Retry'),
    documents: [],
    primarySourcesByFile: new Map(),
    patternGroupByTopicId: new Map([['REL-02', 'reliability']]),
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.manifest.topics[0].slug, '/patterns/rel-02');
  assert.equal(result.manifest.topics[0].pattern_group, 'reliability');
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
      adjacent_topics: [],
      primary_sources: ['https://example.com/architecture-scale'],
      related_cases: [],
      related_questions: [],
      reviewed_at: '2026-07-23',
      published: true,
      pattern_group: null,
      presentation: {},
    },
  ]);
});

test('validates adjacent topics and related questions without adding dependency cycles', () => {
  const documents = [
    publishedKnowledge('PR-01', 'principle', {
      adjacent_topics: ['STY-00'],
      related_cases: [],
      related_questions: ['/questions/qst-01'],
    }),
    publishedKnowledge('STY-00', 'style', {
      adjacent_topics: ['PR-01'],
      related_cases: ['/cases/openai-agents-sdk'],
      related_questions: [],
    }),
    publishedQuestion('QST-01', '/questions/qst-01'),
    {file: 'cases/openai.mdx', metadata: caseMetadata()},
  ];
  const result = buildTopicManifest({
    backlogSource: backlog(
      topic('PR-01', 'P0'),
      topic('STY-00', 'P0'),
      topic('QST-01', 'P1'),
    ),
    documents,
    primarySourcesByFile: primarySources(
      ['principles/pr-01.mdx', ['https://example.com/pr-primary']],
      ['styles/sty-00.mdx', ['https://example.com/sty-primary']],
      ['questions/qst-01.mdx', ['https://example.com/qst-primary']],
      ['cases/openai.mdx', ['https://example.com/case-primary']],
    ),
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.manifest.topics.find(({id}) => id === 'PR-01').adjacent_topics,
    ['STY-00'],
  );
  assert.deepEqual(
    result.manifest.topics.find(({id}) => id === 'PR-01').related_questions,
    ['/questions/qst-01'],
  );
});

test('rejects any override for a published topic even when values match', () => {
  const documents = [
    publishedKnowledge('PR-01', 'principle', {
      adjacent_topics: ['STY-00'],
      related_cases: ['/cases/openai-agents-sdk'],
    }),
    publishedKnowledge('STY-00', 'style', {
      adjacent_topics: ['PR-01'],
      related_cases: ['/cases/openai-agents-sdk'],
    }),
    {file: 'cases/openai.mdx', metadata: caseMetadata()},
  ];
  const result = buildTopicManifest({
    backlogSource: backlog(topic('PR-01', 'P0'), topic('STY-00', 'P0')),
    documents,
    primarySourcesByFile: primarySources(
      ['principles/pr-01.mdx', ['https://example.com/pr-primary']],
      ['styles/sty-00.mdx', ['https://example.com/sty-primary']],
      ['cases/openai.mdx', ['https://example.com/case-primary']],
    ),
    relations: {
      'PR-01': {
        dependencies: [],
        adjacent_topics: ['STY-00'],
        related_cases: ['/cases/openai-agents-sdk'],
        related_questions: [],
      },
    },
  });
  assert.match(
    result.errors.join('\n'),
    /published topic "PR-01" must define relations only in front matter/,
  );
});

test('projects all four relation fields for planned topics', () => {
  const result = buildTopicManifest({
    backlogSource: backlog(
      topic('PR-01', 'P0'),
      topic('STY-00', 'P0'),
      topic('QST-01', 'P1'),
    ),
    documents: [
      publishedQuestion('QST-01', '/questions/qst-01'),
      {file: 'cases/openai.mdx', metadata: caseMetadata()},
    ],
    primarySourcesByFile: primarySources(
      ['questions/qst-01.mdx', ['https://example.com/qst-primary']],
      ['cases/openai.mdx', ['https://example.com/case-primary']],
    ),
    relations: {
      'PR-01': {
        dependencies: ['STY-00'],
        adjacent_topics: ['STY-00'],
        related_cases: ['/cases/openai-agents-sdk'],
        related_questions: ['/questions/qst-01'],
      },
    },
  });
  const projected = result.manifest.topics.find(({id}) => id === 'PR-01');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(projected.dependencies, ['STY-00']);
  assert.deepEqual(projected.adjacent_topics, ['STY-00']);
  assert.deepEqual(projected.related_cases, ['/cases/openai-agents-sdk']);
  assert.deepEqual(projected.related_questions, ['/questions/qst-01']);
});

test('rejects invalid published adjacency and related-question targets', () => {
  const baseDocuments = [
    publishedKnowledge('PR-01', 'principle', {
      adjacent_topics: ['STY-00'],
      related_cases: ['/cases/openai-agents-sdk'],
    }),
    publishedKnowledge('STY-00', 'style', {
      adjacent_topics: [],
      related_cases: ['/cases/openai-agents-sdk'],
    }),
    {file: 'cases/openai.mdx', metadata: caseMetadata()},
  ];
  const primarySourcesByFile = primarySources(
    ['principles/pr-01.mdx', ['https://example.com/pr-primary']],
    ['styles/sty-00.mdx', ['https://example.com/sty-primary']],
    ['cases/openai.mdx', ['https://example.com/case-primary']],
  );

  const missingReverse = buildTopicManifest({
    backlogSource: backlog(topic('PR-01', 'P0'), topic('STY-00', 'P0')),
    documents: baseDocuments,
    primarySourcesByFile,
  });
  assert.match(
    missingReverse.errors.join('\n'),
    /published adjacency "PR-01" -> "STY-00" is missing reverse edge/,
  );

  const plannedTarget = buildTopicManifest({
    backlogSource: backlog(topic('PR-01', 'P0'), topic('STY-00', 'P0')),
    documents: [
      publishedKnowledge('PR-01', 'principle', {
        adjacent_topics: ['STY-00'],
        related_cases: ['/cases/openai-agents-sdk'],
      }),
      {file: 'cases/openai.mdx', metadata: caseMetadata()},
    ],
    primarySourcesByFile,
  });
  assert.match(
    plannedTarget.errors.join('\n'),
    /adjacent topic "STY-00" for "PR-01" is not a published knowledge topic/,
  );

  const wrongQuestionType = buildTopicManifest({
    backlogSource: backlog(topic('PR-01', 'P0'), topic('STY-00', 'P0')),
    documents: [
      publishedKnowledge('PR-01', 'principle', {
        adjacent_topics: ['STY-00'],
        related_cases: [],
        related_questions: ['/styles/sty-00'],
      }),
      publishedKnowledge('STY-00', 'style', {
        adjacent_topics: ['PR-01'],
        related_cases: ['/cases/openai-agents-sdk'],
      }),
      {file: 'cases/openai.mdx', metadata: caseMetadata()},
    ],
    primarySourcesByFile,
  });
  assert.match(
    wrongQuestionType.errors.join('\n'),
    /related question "\/styles\/sty-00" for "PR-01" is not a published question/,
  );
});

test('rejects a planned adjacency target that is not a knowledge topic', () => {
  const result = buildTopicManifest({
    backlogSource: backlog(topic('PR-01', 'P0'), topic('QST-01', 'P1')),
    documents: [publishedQuestion('QST-01', '/questions/qst-01')],
    primarySourcesByFile: primarySources([
      'questions/qst-01.mdx',
      ['https://example.com/qst-primary'],
    ]),
    relations: {
      'PR-01': {
        dependencies: [],
        adjacent_topics: ['QST-01'],
        related_cases: [],
        related_questions: ['/questions/qst-01'],
      },
    },
  });

  assert.match(
    result.errors.join('\n'),
    /adjacent topic "QST-01" for "PR-01" is not a knowledge topic/,
  );
});

test('projects only validated ledger sources into the manifest', () => {
  const result = buildTopicManifest({
    backlogSource: topic('FND-01', 'P0', '计划标题'),
    documents: [
      publishedConcept({
        official_sources: [
          'https://example.com/frontmatter-must-be-ignored',
        ],
      }),
    ],
    primarySourcesByFile: primarySources([
      'concepts/architecture-scale.mdx',
      ['https://example.com/validated-primary-factual'],
    ]),
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.manifest.topics[0].primary_sources,
    ['https://example.com/validated-primary-factual'],
  );

  const missing = buildTopicManifest({
    backlogSource: topic('FND-01', 'P0'),
    documents: [publishedConcept()],
    primarySourcesByFile: primarySources([
      'concepts/unrelated.mdx',
      [
        'https://example.com/secondary-comparison',
        'https://example.com/community-index',
        'https://example.com/navigation-only',
        'https://example.com/not-explicitly-primary',
      ],
    ]),
  });
  assert.match(
    missing.errors.join('\n'),
    /published topic "FND-01" must have at least one primary source/,
  );
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
    primarySourcesByFile: primarySources([
      'cases/openai-agents-sdk.mdx',
      ['https://openai.github.io/openai-agents-python/multi_agent/'],
    ]),
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
    adjacent_topics: [],
    primary_sources: [
      'https://openai.github.io/openai-agents-python/multi_agent/',
    ],
    related_cases: [],
    related_questions: [],
    reviewed_at: '2026-07-20',
    published: true,
    pattern_group: null,
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
    /published topic "FND-01" must define relations only in front matter/,
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
    documents: [publishedConcept()],
    primarySourcesByFile: primarySources([
      'concepts/architecture-scale.mdx',
      [],
    ]),
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
      documents: [publishedConcept()],
      primarySourcesByFile: primarySources([
        'concepts/architecture-scale.mdx',
        invalidSources,
      ]),
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
    primarySourcesByFile: primarySources(
      ['cases/second.mdx', ['https://example.com/second']],
      ['cases/first.mdx', ['https://example.com/first']],
    ),
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
