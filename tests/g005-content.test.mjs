import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  extractMarkdownBody,
  findMarkdownHeadings,
  readContentDocuments,
} from '../scripts/content-metadata.mjs';
import {extractInternalLinks} from '../scripts/content-relations.mjs';
import {knowledgeTypeContracts} from '../scripts/content-schema.mjs';
import {extractExternalLinks} from '../scripts/source-ledger.mjs';

const contentRoot = fileURLToPath(new URL('../content/', import.meta.url));
const expectedFoundations = new Map([
  [
    'FND-01',
    {
      adjacent: ['FND-02', 'FND-03'],
      file: 'concepts/fnd-01-architecture-design-scale.mdx',
      relatedCases: ['/cases/micro-frontends-single-spa'],
      slug: '/concepts/fnd-01',
    },
  ],
  [
    'FND-02',
    {
      adjacent: ['FND-01'],
      file: 'concepts/fnd-02-architecture-drivers-asr.mdx',
      relatedCases: ['/cases/aws-cell-shuffle-sharding'],
      slug: '/concepts/fnd-02',
    },
  ],
  [
    'FND-03',
    {
      adjacent: ['FND-01'],
      file: 'concepts/fnd-03-architecture-taxonomy.mdx',
      relatedCases: ['/cases/microsoft-multi-agent-reference-architecture'],
      slug: '/concepts/fnd-03',
    },
  ],
]);

const [documents, manifest, sourceLedger] = await Promise.all([
  readContentDocuments(contentRoot),
  readFile(
    new URL('../src/generated/topic-manifest.json', import.meta.url),
    'utf8',
  ).then(JSON.parse),
  readFile(new URL('../data/source-ledger.json', import.meta.url), 'utf8').then(
    JSON.parse,
  ),
]);

const documentsById = new Map(
  documents
    .filter(({metadata}) => typeof metadata.topic_id === 'string')
    .map((document) => [document.metadata.topic_id, document]),
);
const topicsById = new Map(manifest.topics.map((topic) => [topic.id, topic]));
const sourcesById = new Map(
  sourceLedger.sources.map((source) => [source.id, source]),
);
const nasaSwehbPathPattern = /\/102695632\/7\.07/iu;
const nistIr5517Pdf =
  'https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir5517.pdf';

function requiredDocument(id) {
  const document = documentsById.get(id);
  assert.ok(document, `${id} must be published`);
  return document;
}

function requiredLedgerDocument(id) {
  const expected = expectedFoundations.get(id);
  const ledgerDocument = sourceLedger.documents[`content/${expected.file}`];
  assert.ok(ledgerDocument, `${id} must have a governed document entry`);
  return ledgerDocument;
}

async function readRequiredText(file, label) {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      assert.fail(`Missing ${label}: ${file.pathname}`);
    }
    throw error;
  }
}

function sectionForHeading(body, headingText) {
  const headings = findMarkdownHeadings(body).filter(({level}) => level === 2);
  const index = headings.findIndex(({text}) => text === headingText);
  assert.notEqual(index, -1, `Missing real heading: ## ${headingText}`);
  const start = body.indexOf('\n', headings[index].offset);
  const end = headings[index + 1]?.offset ?? body.length;
  return body.slice(start === -1 ? end : start + 1, end);
}

function learningQuestions(body) {
  return sectionForHeading(body, '学习问题')
    .split(/\r?\n/)
    .filter((line) => /^ {0,3}[-*+]\s+\S/.test(line));
}

function hasDiagramOrTable(body) {
  const hasDiagram = /^ {0,3}(?:`{3,}|~{3,})mermaid\s*$/mu.test(body);
  const lines = body.split(/\r?\n/);
  const hasTable = lines.some(
    (line, index) =>
      /^\s*\|.*\|\s*$/.test(line) &&
      /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(lines[index + 1] ?? ''),
  );
  return hasDiagram || hasTable;
}

test('publishes the exact Batch 1 foundation files and metadata', () => {
  for (const [id, expected] of expectedFoundations) {
    const document = requiredDocument(id);
    assert.equal(document.file, expected.file, id);
    assert.equal(document.metadata.slug, expected.slug, id);
    assert.equal(document.metadata.content_type, 'concept', id);
    assert.equal(document.metadata.priority, 'P0', id);
  }
});

test('uses the exact concept H2 sequence on every Batch 1 page', () => {
  for (const id of expectedFoundations.keys()) {
    const actual = requiredDocument(id).headings
      .filter(({level}) => level === 2)
      .map(({text}) => `## ${text}`);
    assert.deepEqual(actual, knowledgeTypeContracts.concept, id);
  }
});

test('compares all six foundation taxonomy categories in FND-03', () => {
  const taxonomy = sectionForHeading(
    requiredDocument('FND-03').body,
    '核心机制',
  );
  const categories = taxonomy
    .split(/\r?\n/)
    .map((line) => line.match(/^\|\s*([^|]+?)\s*\|/)?.[1])
    .filter(
      (category) =>
        category &&
        category !== '类别' &&
        !/^:?-{3,}:?$/.test(category),
    );

  assert.deepEqual(categories, [
    '原则',
    '战术',
    '模式',
    '风格',
    '参考架构',
    '最佳实践',
  ]);
});

test('uses governed NASA SWEHB 7.07 evidence directly for FND-02 drivers and ASRs', () => {
  const document = requiredDocument('FND-02');
  const citation = requiredLedgerDocument('FND-02').citations.find(
    ({citation_url: url, source_id: sourceId}) =>
      sourceId === 'src-nasa-swehb-7-07' ||
      nasaSwehbPathPattern.test(url),
  );
  assert.ok(citation, 'FND-02 must govern NASA SWEHB 7.07 directly');

  const source = sourcesById.get(citation.source_id);
  assert.ok(source, `Missing governed source ${citation.source_id}`);
  assert.ok(
    source.id === 'src-nasa-swehb-7-07' ||
      nasaSwehbPathPattern.test(source.canonical_locator),
    'FND-02 NASA source must resolve to SWEHB 7.07',
  );
  assert.ok(
    extractExternalLinks(document).includes(citation.citation_url),
    'FND-02 must visibly cite NASA SWEHB 7.07',
  );
  const evidenceParagraph = document.body
    .split(/\r?\n\s*\r?\n/)
    .find((paragraph) => paragraph.includes(citation.citation_url));
  assert.match(
    evidenceParagraph ?? '',
    /(?:驱动因素|架构重要需求|ASR|drivers?)/iu,
    'FND-02 must connect NASA SWEHB 7.07 to drivers or ASRs',
  );
});

test('governs and cites the NISTIR 5517 report PDF for the FND-03 definition', () => {
  const document = requiredDocument('FND-03');
  const citation = requiredLedgerDocument('FND-03').citations.find(
    ({citation_url: url}) => url === nistIr5517Pdf,
  );
  assert.ok(citation, 'FND-03 must govern the NISTIR 5517 report PDF');

  const source = sourcesById.get(citation.source_id);
  assert.ok(source, `Missing governed source ${citation.source_id}`);
  assert.equal(source.canonical_locator, nistIr5517Pdf);
  assert.ok(
    citation.roles.includes('definition'),
    'NISTIR 5517 PDF must support the reference-architecture definition',
  );
  assert.ok(
    extractExternalLinks(document).includes(nistIr5517Pdf),
    'FND-03 must visibly cite the NISTIR 5517 report PDF',
  );
});

test('records four PASS review gates and route-specific render evidence per page', async () => {
  const reviewFile = new URL(
    '../docs/reviews/g005-batch1.md',
    import.meta.url,
  );
  const review = await readRequiredText(reviewFile, 'G005 Batch 1 review record');
  assert.doesNotMatch(
    review,
    /<!--[\s\S]*?\bPASS\b[\s\S]*?-->/iu,
    'Review PASS evidence must not be hidden in HTML comments',
  );
  assert.doesNotMatch(
    review,
    /\\(?:n|b)/u,
    'Review evidence must not contain backslash compatibility markers',
  );
  const visibleReview = review.replace(/<!--[\s\S]*?-->/gu, '');

  for (const [id, {slug}] of expectedFoundations) {
    const section = sectionForHeading(visibleReview, id);
    for (const gate of ['editorial', 'fact', 'copyright', 'render']) {
      assert.match(
        section,
        new RegExp(`(?:^|\\n)[^\\n]*${gate}[^\\n]*\\bPASS\\b`, 'iu'),
        `${id} must record ${gate} PASS`,
      );
    }
    assert.match(section, /\bdesktop\b/iu, `${id} render evidence needs desktop`);
    assert.match(section, /\bmobile\b/iu, `${id} render evidence needs mobile`);
    assert.match(
      section,
      /\/paths\/architecture-thinking\b/u,
      `${id} render evidence needs the stage-one route`,
    );
    assert.match(
      section,
      new RegExp(`${slug.replaceAll('/', '\\/')}(?:\\b|[?#])`, 'u'),
      `${id} render evidence needs ${slug}`,
    );
  }
});

test('does not retain pending language after final render PASS', async () => {
  const reviewFile = new URL(
    '../docs/reviews/g005-batch1.md',
    import.meta.url,
  );
  const review = await readRequiredText(reviewFile, 'G005 Batch 1 review record');
  const visibleReview = review.replace(/<!--[\s\S]*?-->/gu, '');

  for (const id of expectedFoundations.keys()) {
    assert.match(
      sectionForHeading(visibleReview, id),
      /(?:^|\n)[^\n]*render[^\n]*\bPASS\b/iu,
      `${id} must retain final render PASS`,
    );
  }
  assert.doesNotMatch(
    review,
    /(?:仍需|尚待|待|后续|随后)[^，。；\n]{0,40}复核|复核[^，。；\n]{0,20}(?:待完成|未完成)/u,
    'Final render PASS evidence must not retain pending review language',
  );
});

test('records the final render review revision viewports and routes', async () => {
  const reviewFile = new URL(
    '../docs/reviews/g005-batch1.md',
    import.meta.url,
  );
  const review = await readRequiredText(reviewFile, 'G005 Batch 1 review record');
  const visibleReview = review.replace(/<!--[\s\S]*?-->/gu, '');

  assert.match(
    visibleReview,
    /(?:final|最终)\s+HEAD[^0-9a-f]{0,20}\b0f6eebb\b/iu,
    'Final render evidence must identify HEAD 0f6eebb',
  );
  assert.match(visibleReview, /\bdesktop\s+1440x1000\b/iu);
  assert.match(visibleReview, /\bmobile\s+390x844\b/iu);
  assert.match(visibleReview, /\/paths\/architecture-thinking\b/u);
  assert.match(visibleReview, /\/references\/primary\b/u);
});

test('publishes the required dependency and reciprocal adjacency graph', () => {
  const expectedDependencies = new Map([
    ['FND-01', []],
    ['FND-02', ['FND-01']],
    ['FND-03', ['FND-01']],
  ]);

  for (const [id, expected] of expectedFoundations) {
    const document = requiredDocument(id);
    const topic = topicsById.get(id);
    assert.ok(topic?.published, `${id} manifest projection must be published`);
    assert.deepEqual(document.metadata.depends_on, expectedDependencies.get(id), id);
    assert.deepEqual(document.metadata.adjacent_topics, expected.adjacent, id);
    assert.deepEqual(topic.dependencies, expectedDependencies.get(id), id);
    assert.deepEqual(topic.adjacent_topics, expected.adjacent, id);
  }
});

test('renders parent path adjacent and terminal links on every Batch 1 page', () => {
  for (const [id, expected] of expectedFoundations) {
    const document = requiredDocument(id);
    const visibleLinks = new Set(extractInternalLinks(document));
    const requiredLinks = [
      '/concepts',
      '/paths/architecture-thinking',
      ...expected.adjacent.map(
        (adjacentId) => expectedFoundations.get(adjacentId).slug,
      ),
      ...expected.relatedCases,
    ];

    for (const slug of requiredLinks) {
      assert.ok(visibleLinks.has(slug), `${id} must visibly link ${slug}`);
    }

    assert.deepEqual(document.metadata.related_cases, expected.relatedCases, id);
    assert.deepEqual(topicsById.get(id)?.related_cases, expected.relatedCases, id);
  }
});

test('asks three to five learning questions on every Batch 1 page', () => {
  for (const id of expectedFoundations.keys()) {
    const questions = learningQuestions(requiredDocument(id).body);
    assert.ok(
      questions.length >= 3 && questions.length <= 5,
      `${id} must ask 3–5 learning questions, found ${questions.length}`,
    );
  }
});

test('includes an explicitly original diagram or table on every Batch 1 page', () => {
  for (const id of expectedFoundations.keys()) {
    const body = requiredDocument(id).body;
    assert.ok(hasDiagramOrTable(body), `${id} must contain a diagram or table`);
    assert.match(
      body,
      /(?:原创|本站(?:绘制|整理|定义|操作性分类)|Atlas.{0,20}分类)/iu,
      `${id} must label the visual as original or site-defined`,
    );
  }
});

test('states scale boundaries failure modes and non-use conditions explicitly', () => {
  for (const id of expectedFoundations.keys()) {
    const visibleBody = extractMarkdownBody(requiredDocument(id).source);
    assert.match(visibleBody, /边界/u, `${id} must state a boundary`);
    assert.match(
      visibleBody,
      /(?:失败|失效|故障)/u,
      `${id} must state a failure mode`,
    );
    assert.match(
      visibleBody,
      /(?:不适用|不应|不可|不要|何时不用|禁用|非使用条件)/u,
      `${id} must state a non-use condition`,
    );
  }
});

test('governs two independent visible sources and one eligible primary per page', () => {
  for (const id of expectedFoundations.keys()) {
    const document = requiredDocument(id);
    const ledgerDocument = requiredLedgerDocument(id);
    assert.ok(
      ledgerDocument.citations.length >= 2,
      `${id} must govern at least two sources`,
    );

    const visibleSources = new Set(extractExternalLinks(document));
    const governedSources = ledgerDocument.citations.map((citation) => {
      assert.ok(
        visibleSources.has(citation.citation_url),
        `${id} source must be visible: ${citation.citation_url}`,
      );
      const source = sourcesById.get(citation.source_id);
      assert.ok(source, `${id} cites unknown governed source ${citation.source_id}`);
      return {citation, source};
    });
    assert.ok(
      new Set(
        governedSources.map(({source}) =>
          source.author_or_org.trim().toLocaleLowerCase('en'),
        ),
      ).size >= 2,
      `${id} sources must have at least two independent authors or organizations`,
    );

    const eligiblePrimaryUrls = governedSources
      .filter(
        ({citation, source}) =>
          citation.manifest_primary === true &&
          ['primary', 'first-party'].includes(source.tier) &&
          source.source_kind !== 'community-index',
      )
      .map(({citation}) => citation.citation_url);
    assert.ok(
      eligiblePrimaryUrls.length >= 1,
      `${id} must have an eligible manifest-primary source`,
    );
    for (const url of eligiblePrimaryUrls) {
      assert.ok(
        topicsById.get(id)?.primary_sources.includes(url),
        `${id} manifest must project primary source ${url}`,
      );
    }
  }
});
