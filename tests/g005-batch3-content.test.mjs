import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
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
const expectedMethods = new Map([
  [
    'MTH-04',
    {
      adjacent: ['MTH-03', 'MTH-06'],
      dependsOn: ['FND-05', 'QA-01'],
      file: 'methods/mth-04-architecture-fitness-functions.mdx',
      relatedCases: ['/cases/kubernetes-reconciliation-loop'],
      slug: '/methods/mth-04',
    },
  ],
  [
    'MTH-05',
    {
      adjacent: ['MTH-06'],
      dependsOn: ['MTH-02'],
      file: 'methods/mth-05-risk-storming-premortem.mdx',
      relatedCases: ['/cases/aws-cell-shuffle-sharding'],
      slug: '/methods/mth-05',
    },
  ],
  [
    'MTH-06',
    {
      adjacent: ['MTH-04', 'MTH-05', 'FND-05'],
      dependsOn: ['MTH-01', 'MTH-02', 'MTH-03', 'MTH-04'],
      file: 'methods/mth-06-requirements-to-evolution-loop.mdx',
      relatedCases: ['/cases/microsoft-multi-agent-reference-architecture'],
      slug: '/methods/mth-06',
    },
  ],
]);
const reciprocalTopics = new Map([
  [
    'FND-05',
    {
      adjacent: ['MTH-03', 'MTH-06'],
      file: 'concepts/fnd-05-architecture-debt-evolutionary-design.mdx',
      visible: ['/methods/mth-03', '/methods/mth-06'],
    },
  ],
  [
    'MTH-03',
    {
      adjacent: ['FND-05', 'MTH-04', 'QA-01'],
      file: 'methods/mth-03-adr-lifecycle.mdx',
      visible: ['/concepts/fnd-05', '/methods/mth-04', '/quality-attributes/qa-01'],
    },
  ],
]);
const immutableFiles = new Map([
  [
    'content/cases/aws-cell-shuffle-sharding.mdx',
    '08058bccf763997595492cf083ba81f93081b375307325e716f47d45156080bb',
  ],
  [
    'content/cases/kubernetes-reconciliation-loop.mdx',
    '1d7a0e87b0858db7fc4397cca6c30d6f8ea89f721ce2149897015ca19947e5c4',
  ],
  [
    'content/cases/microsoft-multi-agent-reference-architecture.mdx',
    '18d67491848b193eddffd2f056b0126a8a6f89f9d715d5e5cbfb2583322e43aa',
  ],
  [
    'content/quality-attributes/qa-01-scenario-writing.mdx',
    'd95a8299ed2b25e51007c0f0970b2d95698051e079e146da36c1c77d4612df2b',
  ],
  [
    'scripts/content-schema.mjs',
    '10aa4b2e17a59b57a2bfe5c13edc9abe38156a1ce26db04bbf15dd506240e8cf',
  ],
  [
    'sidebars.ts',
    'd3a60c5e67a717544a2993953b66a9665befa348827d001a71a376cacf95382c',
  ],
]);

const [documents, manifest, sourceLedger, topicRelations] = await Promise.all([
  readContentDocuments(contentRoot),
  readFile(
    new URL('../src/generated/topic-manifest.json', import.meta.url),
    'utf8',
  ).then(JSON.parse),
  readFile(new URL('../data/source-ledger.json', import.meta.url), 'utf8').then(
    JSON.parse,
  ),
  readFile(new URL('../data/topic-relations.json', import.meta.url), 'utf8').then(
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
const slugsById = new Map(
  manifest.topics.map((topic) => [topic.id, topic.slug]),
);

function requiredDocument(id) {
  const document = documentsById.get(id);
  assert.ok(document, `${id} must be published`);
  return document;
}

function requiredLedgerDocument(id) {
  const expected = expectedMethods.get(id);
  const governed = sourceLedger.documents[`content/${expected.file}`];
  assert.ok(governed, `${id} must have a governed document entry`);
  return governed;
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

test('publishes the exact Batch 3 method files metadata and relations', () => {
  for (const [id, expected] of expectedMethods) {
    const document = requiredDocument(id);
    const topic = topicsById.get(id);
    assert.equal(document.file, expected.file, id);
    assert.equal(document.metadata.slug, expected.slug, id);
    assert.equal(document.metadata.content_type, 'method', id);
    assert.equal(document.metadata.priority, 'P1', id);
    assert.equal(document.metadata.status, 'reviewed', id);
    assert.equal(document.metadata.analyzed_at, '2026-07-24', id);
    assert.equal(document.metadata.source_cutoff, '2026-07-24', id);
    assert.equal(
      document.metadata.review_policy,
      'quarterly-version-sensitive',
      id,
    );
    assert.deepEqual(document.metadata.depends_on, expected.dependsOn, id);
    assert.deepEqual(document.metadata.adjacent_topics, expected.adjacent, id);
    assert.deepEqual(document.metadata.related_cases, expected.relatedCases, id);

    assert.ok(topic?.published, `${id} manifest must be published`);
    assert.equal(topic.slug, expected.slug, id);
    assert.equal(topic.type, 'method', id);
    assert.equal(topic.priority, 'P1', id);
    assert.equal(topic.reviewed_at, '2026-07-24', id);
    assert.equal(topic.review_policy, 'quarterly-version-sensitive', id);
    assert.deepEqual(topic.dependencies, expected.dependsOn, id);
    assert.deepEqual(topic.adjacent_topics, expected.adjacent, id);
    assert.deepEqual(topic.related_cases, expected.relatedCases, id);
  }
});

test('uses all nine canonical method H2 headings on every Batch 3 page', () => {
  assert.equal(knowledgeTypeContracts.method.length, 9);
  for (const id of expectedMethods.keys()) {
    const actual = requiredDocument(id).headings
      .filter(({level}) => level === 2)
      .map(({text}) => `## ${text}`);
    assert.deepEqual(actual, knowledgeTypeContracts.method, id);
  }
});

test('provides questions original visuals exercises failures and bounded non-use', () => {
  for (const id of expectedMethods.keys()) {
    const body = requiredDocument(id).body;
    const questions = learningQuestions(body);
    assert.ok(
      questions.length >= 3 && questions.length <= 5,
      `${id} must ask 3–5 learning questions`,
    );
    assert.ok(hasDiagramOrTable(body), `${id} must contain a diagram or table`);
    assert.match(
      body,
      /(?:原创|本站(?:绘制|整理|定义)|Atlas synthesis)/iu,
      `${id} must label its visual as original`,
    );
    assert.match(
      sectionForHeading(body, '常见失败'),
      /(?:失败|失效|误用|故障)/u,
      `${id} must explain a failure`,
    );
    assert.match(
      body,
      /(?:不适用|不应|不可|不要|何时不用|禁用|非使用条件)/u,
      `${id} must state a non-use condition`,
    );
    const exercise = sectionForHeading(body, '完整演练');
    assert.ok(exercise.trim().length >= 200, `${id} exercise is too short`);
    assert.match(exercise, /\d/u, `${id} exercise must use a numeric example`);
    assert.match(
      exercise,
      /(?:假设|说明性数值|示例数值|虚构)/u,
      `${id} numeric exercise must be labelled hypothetical`,
    );
  }
});

test('renders parent path reciprocal adjacency and terminal case links', () => {
  for (const [id, expected] of expectedMethods) {
    const visible = new Set(extractInternalLinks(requiredDocument(id)));
    for (const slug of [
      '/methods',
      '/paths/architecture-thinking',
      ...expected.adjacent.map((adjacentId) => slugsById.get(adjacentId)),
      ...expected.relatedCases,
    ]) {
      assert.ok(visible.has(slug), `${id} must visibly link ${slug}`);
    }
  }

  for (const [id, expected] of reciprocalTopics) {
    const document = requiredDocument(id);
    assert.equal(document.file, expected.file, id);
    assert.deepEqual(document.metadata.adjacent_topics, expected.adjacent, id);
    assert.deepEqual(topicsById.get(id)?.adjacent_topics, expected.adjacent, id);
    const visible = new Set(extractInternalLinks(document));
    for (const slug of expected.visible) {
      assert.ok(visible.has(slug), `${id} must visibly link ${slug}`);
    }
  }
});

test('distinguishes fitness tests metrics and monitors from SLOs and release gates', () => {
  const body = extractMarkdownBody(requiredDocument('MTH-04').source);
  for (const term of ['test', 'metric', 'monitor', 'SLO', 'release gate']) {
    assert.match(body, new RegExp(term, 'iu'), `MTH-04 must explain ${term}`);
  }
  assert.match(
    body,
    /(?:不是|不等于|不能替代|并非).{0,36}SLO|SLO.{0,36}(?:不是|不等于|不能替代|并非)/isu,
  );
  assert.match(
    body,
    /(?:不是|不等于|不能替代|并非).{0,36}release gate|release gate.{0,36}(?:不是|不等于|不能替代|并非)/isu,
  );
});

test('compares five risk methods across all six decision dimensions', () => {
  const body = requiredDocument('MTH-05').body;
  const lines = body.split(/\r?\n/);
  const headerIndex = lines.findIndex(
    (line) =>
      /^\s*\|.*\|\s*$/.test(line) &&
      ['对象', '时机', '参与者', '产物', '故障', '非使用'].every((term) =>
        line.includes(term),
      ),
  );
  assert.notEqual(headerIndex, -1, 'MTH-05 must provide the six-column matrix');
  const tableEnd = lines.findIndex(
    (line, index) =>
      index > headerIndex && !/^\s*\|.*\|\s*$/.test(line),
  );
  const tableLines = lines.slice(
    headerIndex,
    tableEnd === -1 ? lines.length : tableEnd,
  );
  assert.equal(tableLines.length - 2, 5, 'MTH-05 matrix must compare five methods');
});

test('marks exactly three Atlas synthesis points and preserves feedback ordering', () => {
  const body = extractMarkdownBody(requiredDocument('MTH-06').source);
  assert.equal(
    body.match(/Atlas synthesis/giu)?.length ?? 0,
    3,
    'MTH-06 must label exactly three Atlas synthesis points',
  );
  assert.match(body, /反馈/u);
  assert.match(body, /可变序|顺序.{0,20}(?:可变|调整)|(?:可变|调整).{0,20}顺序/su);
});

test('links the learning path to MTH-06 while retaining the QA-00 gap', async () => {
  const pathSource = await readFile(
    new URL('../content/paths/01-architecture-thinking.mdx', import.meta.url),
    'utf8',
  );
  const pathDocument = {
    body: extractMarkdownBody(pathSource),
    file: 'paths/01-architecture-thinking.mdx',
  };
  assert.ok(extractInternalLinks(pathDocument).includes('/methods/mth-06'));
  assert.match(extractMarkdownBody(pathSource), /\bQA-00\b/u);
});

test('removes the published MTH-06 relation override', () => {
  assert.equal('MTH-06' in topicRelations, false);
});

test('governs two visible independent domains and an eligible primary per page', () => {
  for (const id of expectedMethods.keys()) {
    const document = requiredDocument(id);
    const governed = requiredLedgerDocument(id);
    assert.ok(governed.citations.length >= 2, `${id} needs two citations`);
    const visible = new Set(extractExternalLinks(document));
    const citations = governed.citations.map((citation) => {
      assert.ok(visible.has(citation.citation_url), `${id} citation must be visible`);
      const source = sourcesById.get(citation.source_id);
      assert.ok(source, `${id} cites unknown source ${citation.source_id}`);
      return {citation, source};
    });
    assert.ok(
      new Set(citations.map(({citation}) => new URL(citation.citation_url).hostname))
        .size >= 2,
      `${id} must cite at least two independent domains`,
    );
    const primaryUrls = citations
      .filter(
        ({citation, source}) =>
          citation.manifest_primary === true &&
          ['primary', 'first-party'].includes(source.tier) &&
          source.source_kind !== 'community-index',
      )
      .map(({citation}) => citation.citation_url);
    assert.ok(primaryUrls.length >= 1, `${id} needs an eligible primary`);
    for (const url of primaryUrls) {
      assert.ok(topicsById.get(id)?.primary_sources.includes(url), id);
    }
  }
});

test('preserves cases QA-01 the knowledge schema and sidebar', async () => {
  for (const [file, expectedHash] of immutableFiles) {
    const bytes = await readFile(new URL(`../${file}`, import.meta.url));
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    assert.equal(actualHash, expectedHash, file);
  }
});
