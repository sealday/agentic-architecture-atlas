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

  const validation = await validateContent(contentRoot, {
    patternGroupRegistry,
    caseSeriesById: caseSeriesRegistry.byId,
  });
  assert.deepEqual(validation.errors, []);
});

test('does not infer backlog completion from fixture publication', async () => {
  const backlogSource = await readFile(
    fileURLToPath(new URL('../docs/content-backlog.md', import.meta.url)),
    'utf8',
  );
  const parsed = parseBacklogTopics(backlogSource, 'docs/content-backlog.md');
  assert.deepEqual(parsed.errors, []);
  for (const id of fixtureById.keys()) {
    assert.equal(parsed.topics.find((topic) => topic.id === id)?.complete, false, id);
  }
});
