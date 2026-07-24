import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {readContentDocuments} from '../scripts/content-metadata.mjs';
import {parseBacklogTopics} from '../scripts/backlog-topics.mjs';
import {knowledgeTypeContracts} from '../scripts/content-schema.mjs';
import {
  loadCaseSeriesRegistry,
  loadPatternGroupRegistry,
  loadReviewPolicyRegistry,
} from '../scripts/content-registries.mjs';
import {validateContent} from '../scripts/validate-content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureById = new Map([
  ['PR-01', ['principle', 'principles/pr-01-information-hiding.mdx']],
  ['REL-02', ['pattern', 'patterns/rel-02-retry-backoff-jitter.mdx']],
  ['STY-00', ['style', 'styles/sty-00-comparison-framework.mdx']],
  ['MTH-03', ['method', 'methods/mth-03-adr-lifecycle.mdx']],
  ['MOD-02', ['modeling', 'modeling/mod-02-c4-context-container.mdx']],
  ['QA-01', ['quality-attribute', 'quality-attributes/qa-01-scenario-writing.mdx']],
]);
const incompleteFixtureIds = [...fixtureById.keys()].filter(
  (id) => id !== 'MTH-03',
);
const g005ClosureRoutes = new Map([
  ['FND-04', '/concepts/fnd-04'],
  ['FND-05', '/concepts/fnd-05'],
  ['MTH-01', '/methods/mth-01'],
  ['MTH-02', '/methods/mth-02'],
  ['MTH-03', '/methods/mth-03'],
]);
const implementationCommit = '15afc9d';
const deploymentCommit = 'eea2d76';
const pagesRun = '30095517683';

test('publishes one production fixture for each independent knowledge contract', async () => {
  const contentRoot = fileURLToPath(new URL('../content/', import.meta.url));
  const documents = await readContentDocuments(contentRoot);
  const documentsById = new Map(
    documents
      .filter(({metadata}) => typeof metadata.topic_id === 'string')
      .map((document) => [document.metadata.topic_id, document]),
  );

  for (const [id, [type, file]] of fixtureById) {
    const document = documentsById.get(id);
    assert.ok(document, `${id} must be published`);
    assert.equal(document.file, file);
    assert.equal(document.metadata.content_type, type);
    assert.equal(document.metadata.slug, `/${type === 'quality-attribute' ? 'quality-attributes' : type === 'principle' ? 'principles' : type === 'pattern' ? 'patterns' : type === 'style' ? 'styles' : type === 'method' ? 'methods' : 'modeling'}/${id.toLowerCase()}`);
    assert.deepEqual(
      document.headings.filter(({level}) => level === 2).map(({text}) => `## ${text}`),
      knowledgeTypeContracts[type],
    );
  }

  const backlogSource = await readFile(
    fileURLToPath(new URL('../docs/content-backlog.md', import.meta.url)),
    'utf8',
  );
  const parsedBacklog = parseBacklogTopics(
    backlogSource,
    'docs/content-backlog.md',
  );
  assert.deepEqual(parsedBacklog.errors, []);
  const patternGroupRegistry = await loadPatternGroupRegistry(
    root,
    parsedBacklog.topics,
  );
  assert.deepEqual(patternGroupRegistry.errors, []);
  const caseSeriesRegistry = await loadCaseSeriesRegistry(root);
  assert.deepEqual(caseSeriesRegistry.errors, []);
  const reviewPolicyRegistry = await loadReviewPolicyRegistry(root);
  assert.deepEqual(reviewPolicyRegistry.errors, []);

  const validation = await validateContent(contentRoot, {
    patternGroupRegistry,
    caseSeriesById: caseSeriesRegistry.byId,
    reviewPolicyById: reviewPolicyRegistry.byId,
  });
  assert.deepEqual(validation.errors, []);
});

test('does not infer backlog completion for fixtures outside the G005 closure', async () => {
  const backlogSource = await readFile(
    fileURLToPath(new URL('../docs/content-backlog.md', import.meta.url)),
    'utf8',
  );
  const parsed = parseBacklogTopics(backlogSource, 'docs/content-backlog.md');
  assert.deepEqual(parsed.errors, []);
  for (const id of incompleteFixtureIds) {
    assert.equal(parsed.topics.find((topic) => topic.id === id)?.complete, false, id);
  }
});

test('marks every G005 Batch 2 topic complete in the visible backlog', async () => {
  const backlogSource = await readFile(
    fileURLToPath(new URL('../docs/content-backlog.md', import.meta.url)),
    'utf8',
  );
  const visibleBacklog = backlogSource.replace(/<!--[\s\S]*?-->/gu, '');
  const parsed = parseBacklogTopics(visibleBacklog, 'docs/content-backlog.md');
  assert.deepEqual(parsed.errors, []);

  for (const id of g005ClosureRoutes.keys()) {
    assert.equal(
      parsed.topics.find((topic) => topic.id === id)?.complete,
      true,
      `${id} backlog closure must be complete`,
    );
  }
});

test('records deployment closure evidence on every G005 Batch 2 backlog row', async () => {
  const backlogSource = await readFile(
    fileURLToPath(new URL('../docs/content-backlog.md', import.meta.url)),
    'utf8',
  );
  const visibleBacklog = backlogSource.replace(/<!--[\s\S]*?-->/gu, '');
  const lines = visibleBacklog.split(/\r?\n/);
  const parsed = parseBacklogTopics(visibleBacklog, 'docs/content-backlog.md');
  assert.deepEqual(parsed.errors, []);

  for (const [id, route] of g005ClosureRoutes) {
    const topic = parsed.topics.find((candidate) => candidate.id === id);
    assert.ok(topic, `${id} must remain visible in the backlog`);
    const row = lines[topic.line - 1];
    assert.match(row, new RegExp(`\\b${implementationCommit}\\b`, 'u'), id);
    assert.match(row, new RegExp(`\\b${deploymentCommit}\\b`, 'u'), id);
    assert.match(
      row,
      new RegExp(`actions/runs/${pagesRun}(?:\\b|[/?#])`, 'u'),
      `${id} must link Pages run ${pagesRun}`,
    );
    assert.ok(
      row.includes(
        `https://sealday.github.io/agentic-architecture-atlas${route}`,
      ),
      `${id} must link its live route ${route}`,
    );
  }
});

test('projects G005 Batch 2 completion into the manifest and topic indexes', async () => {
  const [manifest, indexes] = await Promise.all([
    readFile(
      new URL('../src/generated/topic-manifest.json', import.meta.url),
      'utf8',
    ).then(JSON.parse),
    readFile(
      new URL('../src/generated/topic-indexes.json', import.meta.url),
      'utf8',
    ).then(JSON.parse),
  ]);
  const manifestById = new Map(
    manifest.topics.map((topic) => [topic.id, topic]),
  );
  const indexById = new Map(
    Object.values(indexes)
      .filter(Array.isArray)
      .flat()
      .map((topic) => [topic.id, topic]),
  );

  for (const id of g005ClosureRoutes.keys()) {
    for (const [projection, topic] of [
      ['manifest', manifestById.get(id)],
      ['topic index', indexById.get(id)],
    ]) {
      assert.ok(topic, `${id} must exist in ${projection}`);
      assert.deepEqual(
        topic.status,
        {
          scope: 'backlog-projection',
          value: 'complete',
          source: 'docs/content-backlog.md',
        },
        `${id} ${projection} must project complete=true`,
      );
    }
  }
});
