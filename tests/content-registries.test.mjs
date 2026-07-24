import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {parseBacklogTopics} from '../scripts/backlog-topics.mjs';
import {
  loadCaseSeriesRegistry,
  parseCaseSeriesRegistry,
  loadPatternGroupRegistry,
  parsePatternGroupRegistry,
} from '../scripts/content-registries.mjs';

const validRegistry = {
  schema_version: 1,
  groups: [
    {
      id: 'general-design',
      label: '通用设计模式',
      description: '责任、结构与边界模式。',
      order: 10,
      topic_ids: ['DDD-01'],
    },
    {
      id: 'integration',
      label: '集成模式',
      description: '跨边界协作模式。',
      order: 20,
      topic_ids: ['PAT-IN-01'],
    },
    {
      id: 'reliability',
      label: '可靠性与生产治理模式',
      description: '恢复与隔离模式。',
      order: 30,
      topic_ids: ['REL-01'],
    },
    {
      id: 'data',
      label: '数据与一致性模式',
      description: '一致性协作模式。',
      order: 40,
      topic_ids: ['PAT-DC-01'],
    },
    {
      id: 'migration',
      label: '迁移模式',
      description: '渐进替换模式。',
      order: 50,
      topic_ids: ['PAT-MIG-01'],
    },
    {
      id: 'agent-control',
      label: 'Agent 控制与协作模式',
      description: '现有 Agent 控制概览。',
      order: 60,
      topic_ids: [],
    },
  ],
};

const topics = [
  {id: 'DDD-01', type: 'pattern'},
  {id: 'PAT-IN-01', type: 'pattern'},
  {id: 'REL-01', type: 'pattern'},
  {id: 'PAT-DC-01', type: 'pattern'},
  {id: 'PAT-MIG-01', type: 'pattern'},
  {id: 'FND-01', type: 'concept'},
];

test('parses ordered case series and rejects duplicate order', () => {
  const valid = {
    schema_version: 1,
    series: [
      {
        id: 'ai-native',
        label: 'AI 原生架构',
        description: 'Agent 框架与编排。',
        order: 10,
        show_on_homepage: false,
      },
      {
        id: 'classic-distributed',
        label: '经典分布式架构迁移',
        description: '经典机制迁移。',
        order: 30,
        show_on_homepage: true,
      },
    ],
  };
  const parsed = parseCaseSeriesRegistry(valid);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.byId.get('ai-native').label, 'AI 原生架构');

  const duplicateOrder = parseCaseSeriesRegistry({
    ...valid,
    series: valid.series.map((entry) => ({...entry, order: 10})),
  });
  assert.match(duplicateOrder.errors.join('\n'), /duplicate order "10"/);
});

test('case series parser rejects schema drift, invalid values, and prototype identities', () => {
  const entry = {
    id: 'ai-native',
    label: 'AI 原生架构',
    description: 'Agent 框架与编排。',
    order: 10,
    show_on_homepage: false,
  };
  const parse = (series) =>
    parseCaseSeriesRegistry({schema_version: 1, series}).errors.join('\n');

  assert.match(
    parseCaseSeriesRegistry({
      schema_version: 1,
      series: [entry],
      unexpected: true,
    }).errors.join('\n'),
    /expected exactly schema_version and series/,
  );
  assert.match(parse([{...entry, id: 'constructor'}]), /non-prototype kebab-case/);
  assert.match(parse([entry, {...entry, order: 20}]), /duplicate id "ai-native"/);
  assert.match(parse([{...entry, label: ' '}]), /invalid label/);
  assert.match(parse([{...entry, description: ''}]), /invalid label/);
  assert.match(parse([{...entry, order: 0}]), /invalid label/);
  assert.match(parse([{...entry, show_on_homepage: 'yes'}]), /invalid label/);
});

test('case series loader fails closed for missing and malformed JSON', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'case-series-registry-'));
  try {
    const missing = await loadCaseSeriesRegistry(root);
    assert.match(missing.errors.join('\n'), /case-series\.json.*ENOENT/i);

    await mkdir(path.join(root, 'data'), {recursive: true});
    await writeFile(path.join(root, 'data/case-series.json'), '{not json');
    const malformed = await loadCaseSeriesRegistry(root);
    assert.match(malformed.errors.join('\n'), /case-series\.json: invalid JSON/);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('production code does not import the legacy case-order fixture', async () => {
  const projectRoot = fileURLToPath(new URL('../', import.meta.url));
  for (const directory of ['scripts', 'src']) {
    const root = path.join(projectRoot, directory);
    const entries = await readdir(root, {recursive: true, withFileTypes: true});
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const file = path.join(entry.parentPath, entry.name);
      const source = await readFile(file, 'utf8');
      assert.doesNotMatch(source, /legacy-case-order\.json/, file);
    }
  }
});

test('parses exact Pattern groups and assigns each Pattern topic once', () => {
  const result = parsePatternGroupRegistry(validRegistry, topics);
  assert.deepEqual(result.errors, []);
  assert.equal(result.groupByTopicId.get('DDD-01'), 'general-design');
  assert.deepEqual(result.registry.groups.map(({id}) => id), [
    'general-design',
    'integration',
    'reliability',
    'data',
    'migration',
    'agent-control',
  ]);
});

test('rejects an empty public common group but permits empty agent-control', () => {
  const result = parsePatternGroupRegistry(
    {
      ...validRegistry,
      groups: validRegistry.groups.map((group) =>
        group.id === 'migration' ? {...group, topic_ids: []} : group
      ),
    },
    topics,
  );
  assert.match(result.errors.join('\n'), /public group "migration" must contain a topic/);
  assert.doesNotMatch(result.errors.join('\n'), /public group "agent-control"/);
});

test('canonical registry keeps every public common group non-empty', async () => {
  const canonical = JSON.parse(
    await readFile(
      fileURLToPath(new URL('../data/pattern-groups.json', import.meta.url)),
      'utf8',
    ),
  );
  for (const id of ['general-design', 'integration', 'reliability', 'data', 'migration']) {
    assert.ok(canonical.groups.find((group) => group.id === id)?.topic_ids.length > 0, id);
  }
});

test('rejects missing, duplicate, unknown, and non-Pattern assignments', () => {
  const missing = parsePatternGroupRegistry(
    {...validRegistry, groups: validRegistry.groups.map((group) => ({...group, topic_ids: []}))},
    topics,
  );
  assert.match(missing.errors.join('\n'), /Pattern topic "DDD-01" is not assigned/);

  const duplicate = parsePatternGroupRegistry(
    {
      ...validRegistry,
      groups: validRegistry.groups.map((group) => ({
        ...group,
        topic_ids: ['DDD-01'],
      })),
    },
    topics,
  );
  assert.match(duplicate.errors.join('\n'), /Pattern topic "DDD-01" is assigned to multiple groups/);

  const badTargets = parsePatternGroupRegistry(
    {
      ...validRegistry,
      groups: [
        {...validRegistry.groups[0], topic_ids: ['UNKNOWN-01', 'FND-01']},
        ...validRegistry.groups.slice(1),
      ],
    },
    topics,
  );
  assert.match(badTargets.errors.join('\n'), /topic "UNKNOWN-01" does not exist/);
  assert.match(badTargets.errors.join('\n'), /topic "FND-01" is not type "pattern"/);
});

test('rejects unknown fields, duplicate IDs, duplicate orders, and duplicate topic IDs', () => {
  const unknownField = parsePatternGroupRegistry(
    {...validRegistry, unexpected: true},
    topics,
  );
  assert.match(unknownField.errors.join('\n'), /expected exactly schema_version and groups/);

  const duplicateIdentity = parsePatternGroupRegistry(
    {
      ...validRegistry,
      groups: validRegistry.groups.map((group, index) =>
        index === 1
          ? {...group, id: validRegistry.groups[0].id, order: validRegistry.groups[0].order}
          : group
      ),
    },
    topics,
  );
  assert.match(duplicateIdentity.errors.join('\n'), /duplicates id "general-design"/);
  assert.match(duplicateIdentity.errors.join('\n'), /duplicates order "10"/);

  const duplicateTopic = parsePatternGroupRegistry(
    {
      ...validRegistry,
      groups: validRegistry.groups.map((group) =>
        group.id === 'general-design'
          ? {...group, topic_ids: ['DDD-01', 'DDD-01']}
          : group
      ),
    },
    topics,
  );
  assert.match(
    duplicateTopic.errors.join('\n'),
    /Pattern topic "DDD-01" is assigned to multiple groups/,
  );
});

test('loads the canonical registry against the complete backlog', async () => {
  const projectRoot = fileURLToPath(new URL('../', import.meta.url));
  const backlogSource = await readFile(
    fileURLToPath(new URL('../docs/content-backlog.md', import.meta.url)),
    'utf8',
  );
  const parsedBacklog = parseBacklogTopics(
    backlogSource,
    'docs/content-backlog.md',
  );
  assert.deepEqual(parsedBacklog.errors, []);

  const loaded = await loadPatternGroupRegistry(
    projectRoot,
    parsedBacklog.topics,
  );
  assert.deepEqual(loaded.errors, []);
  assert.equal(loaded.groupByTopicId.size, 72);

  const caseSeries = await loadCaseSeriesRegistry(projectRoot);
  assert.deepEqual(caseSeries.errors, []);
  assert.deepEqual(
    caseSeries.registry.series.map(({id}) => id),
    [
      'ai-native',
      'agent-platform-gateway',
      'classic-distributed',
      'frontend-architecture',
      'edge-physical',
    ],
  );
});
