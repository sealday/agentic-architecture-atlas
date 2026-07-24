import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {parseBacklogTopics} from '../scripts/backlog-topics.mjs';
import {
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
});
