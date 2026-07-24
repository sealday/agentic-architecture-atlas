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
const expectedTopics = new Map([
  [
    'FND-04',
    {
      adjacent: ['FND-02', 'MTH-02'],
      contentType: 'concept',
      dependsOn: ['FND-02'],
      file: 'concepts/fnd-04-tradeoffs-sensitivity-risk.mdx',
      parent: '/concepts',
      priority: 'P0',
      relatedCases: ['/cases/aws-cell-shuffle-sharding'],
      slug: '/concepts/fnd-04',
    },
  ],
  [
    'FND-05',
    {
      adjacent: ['MTH-03'],
      contentType: 'concept',
      dependsOn: ['FND-04'],
      file: 'concepts/fnd-05-architecture-debt-evolutionary-design.mdx',
      parent: '/concepts',
      priority: 'P1',
      relatedCases: ['/cases/kubernetes-reconciliation-loop'],
      slug: '/concepts/fnd-05',
    },
  ],
  [
    'MTH-01',
    {
      adjacent: ['FND-02', 'MTH-02'],
      contentType: 'method',
      dependsOn: ['QA-01'],
      file: 'methods/mth-01-quality-attribute-workshop.mdx',
      parent: '/methods',
      priority: 'P0',
      relatedCases: ['/cases/microsoft-multi-agent-reference-architecture'],
      slug: '/methods/mth-01',
    },
  ],
  [
    'MTH-02',
    {
      adjacent: ['FND-04', 'MTH-01'],
      contentType: 'method',
      dependsOn: ['QA-01'],
      file: 'methods/mth-02-architecture-tradeoff-analysis-method.mdx',
      parent: '/methods',
      priority: 'P0',
      relatedCases: ['/cases/aws-cell-shuffle-sharding'],
      slug: '/methods/mth-02',
    },
  ],
  [
    'MTH-03',
    {
      adjacent: ['FND-05', 'QA-01'],
      contentType: 'method',
      dependsOn: ['QA-01'],
      file: 'methods/mth-03-adr-lifecycle.mdx',
      parent: '/methods',
      priority: 'P0',
      relatedCases: ['/cases/kubernetes-reconciliation-loop'],
      slug: '/methods/mth-03',
    },
  ],
]);
const batch2Ids = ['FND-04', 'FND-05', 'MTH-01', 'MTH-02'];
const pathSlug = '/paths/architecture-thinking';
const requiredPrimarySourceIds = new Map([
  ['MTH-01', 'src-sei-0547756e19ba'],
  ['MTH-02', 'src-sei-atam-1998'],
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
for (const [id, expected] of expectedTopics) {
  slugsById.set(id, expected.slug);
}

function requiredDocument(id) {
  const document = documentsById.get(id);
  assert.ok(document, `${id} must be published`);
  return document;
}

function requiredLedgerDocument(id) {
  const expected = expectedTopics.get(id);
  const ledgerDocument = sourceLedger.documents[`content/${expected.file}`];
  assert.ok(ledgerDocument, `${id} must have a governed document entry`);
  return ledgerDocument;
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

test('publishes the exact Batch 2 files slugs types priorities and relations', () => {
  for (const [id, expected] of expectedTopics) {
    const document = requiredDocument(id);
    const topic = topicsById.get(id);

    assert.equal(document.file, expected.file, id);
    assert.equal(document.metadata.slug, expected.slug, id);
    assert.equal(document.metadata.content_type, expected.contentType, id);
    assert.equal(document.metadata.priority, expected.priority, id);
    assert.deepEqual(document.metadata.depends_on, expected.dependsOn, id);
    assert.deepEqual(document.metadata.adjacent_topics, expected.adjacent, id);
    assert.deepEqual(document.metadata.related_cases, expected.relatedCases, id);

    assert.ok(topic?.published, `${id} manifest projection must be published`);
    assert.equal(topic.slug, expected.slug, id);
    assert.equal(topic.type, expected.contentType, id);
    assert.equal(topic.priority, expected.priority, id);
    assert.deepEqual(topic.dependencies, expected.dependsOn, id);
    assert.deepEqual(topic.adjacent_topics, expected.adjacent, id);
    assert.deepEqual(topic.related_cases, expected.relatedCases, id);
  }
});

test('uses the exact H2 sequence for each Batch 2 content type', () => {
  for (const [id, expected] of expectedTopics) {
    const actual = requiredDocument(id).headings
      .filter(({level}) => level === 2)
      .map(({text}) => `## ${text}`);
    assert.deepEqual(actual, knowledgeTypeContracts[expected.contentType], id);
  }
});

test('asks three to five learning questions on every new Batch 2 page', () => {
  for (const id of batch2Ids) {
    const questions = learningQuestions(requiredDocument(id).body);
    assert.ok(
      questions.length >= 3 && questions.length <= 5,
      `${id} must ask 3–5 learning questions, found ${questions.length}`,
    );
  }
});

test('includes an explicitly original diagram or table on every new Batch 2 page', () => {
  for (const id of batch2Ids) {
    const body = requiredDocument(id).body;
    assert.ok(hasDiagramOrTable(body), `${id} must contain a diagram or table`);
    assert.match(
      body,
      /(?:原创|本站(?:绘制|整理|定义|操作性分类)|Atlas.{0,20}分类)/iu,
      `${id} must label the visual as original or site-defined`,
    );
  }
});

test('states a boundary on every new Batch 2 page', () => {
  for (const id of batch2Ids) {
    const body = extractMarkdownBody(requiredDocument(id).source);
    assert.match(body, /边界/u, `${id} must state a boundary`);
  }
});

test('states a failure mode on every new Batch 2 page', () => {
  for (const id of batch2Ids) {
    const body = extractMarkdownBody(requiredDocument(id).source);
    assert.match(body, /(?:失败|失效|故障)/u, `${id} must state a failure mode`);
  }
});

test('states a non-use condition on every new Batch 2 page', () => {
  for (const id of batch2Ids) {
    const body = extractMarkdownBody(requiredDocument(id).source);
    assert.match(
      body,
      /(?:不适用|不应|不可|不要|何时不用|禁用|非使用条件)/u,
      `${id} must state a non-use condition`,
    );
  }
});

test('renders parent path adjacent and case links on every Batch 2 topic', () => {
  for (const [id, expected] of expectedTopics) {
    const visibleLinks = new Set(extractInternalLinks(requiredDocument(id)));
    const requiredLinks = [
      expected.parent,
      pathSlug,
      ...expected.adjacent.map((adjacentId) => slugsById.get(adjacentId)),
      ...expected.relatedCases,
    ];

    for (const slug of requiredLinks) {
      assert.ok(visibleLinks.has(slug), `${id} must visibly link ${slug}`);
    }
  }
});

test('governs two independent visible sources on every Batch 2 topic', () => {
  for (const id of expectedTopics.keys()) {
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
      return source;
    });

    assert.ok(
      new Set(
        governedSources.map(({author_or_org: authorOrOrg}) =>
          authorOrOrg.trim().toLocaleLowerCase('en'),
        ),
      ).size >= 2,
      `${id} sources must have at least two independent authors or organizations`,
    );
  }
});

test('projects an eligible visible manifest-primary source on every Batch 2 topic', () => {
  for (const id of expectedTopics.keys()) {
    const document = requiredDocument(id);
    const visibleSources = new Set(extractExternalLinks(document));
    const eligiblePrimaryUrls = requiredLedgerDocument(id).citations
      .filter(({manifest_primary: manifestPrimary, source_id: sourceId}) => {
        const source = sourcesById.get(sourceId);
        return (
          manifestPrimary === true &&
          ['primary', 'first-party'].includes(source?.tier) &&
          source?.source_kind !== 'community-index'
        );
      })
      .map(({citation_url: citationUrl}) => citationUrl);

    assert.ok(
      eligiblePrimaryUrls.length >= 1,
      `${id} must have an eligible manifest-primary source`,
    );
    for (const url of eligiblePrimaryUrls) {
      assert.ok(visibleSources.has(url), `${id} primary source must be visible: ${url}`);
      assert.ok(
        topicsById.get(id)?.primary_sources.includes(url),
        `${id} manifest must project primary source ${url}`,
      );
    }
  }
});

test('uses the governed SEI primary method source for QAW and ATAM', () => {
  for (const [id, sourceId] of requiredPrimarySourceIds) {
    const citation = requiredLedgerDocument(id).citations.find(
      ({manifest_primary: manifestPrimary, source_id: citedId}) =>
        citedId === sourceId && manifestPrimary === true,
    );
    assert.ok(citation, `${id} must use ${sourceId} as a manifest-primary source`);
    assert.ok(
      extractExternalLinks(requiredDocument(id)).includes(citation.citation_url),
      `${id} must visibly cite ${sourceId}`,
    );
  }
});

test('distinguishes tradeoffs sensitivity points tradeoff points risks and non-risks in FND-04', () => {
  const body = extractMarkdownBody(requiredDocument('FND-04').source);
  for (const term of ['权衡', '敏感点', '权衡点', '风险', '非风险']) {
    assert.match(body, new RegExp(term, 'u'), `FND-04 must explain ${term}`);
  }
});

test('distinguishes technical debt architecture debt and evolutionary design in FND-05', () => {
  const body = extractMarkdownBody(requiredDocument('FND-05').source);
  for (const term of ['技术债', '架构债', '演进式设计']) {
    assert.match(body, new RegExp(term, 'u'), `FND-05 must explain ${term}`);
  }
});

test('defines MTH-01 as stakeholder-driven scenario prioritization rather than ATAM', () => {
  const body = extractMarkdownBody(requiredDocument('MTH-01').source);
  assert.match(body, /利益相关者/u, 'MTH-01 must involve stakeholders');
  assert.match(body, /质量属性场景/u, 'MTH-01 must produce quality-attribute scenarios');
  assert.match(body, /优先/u, 'MTH-01 must prioritize scenarios');
  assert.match(
    body,
    /(?:不是|不等于|不能替代|并非).{0,24}ATAM|ATAM.{0,24}(?:不是|不等于|不能替代|并非)/isu,
    'MTH-01 must distinguish QAW from ATAM',
  );
});

test('defines MTH-02 as scenario-based architecture analysis rather than design or certification', () => {
  const body = extractMarkdownBody(requiredDocument('MTH-02').source);
  assert.match(body, /质量属性场景/u, 'MTH-02 must analyze quality-attribute scenarios');
  assert.match(
    body,
    /架构(?:方法|方案|途径|决策)/u,
    'MTH-02 must evaluate architecture approaches',
  );
  for (const term of ['敏感点', '权衡点', '风险', '非风险']) {
    assert.match(body, new RegExp(term, 'u'), `MTH-02 must identify ${term}`);
  }
  assert.match(
    body,
    /(?:不是|不等于|不能替代|并非).{0,24}架构设计|架构设计.{0,24}(?:不是|不等于|不能替代|并非)/isu,
    'MTH-02 must not claim to be architecture design',
  );
  assert.match(
    body,
    /(?:不是|不等于|不能替代|并非).{0,24}认证|认证.{0,24}(?:不是|不等于|不能替代|并非)/isu,
    'MTH-02 must not claim to be certification',
  );
});

test('removes published MTH-01 and MTH-02 relation overrides', () => {
  assert.equal('MTH-01' in topicRelations, false);
  assert.equal('MTH-02' in topicRelations, false);
});
