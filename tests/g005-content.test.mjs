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

function requiredDocument(id) {
  const document = documentsById.get(id);
  assert.ok(document, `${id} must be published`);
  return document;
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
  for (const [id, expected] of expectedFoundations) {
    const document = requiredDocument(id);
    const ledgerPath = `content/${expected.file}`;
    const ledgerDocument = sourceLedger.documents[ledgerPath];
    assert.ok(ledgerDocument, `${id} must have a governed document entry`);
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
