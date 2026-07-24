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

test('compares five risk methods by execution mode and evidence level', () => {
  const body = requiredDocument('MTH-05').body;
  const lines = body.split(/\r?\n/);
  const headerIndex = lines.findIndex(
    (line) =>
      /^\s*\|.*\|\s*$/.test(line) &&
      [
        '对象',
        '时机',
        '参与者',
        '产物',
        '故障',
        '非使用',
        '执行方式',
        '证据等级',
      ].every((term) => line.includes(term)),
  );
  assert.notEqual(
    headerIndex,
    -1,
    'MTH-05 must add execution mode and evidence level to the matrix',
  );
  const tableEnd = lines.findIndex(
    (line, index) =>
      index > headerIndex && !/^\s*\|.*\|\s*$/.test(line),
  );
  const tableLines = lines.slice(
    headerIndex,
    tableEnd === -1 ? lines.length : tableEnd,
  );
  assert.equal(tableLines.length - 2, 5, 'MTH-05 matrix must compare five methods');
  const rows = tableLines.slice(2).map((line) =>
    line
      .replace(/^\s*\||\|\s*$/gu, '')
      .split('|')
      .map((cell) => cell.trim()),
  );
  const rowByMethod = new Map(rows.map((row) => [row[0], row]));

  for (const method of ['风险风暴', '事前验尸']) {
    assert.match(rowByMethod.get(method)?.join(' ') ?? '', /想象故障/u, method);
  }
  for (const method of ['威胁建模', 'ATAM']) {
    assert.match(rowByMethod.get(method)?.join(' ') ?? '', /模型分析/u, method);
  }
  assert.match(
    rowByMethod.get('GameDay')?.join(' ') ?? '',
    /实际演练观测/u,
    'GameDay',
  );
  assert.match(
    body,
    /GameDay.{0,100}(?:观测|演练证据).{0,80}(?:不等于|不能证明|不是).{0,40}生产保证/isu,
    'GameDay observations must not be described as a production guarantee',
  );
});

test('states the OWASP process boundary and visibly governs SEI ATAM in MTH-05', () => {
  const document = requiredDocument('MTH-05');
  const body = extractMarkdownBody(document.source);
  assert.match(
    body,
    /OWASP.{0,160}(?:没有|不存在|不提供).{0,40}(?:统一|普遍).{0,40}行业标准.{0,30}流程/isu,
    'MTH-05 must state that OWASP does not define one universal industry-standard process',
  );

  const seiAtamUrl =
    'https://www.sei.cmu.edu/library/the-architecture-tradeoff-analysis-method/';
  assert.ok(
    extractExternalLinks(document).includes(seiAtamUrl),
    'MTH-05 must visibly cite SEI ATAM',
  );
  assert.ok(
    requiredLedgerDocument('MTH-05').citations.some(
      ({citation_url: url, source_id: sourceId}) =>
        url === seiAtamUrl && sourceId === 'src-sei-atam-1998',
    ),
    'MTH-05 must govern the visible SEI ATAM citation',
  );
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

test('bounds C4 and arc42 as representation tools with governed citations in MTH-06', () => {
  const document = requiredDocument('MTH-06');
  const body = extractMarkdownBody(document.source);
  assert.match(
    body,
    /C4.{0,100}(?:表示|视图).{0,180}arc42.{0,100}(?:文档组织|组织文档)|arc42.{0,100}(?:文档组织|组织文档).{0,180}C4.{0,100}(?:表示|视图)/isu,
    'MTH-06 must describe C4 as representation and arc42 as document organization',
  );
  assert.match(
    body,
    /(?:C4|arc42).{0,220}(?:不替代|不能替代|不是).{0,180}QAW.{0,80}ATAM.{0,80}ADR.{0,80}(?:fitness|适应度函数)/isu,
    'MTH-06 must not let C4 or arc42 replace architecture methods',
  );

  const requiredSources = new Map([
    ['src-c4model-f5342a5e8659', 'https://c4model.com/'],
    ['src-arc42-8b346f00707f', 'https://arc42.org/'],
  ]);
  const governed = requiredLedgerDocument('MTH-06');
  const visible = new Set(extractExternalLinks(document));
  for (const [sourceId, url] of requiredSources) {
    assert.ok(visible.has(url), `MTH-06 must visibly cite ${url}`);
    assert.ok(
      governed.citations.some(
        ({citation_url: citationUrl, source_id: citationSourceId}) =>
          citationSourceId === sourceId && citationUrl === url,
      ),
      `MTH-06 must govern ${sourceId}`,
    );
  }
});

test('selects exactly one manifest-primary citation for MTH-05 and MTH-06', () => {
  for (const id of ['MTH-05', 'MTH-06']) {
    assert.equal(
      requiredLedgerDocument(id).citations.filter(
        ({manifest_primary: manifestPrimary}) => manifestPrimary === true,
      ).length,
      1,
      `${id} must select exactly one manifest primary`,
    );
  }
});

test('uses the official AWS Site Terms as GameDay license evidence', () => {
  const awsGameDay = sourcesById.get('src-docs-930fe7f32f90');
  assert.ok(awsGameDay, 'Missing governed AWS GameDay source');
  assert.equal(awsGameDay.license_evidence_url, 'https://aws.amazon.com/terms/');
  assert.match(
    awsGameDay.license_evidence_note,
    /AWS Site Terms/iu,
    'AWS license note must identify the Site Terms',
  );
  assert.match(
    awsGameDay.license_evidence_note,
    /(?:no reusable license|does not grant|未授予|未发现可复用许可).{0,120}(?:facts|事实摘要)/isu,
    'AWS license note must retain the conservative facts-summary boundary',
  );
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
