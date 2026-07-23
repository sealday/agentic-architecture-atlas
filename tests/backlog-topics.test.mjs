import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {
  findBacklogTopicCandidates,
  parseBacklogTopics,
} from '../scripts/backlog-topics.mjs';

test('parses known topic rows and exact source lines', () => {
  const source = `## E0：内容工程
- [ ] **E0-01 P0｜平台任务**。

## E1：主干
- [ ] **FND-01 P0｜尺度边界**。
- [x] **QA-01 P0｜质量属性场景**：已完成。
- [ ] 普通执行步骤。

## M5：持续维护
- [ ] 术语和 slug 去重。`;

  const result = parseBacklogTopics(source, 'fixture.md');

  assert.deepEqual(result, {
    topics: [
      {
        id: 'FND-01',
        type: 'concept',
        title: '尺度边界',
        slug: '/concepts/fnd-01',
        priority: 'P0',
        complete: false,
        line: 5,
      },
      {
        id: 'QA-01',
        type: 'quality-attribute',
        title: '质量属性场景',
        slug: '/quality-attributes/qa-01',
        priority: 'P0',
        complete: true,
        line: 6,
      },
    ],
    errors: [],
  });
});

test('covers every supported topic prefix', () => {
  const expected = [
    ['FND', 'concept', 'concepts'],
    ['DST', 'concept', 'concepts'],
    ['PR', 'principle', 'principles'],
    ['QA', 'quality-attribute', 'quality-attributes'],
    ['MTH', 'method', 'methods'],
    ['MOD', 'modeling', 'modeling'],
    ['STY', 'style', 'styles'],
    ['DDD', 'pattern', 'patterns'],
    ['APP', 'pattern', 'patterns'],
    ['DP', 'pattern', 'patterns'],
    ['PAT-DC', 'pattern', 'patterns'],
    ['PAT-IN', 'pattern', 'patterns'],
    ['REL', 'pattern', 'patterns'],
    ['OPS', 'pattern', 'patterns'],
    ['SEC', 'pattern', 'patterns'],
    ['ANTI', 'pattern', 'patterns'],
    ['CASE', 'case', 'cases'],
    ['QST', 'question', 'questions'],
    ['CLD', 'path', 'paths'],
    ['FE', 'path', 'paths'],
    ['EDGE', 'path', 'paths'],
    ['AGT', 'path', 'paths'],
  ];
  const source = expected
    .map(([prefix], index) => {
      const priority = `P${index % 4}`;
      return `- [ ] **${prefix}-01 ${priority}｜${prefix} 标题**。`;
    })
    .join('\n');

  const result = parseBacklogTopics(source, 'prefixes.md');

  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.topics.map(({id, type, slug, priority, complete, line}) => ({
      id,
      type,
      slug,
      priority,
      complete,
      line,
    })),
    expected.map(([prefix, type, route], index) => ({
      id: `${prefix}-01`,
      type,
      slug: `/${route}/${prefix.toLowerCase()}-01`,
      priority: `P${index % 4}`,
      complete: false,
      line: index + 1,
    })),
  );
});

test('rejects malformed or unknown topic candidates instead of dropping them', () => {
  const cases = [
    {
      name: 'duplicate ID',
      source: [
        '- [ ] **FND-01 P0｜第一个标题**。',
        '- [x] **FND-01 P0｜第二个标题**。',
      ].join('\n'),
      expected: /duplicate.*FND-01|FND-01.*duplicate/i,
    },
    {
      name: 'invalid priority',
      source: '- [ ] **FND-02 P4｜非法优先级**。',
      expected: /FND-02.*P4|P4.*FND-02/,
    },
    {
      name: 'unknown bold task ID',
      source: '- [ ] **XYZ-01 P0｜未知前缀**。',
      expected: /XYZ-01/,
    },
    {
      name: 'missing separator',
      source: '- [ ] **FND-03 P0 缺少分隔符**。',
      expected: /FND-03/,
    },
    {
      name: 'missing bold markers',
      source: '- [ ] FND-04 P0｜缺少粗体。',
      expected: /FND-04/,
    },
    {
      name: 'indented checklist shell',
      source: '  - [ ] **FND-05 P0｜缩进外壳**。',
      expected: /malformed topic candidate FND-05/,
      candidateId: 'FND-05',
    },
    {
      name: 'blank title',
      source: '- [ ] **FND-06 P0｜   **。',
      expected: /FND-06.*title.*non-empty|non-empty.*FND-06/i,
      candidateId: 'FND-06',
    },
    {
      name: 'asterisk checklist shell',
      source: '* [ ] **QA-03 P0｜星号外壳**。',
      expected: /malformed topic candidate QA-03/,
      candidateId: 'QA-03',
    },
  ];

  for (const fixture of cases) {
    if (fixture.candidateId) {
      assert.deepEqual(
        findBacklogTopicCandidates(fixture.source).map(({id}) => id),
        [fixture.candidateId],
        fixture.name,
      );
    }
    const result = parseBacklogTopics(fixture.source, 'malformed.md');
    if (fixture.candidateId) {
      assert.equal(
        result.topics.some(({id}) => id === fixture.candidateId),
        false,
        fixture.name,
      );
    }
    assert.ok(result.errors.length > 0, fixture.name);
    assert.match(result.errors.join('\n'), /malformed\.md:1/, fixture.name);
    assert.match(result.errors.join('\n'), fixture.expected, fixture.name);
  }

  const explained = parseBacklogTopics(
    '- [X] **QA-02 P1｜带句点标题。**：这里是尾随说明。',
    'explained.md',
  );
  assert.deepEqual(explained, {
    topics: [
      {
        id: 'QA-02',
        type: 'quality-attribute',
        title: '带句点标题',
        slug: '/quality-attributes/qa-02',
        priority: 'P1',
        complete: true,
        line: 1,
      },
    ],
    errors: [],
  });

  const ordinaryReferences = [
    '正文提到 FND-06，但这不是主题任务。',
    '- 普通列表引用 **QA-04**，同样不是 checklist。',
  ].join('\n');
  assert.deepEqual(findBacklogTopicCandidates(ordinaryReferences), []);
  assert.deepEqual(parseBacklogTopics(ordinaryReferences, 'references.md'), {
    topics: [],
    errors: [],
  });
});

test('covers the complete real backlog topic set', async () => {
  const [source, expectedTopicIdsSource] = await Promise.all([
    readFile(new URL('../docs/content-backlog.md', import.meta.url), 'utf8'),
    readFile(
      new URL('./fixtures/backlog-topic-ids.json', import.meta.url),
      'utf8',
    ),
  ]);
  const expectedTopicIds = JSON.parse(expectedTopicIdsSource);
  const candidates = findBacklogTopicCandidates(source);
  const candidateIds = new Set(candidates.map(({id}) => id));
  const result = parseBacklogTopics(source, 'docs/content-backlog.md');

  assert.equal(candidates.length, 198);
  assert.equal(candidateIds.size, 198);
  assert.equal(result.topics.length, 198);
  assert.deepEqual(
    new Set(result.topics.map(({id}) => id)),
    candidateIds,
  );
  assert.deepEqual(
    result.topics.map(({id}) => id).sort(),
    expectedTopicIds,
  );
  assert.deepEqual(result.errors, []);
  for (const id of ['FND-01', 'QA-00', 'PAT-DC-09', 'AGT-06', 'CASE-20', 'QST-10']) {
    assert.ok(candidateIds.has(id));
  }
});
