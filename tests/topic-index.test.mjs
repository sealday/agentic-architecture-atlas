import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {parseBacklogTopics} from '../scripts/backlog-topics.mjs';
import {parsePatternGroupRegistry} from '../scripts/content-registries.mjs';

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
    pattern_group: null,
  };
}

test('groups Pattern topics from generated registry order', async () => {
  const {selectPatternGroups} = await import(
    '../src/components/PatternTopicIndex/patternTopicIndexModel.ts'
  );
  const groups = [
    {id: 'general-design', label: '通用设计模式', description: '边界模式', order: 10},
    {id: 'integration', label: '集成模式', description: '集成模式', order: 20},
    {id: 'reliability', label: '可靠性与生产治理模式', description: '恢复模式', order: 30},
    {id: 'data', label: '数据与一致性模式', description: '数据模式', order: 40},
    {id: 'migration', label: '迁移模式', description: '迁移模式', order: 50},
    {id: 'agent-control', label: 'Agent 控制与协作模式', description: 'Agent 模式', order: 60},
  ];
  const topics = [
    {
      ...topicFixture({id: 'REL-01', priority: 'P0'}),
      type: 'pattern',
      slug: '/patterns/rel-01',
      pattern_group: 'reliability',
    },
    {
      ...topicFixture({id: 'REL-02', priority: 'P0', published: true}),
      type: 'pattern',
      slug: '/patterns/rel-02',
      pattern_group: 'reliability',
    },
  ];
  const selected = selectPatternGroups(groups, topics);
  assert.deepEqual(
    selected.map(({label, topics}) => [label, topics.length]),
    [
      ['通用设计模式', 0],
      ['集成模式', 0],
      ['可靠性与生产治理模式', 2],
      ['数据与一致性模式', 0],
      ['迁移模式', 0],
    ],
  );
  const reliabilityTopics = selected.find(
    ({id}) => id === 'reliability',
  ).topics;
  assert.deepEqual(
    reliabilityTopics.map(({id, internalHref}) => [id, internalHref]),
    [
      ['REL-01', null],
      ['REL-02', '/patterns/rel-02'],
    ],
  );
});

test('Pattern page renders five common groups plus one Agent wrapper', async () => {
  const source = await readFile(
    fileURLToPath(new URL('../content/patterns/index.mdx', import.meta.url)),
    'utf8',
  );
  const lines = source.split('\n');
  assert.equal(source.includes('<PatternTopicIndex />'), true);
  assert.equal(lines.includes('## Agent 控制与协作模式'), true);
  const agentHeadings = [
    'Router',
    'Supervisor',
    'Agents as Tools',
    'Handoff',
    'Fan-out / Fan-in',
    'Evaluator-Optimizer',
    'Hierarchical Teams',
    'A2A',
    'MCP',
  ];
  for (const heading of agentHeadings) {
    assert.equal(lines.includes(`### ${heading}`), true, heading);
    assert.equal(lines.includes(`## ${heading}`), false, heading);
  }

  const agentSection = source
    .slice(source.indexOf('## Agent 控制与协作模式'))
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trimEnd()
    .concat('\n');
  assert.equal(
    createHash('sha256').update(agentSection).digest('hex'),
    'aa0fea7e7bff540a7fb6e9ee81a691fee2bde3d2bcd88b2ee959289003fe5ca2',
    'the complete original Agent wrapper, nine headings, paragraphs, links, and comparison must remain intact',
  );
});

test('canonical Pattern registry exactly matches every generated assignment and link target', async () => {
  const [backlogSource, registryValue, manifest, indexes, generatedGroups] =
    await Promise.all([
      source('docs/content-backlog.md'),
      source('data/pattern-groups.json').then(JSON.parse),
      source('src/generated/topic-manifest.json').then(JSON.parse),
      generatedIndexes(),
      source('src/generated/pattern-groups.json').then(JSON.parse),
    ]);
  const parsedBacklog = parseBacklogTopics(
    backlogSource,
    'docs/content-backlog.md',
  );
  assert.deepEqual(parsedBacklog.errors, []);
  const parsedRegistry = parsePatternGroupRegistry(
    registryValue,
    parsedBacklog.topics,
  );
  assert.deepEqual(parsedRegistry.errors, []);

  const expectedAssignments = [...parsedRegistry.groupByTopicId]
    .map(([id, patternGroup]) => [id, patternGroup])
    .sort(([left], [right]) => left.localeCompare(right, 'en'));
  const manifestPatternTopics = manifest.topics.filter(
    ({type}) => type === 'pattern',
  );
  const actualManifestAssignments = manifestPatternTopics
    .map(({id, pattern_group: patternGroup}) => [id, patternGroup])
    .sort(([left], [right]) => left.localeCompare(right, 'en'));
  const actualIndexAssignments = indexes.pattern
    .map(({id, pattern_group: patternGroup}) => [id, patternGroup])
    .sort(([left], [right]) => left.localeCompare(right, 'en'));

  assert.equal(expectedAssignments.length, 72);
  assert.deepEqual(actualManifestAssignments, expectedAssignments);
  assert.deepEqual(actualIndexAssignments, expectedAssignments);
  assert.ok(
    manifest.topics
      .filter(({type}) => type !== 'pattern')
      .every(({pattern_group: patternGroup}) => patternGroup === null),
  );
  assert.ok(
    Object.entries(indexes)
      .filter(([type]) => type !== 'pattern')
      .flatMap(([, topics]) => topics)
      .every(({pattern_group: patternGroup}) => patternGroup === null),
  );
  assert.deepEqual(
    generatedGroups.groups,
    parsedRegistry.registry.groups.map(
      ({id, label, description, order}) => ({id, label, description, order}),
    ),
  );

  const {selectPatternGroups} = await import(
    '../src/components/PatternTopicIndex/patternTopicIndexModel.ts'
  );
  const canonicalViews = selectPatternGroups(
    generatedGroups.groups,
    indexes.pattern,
  ).flatMap(({topics}) => topics);
  assert.equal(canonicalViews.length, 72);
  assert.ok(canonicalViews.some(({published}) => !published));
  assert.ok(
    canonicalViews
      .filter(({published}) => !published)
      .every(({internalHref}) => internalHref === null),
  );
  assert.deepEqual(
    canonicalViews
      .filter(({published}) => published)
      .map(({id, internalHref}) => [id, internalHref]),
    [['REL-02', '/patterns/rel-02']],
  );
});

test('Pattern component consumes only internalHref for its title link boundary', async () => {
  const component = await source(
    'src/components/PatternTopicIndex/index.tsx',
  );
  const decisionStart = component.indexOf('{topic.internalHref ? (');
  const decisionEnd = component.indexOf(
    '{topic.priority && (',
    decisionStart,
  );
  assert.notEqual(decisionStart, -1);
  assert.notEqual(decisionEnd, -1);

  const normalizedDecision = component
    .slice(decisionStart, decisionEnd)
    .replace(/\s+/g, ' ')
    .trim();
  assert.equal(
    normalizedDecision,
    '{topic.internalHref ? ( <Link to={topic.internalHref}>{topic.title}</Link> ) : ( <span>{topic.title}</span> )}',
  );
  assert.equal(
    component.match(/topic\.internalHref/g)?.length,
    2,
    'the title condition and Link target must consume the same view-model field',
  );
  assert.equal(component.includes('topic.slug'), false);
  assert.equal(
    component.includes('{topic.published ? ('),
    false,
    'published status must not decide whether the title is linked',
  );
});

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
    if (type === 'pattern') {
      assert.match(
        page,
        /import PatternTopicIndex from '@site\/src\/components\/PatternTopicIndex';/,
        path,
      );
      assert.match(page, /<PatternTopicIndex \/>/, path);
    } else {
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
  }

  const cases = await source('content/cases/index.mdx');
  assert.match(cases, /import CaseCatalog from '@site\/src\/components\/CaseCatalog';/);
  assert.match(cases, /<CaseCatalog \/>/);

  const references = await source('content/references/index.mdx');
  assert.match(
    references,
    /import SourceLedger from '@site\/src\/components\/SourceLedger';/,
  );
  assert.match(references, /^<SourceLedger \/>$/m);
  assert.doesNotMatch(references, /^### /m);
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
