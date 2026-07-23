import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

async function generatedIndexes() {
  return JSON.parse(await source('src/generated/topic-indexes.json'));
}

function topicFixture({id, priority, published = false}) {
  return {
    id,
    type: 'concept',
    title: `Fixture ${id}`,
    slug: `/concepts/${id.toLowerCase()}`,
    priority,
    status: {
      scope: published ? 'content-lifecycle' : 'backlog-projection',
      value: published ? 'reviewed' : 'pending',
      source: published ? `content/${id}.mdx` : 'docs/content-backlog.md',
    },
    dependencies: [],
    primary_sources: published ? ['https://example.com/source'] : [],
    related_cases: [],
    reviewed_at: published ? '2026-07-23' : null,
    published,
  };
}

test('connects all ten content type indexes', async () => {
  const indexPages = new Map([
    ['content/concepts/index.mdx', {slug: '/concepts', type: 'concept'}],
    ['content/principles/index.mdx', {slug: '/principles', type: 'principle'}],
    [
      'content/quality-attributes/index.mdx',
      {slug: '/quality-attributes', type: 'quality-attribute'},
    ],
    ['content/methods/index.mdx', {slug: '/methods', type: 'method'}],
    ['content/modeling/index.mdx', {slug: '/modeling', type: 'modeling'}],
    ['content/styles/index.mdx', {slug: '/styles', type: 'style'}],
    ['content/patterns/index.mdx', {slug: '/patterns', type: 'pattern'}],
    ['content/cases/index.mdx', {slug: '/cases', type: 'case'}],
    ['content/questions/index.mdx', {slug: '/questions', type: 'question'}],
    ['content/paths/index.mdx', {slug: '/paths', type: 'path'}],
  ]);

  for (const [path, {slug, type}] of indexPages) {
    const page = await source(path);

    assert.match(page, new RegExp(`^slug: ${slug}$`, 'm'), path);
    assert.match(
      page,
      /import TopicIndex from '@site\/src\/components\/TopicIndex';/,
      path,
    );
    assert.match(
      page,
      new RegExp(
        `<TopicIndex type="${type}"${type === 'case' ? ' plannedOnly' : ''} \\/>`,
      ),
      path,
    );
  }

  const cases = await source('content/cases/index.mdx');
  assert.match(cases, /import CaseCatalog from '@site\/src\/components\/CaseCatalog';/);
  assert.match(cases, /<CaseCatalog \/>/);

  const references = await source('content/references/index.mdx');
  for (const url of [
    'https://c4model.com/',
    'https://www.sei.cmu.edu/training/software-architecture-principles-practices/',
    'https://www.iso.org/standard/78176.html',
    'https://www.sei.cmu.edu/library/quality-attribute-workshops-qaws-third-edition/',
    'https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures',
  ]) {
    assert.match(references, new RegExp(url.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('renders published and planned topics without broken links', async () => {
  const {selectTopics} = await import(
    '../src/components/TopicIndex/topicIndexModel.ts'
  );
  const indexes = await generatedIndexes();
  const allCases = selectTopics(indexes.case, false);
  const plannedCases = selectTopics(indexes.case, true);

  assert.deepEqual(allCases, indexes.case);
  assert.ok(indexes.case.some((topic) => topic.published));
  assert.ok(indexes.case.some((topic) => !topic.published));
  assert.equal(
    plannedCases.length,
    indexes.case.filter((topic) => !topic.published).length,
  );
  assert.ok(plannedCases.every((topic) => !topic.published));

  const component = await source('src/components/TopicIndex/index.tsx');

  assert.match(
    component,
    /import topicIndexes from '@site\/src\/generated\/topic-indexes\.json';/,
  );
  assert.match(component, /import Link from '@docusaurus\/Link';/);
  assert.match(component, /topic\.published \? \(/);
  assert.match(component, /<Link to=\{topic\.slug\}>\{topic\.title\}<\/Link>/);
  assert.match(component, /<span>\{topic\.title\}<\/span>/);
  assert.doesNotMatch(component, /!topic\.published[\s\S]{0,160}<Link[^>]+topic\.slug/);
  assert.match(
    component,
    /topic\.primary_sources\.find\(\(source\) =>\s*source\.startsWith\('https:\/\/'\)/s,
  );
  assert.match(component, /!topic\.published && firstSource && \(/);
  assert.match(component, /href=\{firstSource\}/);
  assert.match(component, /topic\.status\.scope === 'backlog-projection'/);
  assert.match(component, /内容状态：\$\{topic\.status\.value\}/);
});

test('renders review dates and nullable priorities honestly', async () => {
  const {parseTopicIndexes} = await import(
    '../src/components/TopicIndex/topicIndexModel.ts'
  );
  const generated = await generatedIndexes();
  const parsedGenerated = parseTopicIndexes(generated);
  const fixtureIndexes = Object.fromEntries(
    Object.keys(generated).map((type) => [type, []]),
  );
  fixtureIndexes.concept = [
    topicFixture({id: 'FIX-P2', priority: 'P2'}),
    topicFixture({id: 'FIX-P3', priority: 'P3'}),
    topicFixture({id: 'FIX-NULL', priority: null, published: true}),
  ];

  const parsedFixture = parseTopicIndexes(fixtureIndexes);
  assert.deepEqual(
    parsedFixture.concept.map(({priority}) => priority),
    ['P2', 'P3', null],
  );
  assert.ok(
    Object.values(parsedGenerated)
      .flat()
      .some(({priority}) => priority === 'P2'),
    'generated indexes must exercise a real P2 topic',
  );
  assert.throws(
    () =>
      parseTopicIndexes({
        ...fixtureIndexes,
        concept: [topicFixture({id: 'FIX-P4', priority: 'P4'})],
      }),
    /invalid priority "P4"/,
  );

  const component = await source('src/components/TopicIndex/index.tsx');

  assert.match(component, /parseTopicIndexes\(topicIndexes\)/);
  assert.doesNotMatch(component, /topicIndexes as TopicIndexes/);
  assert.match(component, /\{topic\.priority && \(/);
  assert.doesNotMatch(component, /priority \?\? /);
  assert.doesNotMatch(component, /priority \|\| /);
  assert.match(component, /topic\.published && topic\.reviewed_at && \(/);
  assert.match(component, /最近复核：\{topic\.reviewed_at\}/);
});
