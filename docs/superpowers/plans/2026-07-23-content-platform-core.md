# Content Platform Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement E0-01 and E0-02 by adding six knowledge-content contracts, a backlog-projected topic manifest, deterministic per-type indexes, and compatibility generation for the existing case catalog.

**Architecture:** Parse topic tasks from `docs/content-backlog.md`, join them with one validated snapshot of `content/**/*.mdx`, apply relationship-only overrides, and serialize three generated JSON artifacts. A generic `TopicIndex` consumes the per-type artifact while the existing `CaseCatalog` keeps its current compatibility artifact.

**Tech Stack:** Node.js 24 built-ins, Docusaurus 3.10.2, React 19, TypeScript 6, MDX, Node test runner.

## Global Constraints

- `docs/content-backlog.md` checkbox values are the only manually maintained task status.
- Generated files are never repaired by hand.
- `data/topic-relations.json` may contain only `dependencies` and `related_cases`.
- Do not add npm dependencies.
- Preserve all existing public slugs and the current `CaseCatalog` filter behavior.
- Planned topics must not render internal links until a matching content document exists.
- Published topics must have at least one HTTPS source and a valid `YYYY-MM-DD` review date.
- Run every production change through RED, observed failure, minimal GREEN, and regression verification.
- Do not mark E0-01 or E0-02 complete until full verification, review, push, Pages deployment, and live-route checks succeed.

---

## File Structure

### Schema and parsing

- Modify `scripts/content-schema.mjs`: content types, new-type metadata contracts, ordered heading contracts, type-route metadata.
- Create `scripts/backlog-topics.mjs`: parse topic rows and project ID prefixes to content types and planned slugs.
- Create `scripts/topic-manifest.mjs`: join backlog topics, validated documents, and relationship overrides; validate graph; serialize artifacts.
- Modify `scripts/validate-content.mjs`: enforce per-type metadata and heading contracts without weakening case validation.

### Generation

- Create `scripts/generate-content-platform.mjs`: one CLI for `--write` and `--check`.
- Modify `scripts/generate-case-catalog.mjs`: retain exported compatibility helpers, delegate entry construction to the manifest snapshot where practical.
- Create `data/topic-relations.json`: relationship-only seed data.
- Create `src/generated/topic-manifest.json`: generated manifest.
- Create `src/generated/topic-indexes.json`: generated per-type entries.
- Modify `src/generated/case-catalog.json`: regenerated compatibility bytes only.
- Modify `package.json`: add unified generation/check commands and compatibility aliases.

### Presentation

- Create `src/components/TopicIndex/index.tsx`: render published and planned topic entries.
- Create `src/components/TopicIndex/styles.module.css`: responsive list/card styles.
- Create `content/concepts/index.mdx`
- Create `content/principles/index.mdx`
- Create `content/quality-attributes/index.mdx`
- Create `content/methods/index.mdx`
- Create `content/modeling/index.mdx`
- Create `content/styles/index.mdx`
- Modify `content/patterns/index.mdx`
- Modify `content/cases/index.mdx`
- Modify `content/questions/index.mdx`
- Modify `content/paths/index.mdx`
- Modify `content/intro.mdx`
- Modify `content/references/index.mdx`

### Tests

- Modify `tests/content-validation.test.mjs`: six type contracts and regression coverage.
- Create `tests/backlog-topics.test.mjs`: parser and status-projection unit tests.
- Create `tests/topic-manifest.test.mjs`: merge, relation, cycle, ordering, and serialization tests.
- Create `tests/content-platform-generation.test.mjs`: write/check CLI behavior and case compatibility.
- Create `tests/topic-index.test.mjs`: index page and component contract tests.
- Modify `tests/sidebar-navigation.test.mjs`: new stable section order.

---

### Task 1: Extend the content schema with six knowledge contracts

**Files:**
- Modify: `tests/content-validation.test.mjs`
- Modify: `scripts/content-schema.mjs`
- Modify: `scripts/validate-content.mjs`
- Test: `tests/content-validation.test.mjs`

**Interfaces:**
- Produces: `knowledgeContentTypes`, `knowledgeTypeContracts`, `qualityAttributeScenarioHeadings`, and validation errors with file/type/field or heading context.
- Preserves: all existing case-field, case-heading, catalog-order, migration-heading, slug, and collection checks.

- [ ] **Step 1: Add table-driven failing fixtures**

Append constants and helpers to `tests/content-validation.test.mjs`:

```js
function frontMatter(values) {
  return Object.entries(values)
    .map(([field, value]) => {
      if (Array.isArray(value)) {
        return value.length === 0
          ? `${field}: []`
          : `${field}:\n${value.map((item) => `  - ${item}`).join('\n')}`;
      }
      return `${field}: ${value}`;
    })
    .join('\n');
}

const knowledgeFixtures = new Map([
  ['concept', [
    '## 学习问题',
    '## 定义与尺度边界',
    '## 核心机制',
    '## 常见混淆',
    '## 说明性场景',
    '## 相邻主题',
    '## 来源',
  ]],
  ['principle', [
    '## 学习问题',
    '## 要保护的性质',
    '## 冲突与适用上下文',
    '## 机制',
    '## 误用与反原则',
    '## 适用尺度',
    '## 相邻原则',
    '## 说明性场景',
    '## 来源',
  ]],
  ['quality-attribute', [
    '## 学习问题',
    '## 定义与业务目标',
    '## 质量属性场景',
    '### Source',
    '### Stimulus',
    '### Environment',
    '### Artifact',
    '### Response',
    '### Response measure',
    '## 架构策略',
    '## 测量信号与阈值',
    '## 权衡与失败模式',
    '## 相邻质量属性',
    '## 说明性场景',
    '## 来源',
  ]],
  ['method', [
    '## 学习问题',
    '## 输入与参与者',
    '## 步骤',
    '## 产物',
    '## 完成判断',
    '## 常见失败',
    '## 与其他方法的衔接',
    '## 完整演练',
    '## 来源',
  ]],
  ['modeling', [
    '## 学习问题',
    '## 建模目标与输入',
    '## 参与者与步骤',
    '## 模型产物',
    '## 完成判断',
    '## 常见失败',
    '## 与其他模型的衔接',
    '## 完整演练',
    '## 来源',
  ]],
  ['style', [
    '## 学习问题',
    '## 组件、连接器与约束',
    '## 边界与控制流',
    '## 数据所有权与一致性',
    '## 部署单元与故障域',
    '## 团队拓扑',
    '## 质量属性收益与成本',
    '## 迁移路径',
    '## 禁用条件',
    '## 对比案例',
    '## 来源',
  ]],
]);

function validKnowledgeFrontMatter(type, overrides = {}) {
  return frontMatter({
    title: `${type} fixture`,
    slug: `/${type}s/fixture`,
    content_type: type,
    status: 'reviewed',
    difficulty: 'intermediate',
    analyzed_at: '2026-07-23',
    source_cutoff: '2026-07-23',
    confidence: 'high',
    domains: ['software-architecture'],
    agent_patterns: [],
    protocols: [],
    quality_attributes: ['maintainability'],
    tags: [type],
    official_sources: ['https://example.com/official'],
    summary: `${type} summary`,
    topic_id: 'FND-01',
    priority: 'P0',
    depends_on: [],
    related_cases: [],
    ...overrides,
  });
}
```

Add tests that write one valid document per map entry and assert no errors, then remove `summary`, set `priority: P9`, change `depends_on` to a scalar, and delete/reorder one required heading in separate fixtures. For `quality-attribute`, move `### Response measure` outside `## 质量属性场景` and assert a section-ownership error.

- [ ] **Step 2: Run focused tests and observe RED**

Run:

```bash
node --test --test-name-pattern="knowledge content|quality attribute scenario" tests/content-validation.test.mjs
```

Expected: FAIL because all six content types are invalid and no knowledge-specific metadata or heading checks exist.

- [ ] **Step 3: Define the contracts**

Add to `scripts/content-schema.mjs`:

```js
export const knowledgeContentTypes = [
  'concept',
  'principle',
  'quality-attribute',
  'method',
  'modeling',
  'style',
];

export const knowledgeRequiredFields = [
  'summary',
  'topic_id',
  'priority',
  'depends_on',
  'related_cases',
];

export const allowedPriorities = ['P0', 'P1', 'P2', 'P3'];

export const knowledgeTypeContracts = {
  concept: [
    '## 学习问题',
    '## 定义与尺度边界',
    '## 核心机制',
    '## 常见混淆',
    '## 说明性场景',
    '## 相邻主题',
    '## 来源',
  ],
  principle: [
    '## 学习问题',
    '## 要保护的性质',
    '## 冲突与适用上下文',
    '## 机制',
    '## 误用与反原则',
    '## 适用尺度',
    '## 相邻原则',
    '## 说明性场景',
    '## 来源',
  ],
  'quality-attribute': [
    '## 学习问题',
    '## 定义与业务目标',
    '## 质量属性场景',
    '## 架构策略',
    '## 测量信号与阈值',
    '## 权衡与失败模式',
    '## 相邻质量属性',
    '## 说明性场景',
    '## 来源',
  ],
  method: [
    '## 学习问题',
    '## 输入与参与者',
    '## 步骤',
    '## 产物',
    '## 完成判断',
    '## 常见失败',
    '## 与其他方法的衔接',
    '## 完整演练',
    '## 来源',
  ],
  modeling: [
    '## 学习问题',
    '## 建模目标与输入',
    '## 参与者与步骤',
    '## 模型产物',
    '## 完成判断',
    '## 常见失败',
    '## 与其他模型的衔接',
    '## 完整演练',
    '## 来源',
  ],
  style: [
    '## 学习问题',
    '## 组件、连接器与约束',
    '## 边界与控制流',
    '## 数据所有权与一致性',
    '## 部署单元与故障域',
    '## 团队拓扑',
    '## 质量属性收益与成本',
    '## 迁移路径',
    '## 禁用条件',
    '## 对比案例',
    '## 来源',
  ],
};

export const qualityAttributeScenarioHeadings = [
  '### Source',
  '### Stimulus',
  '### Environment',
  '### Artifact',
  '### Response',
  '### Response measure',
];
```

Extend `allowedValues.content_type` with `knowledgeContentTypes`.

- [ ] **Step 4: Implement minimal validation**

In `scripts/validate-content.mjs`, add focused helpers equivalent to:

```js
function validateOrderedH2Contract(file, headings, required, errors) {
  const actual = headings.filter(({level}) => level === 2);
  const expected = required.map(headingText);

  if (actual.length !== expected.length) {
    errors.push(`${file}: expected exactly ${expected.length} ${required[0]}-contract H2 headings; found ${actual.length}`);
  }

  expected.forEach((text, index) => {
    if (actual[index]?.text !== text) {
      errors.push(`${file}: invalid ${required[0]}-contract H2 sequence at position ${index + 1}; expected "## ${text}", actual "${actual[index] ? formatHeading(actual[index]) : 'missing'}"`);
    }
  });
}

function validateStringArray(file, field, value, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${file}: field "${field}" must be an array`);
    return;
  }
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') {
      errors.push(`${file}: field "${field}" contains a non-string or empty value`);
    }
  }
}
```

For a knowledge type:

- require `knowledgeRequiredFields`;
- require non-empty string `summary`;
- require `topic_id` to match `/^[A-Z]+(?:-[A-Z]+)*-\d{2}$/`;
- require `priority` in `allowedPriorities`;
- validate `depends_on` and `related_cases` as string arrays;
- require every related case to match `/^\/cases\/[a-z0-9]+(?:-[a-z0-9]+)*$/`;
- call the ordered H2 validator;
- for `quality-attribute`, collect H3 children of `## 质量属性场景` and require the six exact headings in order.

- [ ] **Step 5: Verify GREEN and full schema regression**

Run:

```bash
node --test --test-name-pattern="knowledge content|quality attribute scenario" tests/content-validation.test.mjs
node --test tests/content-validation.test.mjs tests/content-metadata.test.mjs
```

Expected: focused tests PASS; existing case and metadata tests remain PASS.

- [ ] **Step 6: Commit the schema contract**

```bash
git add scripts/content-schema.mjs scripts/validate-content.mjs tests/content-validation.test.mjs
git commit -m "feat: define knowledge content contracts"
```

---

### Task 2: Parse backlog topics without creating a second status writer

**Files:**
- Create: `tests/backlog-topics.test.mjs`
- Create: `scripts/backlog-topics.mjs`
- Test: `tests/backlog-topics.test.mjs`

**Interfaces:**
- Produces:

```ts
parseBacklogTopics(source: string, file?: string): {
  topics: Array<{
    id: string;
    type: TopicType;
    title: string;
    slug: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    complete: boolean;
    line: number;
  }>;
  errors: string[];
}
```

- [ ] **Step 1: Write parser RED tests**

Create fixtures containing:

```md
## E0：内容工程
- [ ] **E0-01 P0｜平台任务**。

## E1：主干
- [ ] **FND-01 P0｜尺度边界**。
- [x] **QA-01 P0｜质量属性场景**：已完成。
- [ ] 普通执行步骤。

## M5：持续维护
- [ ] 术语和 slug 去重。
```

Assert:

```js
assert.deepEqual(result.topics, [
  {
    id: 'FND-01',
    type: 'concept',
    title: '尺度边界',
    slug: '/concepts/fnd-01',
    priority: 'P0',
    complete: false,
    line: 6,
  },
  {
    id: 'QA-01',
    type: 'quality-attribute',
    title: '质量属性场景',
    slug: '/quality-attributes/qa-01',
    priority: 'P0',
    complete: true,
    line: 7,
  },
]);
```

Add cases for every prefix family in the design, duplicate IDs, invalid priority, and an unknown bold task ID `XYZ-01`.

- [ ] **Step 2: Run and observe RED**

Run:

```bash
node --test tests/backlog-topics.test.mjs
```

Expected: FAIL with module-not-found for `scripts/backlog-topics.mjs`.

- [ ] **Step 3: Implement the parser**

Use one explicit prefix table:

```js
export const topicPrefixTypes = new Map([
  ['FND', ['concept', 'concepts']],
  ['DST', ['concept', 'concepts']],
  ['PR', ['principle', 'principles']],
  ['QA', ['quality-attribute', 'quality-attributes']],
  ['MTH', ['method', 'methods']],
  ['MOD', ['modeling', 'modeling']],
  ['STY', ['style', 'styles']],
  ['DDD', ['pattern', 'patterns']],
  ['APP', ['pattern', 'patterns']],
  ['DP', ['pattern', 'patterns']],
  ['PAT-DC', ['pattern', 'patterns']],
  ['PAT-IN', ['pattern', 'patterns']],
  ['REL', ['pattern', 'patterns']],
  ['OPS', ['pattern', 'patterns']],
  ['SEC', ['pattern', 'patterns']],
  ['ANTI', ['pattern', 'patterns']],
  ['CASE', ['case', 'cases']],
  ['QST', ['question', 'questions']],
  ['CLD', ['path', 'paths']],
  ['FE', ['path', 'paths']],
  ['EDGE', ['path', 'paths']],
  ['AGT', ['path', 'paths']],
]);
```

Match only bold task rows:

```js
const task = line.match(
  /^-\s+\[([ xX])\]\s+\*\*([A-Z]+(?:-[A-Z]+)*-\d{2})\s+(P\d)｜(.+?)\*\*(?:[：:.。]|$)/,
);
```

Resolve prefixes longest-first so `PAT-DC` is selected before any shorter family:

```js
const orderedPrefixes = [...topicPrefixTypes.keys()].sort(
  (left, right) => right.length - left.length,
);
const prefix = orderedPrefixes.find((candidate) =>
  id.startsWith(`${candidate}-`),
);
```

Ignore E0 IDs explicitly. If a bold task-shaped row has a non-E0 unknown prefix or priority, return a line-numbered error. Normalize title by trimming a terminal Chinese/ASCII period.

- [ ] **Step 4: Run GREEN and parse the real backlog**

Run:

```bash
node --test tests/backlog-topics.test.mjs
node -e "import('./scripts/backlog-topics.mjs').then(async ({parseBacklogTopics}) => { const {readFile} = await import('node:fs/promises'); const result = parseBacklogTopics(await readFile('docs/content-backlog.md', 'utf8')); if (result.errors.length) throw new Error(result.errors.join('\\n')); console.log(result.topics.length); })"
```

Expected: tests PASS; the real command prints a positive topic count and exits 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/backlog-topics.mjs tests/backlog-topics.test.mjs
git commit -m "feat: project backlog topics"
```

---

### Task 3: Build and validate the projected manifest

**Files:**
- Create: `tests/topic-manifest.test.mjs`
- Create: `scripts/topic-manifest.mjs`
- Create: `data/topic-relations.json`
- Test: `tests/topic-manifest.test.mjs`

**Interfaces:**
- Consumes: `parseBacklogTopics()`, `validateContent()` document snapshots, and relation JSON.
- Produces:

```ts
buildTopicManifest({
  backlogSource: string,
  documents: Array<{file: string; metadata: Record<string, unknown>}>,
  relations?: Record<string, {
    dependencies?: string[];
    related_cases?: string[];
  }>
}): {
  manifest: {schema_version: 1; topics: TopicRecord[]};
  indexes: Record<TopicType, TopicRecord[]>;
  errors: string[];
}
```

- [ ] **Step 1: Write failing merge and status tests**

Test these exact behaviors:

1. Pending `FND-01` produces `status.scope === 'backlog-projection'` and `value === 'pending'`.
2. Checked `QA-01` produces `value === 'complete'`.
3. A published concept with `topic_id: FND-01` replaces the planned slug and sources but keeps backlog status.
4. A legacy case without `topic_id` derives `DOC-CASE-OPENAI-AGENTS-SDK`.
5. Duplicate `topic_id`, type mismatch, priority mismatch, missing relation ID, self dependency, dependency cycle, and unknown related case each produce explicit errors.
6. Planned empty sources and `reviewed_at: null` are accepted.
7. Published empty sources or invalid review dates fail.

Use plain object document fixtures; do not write filesystem fixtures in this unit test.

- [ ] **Step 2: Run and observe RED**

Run:

```bash
node --test tests/topic-manifest.test.mjs
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement record projection**

Define the status shape and stable legacy ID:

```js
function legacyDocumentId(type, slug) {
  const leaf = slug.split('/').filter(Boolean).at(-1);
  return `DOC-${type}-${leaf}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function backlogStatus(complete) {
  return {
    scope: 'backlog-projection',
    value: complete ? 'complete' : 'pending',
    source: 'docs/content-backlog.md',
  };
}

function contentStatus(file, value) {
  return {
    scope: 'content-lifecycle',
    value,
    source: `content/${file}`,
  };
}
```

Project backlog topics with empty arrays, null review date, and `published: false`. Project documents using `official_sources`, `analyzed_at`, and front-matter relationship fields. Exclude files named `index.mdx` and documents with `content_type: reference` from topic records.

- [ ] **Step 4: Implement merge and relation checks**

Merge a new knowledge document by `topic_id`. For legacy types, merge by explicit `topic_id` when present; otherwise add the derived ID record.

Validate relationship JSON keys:

```js
const allowedRelationKeys = new Set(['dependencies', 'related_cases']);
```

Reject every other key. Use depth-first search with `visiting` and `visited` sets to report a concrete cycle path. Validate related case slugs against published case records after all documents are merged.

- [ ] **Step 5: Implement deterministic indexes**

Create indexes for exactly:

```js
export const indexedTopicTypes = [
  'concept',
  'principle',
  'quality-attribute',
  'method',
  'modeling',
  'style',
  'pattern',
  'case',
  'question',
  'path',
];
```

Sort by numeric priority, longest dependency-path depth, then ID:

```js
const priorityOrder = new Map([['P0', 0], ['P1', 1], ['P2', 2], ['P3', 3]]);

function dependencyDepth(topic, topicsById, memo = new Map()) {
  if (memo.has(topic.id)) return memo.get(topic.id);
  const depth = topic.dependencies.length === 0
    ? 0
    : 1 + Math.max(
        ...topic.dependencies.map((id) =>
          dependencyDepth(topicsById.get(id), topicsById, memo),
        ),
      );
  memo.set(topic.id, depth);
  return depth;
}

function makeTopicComparator(topicsById) {
  const depthMemo = new Map();
  return (left, right) => (
    priorityOrder.get(left.priority) - priorityOrder.get(right.priority) ||
    dependencyDepth(left, topicsById, depthMemo) -
      dependencyDepth(right, topicsById, depthMemo) ||
    left.id.localeCompare(right.id, 'en')
  );
}
```

Create the comparator once after cycle validation and use it in manifest topics and every index group.

- [ ] **Step 6: Seed only established relationships**

Create `data/topic-relations.json` with:

```json
{
  "FND-02": {
    "dependencies": ["FND-01"],
    "related_cases": []
  },
  "FND-03": {
    "dependencies": ["FND-01"],
    "related_cases": []
  },
  "QA-00": {
    "dependencies": ["FND-02"],
    "related_cases": []
  },
  "QA-01": {
    "dependencies": ["FND-02", "QA-00"],
    "related_cases": []
  },
  "MTH-01": {
    "dependencies": ["QA-01"],
    "related_cases": []
  },
  "MTH-02": {
    "dependencies": ["QA-01"],
    "related_cases": []
  },
  "MTH-06": {
    "dependencies": ["MTH-01", "MTH-02", "MTH-03", "MTH-04"],
    "related_cases": []
  },
  "STY-14": {
    "dependencies": ["STY-04", "STY-05", "STY-06"],
    "related_cases": []
  }
}
```

Do not infer other dependencies from backlog order.

- [ ] **Step 7: Verify GREEN**

Run:

```bash
node --test tests/topic-manifest.test.mjs tests/backlog-topics.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add scripts/topic-manifest.mjs data/topic-relations.json tests/topic-manifest.test.mjs
git commit -m "feat: build projected topic manifest"
```

---

### Task 4: Generate all content-platform artifacts atomically

**Files:**
- Create: `tests/content-platform-generation.test.mjs`
- Create: `scripts/generate-content-platform.mjs`
- Modify: `scripts/generate-case-catalog.mjs`
- Modify: `package.json`
- Create: `src/generated/topic-manifest.json`
- Create: `src/generated/topic-indexes.json`
- Modify: `src/generated/case-catalog.json`
- Test: `tests/content-platform-generation.test.mjs`
- Test: `tests/case-catalog-generation.test.mjs`

**Interfaces:**
- Produces CLI:

```text
node scripts/generate-content-platform.mjs --write
node scripts/generate-content-platform.mjs --check
```

- Preserves `buildCaseCatalog`, `serializeCaseCatalog`, `writeCaseCatalog`, and `checkCaseCatalog` exports until a later compatibility cleanup.

- [ ] **Step 1: Write failing generation tests**

Create a temporary repository fixture with:

```text
docs/content-backlog.md
content/concepts/example.mdx
content/cases/example.mdx
data/topic-relations.json
src/generated/
```

Assert:

- `buildContentArtifacts(root)` reads each MDX source once;
- serialization ends with one newline and contains no absolute temp path;
- two calls return byte-identical strings;
- `writeContentArtifacts(root)` writes all three files;
- `checkContentArtifacts(root)` returns `{matches: true, stale: []}`;
- changing one generated byte reports only that path stale;
- deleting one output reports it stale;
- the generated case catalog equals `serializeCaseCatalog(await buildCaseCatalog(contentRoot))`.

- [ ] **Step 2: Run and observe RED**

Run:

```bash
node --test tests/content-platform-generation.test.mjs
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the artifact builder**

In `scripts/generate-content-platform.mjs`, export:

```js
export const generatedPaths = {
  manifest: 'src/generated/topic-manifest.json',
  indexes: 'src/generated/topic-indexes.json',
  caseCatalog: 'src/generated/case-catalog.json',
};

export async function buildContentArtifacts(root) {
  const contentRoot = path.join(root, 'content');
  const backlogSource = await readFile(path.join(root, 'docs/content-backlog.md'), 'utf8');
  const relations = JSON.parse(
    await readFile(path.join(root, 'data/topic-relations.json'), 'utf8'),
  );
  const validation = await validateContent(contentRoot, {
    requiredCollection: 'complete',
  });
  if (validation.errors.length) {
    throw new Error(`Content validation failed:\n${validation.errors.join('\n')}`);
  }

  const built = buildTopicManifest({
    backlogSource,
    documents: validation.documents,
    relations,
  });
  if (built.errors.length) {
    throw new Error(`Topic manifest failed:\n${built.errors.join('\n')}`);
  }

  const caseCatalog = buildCaseCatalogFromDocuments(validation.documents);
  return {
    [generatedPaths.manifest]: `${JSON.stringify(built.manifest, null, 2)}\n`,
    [generatedPaths.indexes]: `${JSON.stringify(built.indexes, null, 2)}\n`,
    [generatedPaths.caseCatalog]: serializeCaseCatalog(caseCatalog),
  };
}
```

Move the pure document-to-case-entry mapping from `buildCaseCatalog()` into an exported `buildCaseCatalogFromDocuments(documents)` helper. Keep `buildCaseCatalog(root)` as validation plus delegation.

- [ ] **Step 4: Implement atomic write and exact check**

For write mode:

1. build every byte string before writing;
2. create parent directories;
3. write sibling temporary files;
4. rename temporary files to final paths only after every temporary write succeeds;
5. remove remaining temporary files in `finally`.

For check mode, compare `Buffer` values and return sorted stale relative paths. Missing files count as stale; other read errors propagate.

- [ ] **Step 5: Add package commands**

Update scripts:

```json
"generate:content": "node scripts/generate-content-platform.mjs --write",
"check:content": "node scripts/generate-content-platform.mjs --check",
"generate:catalog": "npm run generate:content",
"check:catalog": "npm run check:content",
"verify": "npm run test && npm run validate:content && npm run check:content && npm run typecheck && npm run build"
```

The CLI must reject missing mode, both modes, and unknown arguments with usage text and exit 1.

- [ ] **Step 6: Verify GREEN and regenerate repository artifacts**

Run:

```bash
node --test tests/content-platform-generation.test.mjs tests/case-catalog-generation.test.mjs
npm run generate:content
npm run check:content
git diff -- src/generated/case-catalog.json
```

Expected: tests PASS; check exits 0; the compatibility case catalog has no semantic diff.

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-content-platform.mjs scripts/generate-case-catalog.mjs \
  tests/content-platform-generation.test.mjs tests/case-catalog-generation.test.mjs \
  package.json src/generated/topic-manifest.json src/generated/topic-indexes.json \
  src/generated/case-catalog.json
git commit -m "feat: generate content platform artifacts"
```

---

### Task 5: Render manifest-backed indexes

**Files:**
- Create: `tests/topic-index.test.mjs`
- Create: `src/components/TopicIndex/index.tsx`
- Create: `src/components/TopicIndex/styles.module.css`
- Create: `content/concepts/index.mdx`
- Create: `content/principles/index.mdx`
- Create: `content/quality-attributes/index.mdx`
- Create: `content/methods/index.mdx`
- Create: `content/modeling/index.mdx`
- Create: `content/styles/index.mdx`
- Modify: `content/patterns/index.mdx`
- Modify: `content/cases/index.mdx`
- Modify: `content/questions/index.mdx`
- Modify: `content/paths/index.mdx`
- Test: `tests/topic-index.test.mjs`

**Interfaces:**
- Consumes:

```ts
type TopicType =
  | 'concept'
  | 'principle'
  | 'quality-attribute'
  | 'method'
  | 'modeling'
  | 'style'
  | 'pattern'
  | 'case'
  | 'question'
  | 'path';

type TopicIndexProps = {
  type: TopicType;
  plannedOnly?: boolean;
};
```

- [ ] **Step 1: Write structural and presentation RED tests**

In `tests/topic-index.test.mjs`, assert:

- the six new index files exist with slugs `/concepts`, `/principles`, `/quality-attributes`, `/methods`, `/modeling`, `/styles`;
- every new page imports `@site/src/components/TopicIndex` and passes the exact type;
- patterns/questions/paths pass their exact type;
- cases passes `type="case" plannedOnly`;
- component imports `@site/src/generated/topic-indexes.json`;
- published entries use Docusaurus `Link`;
- planned entries do not pass their slug to `Link`;
- first HTTPS source is rendered only when present;
- status labels distinguish backlog projection from content lifecycle.

The source-level test supplements typecheck and build; do not snapshot CSS class hashes.

- [ ] **Step 2: Run and observe RED**

Run:

```bash
node --test tests/topic-index.test.mjs
```

Expected: FAIL because component and six pages do not exist.

- [ ] **Step 3: Implement TopicIndex**

Use the generated JSON and this rendering boundary:

```tsx
import Link from '@docusaurus/Link';
import topicIndexes from '@site/src/generated/topic-indexes.json';
import styles from './styles.module.css';

export default function TopicIndex({type, plannedOnly = false}: TopicIndexProps) {
  const topics = topicIndexes[type].filter(
    (topic) => !plannedOnly || !topic.published,
  );

  if (topics.length === 0) {
    return <p>当前没有符合条件的主题。</p>;
  }

  return (
    <ul className={styles.grid}>
      {topics.map((topic) => {
        const firstSource = topic.primary_sources.find((source) =>
          source.startsWith('https://'),
        );
        return (
          <li className={styles.card} key={topic.id}>
            <div className={styles.heading}>
              {topic.published ? (
                <Link to={topic.slug}>{topic.title}</Link>
              ) : (
                <span>{topic.title}</span>
              )}
              <span className={styles.priority}>{topic.priority}</span>
            </div>
            <p>
              {topic.status.scope === 'backlog-projection'
                ? topic.status.value === 'complete' ? '任务已完成' : '计划主题'
                : `内容状态：${topic.status.value}`}
            </p>
            {topic.dependencies.length > 0 && (
              <p>前置主题：{topic.dependencies.join('、')}</p>
            )}
            {!topic.published && firstSource && (
              <p><a href={firstSource}>外部学习起点</a></p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

Add explicit local TypeScript types for the imported JSON shape. Use semantic `ul/li`, visible focus inherited from site links, a single-column mobile layout, and a two-column layout above 768 px.

- [ ] **Step 4: Add the responsive styles**

Create `src/components/TopicIndex/styles.module.css`:

```css
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  margin: 1rem 0 2rem;
  padding: 0;
  list-style: none;
}

.card {
  border: 1px solid var(--atlas-line);
  border-radius: 3px;
  background: var(--atlas-paper-muted);
  padding: 1rem;
}

.heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  font-weight: 650;
}

.priority {
  flex: 0 0 auto;
  color: var(--atlas-ink-soft);
  font-size: 0.8rem;
}

.card p:last-child {
  margin-bottom: 0;
}

@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

- [ ] **Step 5: Add six index pages**

Each new page uses this exact base metadata, changing title, slug, position, tag, and source according to the table below:

```yaml
title: 基础概念
slug: /concepts
sidebar_position: 2
content_type: reference
status: reviewed
difficulty: beginner
analyzed_at: 2026-07-23
source_cutoff: 2026-07-23
confidence: high
domains:
  - software-architecture
agent_patterns: []
protocols: []
quality_attributes:
  - maintainability
tags:
  - 基础概念
official_sources:
  - https://c4model.com/
```

| Title | Slug | Position | Tag | Official source |
| --- | --- | ---: | --- | --- |
| 基础概念 | `/concepts` | 2 | `基础概念` | `https://c4model.com/` |
| 架构原则 | `/principles` | 3 | `架构原则` | `https://awesome-architecture.com/architectural-design-principles/architectural-design-principles/` |
| 质量属性 | `/quality-attributes` | 4 | `质量属性` | `https://www.iso.org/standard/78176.html` |
| 架构方法 | `/methods` | 5 | `架构方法` | `https://www.sei.cmu.edu/library/quality-attribute-workshops-qaws-third-edition/` |
| 建模与图示 | `/modeling` | 6 | `建模` | `https://c4model.com/` |
| 架构风格 | `/styles` | 7 | `架构风格` | `https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures` |

Body shape:

```mdx
import TopicIndex from '@site/src/components/TopicIndex';

# 基础概念

本页从机器可读主题清单生成。可点击标题已经有站内正文；“计划主题”仍由长期 backlog 跟踪，不会链接到不存在的页面。

<TopicIndex type="concept" />
```

Use titles:

```text
基础概念
架构原则
质量属性
架构方法
建模与图示
架构风格
```

- [ ] **Step 6: Connect existing indexes**

- `content/patterns/index.mdx`: import TopicIndex and add `## 模式主题清单` plus `<TopicIndex type="pattern" />`.
- `content/questions/index.mdx`: add `## 题目清单` plus `<TopicIndex type="question" />`.
- `content/paths/index.mdx`: add `## 路线主题清单` plus `<TopicIndex type="path" />` after the curated roadmap entrances.
- `content/cases/index.mdx`: keep `<CaseCatalog />`; add `## 候选案例` and `<TopicIndex type="case" plannedOnly />`.

Do not remove current prose, CaseCatalog, roadmap, Mermaid, image, or case links.

- [ ] **Step 7: Verify GREEN**

Run:

```bash
node --test tests/topic-index.test.mjs
npm run typecheck
npm run build
```

Expected: tests and typecheck PASS; build contains no broken internal link because unpublished topics render without `Link`.

- [ ] **Step 8: Commit**

```bash
git add src/components/TopicIndex tests/topic-index.test.mjs \
  content/concepts content/principles content/quality-attributes \
  content/methods content/modeling content/styles \
  content/patterns/index.mdx content/cases/index.mdx \
  content/questions/index.mdx content/paths/index.mdx
git commit -m "feat: add manifest-backed topic indexes"
```

---

### Task 6: Stabilize sidebar ordering and navigation copy

**Files:**
- Modify: `tests/sidebar-navigation.test.mjs`
- Modify: `content/intro.mdx`
- Modify: `content/cases/index.mdx`
- Modify: `content/patterns/index.mdx`
- Modify: `content/questions/index.mdx`
- Modify: `content/paths/index.mdx`
- Modify: `content/references/index.mdx`
- Modify: six new index MDX files
- Test: `tests/sidebar-navigation.test.mjs`

**Interfaces:**
- Produces this sidebar order:

```text
1 首页
2 基础概念
3 架构原则
4 质量属性
5 架构方法
6 建模与图示
7 架构风格
8 架构模式
9 案例库
10 设计题
11 学习路径
12 资料库
```

- [ ] **Step 1: Change the sidebar-order test first**

Replace the six-entry expected map with the twelve paths and positions above. Preserve the test that requires one root autogenerated sidebar and concise canonical case labels.

- [ ] **Step 2: Run and observe RED**

Run:

```bash
node --test tests/sidebar-navigation.test.mjs
```

Expected: ordering test FAIL because positions conflict or are missing.

- [ ] **Step 3: Apply exact positions**

Set `sidebar_position` on all twelve index pages to the values above. Do not change slugs, titles, or case labels.

- [ ] **Step 4: Verify GREEN and navigation build**

Run:

```bash
node --test tests/sidebar-navigation.test.mjs tests/topic-index.test.mjs
npm run build
```

Expected: tests PASS; Docusaurus build has one category/link per section without position collisions.

- [ ] **Step 5: Commit**

```bash
git add tests/sidebar-navigation.test.mjs content/intro.mdx \
  content/concepts/index.mdx content/principles/index.mdx \
  content/quality-attributes/index.mdx content/methods/index.mdx \
  content/modeling/index.mdx content/styles/index.mdx \
  content/patterns/index.mdx content/cases/index.mdx \
  content/questions/index.mdx content/paths/index.mdx content/references/index.mdx
git commit -m "docs: order architecture knowledge sections"
```

---

### Task 7: Full verification, review, backlog evidence, and incremental publication

**Files:**
- Modify after successful implementation verification: `docs/content-backlog.md`
- Regenerate if inputs changed: `src/generated/topic-manifest.json`
- Regenerate if inputs changed: `src/generated/topic-indexes.json`
- Preserve: all unrelated content and local Ultragoal artifacts

**Interfaces:**
- Consumes: the completed implementation commits and repository publication gate.
- Produces: checked E0-01/E0-02, fresh generated artifacts, independent review evidence, successful Pages deployment, live-route checks, and an Ultragoal checkpoint.

- [ ] **Step 1: Run targeted platform verification**

Run:

```bash
node --test tests/content-validation.test.mjs \
  tests/backlog-topics.test.mjs \
  tests/topic-manifest.test.mjs \
  tests/content-platform-generation.test.mjs \
  tests/topic-index.test.mjs \
  tests/sidebar-navigation.test.mjs \
  tests/case-catalog-generation.test.mjs
npm run validate:content
npm run check:content
```

Expected: all tests PASS; content and generated artifacts are current.

- [ ] **Step 2: Run the full repository gate**

Run:

```bash
npm run verify
git diff --check
git status --short
```

Expected: all Node tests, content validation, generated-content check, typecheck, and Docusaurus build PASS; diff check is empty; only G002 files are modified.

- [ ] **Step 3: Perform independent implementation review**

Review against:

- E0-01 and E0-02 wording in `docs/content-backlog.md`;
- the design document;
- every plan task;
- the single-writer status invariant;
- published/planned link behavior;
- current case-catalog bytes and filters;
- generated-artifact determinism;
- error-message file/line context.

Resolve all blocking findings with new RED/GREEN tests before continuing.

- [ ] **Step 4: Mark backlog tasks only after technical approval**

Change exactly:

```md
- [x] **E0-01 P0｜建立内容类型契约**
- [x] **E0-02 P0｜建立唯一主题清单**
```

Add concise implementation evidence to their descriptions: schema/generator file names and the relevant generated artifacts. Run:

```bash
npm run generate:content
npm run verify
```

Expected: manifest status projection reflects the checked boxes where applicable and full verification remains green.

- [ ] **Step 5: Commit the completion evidence**

```bash
git add docs/content-backlog.md src/generated/topic-manifest.json \
  src/generated/topic-indexes.json src/generated/case-catalog.json
git commit -m "docs: record content platform completion"
```

If regeneration does not change a generated file, do not stage it.

- [ ] **Step 6: Push and wait for GitHub Pages**

Run:

```bash
git push origin main
gh run list --workflow deploy.yml --branch main --limit 3
gh run list --workflow deploy.yml --branch main --limit 1 \
  --json databaseId --jq '.[0].databaseId' > /tmp/tego-arch-g002-run-id
xargs gh run watch --exit-status < /tmp/tego-arch-g002-run-id
```

Expected: push succeeds; the run associated with the G002 head commit completes successfully.

- [ ] **Step 7: Check live routes**

Check:

```text
https://sealday.github.io/agentic-architecture-atlas/concepts
https://sealday.github.io/agentic-architecture-atlas/quality-attributes
https://sealday.github.io/agentic-architecture-atlas/cases
https://sealday.github.io/agentic-architecture-atlas/paths
```

Expected: all return HTTP 200; planned rows are not internal links; published case and path links remain usable.

- [ ] **Step 8: Record publication baseline**

Update `docs/content-backlog.md` current publication baseline with the G002 content commit, successful run URL, date, and checked routes. Commit and push this metadata-only update, wait for its Pages run, and retain the earlier G002 implementation commit as the content baseline to avoid self-reference.

- [ ] **Step 9: Checkpoint Ultragoal**

After a fresh active `get_goal` snapshot, checkpoint `G002-content-platform` with:

- implementation and evidence commit SHAs;
- targeted and full verification results;
- independent review approval;
- Pages run IDs;
- live route results.

Do not mark the aggregate Codex goal complete; continue to G003.
