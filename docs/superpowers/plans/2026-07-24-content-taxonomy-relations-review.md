# Content Taxonomy, Relations, and Review Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver E0-04, E0-06, E0-07, E0-13, and E0-14 as five independently verified and published increments: six production knowledge fixtures, registry-driven pattern navigation and case series, executable page relationships, and monthly/quarterly review gates.

**Architecture:** Preserve the current backlog → validated MDX → source governance → manifest/index/catalog generation pipeline. Add three small canonical registries, project their validated values into generated JSON, keep relationships in article front matter and the existing relation override, and run review-health as a deterministic read-only evaluator over the same content/source snapshot.

**Tech Stack:** Node.js 24 built-ins, `node:test`, TypeScript 6, React 19, Docusaurus 3.10, MDX, JSON registries, GitHub Actions, Mermaid, canonical source ledger.

## Global Constraints

- Do not add npm dependencies; parsing, validation, generation, reporting, and tests use Node.js built-ins.
- Preserve every existing public URL, all 18 case slugs and `catalog_order` values, and all 10 learning-path URLs.
- `docs/content-backlog.md` checkbox state remains the only human-written task-status source.
- Publishing a fixture sets manifest `published: true` but does not check its topic checkbox unless the article meets that topic's own completion criteria.
- `data/source-ledger.json` remains the only source identity, version, citation, license, and document-review authority.
- `community-index`, awesome lists, roadmaps, and third-party indexes remain discovery/learning only and cannot satisfy factual evidence gates.
- Generate artifacts only through `scripts/generate-content-platform.mjs`; do not hand-edit `src/generated/*.json`.
- Keep default verification offline; only the scheduled/manual live-link workflow performs network probes.
- `related_questions` is optional; a published knowledge page passes the terminal relation gate with at least one published `related_cases` target or one published `related_questions` target.
- Published `adjacent_topics` are reciprocal: if A names B, B must name A. Adjacency remains outside dependency-cycle analysis.
- All filesystem roots derived from `import.meta.url` must use `fileURLToPath(new URL(...))` before being passed to `fs`, `path`, scanners, validators, or builders.
- Registry files are mandatory inputs to validator CLI, manifest/catalog builders, generation, runtime projections, and direct tests. Missing or unreadable registries fail closed; no caller may silently skip registry enforcement.
- Implementation workers may create local commits only. They must not push, deploy, update Ultragoal state, checkpoint goals, or write deployment metadata.
- Only the Ultragoal leader may push `main`, wait for GitHub Pages, perform online smoke checks, update E0 deployment metadata, and run the single final G004 `omx ultragoal checkpoint` after Unit E.
- Every local implementation task follows RED → observed failure → minimal GREEN → targeted regression → local commit.
- Each of the five release units must pass `npm run verify`, `git diff --check`, an independent review gate, Pages deployment, and online smoke before the next unit starts.

### Leader-only bounded Actions helper

Before any release gate, define this helper in the leader shell. Every implementation and metadata commit uses it;
an immediate one-shot `gh run list` result is never trusted.

```bash
wait_for_pages_run() {
  local expected_sha="$1"
  local run_json=""
  for attempt in $(seq 1 30); do
    run_json=$(gh run list --workflow deploy.yml --branch main --limit 30 \
      --json databaseId,headSha,status,conclusion,url \
      --jq "map(select(.headSha == \"$expected_sha\"))[0] // empty")
    if [ -n "$run_json" ]; then
      break
    fi
    sleep 10
  done
  test -n "$run_json"
  PAGES_RUN_ID=$(node -e 'const v=JSON.parse(process.argv[1]); process.stdout.write(String(v.databaseId))' "$run_json")
  PAGES_RUN_SHA=$(node -e 'const v=JSON.parse(process.argv[1]); process.stdout.write(v.headSha)' "$run_json")
  test "$PAGES_RUN_SHA" = "$expected_sha"
  gh run watch "$PAGES_RUN_ID" --exit-status
  gh run view "$PAGES_RUN_ID" \
    --json databaseId,headSha,status,conclusion,url \
    --jq 'select(.headSha == "'"$expected_sha"'" and .status == "completed" and .conclusion == "success")'
}

fetch_and_assert_text() {
  local route="$1"
  local expected_text="$2"
  local smoke_name
  smoke_name=$(printf '%s' "$route" | tr '/' '-')
  SMOKE_FILE="/tmp/g004-smoke-${smoke_name}.html"
  curl --fail --silent --show-error \
    "https://sealday.github.io/agentic-architecture-atlas/$route" \
    --output "$SMOKE_FILE"
  test -s "$SMOKE_FILE"
  rg -F -- "$expected_text" "$SMOKE_FILE" >/dev/null
}
```

The 30 × 10-second discovery loop is bounded. A missing run, mismatched `headSha`, non-success conclusion, or empty
final JSON fails the release gate. `fetch_and_assert_text` retains each response under `/tmp` and fails when the
expected page text is absent; a bare HTTP 200 is not sufficient smoke evidence.

---

## File Structure

### Canonical inputs

- Create `data/pattern-groups.json`: pattern group IDs, labels, descriptions, order, and exhaustive topic assignments.
- Create `data/case-series.json`: case series IDs, labels, order, homepage visibility, and descriptions.
- Create `data/review-policies.json`: deterministic calendar-month review policies.
- Modify `data/topic-relations.json`: planned-topic-only overrides for dependencies, adjacent topics, related cases, and related questions.
- Modify `docs/content-backlog.md`: add formal planned migration topics `PAT-MIG-01` through `PAT-MIG-03`.
- Modify `data/source-ledger.json`: six fixture document citations, two new primary sources, and later source `registered_at`.
- Modify `data/source-link-health.json`: reviewed transport results for newly introduced source locators.

### Content

- Create `content/principles/pr-01-information-hiding.mdx`.
- Create `content/patterns/rel-02-retry-backoff-jitter.mdx`.
- Create `content/styles/sty-00-comparison-framework.mdx`.
- Create `content/methods/mth-03-adr-lifecycle.mdx`.
- Create `content/modeling/mod-02-c4-context-container.mdx`.
- Create `content/quality-attributes/qa-01-scenario-writing.mdx`.
- Modify `content/patterns/index.mdx`: registry-driven common pattern groups plus preserved Agent control material.
- Modify `content/cases/new-api-channel-pool-routing.mdx`: series only.
- Modify `content/cases/litellm-virtual-keys-governance.mdx`: series only.
- Modify `content/cases/kong-ai-gateway-routing-resilience.mdx`: series only.

### Validation and generation

- Modify `scripts/content-schema.mjs`: pattern contract, relation fields, and removal of case-series/catalog hardcoding.
- Modify `scripts/validate-content.mjs`: knowledge-index boundary, registry-aware case validation, relation metadata shapes, and review-policy shapes.
- Create `scripts/content-registries.mjs`: exact-schema parsers for the three registries.
- Modify `scripts/topic-manifest.mjs`: pattern group, adjacent topic, related question, and review-policy projections.
- Modify `scripts/generate-case-catalog.mjs`: discovered-case completeness without frozen slug arrays.
- Modify `scripts/generate-content-platform.mjs`: read registries once and generate pattern-group/case-series projections in the recoverable transaction.
- Modify `scripts/source-ledger.mjs`: `registered_at`, exported visible-line helper, and unchanged evidence-role rules.
- Create `scripts/content-relations.mjs`: visible internal-link extraction and page relationship gate.
- Create `scripts/content-review-health.mjs`: injected-clock monthly/quarterly evaluator and JSON/Markdown serializer.

### Frontend

- Create `src/components/PatternTopicIndex/patternTopicIndexModel.ts`.
- Create `src/components/PatternTopicIndex/index.tsx`.
- Create `src/components/PatternTopicIndex/styles.module.css`.
- Modify `src/components/TopicIndex/topicIndexModel.ts`: accept manifest relationship/group projections.
- Modify `src/data/caseCatalog.ts`: runtime-validated generated series registry instead of a hand-written union/map.
- Modify `src/components/CaseCatalog/filterCases.ts`: registry order.
- Modify `src/pages/index.tsx`: homepage series visibility from the generated registry.

### Generated artifacts

- Modify `src/generated/source-ledger.json`.
- Modify `src/generated/topic-manifest.json`.
- Modify `src/generated/topic-indexes.json`.
- Modify `src/generated/case-catalog.json`.
- Create `src/generated/pattern-groups.json`.
- Create `src/generated/case-series.json`.

### Tests and workflow

- Modify `tests/content-validation.test.mjs`.
- Create `tests/knowledge-fixtures.test.mjs`.
- Create `tests/content-registries.test.mjs`.
- Modify `tests/backlog-topics.test.mjs`.
- Modify `tests/topic-manifest.test.mjs`.
- Modify `tests/topic-index.test.mjs`.
- Modify `tests/content-platform-generation.test.mjs`.
- Modify `tests/case-catalog-generation.test.mjs`.
- Create `tests/fixtures/legacy-case-order.json`: regression-only snapshot of the existing 18 case slugs and orders.
- Modify `tests/case-catalog-selectors.test.mjs`.
- Modify `tests/sidebar-navigation.test.mjs`.
- Modify `tests/learning-path.test.mjs`.
- Modify `tests/case-fact-inventory.test.mjs`.
- Create `tests/content-relations.test.mjs`.
- Create `tests/content-review-health.test.mjs`.
- Modify `tests/source-ledger.test.mjs`.
- Modify `tests/source-ledger-rendering.test.mjs`.
- Modify `tests/workflow-configuration.test.mjs`.
- Modify `.github/workflows/link-health.yml`.
- Modify `package.json`.

## Release Unit A — E0-04: Six Production Knowledge Fixtures

### Task 1: Add the production Pattern contract without validating the Pattern index as an article

**Files:**
- Modify: `scripts/content-schema.mjs:17-24,36-103,114-122`
- Modify: `scripts/validate-content.mjs:194-369`
- Modify: `tests/content-validation.test.mjs:900-1140`

**Interfaces:**
- Consumes: `readContentDocuments(root)` returning `{file, metadata, headings}`.
- Produces: `knowledgeContentTypes` containing `pattern`; `knowledgeTypeContracts.pattern`; `isKnowledgeArticle(file, metadata): boolean`.
- Invariant: `content/patterns/index.mdx` remains an index and is excluded by path, while every non-index `content_type: pattern` document must have `topic_id` and the exact Pattern H2 sequence.

- [ ] **Step 1: Write the failing Pattern contract tests**

Add these cases to `tests/content-validation.test.mjs`:

```js
const patternHeadings = [
  '## 学习问题',
  '## 问题与适用上下文',
  '## 约束与驱动力',
  '## 结构与协作关系',
  '## 运行机制',
  '## 失败模式与误用',
  '## 质量属性权衡',
  '## 实现与迁移提示',
  '## 相邻模式与反模式',
  '## 说明性场景',
  '## 来源',
];

test('accepts the Pattern knowledge contract and excludes the Pattern index', async () => {
  await withTempRoot(async (root) => {
    await writeMdx(
      root,
      'patterns/rel-02.mdx',
      validKnowledgeFrontMatter('pattern', {
        topic_id: 'REL-02',
        slug: '/patterns/rel-02',
      }),
      patternHeadings.join('\n\n'),
    );
    await writeMdx(
      root,
      'patterns/index.mdx',
      frontMatter({
        title: '架构模式',
        slug: '/patterns',
        content_type: 'pattern',
        status: 'reviewed',
        difficulty: 'intermediate',
        analyzed_at: '2026-07-24',
        source_cutoff: '2026-07-24',
        confidence: 'high',
        domains: ['software-architecture'],
        agent_patterns: [],
        protocols: [],
        quality_attributes: ['maintainability'],
        tags: ['模式'],
      }),
      '# 架构模式',
    );

    const result = await validateContent(root);
    assert.deepEqual(result.errors, []);
  });
});

test('rejects a Pattern article with a reordered mechanism section', async () => {
  await withTempRoot(async (root) => {
    const reordered = [...patternHeadings];
    [reordered[4], reordered[5]] = [reordered[5], reordered[4]];
    await writeMdx(
      root,
      'patterns/rel-02.mdx',
      validKnowledgeFrontMatter('pattern', {
        topic_id: 'REL-02',
        slug: '/patterns/rel-02',
      }),
      reordered.join('\n\n'),
    );

    const result = await validateContent(root);
    assert.match(
      result.errors.join('\n'),
      /invalid ## 学习问题-contract H2 sequence at position 5/,
    );
  });
});
```

- [ ] **Step 2: Run the focused tests and observe RED**

Run:

```bash
node --test --test-name-pattern='Pattern knowledge contract|Pattern article' tests/content-validation.test.mjs
```

Expected: FAIL because `pattern` is not in `knowledgeContentTypes`, so the reordered Pattern article produces no contract error.

- [ ] **Step 3: Add the Pattern contract and index boundary**

Add to `scripts/content-schema.mjs`:

```js
export const knowledgeContentTypes = [
  'concept',
  'principle',
  'quality-attribute',
  'method',
  'modeling',
  'style',
  'pattern',
];

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
  pattern: [
    '## 学习问题',
    '## 问题与适用上下文',
    '## 约束与驱动力',
    '## 结构与协作关系',
    '## 运行机制',
    '## 失败模式与误用',
    '## 质量属性权衡',
    '## 实现与迁移提示',
    '## 相邻模式与反模式',
    '## 说明性场景',
    '## 来源',
  ],
};
```

Remove the standalone `'pattern'` literal from `allowedValues.content_type`; it now enters that allowlist exactly once
through `...knowledgeContentTypes`.

Add and use this predicate in `scripts/validate-content.mjs`:

```js
function isKnowledgeArticle(file, metadata) {
  return (
    knowledgeContentTypes.includes(metadata.content_type) &&
    file !== 'index.mdx' &&
    !file.endsWith('/index.mdx')
  );
}
```

Replace the knowledge branch condition with:

```js
if (isKnowledgeArticle(file, metadata)) {
  const type = metadata.content_type;
  for (const field of knowledgeRequiredFields) {
    if (!(field in metadata)) {
      errors.push(`${file}: missing required ${type} field "${field}"`);
    }
  }
  validateOrderedH2Contract(file, headings, knowledgeTypeContracts[type], errors);
  if (type === 'quality-attribute') {
    validateSectionH3Contract(
      file,
      headings,
      '## 质量属性场景',
      qualityAttributeScenarioHeadings,
      errors,
    );
  }
}
```

Retain the existing summary, topic ID, priority, dependency, and related-case checks inside this branch.

- [ ] **Step 4: Run focused and full content-contract tests**

Run:

```bash
node --test tests/content-validation.test.mjs
```

Expected: PASS with zero failed tests; the new Pattern tests pass and the six prior knowledge contract fixtures remain green.

- [ ] **Step 5: Commit the contract**

```bash
git add scripts/content-schema.mjs scripts/validate-content.mjs tests/content-validation.test.mjs
git commit -m "feat: define the Pattern article contract"
```

Expected: one local commit containing only the schema, validator, and validator tests.

### Task 2: Add six production fixtures and close their source-governance records

**Files:**
- Create: `content/principles/pr-01-information-hiding.mdx`
- Create: `content/patterns/rel-02-retry-backoff-jitter.mdx`
- Create: `content/styles/sty-00-comparison-framework.mdx`
- Create: `content/methods/mth-03-adr-lifecycle.mdx`
- Create: `content/modeling/mod-02-c4-context-container.mdx`
- Create: `content/quality-attributes/qa-01-scenario-writing.mdx`
- Create: `tests/knowledge-fixtures.test.mjs`
- Modify: `data/source-ledger.json`
- Modify: `data/source-link-health.json`

**Interfaces:**
- Consumes: the seven knowledge contracts in `knowledgeTypeContracts`; `validateSourceGovernance(documents, ledger)`.
- Produces: published topics `PR-01`, `REL-02`, `STY-00`, `MTH-03`, `MOD-02`, and `QA-01`.
- Source IDs reused: `src-sei-bfb2b903b4eb`, `src-learn-1abc9c267864`, `src-docs-9950c767c50f`, `src-arc42-8b346f00707f`, `src-c4model-f5342a5e8659`, `src-sei-0547756e19ba`, `src-iso-11f3b103e932`.
- Source IDs added: `src-adr-d5366499f6a8`, `src-acm-96e876360753`.
- Invariant: the six topic checkboxes in `docs/content-backlog.md` remain pending unless a separate editorial review proves each topic's own stop condition.
- Invariant: every fixture has 3–5 learning questions, at least two independent sources, an original Mermaid diagram or decision table, a complete worked exercise, explicit counterexamples/non-use conditions, and page-specific editorial/fact/copyright/render review evidence.

- [ ] **Step 1: Write the failing repository fixture inventory test**

Create `tests/knowledge-fixtures.test.mjs`:

```js
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {readContentDocuments} from '../scripts/content-metadata.mjs';
import {parseBacklogTopics} from '../scripts/backlog-topics.mjs';
import {knowledgeTypeContracts} from '../scripts/content-schema.mjs';
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

  const validation = await validateContent(contentRoot);
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
```

- [ ] **Step 2: Run the inventory test and observe RED**

Run:

```bash
node --test tests/knowledge-fixtures.test.mjs
```

Expected: FAIL on `PR-01 must be published`.

- [ ] **Step 3: Add exact front matter and contract headings for all six pages**

Use the following front matter values and section order. Every listed section must contain substantive original prose,
3–5 bullet questions under `学习问题`, at least one original Mermaid diagram or original decision table, explicit
failure/limit and non-use language, one complete input → decision → outcome exercise, the visible internal links shown
here, and visible links for every ledger citation.

`content/principles/pr-01-information-hiding.mdx`:

```mdx
---
title: 信息隐藏与封装
slug: /principles/pr-01
content_type: principle
status: reviewed
difficulty: beginner
analyzed_at: 2026-07-24
source_cutoff: 2026-07-24
confidence: high
domains:
  - software-architecture
agent_patterns: []
protocols: []
quality_attributes:
  - maintainability
  - modifiability
tags:
  - 信息隐藏
  - 模块边界
summary: 用变化决策而不是访问修饰符定义模块边界，并检查泄漏如何扩大修改成本。
topic_id: PR-01
priority: P0
depends_on: []
related_cases:
  - /cases/micro-frontends-single-spa
---

# 信息隐藏与封装

## 学习问题
- 信息隐藏保护的是哪类变化？
- 为什么 `private` 不能自动形成架构边界？
- 如何识别泄漏的设计决策？

## 要保护的性质
说明稳定接口如何隔离可能变化的设计决策，并链接[原则入口](/principles)。

## 冲突与适用上下文
比较可见性、调试便利、跨团队协作和演进成本。

## 机制
用决策所有权、最小接口和契约测试解释隐藏机制。

## 误用与反原则
区分访问限制、数据包装和真正的信息隐藏。

## 适用尺度
覆盖函数、模块、服务、数据和团队边界。

## 相邻原则
连接[架构风格比较框架](/styles/sty-00)。

## 说明性场景
用[Micro-Frontend 案例](/cases/micro-frontends-single-spa)检查共享依赖泄漏。

## 来源
依据 [Parnas 的模块分解论文](https://dl.acm.org/doi/10.1145/361598.361623)与
[SEI 软件架构原则课程](https://www.sei.cmu.edu/training/software-architecture-principles-practices/)核对定义和尺度。
```

`content/patterns/rel-02-retry-backoff-jitter.mdx`:

```mdx
---
title: Retry、Exponential Backoff 与 Jitter
slug: /patterns/rel-02
content_type: pattern
status: reviewed
difficulty: intermediate
analyzed_at: 2026-07-24
source_cutoff: 2026-07-24
confidence: high
domains:
  - distributed-systems
agent_patterns: []
protocols: []
quality_attributes:
  - reliability
  - latency
tags:
  - 重试
  - 退避
  - 抖动
summary: 从重试资格、预算、退避与抖动解释恢复收益和放大风险。
topic_id: REL-02
priority: P0
depends_on: []
related_cases:
  - /cases/temporal-saga-durable-execution
---

# Retry、Exponential Backoff 与 Jitter

## 学习问题
- 什么失败值得重试？
- 谁拥有端到端重试预算？
- 何时应停止并暴露失败？

## 问题与适用上下文
区分瞬时故障、永久错误、不确定结果和副作用窗口，并链接[模式入口](/patterns)。

## 约束与驱动力
明确 deadline、幂等性、容量和公平性约束。

## 结构与协作关系
描述调用方、被调用方、限流器和观测信号的责任。

## 运行机制
说明指数退避、随机抖动、最大尝试和端到端预算。

## 失败模式与误用
解释重试风暴、同步重试、重复副作用和掩盖永久错误。

## 质量属性权衡
比较可用性、尾延迟、负载和恢复时间。

## 实现与迁移提示
先统一错误分类和 deadline，再逐层删除重复重试。

## 相邻模式与反模式
连接[质量属性场景写法](/quality-attributes/qa-01)并指出 Retry Storm 反模式。

## 说明性场景
用 [Temporal durable execution](/cases/temporal-saga-durable-execution)检查活动重试和工作流重放边界。

## 来源
依据 [Azure Retry pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/retry)核对模式边界。
```

`content/styles/sty-00-comparison-framework.mdx` uses:

```yaml
title: 架构风格比较框架
slug: /styles/sty-00
content_type: style
status: reviewed
difficulty: intermediate
analyzed_at: 2026-07-24
source_cutoff: 2026-07-24
confidence: high
domains:
  - software-architecture
agent_patterns: []
protocols: []
quality_attributes:
  - maintainability
  - reliability
  - deployability
tags:
  - 架构风格
  - 比较框架
summary: 用边界、控制流、数据、部署和团队拓扑在同一尺度上比较架构风格。
topic_id: STY-00
priority: P0
depends_on: []
related_cases:
  - /cases/micro-frontends-single-spa
```

Its body links `/styles`, `/principles/pr-01`, the Micro-Frontend case, and the SEI principles source. Its H2
sequence is exactly:

```text
## 学习问题
## 组件、连接器与约束
## 边界与控制流
## 数据所有权与一致性
## 部署单元与故障域
## 团队拓扑
## 质量属性收益与成本
## 迁移路径
## 禁用条件
## 对比案例
## 来源
```

`content/methods/mth-03-adr-lifecycle.mdx` uses:

```yaml
title: ADR 生命周期
slug: /methods/mth-03
content_type: method
status: reviewed
difficulty: beginner
analyzed_at: 2026-07-24
source_cutoff: 2026-07-24
confidence: high
domains:
  - software-architecture
agent_patterns: []
protocols: []
quality_attributes:
  - maintainability
  - auditability
tags:
  - ADR
  - 架构决策
summary: 把架构决策从一次性文档扩展为提出、接受、替代、废弃和复核的生命周期。
topic_id: MTH-03
priority: P0
depends_on:
  - QA-01
related_cases:
  - /cases/kubernetes-reconciliation-loop
```

Its body links `/methods`, `/quality-attributes/qa-01`, the Kubernetes case, and `https://adr.github.io/`. Its H2
sequence is exactly:

```text
## 学习问题
## 输入与参与者
## 步骤
## 产物
## 完成判断
## 常见失败
## 与其他方法的衔接
## 完整演练
## 来源
```

`content/modeling/mod-02-c4-context-container.mdx` uses:

```yaml
title: C4 Context 与 Container
slug: /modeling/mod-02
content_type: modeling
status: reviewed
difficulty: beginner
analyzed_at: 2026-07-24
source_cutoff: 2026-07-24
confidence: high
domains:
  - software-architecture
agent_patterns: []
protocols: []
quality_attributes:
  - understandability
  - maintainability
tags:
  - C4
  - 架构图
summary: 用 Context 和 Container 明确系统边界、参与者、职责和可部署单元，避免图示伪精确。
topic_id: MOD-02
priority: P0
depends_on: []
related_cases:
  - /cases/microsoft-multi-agent-reference-architecture
```

Its body links `/modeling`, `/styles/sty-00`, the Microsoft reference case, and `https://c4model.com/`. Its H2
sequence is exactly:

```text
## 学习问题
## 建模目标与输入
## 参与者与步骤
## 模型产物
## 完成判断
## 常见失败
## 与其他模型的衔接
## 完整演练
## 来源
```

`content/quality-attributes/qa-01-scenario-writing.mdx` uses:

```yaml
title: 质量属性场景写法
slug: /quality-attributes/qa-01
content_type: quality-attribute
status: reviewed
difficulty: beginner
analyzed_at: 2026-07-24
source_cutoff: 2026-07-24
confidence: high
domains:
  - software-architecture
agent_patterns: []
protocols: []
quality_attributes:
  - reliability
  - performance
tags:
  - 质量属性
  - 场景
summary: 用六字段场景把模糊质量口号转成可定位、可测量和可评审的架构驱动因素。
topic_id: QA-01
priority: P0
depends_on:
  - FND-02
  - QA-00
related_cases:
  - /cases/aws-cell-shuffle-sharding
```

Its body links `/quality-attributes`, `/methods/mth-03`, the AWS Cell case, the SEI QAW source, and ISO/IEC 25010.
Its quality scenario contains exactly:

```text
## 学习问题
## 定义与业务目标
## 质量属性场景
### Source
### Stimulus
### Environment
### Artifact
### Response
### Response measure
## 架构策略
## 测量信号与阈值
## 权衡与失败模式
## 相邻质量属性
## 说明性场景
## 来源
```

Use this page-specific quality matrix; do not treat one page's evidence as covering another:

| Topic | Independent source pair | Original visual/decision aid | Complete exercise | Counterexample / do-not-use condition |
| --- | --- | --- | --- | --- |
| `PR-01` | Parnas/ACM + SEI | information-leak Mermaid boundary map | trace one change through two module decompositions | visibility modifiers without hidden decisions |
| `REL-02` | Azure Architecture Center + Temporal | retry-eligibility/budget decision table | calculate attempts, delays, deadline, and stop result | non-idempotent or permanent failures |
| `STY-00` | SEI + arc42 | style comparison decision table | score two candidate styles against one scenario set | choosing a style by technology fashion |
| `MTH-03` | ADR organization + SEI | ADR state-transition Mermaid | propose, accept, supersede, and review one decision | logging trivial reversible choices as architecture decisions |
| `MOD-02` | C4 Model + arc42 | original Context→Container Mermaid | derive two diagram levels from a stated system boundary | using C4 as runtime sequence or deployment proof |
| `QA-01` | SEI QAW + ISO/IEC 25010 | six-field scenario decision table | turn one vague quality goal into a measurable scenario | targets with no source, environment, or response measure |

For each row, record four separate review results keyed by topic ID: editorial (3–5 questions, prose density,
exercise completeness), fact (claims closed by the two sources), copyright (original structure/visual and quotation
boundaries), and render (Mermaid/table, headings, internal/external links, mobile width). Any missing page-level result
blocks Unit A.

- [ ] **Step 4: Add the two missing source records and six document entries**

Add these exact source identities to `data/source-ledger.json`; use the existing conservative `facts-summary` policy and verify the title, organization, license evidence, and final transport during review:

```json
{
  "id": "src-adr-d5366499f6a8",
  "canonical_locator": "https://adr.github.io/",
  "transport_locator": "https://adr.github.io/",
  "query_insensitive": false,
  "locator_aliases": [],
  "tombstone": null,
  "title": "Architectural Decision Records",
  "author_or_org": "ADR GitHub organization",
  "published_at": null,
  "checked_at": "2026-07-24",
  "version": "Current work/page checked on 2026-07-24",
  "source_kind": "official-docs",
  "tier": "primary",
  "allowed_evidence_roles": ["definition", "method", "learning"],
  "license": "LicenseRef-All-Rights-Reserved",
  "license_scope": "The cited ADR website text; linked repositories and third-party works excluded",
  "license_evidence_url": null,
  "license_evidence_note": "No reuse license is declared on the cited website; only factual summary and links are used.",
  "license_family_id": "https://adr.github.io/",
  "license_family_grouping": "identity",
  "family_grouping_evidence_url": null,
  "copyright_policy": "facts-and-short-quotation",
  "usage_boundary": "Defines ADR lifecycle resources; it does not prove that a particular decision is correct.",
  "link_policy": "stable",
  "expected_final_transport_locator": "https://adr.github.io/",
  "expected_final_approved_at": "2026-07-24",
  "expected_final_approval_note": "Initial reviewed transport baseline"
}
```

```json
{
  "id": "src-acm-96e876360753",
  "canonical_locator": "https://dl.acm.org/doi/10.1145/361598.361623",
  "transport_locator": "https://dl.acm.org/doi/10.1145/361598.361623",
  "query_insensitive": false,
  "locator_aliases": [],
  "tombstone": null,
  "title": "On the Criteria To Be Used in Decomposing Systems into Modules",
  "author_or_org": "D. L. Parnas / ACM",
  "published_at": "1972-12-01",
  "checked_at": "2026-07-24",
  "version": "Communications of the ACM 15(12), DOI 10.1145/361598.361623",
  "source_kind": "paper",
  "tier": "primary",
  "allowed_evidence_roles": ["definition", "historical-context", "method"],
  "license": "LicenseRef-All-Rights-Reserved",
  "license_scope": "The cited ACM paper; abstract, references, and linked works excluded from reuse",
  "license_evidence_url": null,
  "license_evidence_note": "ACM publication rights are reserved; only factual summary and a link are used.",
  "license_family_id": "doi:10.1145/361598.361623",
  "license_family_grouping": "identity",
  "family_grouping_evidence_url": null,
  "copyright_policy": "facts-and-short-quotation",
  "usage_boundary": "Supports the historical definition of information hiding; it does not establish modern deployment or team claims.",
  "link_policy": "stable",
  "expected_final_transport_locator": "https://dl.acm.org/doi/10.1145/361598.361623",
  "expected_final_approved_at": "2026-07-24",
  "expected_final_approval_note": "Initial reviewed DOI transport baseline"
}
```

For `src-acm-96e876360753`, the shown `transport_locator`, `link_policy`, and expected-final values are valid only
when the full audit observes a successful same-locator final response. If the audited final locator differs, use the
repository's existing reviewed-redirect policy and write the observed final locator/approval fields; if the result is
blocked, retired, or unsuccessful, do not commit the source as publishable. The DOI license family remains
`doi:10.1145/361598.361623` in every branch.

For every new fixture, add a document entry with:

```json
{
  "reviewed_at": "2026-07-24",
  "copyright_checks": [
    "original-structure",
    "quotation-boundary",
    "attribution-complete",
    "illustration-rights"
  ],
  "citations": [
    {
      "source_id": "src-c4model-f5342a5e8659",
      "citation_url": "https://c4model.com/",
      "roles": ["method"],
      "manifest_primary": true,
      "usage_mode": "facts-summary",
      "attribution_note": "C4 Model, Simon Brown",
      "modification_note": null,
      "excerpt": null,
      "quotation_reviewed": false
    }
  ]
}
```

Use the source IDs and visible URLs declared above for each document. Do not cite a community index as
`manifest_primary`; use `facts-summary`, `excerpt: null`, and original prose for every fixture citation.

Use this exact citation matrix:

| Document | Source ID | Visible citation URL | Roles | Primary |
| --- | --- | --- | --- | --- |
| `content/principles/pr-01-information-hiding.mdx` | `src-acm-96e876360753` | `https://dl.acm.org/doi/10.1145/361598.361623` | `definition`, `historical-context` | `true` |
| `content/principles/pr-01-information-hiding.mdx` | `src-sei-bfb2b903b4eb` | `https://www.sei.cmu.edu/training/software-architecture-principles-practices/` | `learning` | `false` |
| `content/patterns/rel-02-retry-backoff-jitter.mdx` | `src-learn-1abc9c267864` | `https://learn.microsoft.com/en-us/azure/architecture/patterns/retry` | `definition`, `method` | `true` |
| `content/patterns/rel-02-retry-backoff-jitter.mdx` | `src-docs-9950c767c50f` | `https://docs.temporal.io/encyclopedia/retry-policies` | `method`, `runtime-fact` | `true` |
| `content/styles/sty-00-comparison-framework.mdx` | `src-sei-bfb2b903b4eb` | `https://www.sei.cmu.edu/training/software-architecture-principles-practices/` | `definition`, `method` | `true` |
| `content/styles/sty-00-comparison-framework.mdx` | `src-arc42-8b346f00707f` | `https://arc42.org/` | `method`, `learning` | `true` |
| `content/methods/mth-03-adr-lifecycle.mdx` | `src-adr-d5366499f6a8` | `https://adr.github.io/` | `definition`, `method` | `true` |
| `content/methods/mth-03-adr-lifecycle.mdx` | `src-sei-bfb2b903b4eb` | `https://www.sei.cmu.edu/training/software-architecture-principles-practices/` | `method`, `learning` | `false` |
| `content/modeling/mod-02-c4-context-container.mdx` | `src-c4model-f5342a5e8659` | `https://c4model.com/` | `method` | `true` |
| `content/modeling/mod-02-c4-context-container.mdx` | `src-arc42-8b346f00707f` | `https://arc42.org/` | `method`, `learning` | `true` |
| `content/quality-attributes/qa-01-scenario-writing.mdx` | `src-sei-0547756e19ba` | `https://www.sei.cmu.edu/library/quality-attribute-workshops-qaws-third-edition/` | `method` | `true` |
| `content/quality-attributes/qa-01-scenario-writing.mdx` | `src-iso-11f3b103e932` | `https://www.iso.org/standard/78176.html` | `definition` | `true` |

Every matrix row becomes one full citation object with the row's `source_id`, URL, roles, and
`manifest_primary`; all use `usage_mode: "facts-summary"`, a source-specific non-empty attribution note,
`modification_note: null`, `excerpt: null`, and `quotation_reviewed: false`.

Do not write any of these published topics to `data/topic-relations.json`. When `QA-01` becomes published, remove
its existing planned override in the same Unit A commit; its front matter is already the sole owner of dependencies
and related cases.

- [ ] **Step 5: Run and review the complete atomic transport audit**

Run:

```bash
npm run refresh:links
npm run check:links
```

Expected: the repository's existing atomic writer audits every canonical transport, preserves a complete sorted
cache, and both commands exit 0. Inspect the full cache diff, including unchanged-source outcome changes; confirm the
two new source IDs are covered, then set each new source's transport policy and expected-final fields from the
observed result. Do not implement or manually perform a two-record filter/merge.

- [ ] **Step 6: Run the fixture, source-governance, and build tests**

Run:

```bash
node --test tests/knowledge-fixtures.test.mjs tests/source-ledger.test.mjs
npm run validate:content
npm run generate:content
npm run check:content
npm run build
```

Expected: every command exits 0; Docusaurus reports a successful production build; generated manifest contains all
six topic IDs with `published: true` and backlog-projection `status.value: "pending"`.

- [ ] **Step 7: Complete and record all 24 page-specific reviews**

For each of the six topic IDs, record one editorial, fact, copyright, and render result against that page and the
quality-matrix row above. Open the built route, inspect the original visual/table, exercise, counterexample, 3–5
questions, two independent citations, and mobile-width rendering. The evidence report must name all 24 results;
aggregate statements such as “all fixtures reviewed” are insufficient.

Expected: 24 named results, all passing, with no missing topic/review-kind pair.

- [ ] **Step 8: Commit the six-page content baseline**

```bash
git add content/principles/pr-01-information-hiding.mdx \
  content/patterns/rel-02-retry-backoff-jitter.mdx \
  content/styles/sty-00-comparison-framework.mdx \
  content/methods/mth-03-adr-lifecycle.mdx \
  content/modeling/mod-02-c4-context-container.mdx \
  content/quality-attributes/qa-01-scenario-writing.mdx \
  data/source-ledger.json data/source-link-health.json data/topic-relations.json \
  src/generated/source-ledger.json src/generated/topic-manifest.json \
  src/generated/topic-indexes.json tests/knowledge-fixtures.test.mjs
git commit -m "content: add six production knowledge fixtures"
```

Expected: one local commit containing the six pages, governed sources, generated projections, and fixture test.

### Task 3: Verify Release Unit A and hand it to the Ultragoal leader

**Files:**
- Test: `tests/content-validation.test.mjs`
- Test: `tests/knowledge-fixtures.test.mjs`
- Test: `tests/source-ledger.test.mjs`
- Test: `tests/content-platform-generation.test.mjs`

**Interfaces:**
- Consumes: the local commits from Tasks 1–2.
- Produces: a local verification report with exact commands, commit hashes, and six route paths.
- Authority boundary: the implementation worker stops after the local commit and evidence report.

- [ ] **Step 1: Run the complete local release gate**

```bash
npm run verify
git diff --check
git status --short
```

Expected: `npm run verify` exits 0, `git diff --check` prints nothing, and `git status --short` prints nothing.

- [ ] **Step 2: Record the local evidence without changing repository files**

Report:

```text
Release Unit A local gate:
- npm run verify: PASS
- git diff --check: PASS
- routes: /principles/pr-01, /patterns/rel-02, /styles/sty-00,
  /methods/mth-03, /modeling/mod-02, /quality-attributes/qa-01
- fixture topic checkboxes: unchanged
- local commits: output of git log -2 --oneline
```

Expected: no new commit and no push.

### Release Gate A — Ultragoal leader only

- [ ] Push the verified Unit A commits:

```bash
git push origin main
```

Expected: the remote `main` advances to the Unit A head. No implementation worker runs this command.

- [ ] Find and watch the Pages workflow:

```bash
UNIT_HEAD=$(git rev-parse HEAD)
wait_for_pages_run "$UNIT_HEAD"
```

Expected: the bounded helper proves the watched run's `headSha` equals `UNIT_HEAD` and conclusion is `success`.

- [ ] Smoke the six production routes:

```bash
for route in \
  principles/pr-01 patterns/rel-02 styles/sty-00 methods/mth-03 \
  modeling/mod-02 quality-attributes/qa-01; do
  curl --fail --silent --show-error \
    "https://sealday.github.io/agentic-architecture-atlas/$route" >/dev/null
done
```

Expected: all six requests exit 0.

- [ ] Update only the E0-04 backlog line with the deployed implementation commit and Pages run URL. Do not check
`PR-01`, `REL-02`, `STY-00`, `MTH-03`, `MOD-02`, or `QA-01` merely because they are fixtures.

```bash
git add docs/content-backlog.md
git commit -m "docs: record e0-04 deployment"
git push origin main
METADATA_HEAD=$(git rev-parse HEAD)
wait_for_pages_run "$METADATA_HEAD"
for route in \
  principles/pr-01 patterns/rel-02 styles/sty-00 methods/mth-03 \
  modeling/mod-02 quality-attributes/qa-01; do
  curl --fail --silent --show-error \
    "https://sealday.github.io/agentic-architecture-atlas/$route" >/dev/null
done
```

Expected: the metadata commit changes only `docs/content-backlog.md`; its own matching Pages run completes and the
post-metadata smoke passes before Unit A ends.

- [ ] Record Unit A's commit, Pages run, smoke evidence, and E0-04 metadata commit in the leader's running G004
evidence summary. Do not perform a Codex-goal transition or OMX checkpoint; G004 remains one active story until Unit
E and the final independent review are complete.

## Release Unit B — E0-06: Registry-Driven Pattern Navigation

### Task 4: Define and validate the exhaustive Pattern group registry

**Files:**
- Create: `data/pattern-groups.json`
- Create: `scripts/content-registries.mjs`
- Create: `tests/content-registries.test.mjs`
- Modify: `docs/content-backlog.md`
- Modify: `scripts/backlog-topics.mjs`
- Modify: `scripts/validate-content.mjs`
- Modify: `tests/backlog-topics.test.mjs`
- Modify: `tests/content-validation.test.mjs`
- Modify: `tests/knowledge-fixtures.test.mjs`

**Interfaces:**
- Consumes: `parseBacklogTopics(source, file).topics`, each with `{id, type}`.
- Produces: `parsePatternGroupRegistry(value, topics, file): {registry, groupByTopicId, errors}`.
- `registry.groups` is ordered by numeric `order`.
- `groupByTopicId` is `Map<string, string>`.
- Invariant: every backlog `type: pattern` topic appears in exactly one `topic_ids` array; non-Pattern topics and unknown IDs are rejected.
- Invariant: the five public common groups are non-empty; `agent-control` may remain a hand-written empty-topic group.
- Invariant: validator CLI loads `data/pattern-groups.json` from a `fileURLToPath` project root and exits 1 when it is missing, unreadable, or invalid.

- [ ] **Step 1: Write RED tests for exact schema and exhaustive assignment**

Create `tests/content-registries.test.mjs`:

```js
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {parseBacklogTopics} from '../scripts/backlog-topics.mjs';
import {parsePatternGroupRegistry} from '../scripts/content-registries.mjs';

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
  {id: 'PAT-MIG-01', type: 'pattern'},
  {id: 'FND-01', type: 'concept'},
];

test('parses exact Pattern groups and assigns each Pattern topic once', () => {
  const result = parsePatternGroupRegistry(validRegistry, topics);
  assert.deepEqual(result.errors, []);
  assert.equal(result.groupByTopicId.get('DDD-01'), 'general-design');
  assert.deepEqual(result.registry.groups.map(({id}) => id), [
    'general-design',
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
        validRegistry.groups[1],
      ],
    },
    topics,
  );
  assert.match(badTargets.errors.join('\n'), /topic "UNKNOWN-01" does not exist/);
  assert.match(badTargets.errors.join('\n'), /topic "FND-01" is not type "pattern"/);
});
```

- [ ] **Step 2: Run the registry test and observe RED**

Run:

```bash
node --test tests/content-registries.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/content-registries.mjs`.

- [ ] **Step 3: Register formal migration topics in the backlog parser**

Add these pending topics to the migration section of `docs/content-backlog.md`:

```md
- [ ] **PAT-MIG-01 P0｜Strangler Fig 渐进迁移**：按可观测业务切片逐步替换旧系统，并定义流量迁移、回退和退役条件。
- [ ] **PAT-MIG-02 P1｜Branch by Abstraction**：在稳定抽象后并行替换实现，控制双写、切换和旧分支删除窗口。
- [ ] **PAT-MIG-03 P1｜Expand/Contract**：用兼容性扩展、分阶段迁移和最终收缩完成 schema/API 演进。
```

Add `PAT-MIG` to `topicPrefixTypes` as `pattern` / `/patterns`, and extend
`tests/backlog-topics.test.mjs` to assert the three IDs parse with slugs `/patterns/pat-mig-01`,
`/patterns/pat-mig-02`, and `/patterns/pat-mig-03`.

- [ ] **Step 4: Add the complete Pattern registry**

Create `data/pattern-groups.json` with this complete assignment:

```json
{
  "schema_version": 1,
  "groups": [
    {
      "id": "general-design",
      "label": "通用设计模式",
      "description": "领域、企业应用、代码责任与结构模式。",
      "order": 10,
      "topic_ids": [
        "DDD-01", "DDD-02", "DDD-03", "DDD-04", "DDD-05", "DDD-06",
        "APP-01", "APP-02", "APP-03", "APP-04",
        "DP-01", "DP-02", "DP-03", "DP-04", "DP-05",
        "DP-06", "DP-07", "DP-08", "DP-09", "DP-10",
        "ANTI-01", "ANTI-02", "ANTI-06", "ANTI-07", "ANTI-08",
        "ANTI-09", "ANTI-10"
      ]
    },
    {
      "id": "integration",
      "label": "集成模式",
      "description": "服务、消息、网关、协议与跨边界协作模式。",
      "order": 20,
      "topic_ids": [
        "PAT-IN-01", "PAT-IN-02", "PAT-IN-03", "PAT-IN-04",
        "PAT-IN-05", "PAT-IN-06", "PAT-IN-07", "PAT-IN-08",
        "ANTI-05"
      ]
    },
    {
      "id": "reliability",
      "label": "可靠性与生产治理模式",
      "description": "恢复、隔离、容量、观测和安全控制模式。",
      "order": 30,
      "topic_ids": [
        "REL-01", "REL-02", "REL-03", "REL-04", "REL-05",
        "REL-06", "REL-07", "REL-08", "REL-09", "REL-10",
        "OPS-01", "OPS-02", "OPS-03", "OPS-04", "OPS-05", "OPS-06",
        "SEC-01", "SEC-02", "SEC-03", "SEC-04", "SEC-05", "SEC-06",
        "ANTI-04"
      ]
    },
    {
      "id": "data",
      "label": "数据与一致性模式",
      "description": "事务消息、投影、事件和一致性协作模式。",
      "order": 40,
      "topic_ids": [
        "PAT-DC-01", "PAT-DC-02", "PAT-DC-03", "PAT-DC-04",
        "PAT-DC-05", "PAT-DC-06", "PAT-DC-07", "PAT-DC-08",
        "PAT-DC-09", "ANTI-03"
      ]
    },
    {
      "id": "migration",
      "label": "迁移模式",
      "description": "渐进替换、兼容窗口和风险受控的结构迁移。",
      "order": 50,
      "topic_ids": ["PAT-MIG-01", "PAT-MIG-02", "PAT-MIG-03"]
    },
    {
      "id": "agent-control",
      "label": "Agent 控制与协作模式",
      "description": "Router、Supervisor、Handoff、A2A 与 MCP 等现有控制概览。",
      "order": 60,
      "topic_ids": []
    }
  ]
}
```

- [ ] **Step 5: Implement the exact registry parser and fail-closed loader**

Create `scripts/content-registries.mjs` with these public contracts:

```js
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return (
    isRecord(value) &&
    Object.keys(value).sort().join('\0') === [...keys].sort().join('\0')
  );
}

export function parsePatternGroupRegistry(
  value,
  topics,
  file = 'data/pattern-groups.json',
) {
  const errors = [];
  const groups = [];
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const groupByTopicId = new Map();
  const groupIds = new Set();
  const orders = new Set();

  if (!exactKeys(value, ['schema_version', 'groups'])) {
    return {
      registry: {schema_version: 1, groups: []},
      groupByTopicId,
      errors: [`${file}: expected exactly schema_version and groups`],
    };
  }
  if (value.schema_version !== 1 || !Array.isArray(value.groups)) {
    return {
      registry: {schema_version: 1, groups: []},
      groupByTopicId,
      errors: [`${file}: schema_version must equal 1 and groups must be an array`],
    };
  }

  for (const [index, group] of value.groups.entries()) {
    const label = `${file}: group ${index + 1}`;
    if (!exactKeys(group, ['id', 'label', 'description', 'order', 'topic_ids'])) {
      errors.push(`${label} has unknown or missing fields`);
      continue;
    }
    if (
      typeof group.id !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(group.id)
    ) {
      errors.push(`${label} id must be kebab-case`);
    }
    if (groupIds.has(group.id)) errors.push(`${label} duplicates id "${group.id}"`);
    if (orders.has(group.order)) errors.push(`${label} duplicates order "${group.order}"`);
    groupIds.add(group.id);
    orders.add(group.order);
    if (
      typeof group.label !== 'string' ||
      group.label.trim() === '' ||
      typeof group.description !== 'string' ||
      group.description.trim() === '' ||
      !Number.isInteger(group.order) ||
      group.order <= 0 ||
      !Array.isArray(group.topic_ids)
    ) {
      errors.push(`${label} has an invalid label, description, order, or topic_ids`);
      continue;
    }
    for (const topicId of group.topic_ids) {
      const topic = topicById.get(topicId);
      if (!topic) {
        errors.push(`${label} topic "${topicId}" does not exist`);
      } else if (topic.type !== 'pattern') {
        errors.push(`${label} topic "${topicId}" is not type "pattern"`);
      } else if (groupByTopicId.has(topicId)) {
        errors.push(`Pattern topic "${topicId}" is assigned to multiple groups`);
      } else {
        groupByTopicId.set(topicId, group.id);
      }
    }
    groups.push({...group, topic_ids: [...group.topic_ids]});
  }

  for (const topic of topics.filter(({type}) => type === 'pattern')) {
    if (!groupByTopicId.has(topic.id)) {
      errors.push(`Pattern topic "${topic.id}" is not assigned to a group`);
    }
  }
  groups.sort((left, right) => left.order - right.order);
  errors.sort((left, right) => left.localeCompare(right, 'en'));
  return {registry: {schema_version: 1, groups}, groupByTopicId, errors};
}
```

After parsing, require non-empty `topic_ids` for
`general-design`, `integration`, `reliability`, `data`, and `migration`. Keep `agent-control` exempt because its
content remains the hand-written overview.

Also export `loadPatternGroupRegistry(projectRoot, topics)`. It resolves
`path.join(projectRoot, 'data/pattern-groups.json')`, parses JSON, and returns sorted diagnostics for missing file,
invalid JSON, or schema errors. It never returns an empty “valid” registry after an I/O error.

Wire the validator CLI to derive `projectRoot` with `fileURLToPath(new URL('..', import.meta.url))`, load the
registry, and pass it into `validateContent`. Direct repository tests, including `knowledge-fixtures`, must call the
same loader and pass the validated registry; omission is a test failure, not a skip. Add a spawned-CLI test proving a temporary project without
`data/pattern-groups.json` exits 1 and names the missing path.

- [ ] **Step 6: Run registry, backlog, and validator CLI tests**

```bash
node --test tests/content-registries.test.mjs tests/backlog-topics.test.mjs tests/content-validation.test.mjs
```

Expected: PASS; every current backlog Pattern ID is assigned exactly once, all public common groups are non-empty,
and the CLI missing-registry fixture fails for the expected reason.

- [ ] **Step 7: Commit the canonical Pattern taxonomy**

```bash
git add data/pattern-groups.json docs/content-backlog.md scripts/backlog-topics.mjs \
  scripts/content-registries.mjs scripts/validate-content.mjs \
  tests/content-registries.test.mjs tests/backlog-topics.test.mjs \
  tests/content-validation.test.mjs tests/knowledge-fixtures.test.mjs
git commit -m "feat: register Pattern navigation groups"
```

Expected: one local commit with the registry, parser, and exhaustive tests.

### Task 5: Project Pattern groups and render grouped navigation

**Files:**
- Modify: `scripts/topic-manifest.mjs`
- Modify: `scripts/generate-content-platform.mjs`
- Modify: `src/components/TopicIndex/topicIndexModel.ts`
- Create: `src/components/PatternTopicIndex/patternTopicIndexModel.ts`
- Create: `src/components/PatternTopicIndex/index.tsx`
- Create: `src/components/PatternTopicIndex/styles.module.css`
- Modify: `content/patterns/index.mdx`
- Modify: `tests/topic-manifest.test.mjs`
- Modify: `tests/topic-index.test.mjs`
- Modify: `tests/content-platform-generation.test.mjs`
- Modify generated: `src/generated/topic-manifest.json`
- Modify generated: `src/generated/topic-indexes.json`
- Create generated: `src/generated/pattern-groups.json`

**Interfaces:**
- Consumes: `parsePatternGroupRegistry(...).groupByTopicId` and `.registry`.
- Produces: manifest/index topic field `pattern_group: string | null`; generated path
  `src/generated/pattern-groups.json`; `<PatternTopicIndex />`.
- `selectPatternGroups(groups, topics)` returns ordered groups with `topics`.
- Invariant: `/patterns` stays stable; planned topics have no internal link; `selectPatternGroups` returns the five
  common groups, while the page renders a sixth explicit `Agent 控制与协作模式` wrapper around all preserved
  hand-written Agent control content.

- [ ] **Step 1: Write RED projection and UI model tests**

Add to `tests/topic-manifest.test.mjs`:

```js
test('projects the canonical Pattern group without changing the Pattern slug', () => {
  const result = buildTopicManifestCore({
    backlogSource: topic('REL-02', 'P0', 'Retry'),
    documents: [],
    primarySourcesByFile: new Map(),
    patternGroupByTopicId: new Map([['REL-02', 'reliability']]),
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.manifest.topics[0].slug, '/patterns/rel-02');
  assert.equal(result.manifest.topics[0].pattern_group, 'reliability');
});
```

An empty `primarySourcesByFile` is allowed only in a planned-only test with `documents: []`, as above. Every
manifest test that passes a published document must include a non-empty map entry for that document file; add a
shared `primarySourcesFor(documents)` fixture and an assertion that no published test document is absent.

Add to `tests/topic-index.test.mjs`:

```js
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

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
    {...topicFixture({id: 'REL-02', priority: 'P0'}), type: 'pattern', pattern_group: 'reliability'},
  ];
  assert.deepEqual(
    selectPatternGroups(groups, topics).map(({label, topics}) => [label, topics.length]),
    [
      ['通用设计模式', 0],
      ['集成模式', 0],
      ['可靠性与生产治理模式', 1],
      ['数据与一致性模式', 0],
      ['迁移模式', 0],
    ],
  );
});

test('Pattern page renders five common groups plus one Agent wrapper', async () => {
  const source = await readFile(
    fileURLToPath(new URL('../content/patterns/index.mdx', import.meta.url)),
    'utf8',
  );
  assert.match(source, /<PatternTopicIndex \\/>/);
  assert.match(source, /## Agent 控制与协作模式/);
});
```

- [ ] **Step 2: Run tests and observe RED**

```bash
node --test --test-name-pattern='canonical Pattern group|groups Pattern topics|five common groups plus one Agent wrapper' \
  tests/topic-manifest.test.mjs tests/topic-index.test.mjs
```

Expected: FAIL because manifest topics have no `pattern_group` and the Pattern component model does not exist.

- [ ] **Step 3: Add manifest projection and generated artifact**

Extend both backlog and document projections in `scripts/topic-manifest.mjs`:

```js
function projectBacklogTopic(topic, patternGroupByTopicId) {
  return {
    id: topic.id,
    type: topic.type,
    title: topic.title,
    slug: topic.slug,
    priority: topic.priority,
    status: backlogStatus(topic.complete),
    dependencies: [],
    primary_sources: [],
    related_cases: [],
    reviewed_at: null,
    published: false,
    pattern_group: patternGroupByTopicId.get(topic.id) ?? null,
  };
}
```

Add `patternGroupByTopicId = new Map()` to `buildTopicManifest(...)` and set the same field in
`projectDocument(...)`. A published Pattern topic without a registry group must add:

```js
errors.push(`content/${file}: published Pattern topic "${id}" has no registered group`);
```

In `scripts/generate-content-platform.mjs`, read backlog first, parse its topics, parse
`data/pattern-groups.json`, and add:

```js
export const generatedPaths = {
  sourceLedger: 'src/generated/source-ledger.json',
  manifest: 'src/generated/topic-manifest.json',
  indexes: 'src/generated/topic-indexes.json',
  patternGroups: 'src/generated/pattern-groups.json',
  caseCatalog: 'src/generated/case-catalog.json',
};
```

Serialize a public projection without `topic_ids` duplication:

```js
const publicPatternGroups = {
  schema_version: 1,
  groups: patternRegistry.groups.map(
    ({id, label, description, order}) => ({id, label, description, order}),
  ),
};
```

- [ ] **Step 4: Implement the grouped Pattern component**

Create `src/components/PatternTopicIndex/patternTopicIndexModel.ts`:

```ts
import type {TopicIndexEntry} from '../TopicIndex/topicIndexModel';

export type PatternGroup = {
  id: string;
  label: string;
  description: string;
  order: number;
};

export type PatternGroupView = PatternGroup & {topics: TopicIndexEntry[]};

export function selectPatternGroups(
  groups: PatternGroup[],
  topics: TopicIndexEntry[],
): PatternGroupView[] {
  return [...groups]
    .filter(({id}) => id !== 'agent-control')
    .sort((left, right) => left.order - right.order)
    .map((group) => ({
      ...group,
      topics: topics.filter((topic) => topic.pattern_group === group.id),
    }));
}
```

Update `TopicIndexEntry` in `src/components/TopicIndex/topicIndexModel.ts`:

```ts
export type TopicIndexEntry = {
  id: string;
  type: TopicType;
  title: string;
  slug: string;
  priority: TopicPriority;
  status: TopicStatus;
  dependencies: string[];
  primary_sources: string[];
  related_cases: string[];
  reviewed_at: string | null;
  published: boolean;
  pattern_group: string | null;
};
```

Create `src/components/PatternTopicIndex/index.tsx` so each of the five common groups renders its registry label/description, published
topics use `<Link to={topic.slug}>`, planned topics render `<span>`, and empty groups render `该分组尚无已登记主题。`.
Import this component in `content/patterns/index.mdx` and replace only:

```mdx
<TopicIndex type="pattern" />
```

with:

```mdx
<PatternTopicIndex />
```

Immediately after `<PatternTopicIndex />`, add the explicit wrapper heading:

```mdx
## Agent 控制与协作模式
```

Keep every existing Agent control heading and paragraph under that wrapper. The Agent material must not be emitted
by `selectPatternGroups`, but the built `/patterns` page and tests must contain all five common registry labels plus
this sixth wrapper title.

- [ ] **Step 5: Generate and run navigation regressions**

```bash
npm run generate:content
node --test tests/topic-manifest.test.mjs tests/topic-index.test.mjs \
  tests/content-platform-generation.test.mjs tests/sidebar-navigation.test.mjs
npm run typecheck
npm run build
```

Expected: all commands exit 0; generated Pattern entries have exactly one group; `/patterns` builds with common
groups and preserved Agent sections.

- [ ] **Step 6: Commit grouped Pattern navigation**

```bash
git add scripts/topic-manifest.mjs scripts/generate-content-platform.mjs \
  src/components/TopicIndex/topicIndexModel.ts \
  src/components/PatternTopicIndex/patternTopicIndexModel.ts \
  src/components/PatternTopicIndex/index.tsx \
  src/components/PatternTopicIndex/styles.module.css \
  content/patterns/index.mdx \
  tests/topic-manifest.test.mjs tests/topic-index.test.mjs \
  tests/content-platform-generation.test.mjs tests/sidebar-navigation.test.mjs \
  src/generated/topic-manifest.json src/generated/topic-indexes.json \
  src/generated/pattern-groups.json
git commit -m "feat: group common and Agent Pattern navigation"
```

Expected: one local commit containing manifest projection, generated registry, component, page, and tests.

### Release Gate B — Ultragoal leader only

- [ ] Run the local release gate:

```bash
npm run verify
git diff --check
git status --short
```

Expected: all commands pass and the worktree is clean.

- [ ] Push, watch Pages, and smoke the stable routes:

```bash
git push origin main
UNIT_HEAD=$(git rev-parse HEAD)
wait_for_pages_run "$UNIT_HEAD"
for heading in \
  "通用设计模式" "集成模式" "可靠性与生产治理模式" \
  "数据与一致性模式" "迁移模式" "Agent 控制与协作模式"; do
  fetch_and_assert_text patterns "$heading"
done
fetch_and_assert_text patterns/rel-02 "Retry、Exponential Backoff 与 Jitter"
```

Expected: Pages concludes `success`; saved HTML proves all six group headings and the REL-02 title are rendered.

- [ ] Update only E0-06 deployment metadata and push that leader-owned commit:

```bash
git add docs/content-backlog.md
git commit -m "docs: record e0-06 deployment"
git push origin main
METADATA_HEAD=$(git rev-parse HEAD)
wait_for_pages_run "$METADATA_HEAD"
for heading in \
  "通用设计模式" "集成模式" "可靠性与生产治理模式" \
  "数据与一致性模式" "迁移模式" "Agent 控制与协作模式"; do
  fetch_and_assert_text patterns "$heading"
done
fetch_and_assert_text patterns/rel-02 "Retry、Exponential Backoff 与 Jitter"
```

Expected: only `docs/content-backlog.md` changes; the metadata commit's Pages run and repeated smoke both pass.

- [ ] Add Unit B's commit, Pages run, smoke evidence, and E0-06 metadata commit to the running G004 evidence summary.
Do not perform an Ultragoal completion checkpoint.

## Release Unit C — E0-07: Extensible Case Series

### Task 6: Make case-series validation and generation registry-driven

**Files:**
- Create: `data/case-series.json`
- Modify: `scripts/content-registries.mjs`
- Modify: `scripts/content-schema.mjs`
- Modify: `scripts/validate-content.mjs`
- Modify: `scripts/generate-case-catalog.mjs`
- Modify: `scripts/generate-content-platform.mjs`
- Modify: `package.json`
- Modify: `tests/content-registries.test.mjs`
- Modify: `tests/content-validation.test.mjs`
- Modify: `tests/knowledge-fixtures.test.mjs`
- Modify: `tests/case-catalog-generation.test.mjs`
- Modify: `tests/content-platform-generation.test.mjs`
- Create: `tests/fixtures/legacy-case-order.json`
- Create generated: `src/generated/case-series.json`

**Interfaces:**
- Produces: `parseCaseSeriesRegistry(value, file): {registry, byId, errors}`.
- `byId` is `Map<string, {id,label,description,order,show_on_homepage}>`.
- `validateContent(root, {requiredCollection, caseSeriesById})` validates every case series against the map.
- `buildCaseCatalog(root, {caseSeriesById})` requires the validated registry map; omission is an error, not a
  signal to skip series validation.
- `buildCaseCatalogFromManifest(manifest)` remains the case-discovery boundary.
- Invariant: catalog completeness means every discovered, validated, published case appears exactly once; there is no frozen slug manifest.
- Invariant: the old 18 slug/order pairs live only in `tests/fixtures/legacy-case-order.json`; production modules
  never import that regression fixture.

- [ ] **Step 1: Write RED registry and discovered-catalog tests**

Add to `tests/content-registries.test.mjs`:

```js
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
```

Add a catalog generation test:

```js
test('catalog coverage is the discovered published case set', () => {
  const manifest = {
    schema_version: 1,
    topics: [
      caseTopic('/cases/one', 1),
      caseTopic('/cases/two', 2),
      {id: 'PR-01', type: 'principle', published: true, presentation: {}},
    ],
  };
  assert.deepEqual(
    buildCaseCatalogFromManifest(manifest).map(({slug}) => slug),
    ['/cases/one', '/cases/two'],
  );
});
```

- [ ] **Step 2: Run tests and observe RED**

```bash
node --test --test-name-pattern='ordered case series|discovered published case set' \
  tests/content-registries.test.mjs tests/case-catalog-generation.test.mjs
```

Expected: FAIL because `parseCaseSeriesRegistry` is not exported and old content validation still imports frozen
series/catalog arrays.

- [ ] **Step 3: Add the canonical case-series registry**

Create `data/case-series.json`:

```json
{
  "schema_version": 1,
  "series": [
    {
      "id": "ai-native",
      "label": "AI 原生架构",
      "description": "Agent 框架、编排和多智能体运行时。",
      "order": 10,
      "show_on_homepage": false
    },
    {
      "id": "agent-platform-gateway",
      "label": "Agent 平台与模型网关",
      "description": "模型路由、虚拟凭据、预算、Guardrail 和网关治理。",
      "order": 20,
      "show_on_homepage": false
    },
    {
      "id": "classic-distributed",
      "label": "经典分布式架构迁移",
      "description": "监督、协调、持久执行、消息和故障隔离机制。",
      "order": 30,
      "show_on_homepage": true
    },
    {
      "id": "frontend-architecture",
      "label": "前端协同与组合架构",
      "description": "运行时组合和协作状态机制。",
      "order": 40,
      "show_on_homepage": true
    },
    {
      "id": "edge-physical",
      "label": "边缘与物理智能体",
      "description": "边云自治、物理执行和断连恢复。",
      "order": 50,
      "show_on_homepage": true
    }
  ]
}
```

- [ ] **Step 4: Implement case registry parsing and remove frozen catalog constants**

Add `parseCaseSeriesRegistry` to `scripts/content-registries.mjs`. It must exact-check
`schema_version`, `series`, and each entry's `id`, `label`, `description`, `order`, `show_on_homepage`; reject
prototype names, duplicate ID/order, blank text, non-positive integer order, and non-boolean homepage flags.

Delete from `scripts/content-schema.mjs`:

```text
allowedSeries
caseCatalogManifest
launchCaseSlugs
classicCollectionSlugs
requiredCaseSlugs
secondCollectionSlugs
```

Change case validation in `scripts/validate-content.mjs` to:

```js
if (
  'series' in metadata &&
  (!caseSeriesById || !caseSeriesById.has(metadata.series))
) {
  errors.push(`${file}: unregistered case series "${metadata.series}"`);
}

if (metadata.featured === false) {
  validateMigrationHeadingContract(file, headings, errors);
}
```

Move the existing 18 slug/`catalog_order` pairs verbatim into `tests/fixtures/legacy-case-order.json`. Update
regression tests to compare the generated catalog's slug/order projection to that file, and add a source-boundary
test proving no file under `scripts/` or `src/` imports it.

Remove approved-order checks and collection coverage flags. Preserve positive/unique `catalog_order`, unique slug,
case heading, source kind, migration target, and `featured` validation. Update `package.json`:

```json
"validate:content": "node scripts/validate-content.mjs content"
```

- [ ] **Step 5: Add the generated series projection to the recoverable transaction**

Extend the canonical registry loader to read and parse `data/case-series.json`. `validate-content.mjs`,
`buildCaseCatalog(root, ...)`, `knowledge-fixtures`, direct catalog tests, and `buildContentArtifacts` must use that same validated map.
Add tests for missing file, malformed JSON, and omitted `caseSeriesById`; all fail with a named diagnostic.

Read and parse `data/case-series.json` once in `buildContentArtifacts`. Add:

```js
caseSeries: 'src/generated/case-series.json',
```

to `generatedPaths`, pass `caseSeriesRegistry.byId` into `validateContent`, and serialize the full validated registry
as the `caseSeries` artifact. `Object.values(generatedPaths)` remains the one replacement order used by staging
replay.

- [ ] **Step 6: Run generator and catalog tests**

```bash
node --test tests/content-registries.test.mjs tests/content-validation.test.mjs \
  tests/knowledge-fixtures.test.mjs tests/case-catalog-generation.test.mjs \
  tests/content-platform-generation.test.mjs
npm run generate:content
npm run check:content
```

Expected: PASS; generated targets include `src/generated/case-series.json`; deleting any discovered case from the
catalog projection test fails, while adding a valid new case requires no slug-manifest edit.

- [ ] **Step 7: Commit registry-driven case generation**

```bash
git add data/case-series.json scripts/content-registries.mjs \
  scripts/content-schema.mjs scripts/validate-content.mjs \
  scripts/generate-case-catalog.mjs scripts/generate-content-platform.mjs \
  package.json tests/content-registries.test.mjs tests/content-validation.test.mjs \
  tests/knowledge-fixtures.test.mjs \
  tests/case-catalog-generation.test.mjs tests/content-platform-generation.test.mjs \
  tests/fixtures/legacy-case-order.json src/generated/case-series.json
git commit -m "feat: generate case series from a canonical registry"
```

Expected: one local commit; no case content or frontend changes yet.

### Task 7: Move gateway cases and frontend consumers to the generated registry

**Files:**
- Modify: `content/cases/new-api-channel-pool-routing.mdx`
- Modify: `content/cases/litellm-virtual-keys-governance.mdx`
- Modify: `content/cases/kong-ai-gateway-routing-resilience.mdx`
- Modify: `src/data/caseCatalog.ts`
- Modify: `src/components/CaseCatalog/filterCases.ts`
- Modify: `src/pages/index.tsx`
- Modify: `tests/case-catalog-selectors.test.mjs`
- Modify: `tests/sidebar-navigation.test.mjs`
- Modify: `tests/learning-path.test.mjs`
- Modify: `tests/case-fact-inventory.test.mjs`
- Modify generated: `src/generated/case-catalog.json`
- Modify generated: `src/generated/topic-manifest.json`
- Modify generated: `src/generated/topic-indexes.json`

**Interfaces:**
- Consumes: `src/generated/case-series.json`.
- Produces: `caseSeries`, `caseSeriesById`, `seriesLabels`, and registry-ordered filtering/grouping.
- Invariant: New API, LiteLLM, and Kong use `agent-platform-gateway`; AWS CLI Agent Orchestrator remains
  `ai-native`; all slugs and orders remain unchanged.

- [ ] **Step 1: Update selector tests to the intended five-series result**

Replace frozen series assertions with:

```js
assert.deepEqual(
  groupCasesBySeries(caseCatalog).map(({series, cases}) => [series, cases.length]),
  [
    ['ai-native', 5],
    ['agent-platform-gateway', 3],
    ['classic-distributed', 5],
    ['frontend-architecture', 2],
    ['edge-physical', 3],
  ],
);

assert.deepEqual(
  caseSeries.map(({id, label, order}) => ({id, label, order})),
  [
    {id: 'ai-native', label: 'AI 原生架构', order: 10},
    {id: 'agent-platform-gateway', label: 'Agent 平台与模型网关', order: 20},
    {id: 'classic-distributed', label: '经典分布式架构迁移', order: 30},
    {id: 'frontend-architecture', label: '前端协同与组合架构', order: 40},
    {id: 'edge-physical', label: '边缘与物理智能体', order: 50},
  ],
);
```

Add assertions that the three gateway slugs have the new series and catalog orders 16, 17, 18.

- [ ] **Step 2: Run selector tests and observe RED**

```bash
node --test tests/case-catalog-selectors.test.mjs
```

Expected: FAIL because the generated catalog still reports eight `ai-native` cases and no generated registry is
consumed by the frontend.

- [ ] **Step 3: Change only the three case series front matter values**

In each of the three gateway case files, replace:

```yaml
series: ai-native
```

with:

```yaml
series: agent-platform-gateway
```

Do not change title, slug, `catalog_order`, `featured`, facts, citations, or migration targets.

- [ ] **Step 4: Parse generated series in `src/data/caseCatalog.ts`**

Use runtime validation rather than a hand-written union:

```ts
import generatedCatalog from '../generated/case-catalog.json' with {type: 'json'};
import generatedSeries from '../generated/case-series.json' with {type: 'json'};

export type CaseSeries = string;

export type CaseSeriesEntry = {
  id: string;
  label: string;
  description: string;
  order: number;
  show_on_homepage: boolean;
};

export function assertCaseSeriesRegistry(value: unknown): asserts value is {
  schema_version: 1;
  series: CaseSeriesEntry[];
} {
  // Exact top-level and entry keys; reject prototype names, blank strings,
  // duplicate IDs/orders, non-positive orders, and non-boolean flags.
}

assertCaseSeriesRegistry(generatedSeries);

export const caseSeries = [...generatedSeries.series]
  .sort((left, right) => left.order - right.order) as CaseSeriesEntry[];

export const caseSeriesById = new Map(
  caseSeries.map((entry) => [entry.id, entry]),
);

export const seriesLabels = Object.fromEntries(
  caseSeries.map(({id, label}) => [id, label]),
) as Record<string, string>;
```

Make `assertCatalogEntry` use `caseSeriesById.has(String(entry.series))`. Keep difficulty, source-kind, slug, order,
array, and uniqueness checks. `assertCaseSeriesRegistry(generatedSeries)` must run at module initialization before
any catalog entry is accepted. Add runtime tests for malformed shape, duplicate ID/order, blank label, prototype ID,
and unknown catalog series.

In `filterCases.ts`, import `caseSeries` and derive order:

```ts
const seriesOrder = caseSeries.map(({id}) => id);
```

In `src/pages/index.tsx`, replace `migrationSeries` with:

```ts
const homepageSeries = new Set(
  caseSeries.filter(({show_on_homepage}) => show_on_homepage).map(({id}) => id),
);

const migrationGroups = groupCasesBySeries(secondCollectionCases).filter(
  ({series}) => homepageSeries.has(series),
);
```

- [ ] **Step 5: Generate and run all case regressions**

```bash
npm run generate:content
node --test tests/case-catalog-generation.test.mjs \
  tests/case-catalog-selectors.test.mjs tests/sidebar-navigation.test.mjs \
  tests/learning-path.test.mjs tests/case-fact-inventory.test.mjs
npm run typecheck
npm run build
```

Expected: PASS; generated catalog length remains 18; orders remain 1–18; three gateway cases form the new group;
homepage migration groups remain classic/frontend/edge because only those registry entries opt in.

- [ ] **Step 6: Commit the extensible case classification**

```bash
git add content/cases/new-api-channel-pool-routing.mdx \
  content/cases/litellm-virtual-keys-governance.mdx \
  content/cases/kong-ai-gateway-routing-resilience.mdx \
  src/data/caseCatalog.ts src/components/CaseCatalog/filterCases.ts \
  src/pages/index.tsx \
  tests/case-catalog-selectors.test.mjs tests/sidebar-navigation.test.mjs \
  tests/learning-path.test.mjs tests/case-fact-inventory.test.mjs \
  src/generated/case-catalog.json src/generated/topic-manifest.json \
  src/generated/topic-indexes.json
git commit -m "feat: add the Agent platform gateway case series"
```

Expected: one local commit with exactly three case metadata changes plus frontend/generated/test changes.

### Release Gate C — Ultragoal leader only

- [ ] Run `npm run verify`, `git diff --check`, and an independent case-catalog review. Expected: all pass, 18
case URLs and orders are unchanged, and the worktree is clean.

- [ ] Push and wait for the deployment:

```bash
git push origin main
UNIT_HEAD=$(git rev-parse HEAD)
wait_for_pages_run "$UNIT_HEAD"
```

Expected: the matching Pages run concludes `success`.

- [ ] Smoke the catalog and three gateway cases:

```bash
fetch_and_assert_text cases "Agent 平台与模型网关"
fetch_and_assert_text cases/new-api-channel-pool-routing "New API"
fetch_and_assert_text cases/litellm-virtual-keys-governance "LiteLLM"
fetch_and_assert_text cases/kong-ai-gateway-routing-resilience "Kong AI Gateway"
```

Expected: all four saved responses are non-empty and contain the catalog/group or page-specific title.

- [ ] Update E0-07 deployment metadata in a leader-only commit and push it:

```bash
git add docs/content-backlog.md
git commit -m "docs: record e0-07 deployment"
git push origin main
METADATA_HEAD=$(git rev-parse HEAD)
wait_for_pages_run "$METADATA_HEAD"
fetch_and_assert_text cases "Agent 平台与模型网关"
fetch_and_assert_text cases/new-api-channel-pool-routing "New API"
fetch_and_assert_text cases/litellm-virtual-keys-governance "LiteLLM"
fetch_and_assert_text cases/kong-ai-gateway-routing-resilience "Kong AI Gateway"
```

Expected: deployment metadata is durable and its matching Pages run plus repeated content assertions pass. Add Unit C evidence to the running G004 summary and do not perform an
Ultragoal completion checkpoint.

## Release Unit D — E0-13: Executable Page Relationships

### Task 8: Extend relation metadata and manifest target validation

**Files:**
- Modify: `scripts/content-schema.mjs`
- Modify: `scripts/validate-content.mjs`
- Modify: `scripts/topic-manifest.mjs`
- Modify: `data/topic-relations.json`
- Modify: `tests/content-validation.test.mjs`
- Modify: `tests/topic-manifest.test.mjs`
- Modify: `src/components/TopicIndex/topicIndexModel.ts`

**Interfaces:**
- Produces knowledge metadata fields:
  `depends_on: string[]`, `adjacent_topics: string[]`, `related_cases: string[]`,
  `related_questions?: string[]`.
- Produces manifest fields:
  `dependencies`, `adjacent_topics`, `related_cases`, `related_questions`.
- Planned relation override accepts exact keys:
  `dependencies`, `adjacent_topics`, `related_cases`, `related_questions`.
- Invariant: adjacency is reciprocal for published topics and does not participate in dependency depth/cycle checks.
- Invariant: overrides are planned-topic-only. Published front matter is the sole writer for all four relation fields;
  any published-topic override is an error even when byte-for-byte identical.

- [ ] **Step 1: Write RED metadata and graph tests**

Add to `tests/content-validation.test.mjs`:

```js
test('accepts either related cases or related questions and requires adjacency', async () => {
  for (const terminalRelation of [
    {related_cases: ['/cases/example'], related_questions: []},
    {related_cases: [], related_questions: ['/questions/qst-01']},
  ]) {
    await withTempRoot(async (root) => {
      await writeMdx(
        root,
        'principle.mdx',
        validKnowledgeFrontMatter('principle', {
          topic_id: 'PR-01',
          adjacent_topics: ['STY-00'],
          ...terminalRelation,
        }),
        knowledgeFixtures.get('principle').join('\n\n'),
      );
      const result = await validateContent(root);
      assert.deepEqual(result.errors, []);
    });
  }
});

test('rejects a knowledge page without adjacency or a terminal relation', async () => {
  await withTempRoot(async (root) => {
    await writeMdx(
      root,
      'principle.mdx',
      validKnowledgeFrontMatter('principle', {
        topic_id: 'PR-01',
        adjacent_topics: [],
        related_cases: [],
        related_questions: [],
      }),
      knowledgeFixtures.get('principle').join('\n\n'),
    );
    const result = await validateContent(root);
    assert.match(result.errors.join('\n'), /requires at least one adjacent topic/);
    assert.match(result.errors.join('\n'), /requires at least one related case or question/);
  });
});
```

`withTempRoot` must write minimal valid registry files or pass the canonical validated registry bundle; deleting any
one required registry is a separate RED fixture and must fail rather than skip validation.

Add to `tests/topic-manifest.test.mjs` fixtures for published `STY-00`, a published question topic, and:

```js
test('validates adjacent topics and related questions without adding dependency cycles', () => {
  const result = buildTopicManifest({
    backlogSource: backlog(
      topic('PR-01', 'P0'),
      topic('STY-00', 'P0'),
      topic('QST-01', 'P1'),
    ),
    documents: [
      publishedKnowledge('PR-01', 'principle', {
        adjacent_topics: ['STY-00'],
        related_cases: [],
        related_questions: ['/questions/qst-01'],
      }),
      publishedKnowledge('STY-00', 'style', {
        adjacent_topics: ['PR-01'],
        related_cases: ['/cases/openai-agents-sdk'],
        related_questions: [],
      }),
      publishedQuestion('QST-01', '/questions/qst-01'),
      {file: 'cases/openai.mdx', metadata: caseMetadata()},
    ],
    primarySourcesByFile: new Map([
      ['principles/pr-01.mdx', ['https://example.com/pr-primary']],
      ['styles/sty-00.mdx', ['https://example.com/sty-primary']],
      ['questions/qst-01.mdx', ['https://example.com/qst-primary']],
      ['cases/openai.mdx', ['https://example.com/case-primary']],
    ]),
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.manifest.topics.find(({id}) => id === 'PR-01').adjacent_topics, ['STY-00']);
  assert.deepEqual(
    result.manifest.topics.find(({id}) => id === 'PR-01').related_questions,
    ['/questions/qst-01'],
  );
});

test('rejects any override for a published topic even when values match', () => {
  const result = buildTopicManifest({
    backlogSource: backlog(topic('PR-01', 'P0'), topic('STY-00', 'P0')),
    documents: reciprocalPublishedKnowledgeFixtures(),
    primarySourcesByFile: primarySourcesFor(reciprocalPublishedKnowledgeFixtures()),
    relations: {
      'PR-01': {
        dependencies: [],
        adjacent_topics: ['STY-00'],
        related_cases: ['/cases/openai-agents-sdk'],
        related_questions: [],
      },
    },
  });
  assert.match(result.errors.join('\n'), /published topic "PR-01" must define relations only in front matter/);
});
```

- [ ] **Step 2: Run focused tests and observe RED**

```bash
node --test --test-name-pattern='related cases or related questions|without adjacency|adjacent topics and related questions' \
  tests/content-validation.test.mjs tests/topic-manifest.test.mjs
```

Expected: FAIL because `adjacent_topics` and `related_questions` are neither required nor projected.

- [ ] **Step 3: Add metadata shape and OR-gate validation**

Change `knowledgeRequiredFields` in `scripts/content-schema.mjs`:

```js
export const knowledgeRequiredFields = [
  'summary',
  'topic_id',
  'priority',
  'depends_on',
  'adjacent_topics',
  'related_cases',
];
```

Inside the knowledge branch in `scripts/validate-content.mjs`, validate:

```js
const adjacentTopics = metadata.adjacent_topics;
const relatedCases = metadata.related_cases;
const relatedQuestions = metadata.related_questions ?? [];

validateStringArray(file, type, 'adjacent_topics', adjacentTopics, errors);
validateStringArray(file, type, 'related_cases', relatedCases, errors);
validateStringArray(file, type, 'related_questions', relatedQuestions, errors);

if (Array.isArray(adjacentTopics) && adjacentTopics.length === 0) {
  errors.push(`${file}: ${type} requires at least one adjacent topic`);
}
if (
  Array.isArray(relatedCases) &&
  Array.isArray(relatedQuestions) &&
  relatedCases.length + relatedQuestions.length === 0
) {
  errors.push(`${file}: ${type} requires at least one related case or question`);
}
```

Keep case slugs restricted by `/^\/cases\/[a-z0-9]+(?:-[a-z0-9]+)*$/`. Restrict question slugs by
`/^\/questions\/[a-z0-9]+(?:-[a-z0-9]+)*$/`. Require topic IDs
in adjacency arrays to match `/^[A-Z]+(?:-[A-Z]+)*-\d{2}$/`.

- [ ] **Step 4: Extend manifest projections and override keys**

In `scripts/topic-manifest.mjs`, change:

```js
const allowedRelationKeys = new Set([
  'dependencies',
  'adjacent_topics',
  'related_cases',
  'related_questions',
]);
```

Parse and validate all four override fields for planned topics, then reject an override before merge whenever the
topic is published:

```js
if (publishedTopicIds.has(topicId)) {
  errors.push(
    `data/topic-relations.json: published topic "${topicId}" must define relations only in front matter`,
  );
  continue;
}
```

Do not compare values and do not accept an identical override.

Project defaults for planned and legacy topics:

```js
adjacent_topics: [],
related_cases: [],
related_questions: [],
```

Project published metadata:

```js
adjacent_topics: copyArray(metadata.adjacent_topics ?? []),
related_cases: copyArray(metadata.related_cases ?? []),
related_questions: copyArray(metadata.related_questions ?? []),
```

Validate every adjacent ID exists, is not self, and has a published knowledge target before it can satisfy a
published page. For each published A → B adjacency, require B → A and report the missing reverse edge. Validate every
question slug against published `type: question` topics. Do not add adjacent edges to `findDependencyCycles` or
`dependencyDepth`.

Extend `TopicIndexEntry` with:

```ts
adjacent_topics: string[];
related_questions: string[];
```

- [ ] **Step 5: Backfill the six fixtures' machine relations**

Add:

```yaml
adjacent_topics:
  - STY-00
related_questions: []
```

to `PR-01`; use `QA-01` for `REL-02`; `PR-01` and `MOD-02` for `STY-00`; `QA-01` for `MTH-03`;
`STY-00` for `MOD-02`; and `MTH-03` plus `REL-02` for `QA-01`.

Set the QA-01 front matter `depends_on` to `FND-02`, `QA-00`. Confirm `data/topic-relations.json` has no entry for
any of the six published fixtures. Add a planned-topic test whose override supplies all four fields and verify the
manifest projection preserves them.

- [ ] **Step 6: Run relation metadata and manifest tests**

```bash
node --test tests/content-validation.test.mjs tests/topic-manifest.test.mjs
npm run generate:content
npm run typecheck
```

Expected: PASS; every published fixture has a published adjacent target and a case; `related_questions` defaults to
an empty array; dependency sorting is unchanged.

- [ ] **Step 7: Commit machine-readable page relations**

```bash
git add scripts/content-schema.mjs scripts/validate-content.mjs \
  scripts/topic-manifest.mjs data/topic-relations.json \
  content/principles/pr-01-information-hiding.mdx \
  content/patterns/rel-02-retry-backoff-jitter.mdx \
  content/styles/sty-00-comparison-framework.mdx \
  content/methods/mth-03-adr-lifecycle.mdx \
  content/modeling/mod-02-c4-context-container.mdx \
  content/quality-attributes/qa-01-scenario-writing.mdx \
  tests/content-validation.test.mjs tests/topic-manifest.test.mjs \
  src/components/TopicIndex/topicIndexModel.ts \
  src/generated/topic-manifest.json src/generated/topic-indexes.json
git commit -m "feat: validate knowledge page relationship targets"
```

Expected: one local commit containing relationship schema, projections, six fixture metadata updates, and tests.

### Task 9: Enforce visible parent, adjacent, and case/question links

**Files:**
- Modify: `scripts/source-ledger.mjs`
- Create: `scripts/content-relations.mjs`
- Modify: `scripts/generate-content-platform.mjs`
- Create: `tests/content-relations.test.mjs`
- Modify: `tests/content-platform-generation.test.mjs`

**Interfaces:**
- Exports from source governance: `visibleMdxLines(document): string[]`.
- Produces: `extractInternalLinks(document): string[]`.
- Produces:
  `validateContentRelations({documents, manifest}): {errors: string[]}`.
- Invariant: front matter, fenced code, inline code, and HTML comments cannot satisfy visible-link gates.

- [ ] **Step 1: Write RED visible-link tests**

Create `tests/content-relations.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractInternalLinks,
  validateContentRelations,
} from '../scripts/content-relations.mjs';

const manifest = {
  schema_version: 1,
  topics: [
    {
      id: 'PR-01',
      type: 'principle',
      slug: '/principles/pr-01',
      published: true,
      adjacent_topics: ['STY-00'],
      related_cases: ['/cases/example'],
      related_questions: [],
    },
    {
      id: 'STY-00',
      type: 'style',
      slug: '/styles/sty-00',
      published: true,
      adjacent_topics: ['PR-01'],
      related_cases: ['/cases/example'],
      related_questions: [],
    },
    {id: 'CASE-01', type: 'case', slug: '/cases/example', published: true},
  ],
};

const validDocument = {
  file: 'principles/pr-01.mdx',
  metadata: {content_type: 'principle', topic_id: 'PR-01'},
  body: [
    '[原则入口](/principles)',
    '[架构风格](/styles/sty-00)',
    '[案例](/cases/example)',
  ].join('\n'),
};

test('accepts visible parent, adjacent, and terminal links', () => {
  assert.deepEqual(
    validateContentRelations({documents: [validDocument], manifest}).errors,
    [],
  );
});

test('ignores hidden and code-only internal links', () => {
  const document = {
    ...validDocument,
    body: [
      '<!-- [原则入口](/principles) -->',
      '```md',
      '[架构风格](/styles/sty-00)',
      '```',
      '`[案例](/cases/example)`',
    ].join('\n'),
  };
  assert.deepEqual(extractInternalLinks(document), []);
  assert.match(
    validateContentRelations({documents: [document], manifest}).errors.join('\n'),
    /missing visible parent link "\/principles"/,
  );
});
```

- [ ] **Step 2: Run the relation test and observe RED**

```bash
node --test tests/content-relations.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/content-relations.mjs`.

- [ ] **Step 3: Export the existing visible-MDX filter**

In `scripts/source-ledger.mjs`, change the internal helper declaration to:

```js
export function visibleMdxLines(document) {
```

Do not change its behavior. Existing external-link and quotation tests must remain green.

- [ ] **Step 4: Implement internal-link extraction and validation**

Create `scripts/content-relations.mjs`:

```js
import {visibleMdxLines} from './source-ledger.mjs';

const parentByType = new Map([
  ['concept', '/concepts'],
  ['principle', '/principles'],
  ['quality-attribute', '/quality-attributes'],
  ['method', '/methods'],
  ['modeling', '/modeling'],
  ['style', '/styles'],
  ['pattern', '/patterns'],
]);

function normalizeInternalPath(value) {
  const path = value.split(/[?#]/, 1)[0].replace(/\/+$/, '');
  return path === '' ? '/' : path;
}

export function extractInternalLinks(document) {
  const links = new Set();
  for (const line of visibleMdxLines(document)) {
    const withoutInlineCode = line.replace(/(`+)(?:(?!\1)[\s\S])*\1/gu, '');
    for (const pattern of [
      /\]\((\/[^)\s]+)(?:\s+["'][^"']*["'])?\)/g,
      /\bhref=(?:["'])(\/[^"']+)(?:["'])/g,
    ]) {
      for (const match of withoutInlineCode.matchAll(pattern)) {
        links.add(normalizeInternalPath(match[1]));
      }
    }
  }
  return [...links].sort((left, right) => left.localeCompare(right, 'en'));
}

export function validateContentRelations({documents, manifest}) {
  const errors = [];
  const topicById = new Map(manifest.topics.map((topic) => [topic.id, topic]));
  for (const document of documents) {
    const type = document.metadata?.content_type;
    const topicId = document.metadata?.topic_id;
    if (!parentByType.has(type) || typeof topicId !== 'string') continue;
    const topic = topicById.get(topicId);
    if (!topic?.published) continue;
    const visible = new Set(extractInternalLinks(document));
    const parent = parentByType.get(type);
    if (!visible.has(parent)) {
      errors.push(`content/${document.file}: missing visible parent link "${parent}"`);
    }
    const adjacentSlugs = topic.adjacent_topics
      .map((id) => topicById.get(id))
      .filter((target) => target?.published)
      .map(({slug}) => slug);
    for (const slug of adjacentSlugs) {
      if (!visible.has(slug)) {
        errors.push(
          `content/${document.file}: missing visible adjacent topic link "${slug}"`,
        );
      }
    }
    const terminal = [...topic.related_cases, ...topic.related_questions];
    if (!terminal.some((slug) => visible.has(slug))) {
      errors.push(`content/${document.file}: missing visible related case or question link`);
    }
  }
  return {errors: errors.sort((left, right) => left.localeCompare(right, 'en'))};
}
```

- [ ] **Step 5: Gate generation with visible relationships**

After `buildTopicManifest` succeeds in `buildContentArtifacts`, call:

```js
const relationValidation = validateContentRelations({
  documents: validation.documents,
  manifest: built.manifest,
});
if (relationValidation.errors.length) {
  throw new Error(
    `Content relations failed:\n${relationValidation.errors.join('\n')}`,
  );
}
```

This call occurs before any artifact bytes are returned or staged.

- [ ] **Step 6: Run hidden-link, source-governance, generation, and fixture tests**

```bash
node --test tests/content-relations.test.mjs tests/source-ledger.test.mjs \
  tests/content-platform-generation.test.mjs tests/knowledge-fixtures.test.mjs
npm run generate:content
npm run check:content
npm run build
```

Expected: PASS; removing any fixture's visible parent, any declared adjacent, or case/question link makes
`buildContentArtifacts` reject the snapshot with a file-scoped error.

- [ ] **Step 7: Commit the visible relationship gate**

```bash
git add scripts/source-ledger.mjs scripts/content-relations.mjs \
  scripts/generate-content-platform.mjs tests/content-relations.test.mjs \
  tests/content-platform-generation.test.mjs
git commit -m "feat: enforce visible knowledge page relationships"
```

Expected: one local commit containing the extractor, gate, generator integration, and tests.

### Release Gate D — Ultragoal leader only

- [ ] Run:

```bash
npm run verify
git diff --check
git status --short
```

Expected: PASS and a clean worktree.

- [ ] Push, wait for Pages, and smoke one page from each knowledge contract:

```bash
git push origin main
UNIT_HEAD=$(git rev-parse HEAD)
wait_for_pages_run "$UNIT_HEAD"
for route in \
  principles/pr-01 patterns/rel-02 styles/sty-00 methods/mth-03 \
  modeling/mod-02 quality-attributes/qa-01; do
  curl --fail --silent --show-error \
    "https://sealday.github.io/agentic-architecture-atlas/$route" >/dev/null
done
```

Expected: Pages concludes `success` and all routes return success.

- [ ] Update E0-13 deployment metadata and push:

```bash
git add docs/content-backlog.md
git commit -m "docs: record e0-13 deployment"
git push origin main
METADATA_HEAD=$(git rev-parse HEAD)
wait_for_pages_run "$METADATA_HEAD"
curl --fail --silent --show-error \
  https://sealday.github.io/agentic-architecture-atlas/principles/pr-01 >/dev/null
```

Expected: only backlog metadata changes; the metadata run and repeated smoke pass. Add Unit D evidence to the running G004 summary; do not perform an
Ultragoal completion checkpoint.

## Release Unit E — E0-14: Monthly and Quarterly Review Health

### Task 10: Add source registration dates and the review policy registry

**Files:**
- Create: `data/review-policies.json`
- Modify: `scripts/content-registries.mjs`
- Modify: `scripts/source-ledger.mjs`
- Modify: `scripts/validate-content.mjs`
- Modify: `scripts/topic-manifest.mjs`
- Modify: `scripts/generate-content-platform.mjs`
- Modify: `src/components/TopicIndex/topicIndexModel.ts`
- Modify: `data/source-ledger.json`
- Modify: `tests/content-registries.test.mjs`
- Modify: `tests/source-ledger.test.mjs`
- Modify: `tests/content-validation.test.mjs`
- Modify: `tests/knowledge-fixtures.test.mjs`
- Modify: `tests/content-platform-generation.test.mjs`
- Modify: `tests/learning-path.test.mjs`
- Modify: `tests/source-license-inventory.test.mjs`
- Modify: `tests/source-link-health.test.mjs`
- Modify generated: `src/generated/source-ledger.json`
- Modify generated: `src/generated/topic-manifest.json`
- Modify generated: `src/generated/topic-indexes.json`
- Modify metadata: `content/cases/apache-kafka-consumer-groups.mdx`
- Modify metadata: `content/cases/aws-cell-shuffle-sharding.mdx`
- Modify metadata: `content/cases/aws-cli-agent-orchestrator.mdx`
- Modify metadata: `content/cases/cloudflare-durable-objects-workerd.mdx`
- Modify metadata: `content/cases/erlang-otp-supervision-tree.mdx`
- Modify metadata: `content/cases/google-adk-a2a.mdx`
- Modify metadata: `content/cases/kong-ai-gateway-routing-resilience.mdx`
- Modify metadata: `content/cases/kubeedge-cloud-edge-autonomy.mdx`
- Modify metadata: `content/cases/kubernetes-reconciliation-loop.mdx`
- Modify metadata: `content/cases/langgraph-supervisor.mdx`
- Modify metadata: `content/cases/litellm-virtual-keys-governance.mdx`
- Modify metadata: `content/cases/micro-frontends-single-spa.mdx`
- Modify metadata: `content/cases/microsoft-multi-agent-reference-architecture.mdx`
- Modify metadata: `content/cases/new-api-channel-pool-routing.mdx`
- Modify metadata: `content/cases/openai-agents-sdk.mdx`
- Modify metadata: `content/cases/ros2-dds-agent-lifecycle.mdx`
- Modify metadata: `content/cases/temporal-saga-durable-execution.mdx`
- Modify metadata: `content/cases/yjs-crdt-collaboration.mdx`
- Modify metadata: `content/paths/01-architecture-thinking.mdx`
- Modify metadata: `content/paths/02-module-boundaries.mdx`
- Modify metadata: `content/paths/03-distributed-systems.mdx`
- Modify metadata: `content/paths/04-reliability-state.mdx`
- Modify metadata: `content/paths/05-production-governance.mdx`
- Modify metadata: `content/paths/06-agentic-architecture.mdx`
- Modify metadata: `content/paths/07-cloud-native-platform.mdx`
- Modify metadata: `content/paths/08-collaborative-state-frontend.mdx`
- Modify metadata: `content/paths/09-edge-physical-agents.mdx`
- Modify metadata: `content/paths/10-agent-platform-gateway.mdx`

**Interfaces:**
- Produces source field `registered_at: YYYY-MM-DD`.
- Produces `parseReviewPolicyRegistry(value, file): {registry, byId, errors}`.
- Policy `quarterly-version-sensitive` has `calendar_months: 3` and `warning_days: 30`.
- Review policy is an explicit editorial declaration. Neither `checked_at` nor `link_policy` may infer policy or a
  source-version change; factual citations independently require a non-empty source `version`.

- [ ] **Step 1: Write RED registry, date, and metadata tests**

Add to `tests/content-registries.test.mjs`:

```js
test('parses the quarterly review policy exactly', () => {
  const result = parseReviewPolicyRegistry({
    schema_version: 1,
    policies: [
      {
        id: 'quarterly-version-sensitive',
        label: '季度版本敏感复核',
        calendar_months: 3,
        warning_days: 30,
        description: '按来源版本边界复核。',
      },
    ],
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.byId.get('quarterly-version-sensitive').calendar_months, 3);
});
```

Add to source-ledger tests:

```js
test('requires a valid source registration date', () => {
  const ledger = sourceLedgerFixture();
  ledger.sources[0].registered_at = '2026-02-30';
  const parsed = parseSourceLedger(ledger);
  assert.match(parsed.errors.join('\n'), /registered_at must be a valid calendar date/);
});
```

Add content validation cases for an allowed `review_policy` string and a rejected scalar/unknown value.

- [ ] **Step 2: Run focused tests and observe RED**

```bash
node --test --test-name-pattern='quarterly review policy|source registration date|review_policy' \
  tests/content-registries.test.mjs tests/source-ledger.test.mjs \
  tests/content-validation.test.mjs
```

Expected: FAIL because source exact keys reject `registered_at`, the review parser is absent, and content does not
validate `review_policy`.

- [ ] **Step 3: Create the exact review policy registry**

Create `data/review-policies.json`:

```json
{
  "schema_version": 1,
  "policies": [
    {
      "id": "quarterly-version-sensitive",
      "label": "季度版本敏感复核",
      "calendar_months": 3,
      "warning_days": 30,
      "description": "从 source_cutoff 起按三个日历月复核版本敏感事实，并在到期前 30 天提示。"
    }
  ]
}
```

Implement exact keys, unique ID, positive integer months, non-negative integer warning days, kebab-case ID, and
non-empty label/description in `parseReviewPolicyRegistry`.

Extend the canonical registry loader, validator CLI, and `knowledge-fixtures` repository test to require
`data/review-policies.json`. Add missing-file, invalid-JSON, and invalid-schema CLI tests; none may continue with an
empty policy map.

- [ ] **Step 4: Add and migrate `registered_at`**

Insert `registered_at` immediately after `published_at` in `sourceKeys` and validate it with `isCalendarDate`.
Update every source fixture in `tests/content-platform-generation.test.mjs`,
`tests/content-validation.test.mjs`, `tests/learning-path.test.mjs`, `tests/source-ledger.test.mjs`,
`tests/source-license-inventory.test.mjs`, and `tests/source-link-health.test.mjs`.

For the canonical ledger:

- set all sources that existed at the canonical ledger launch to `registered_at: "2026-07-24"`;
- keep the two Unit A sources at `registered_at: "2026-07-24"`;
- do not infer dates from original publication dates or Git history.

After the mechanical migration, verify:

```bash
node -e 'const l=require("./data/source-ledger.json"); const bad=l.sources.filter(s=>s.registered_at!=="2026-07-24"); if(bad.length) throw new Error(JSON.stringify(bad.map(s=>s.id))); console.log(l.sources.length)'
```

Expected: prints the canonical source count and exits 0.

- [ ] **Step 5: Add explicit review policy metadata**

Add:

```yaml
review_policy: quarterly-version-sensitive
```

to every non-index case page and all ten numbered path pages as an explicit editorial policy for those
version-sensitive case/path families. Do not derive this choice from a source's transport policy, and do not add it
to index pages or stable knowledge fixtures without a separate editorial decision.

In `validateContent`, accept `reviewPolicyById` and reject unknown policy IDs. After source governance resolves
citations, require a non-empty `version` for every factual source as an independent validation error; do not
auto-assign a policy and do not call a missing version a detected change.

Read `data/review-policies.json` once in `buildContentArtifacts`, pass `reviewPolicyRegistry.byId` to content
validation, and project `review_policy: metadata.review_policy ?? null` for published topics and `review_policy: null`
for planned topics. Extend `TopicIndexEntry` with `review_policy: string | null`.

- [ ] **Step 6: Run registry, content, ledger, and generated-ledger tests**

```bash
node --test tests/content-registries.test.mjs tests/source-ledger.test.mjs \
  tests/content-validation.test.mjs tests/knowledge-fixtures.test.mjs \
  tests/source-ledger-rendering.test.mjs
npm run generate:content
npm run check:content
```

Expected: PASS; public source ledger exposes `registered_at`; all case/path metadata parses; no source-governance
roles or copyright checks change.

- [ ] **Step 7: Commit review policy inputs**

```bash
git add data/review-policies.json data/source-ledger.json \
  scripts/content-registries.mjs scripts/source-ledger.mjs \
  scripts/validate-content.mjs scripts/topic-manifest.mjs \
  scripts/generate-content-platform.mjs src/components/TopicIndex/topicIndexModel.ts \
  content/cases content/paths \
  tests/content-registries.test.mjs tests/source-ledger.test.mjs \
  tests/content-validation.test.mjs tests/knowledge-fixtures.test.mjs \
  tests/content-platform-generation.test.mjs \
  tests/learning-path.test.mjs tests/source-license-inventory.test.mjs \
  tests/source-link-health.test.mjs tests/source-ledger-rendering.test.mjs \
  src/generated/source-ledger.json src/generated/topic-manifest.json \
  src/generated/topic-indexes.json
git commit -m "feat: register version-sensitive content review policy"
```

Expected: one local commit with policy/schema/metadata migration only; no report or workflow code.

### Task 11: Implement deterministic monthly and quarterly review reports

**Files:**
- Create: `scripts/content-review-health.mjs`
- Create: `tests/content-review-health.test.mjs`
- Modify: `scripts/generate-content-platform.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces:
  `evaluateContentReviewHealth({documents, ledger, policyById, asOf}): {report, errors, warnings}`.
- Produces: `serializeReviewHealthJson(report): string`.
- Produces: `serializeReviewHealthMarkdown(report): string`.
- CLI:
  `node scripts/content-review-health.mjs --check [--as-of YYYY-MM-DD]`
  or
  `node scripts/content-review-health.mjs --report --as-of YYYY-MM-DD --json PATH --markdown PATH`.
- Due reason: `interval-elapsed`.
- Independent validation errors: `source-version-missing`, `document-review-older-than-cutoff`.
- `checked_at` and `link_policy` are report/link-health inputs only and never due triggers.

- [ ] **Step 1: Write RED evaluator tests with an injected clock**

Create `tests/content-review-health.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addCalendarMonths,
  evaluateContentReviewHealth,
} from '../scripts/content-review-health.mjs';

const policyById = new Map([
  ['quarterly-version-sensitive', {
    id: 'quarterly-version-sensitive',
    label: '季度版本敏感复核',
    calendar_months: 3,
    warning_days: 30,
    description: '季度复核',
  }],
]);

const source = {
  id: 'src-floating',
  registered_at: '2026-07-24',
  checked_at: '2026-07-24',
  version: 'Current page checked on 2026-07-24',
  link_policy: 'floating',
};

const ledger = {
  schema_version: 1,
  sources: [source],
  documents: {
    'content/cases/example.mdx': {
      reviewed_at: '2026-07-24',
      copyright_checks: [],
      citations: [{
        source_id: 'src-floating',
        citation_url: 'https://example.com/',
        roles: ['runtime-fact'],
        manifest_primary: true,
        usage_mode: 'facts-summary',
        attribution_note: 'Example',
        modification_note: null,
        excerpt: null,
        quotation_reviewed: false,
      }],
    },
  },
};

const documents = [{
  file: 'cases/example.mdx',
  metadata: {
    slug: '/cases/example',
    content_type: 'case',
    analyzed_at: '2026-07-24',
    source_cutoff: '2026-07-24',
    review_policy: 'quarterly-version-sensitive',
  },
}];

test('adds calendar months without using a 90-day approximation', () => {
  assert.equal(addCalendarMonths('2026-01-31', 3), '2026-04-30');
  assert.equal(addCalendarMonths('2024-11-30', 3), '2025-02-28');
});

test('marks quarterly content due on the exact calendar boundary', () => {
  const before = evaluateContentReviewHealth({
    documents,
    ledger,
    policyById,
    asOf: '2026-10-23',
  });
  assert.equal(before.errors.length, 0);

  const due = evaluateContentReviewHealth({
    documents,
    ledger,
    policyById,
    asOf: '2026-10-24',
  });
  assert.match(due.errors.join('\n'), /interval-elapsed/);
  assert.equal(due.report.due_documents[0].slug, '/cases/example');
});

test('separates newly registered and rechecked sources in the monthly report', () => {
  const result = evaluateContentReviewHealth({
    documents,
    ledger,
    policyById,
    asOf: '2026-08-01',
  });
  assert.deepEqual(result.report.monthly_window, {
    start: '2026-07-01',
    end_exclusive: '2026-08-01',
  });
  assert.deepEqual(result.report.new_source_ids, ['src-floating']);
  assert.deepEqual(result.report.rechecked_source_ids, ['src-floating']);
});

test('does not infer a version change or early due from checked_at or link_policy', () => {
  const changedTransportFacts = structuredClone(ledger);
  changedTransportFacts.sources[0].checked_at = '2026-08-15';
  changedTransportFacts.sources[0].link_policy = 'floating';
  const result = evaluateContentReviewHealth({
    documents,
    ledger: changedTransportFacts,
    policyById,
    asOf: '2026-09-01',
  });
  assert.deepEqual(result.report.due_documents, []);
  assert.doesNotMatch(result.errors.join('\n'), /version change|floating-source-newer/);
});
```

- [ ] **Step 2: Run review-health tests and observe RED**

```bash
node --test tests/content-review-health.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/content-review-health.mjs`.

- [ ] **Step 3: Implement deterministic date and due evaluation**

Use UTC calendar arithmetic:

```js
export function addCalendarMonths(dateText, months) {
  const [year, month, day] = dateText.split('-').map(Number);
  const targetMonthStart = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(
    targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  const result = new Date(Date.UTC(
    targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth(),
    Math.min(day, lastDay),
  ));
  return result.toISOString().slice(0, 10);
}
```

`evaluateContentReviewHealth` must:

1. exact-validate `asOf`;
2. derive the previous complete calendar-month window;
3. report sources by `registered_at` and `checked_at` separately;
4. map ledger documents by `content/${document.file}`;
5. validate every factual source has a non-empty version without inferring change;
6. compute only the explicit policy's `interval-elapsed` due reason;
7. report `document-review-older-than-cutoff` as an independent consistency error;
8. compute warnings when the interval date is within `warning_days`;
9. list each due document with slug, policy, analyzed date, cutoff, ledger review date, source IDs, versions, checked
   dates, and reasons;
10. sort every list by stable ID/slug/reason;
11. return errors for invalid policy, missing version, review/cutoff inconsistency, or due documents without modifying
    content or ledger.

- [ ] **Step 4: Implement JSON/Markdown serialization and CLI**

The JSON report shape is:

```json
{
  "schema_version": 1,
  "as_of": "2026-08-01",
  "monthly_window": {
    "start": "2026-07-01",
    "end_exclusive": "2026-08-01"
  },
  "counts": {
    "new_sources": 0,
    "rechecked_sources": 0,
    "orphan_sources": 0,
    "due_documents": 0,
    "approaching_due_documents": 0
  },
  "gates": {
    "inputs_non_empty": "passed",
    "policy_validation": "passed",
    "review_health": "passed"
  },
  "new_source_ids": [],
  "rechecked_source_ids": [],
  "orphan_source_ids": [],
  "due_documents": [],
  "approaching_due_documents": []
}
```

Markdown must contain headings `# Content review health`, `## Counts and gates`, `## Monthly source review`, `## Quarterly due
documents`, and `## Approaching due`. Empty sections render `None.`.

The CLI derives project/content roots with `fileURLToPath(new URL(...))`, then reads canonical documents, source
ledger, and the validated review-policy registry. Tests spawn the real CLI against a temporary project. A zero-source
or zero-document input is an `inputs_non_empty` gate failure; it may not emit a misleading healthy report.
`--check` prints errors to stderr and exits 1 for due/invalid state. `--report` writes both requested artifacts before
setting exit code whenever serialization remains possible, so scheduled workflows can upload failure evidence.

- [ ] **Step 5: Add package commands and offline verify integration**

Add:

```json
"check:reviews": "node scripts/content-review-health.mjs --check",
"report:reviews": "node scripts/content-review-health.mjs --report",
```

Change `verify` so `npm run check:reviews` runs after `npm run check:links` and before typecheck. Do not invoke live
links from `verify`.

- [ ] **Step 6: Run evaluator, CLI, and full offline checks**

```bash
node --test tests/content-review-health.test.mjs
npm run check:reviews
npm run report:reviews -- --as-of 2026-08-01 \
  --json /tmp/g004-review-health.json \
  --markdown /tmp/g004-review-health.md
test -s /tmp/g004-review-health.json
test -s /tmp/g004-review-health.md
node -e 'const r=require("/tmp/g004-review-health.json"); for (const k of ["new_sources","rechecked_sources","orphan_sources","due_documents","approaching_due_documents"]) { if (!Number.isInteger(r.counts?.[k])) throw new Error(`missing count ${k}`) } if (r.gates?.inputs_non_empty !== "passed") throw new Error("empty canonical inputs")'
```

Expected: tests and checks pass on the implementation date; both report files exist and are non-empty; no network
request occurs; the canonical report has non-zero source/document input cardinality and populated counts/gates.

- [ ] **Step 7: Commit the deterministic review evaluator**

```bash
git add scripts/content-review-health.mjs tests/content-review-health.test.mjs \
  scripts/generate-content-platform.mjs package.json
git commit -m "feat: report monthly and quarterly content review health"
```

Expected: one local commit containing evaluator, tests, commands, and generator input plumbing.

### Task 12: Extend the read-only monthly workflow

**Files:**
- Modify: `.github/workflows/link-health.yml`
- Modify: `tests/workflow-configuration.test.mjs`

**Interfaces:**
- Consumes: `npm run check:links:live` and `npm run report:reviews`.
- Produces artifacts:
  `source-link-health-live`,
  `content-review-health` containing JSON and Markdown.
- Invariant: workflow permission remains `contents: read`; no push, PR, write token, or source mutation.

- [ ] **Step 1: Write RED workflow assertions**

Add:

```js
assert.match(
  linkHealth,
  /run: npm run report:reviews -- --as-of "\$\(date -u \+%F\)" --json \/tmp\/content-review-health\.json --markdown \/tmp\/content-review-health\.md/,
);
assert.match(
  linkHealth,
  /- name: Build content review report\n[ ]+if: always\(\)\n[ ]+run: npm run report:reviews/,
);
assert.match(
  linkHealth,
  /- name: Upload content review report\n[ ]+if: always\(\)\n[ ]+uses: actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/,
);
assert.match(linkHealth, /name: content-review-health/);
assert.match(
  linkHealth,
  /path: \|\n[ ]+\/tmp\/content-review-health\.json\n[ ]+\/tmp\/content-review-health\.md/,
);
```

- [ ] **Step 2: Run workflow tests and observe RED**

```bash
node --test tests/workflow-configuration.test.mjs
```

Expected: FAIL because no review report command or artifact upload exists.

- [ ] **Step 3: Add report generation and pinned upload**

Append these steps after live-link checking:

```yaml
      - name: Build content review report
        if: always()
        run: npm run report:reviews -- --as-of "$(date -u +%F)" --json /tmp/content-review-health.json --markdown /tmp/content-review-health.md
      - name: Upload content review report
        if: always()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with:
          name: content-review-health
          path: |
            /tmp/content-review-health.json
            /tmp/content-review-health.md
          if-no-files-found: error
```

Keep the existing cron, timeout, checkout/setup action SHAs, live report, and read-only permission unchanged.

- [ ] **Step 4: Run workflow and offline deployment regressions**

```bash
node --test tests/workflow-configuration.test.mjs
npm run verify
```

Expected: PASS; deploy workflow still contains only offline `npm run verify`; scheduled workflow remains read-only and
always uploads both report families.

- [ ] **Step 5: Commit the scheduled review workflow**

```bash
git add .github/workflows/link-health.yml tests/workflow-configuration.test.mjs
git commit -m "ci: publish monthly source and content review reports"
```

Expected: one local commit containing only workflow and workflow tests.

### Task 13: Run the full G004 local regression and prepare leader evidence

**Files:**
- Test: all files under `tests/`
- Verify: all canonical inputs and generated artifacts listed in this plan
- No repository file changes are expected.

**Interfaces:**
- Consumes: all local commits from Release Units A–E.
- Produces: one evidence bundle for the Ultragoal leader.
- Invariant: implementation worker neither pushes nor checkpoints G004.

- [ ] **Step 1: Run the full verification matrix**

```bash
npm run test
npm run validate:content
npm run check:content
npm run check:links
npm run check:reviews
npm run typecheck
npm run build
git diff --check
git status --short
```

Expected: every command exits 0; no stale generated artifacts; no due review at the implementation date; clean
worktree.

- [ ] **Step 2: Verify immutable route/order facts**

```bash
node - <<'NODE'
const catalog = require('./src/generated/case-catalog.json');
const legacy = require('./tests/fixtures/legacy-case-order.json');
const actual = catalog.map(({slug, catalog_order}) => ({slug, catalog_order}));
if (JSON.stringify(actual) !== JSON.stringify(legacy)) {
  throw new Error('case slug/order regression fixture changed');
}
const fixtureIds = new Set(['PR-01', 'REL-02', 'STY-00', 'MTH-03', 'MOD-02', 'QA-01']);
const manifest = require('./src/generated/topic-manifest.json');
const published = manifest.topics.filter(({id, published}) => fixtureIds.has(id) && published);
if (published.length !== fixtureIds.size) throw new Error('six production fixtures are not published');
console.log(JSON.stringify({cases: catalog.length, fixtures: published.length}));
NODE
```

Expected: prints `{"cases":18,"fixtures":6}`.

- [ ] **Step 3: Hand the leader exact evidence**

Report:

```text
G004 local implementation evidence:
- Release Units A-E local commit hashes: git log output
- npm run test: PASS
- npm run validate:content: PASS
- npm run check:content: PASS
- npm run check:links: PASS
- npm run check:reviews: PASS
- npm run typecheck: PASS
- npm run build: PASS
- git diff --check: PASS
- git status --short: clean
- immutable facts: 18 cases, orders 1-18, six published fixtures
- no push, deploy, backlog deployment metadata, or Ultragoal checkpoint performed by worker
```

Expected: no repository mutation after the final local commit.

### Release Gate E and Final G004 Completion — Ultragoal leader only

- [ ] Run the post-worker verification:

```bash
npm run verify
git diff --check
git status --short
```

Expected: PASS and a clean worktree.

- [ ] Run `ai-slop-cleaner` on G004-changed files only and record its passed/no-op report. If it changes files,
inspect the diff, run targeted tests, run the full verification below, create a dedicated
`refactor: clean g004 changed files` commit, and keep that commit in the Unit E head:

```bash
npm run verify
git diff --check
git status --short
```

Expected: PASS after cleanup. The worktree is clean; any cleaner changes are committed before independent review.

- [ ] Run independent `code-reviewer` and `architect` reviews. Require:

```json
{
  "recommendation": "APPROVE",
  "architectStatus": "CLEAR",
  "architectureInvariantGate": "passed"
}
```

The architect must explicitly prove:

- backlog checkbox remains the only task-status writer;
- source ledger remains the evidence/version authority;
- community indexes cannot satisfy factual gates;
- all existing URLs and case orders are preserved;
- Pattern and case registries have one canonical writer;
- page terminal relations use `related_cases OR related_questions`;
- default verification is offline;
- only the leader performs deployment and the single final G004 checkpoint.

If either review is not clean, create blocker work through `omx ultragoal record-review-blockers`; do not complete or
checkpoint G004.

- [ ] Push Unit E and watch Pages:

```bash
git push origin main
UNIT_HEAD=$(git rev-parse HEAD)
wait_for_pages_run "$UNIT_HEAD"
```

Expected: the bounded helper matches `UNIT_HEAD` and Pages concludes `success`.

- [ ] Smoke public routes and manually dispatch the monthly workflow:

```bash
fetch_and_assert_text patterns "Agent 控制与协作模式"
fetch_and_assert_text cases "Agent 平台与模型网关"
fetch_and_assert_text references "资料库"
fetch_and_assert_text paths "软件架构学习路线"
fetch_and_assert_text principles/pr-01 "信息隐藏与封装"
fetch_and_assert_text patterns/rel-02 "Retry、Exponential Backoff 与 Jitter"
fetch_and_assert_text styles/sty-00 "架构风格比较框架"
fetch_and_assert_text methods/mth-03 "ADR 生命周期"
fetch_and_assert_text modeling/mod-02 "C4 Context 与 Container"
fetch_and_assert_text quality-attributes/qa-01 "质量属性场景写法"
```

Expected: every response is saved and contains its index, group, or fixture title.

- [ ] Dispatch, identify, wait for, and inspect the monthly workflow:

```bash
DISPATCH_SHA=$(git rev-parse HEAD)
DISPATCHED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
gh workflow run link-health.yml --ref main
DISPATCH_RUN_JSON=""
for attempt in $(seq 1 30); do
  DISPATCH_RUN_JSON=$(gh run list --workflow link-health.yml --branch main \
    --event workflow_dispatch --limit 30 \
    --json databaseId,headSha,createdAt,status,conclusion,url \
    --jq "map(select(.headSha == \"$DISPATCH_SHA\" and .createdAt >= \"$DISPATCHED_AT\"))[0] // empty")
  if [ -n "$DISPATCH_RUN_JSON" ]; then
    break
  fi
  sleep 10
done
test -n "$DISPATCH_RUN_JSON"
AUDIT_RUN_ID=$(node -e 'const v=JSON.parse(process.argv[1]); process.stdout.write(String(v.databaseId))' "$DISPATCH_RUN_JSON")
AUDIT_RUN_SHA=$(node -e 'const v=JSON.parse(process.argv[1]); process.stdout.write(v.headSha)' "$DISPATCH_RUN_JSON")
test "$AUDIT_RUN_SHA" = "$DISPATCH_SHA"
gh run watch "$AUDIT_RUN_ID" --exit-status
gh run download "$AUDIT_RUN_ID" -n source-link-health-live -D /tmp/g004-source-link-health-live
gh run download "$AUDIT_RUN_ID" -n content-review-health -D /tmp/g004-content-review-health
test -n "$(find /tmp/g004-source-link-health-live -type f -size +0c -print -quit)"
test -s /tmp/g004-content-review-health/content-review-health.json
test -s /tmp/g004-content-review-health/content-review-health.md
rg -F -- "# Content review health" \
  /tmp/g004-content-review-health/content-review-health.md >/dev/null
node -e 'const r=require("/tmp/g004-content-review-health/content-review-health.json"); if (r.gates?.inputs_non_empty !== "passed") throw new Error("empty report inputs"); for (const k of ["new_sources","rechecked_sources","orphan_sources","due_documents","approaching_due_documents"]) if (!Number.isInteger(r.counts?.[k])) throw new Error(`missing count ${k}`)'
```

Expected: the bounded lookup selects the manual run for `DISPATCH_SHA`; it completes successfully; both named
artifacts exist and are non-empty; content-review counts/gates validate.

- [ ] Update E0-14 deployment metadata and the G004 publication baseline:

```bash
git add docs/content-backlog.md
git commit -m "docs: record e0-14 and g004 deployment"
git push origin main
METADATA_HEAD=$(git rev-parse HEAD)
wait_for_pages_run "$METADATA_HEAD"
fetch_and_assert_text patterns "Agent 控制与协作模式"
fetch_and_assert_text cases "Agent 平台与模型网关"
fetch_and_assert_text references "资料库"
fetch_and_assert_text paths "软件架构学习路线"
fetch_and_assert_text principles/pr-01 "信息隐藏与封装"
fetch_and_assert_text patterns/rel-02 "Retry、Exponential Backoff 与 Jitter"
fetch_and_assert_text styles/sty-00 "架构风格比较框架"
fetch_and_assert_text methods/mth-03 "ADR 生命周期"
fetch_and_assert_text modeling/mod-02 "C4 Context 与 Container"
fetch_and_assert_text quality-attributes/qa-01 "质量属性场景写法"
```

Expected: the backlog records E0-04, E0-06, E0-07, E0-13, and E0-14 implementation commit/Pages evidence. Fixture
topic checkboxes change only where their individual completion criteria were independently approved. The metadata
commit's own Pages run matches `METADATA_HEAD`, completes successfully, and passes smoke before checkpointing.

- [ ] Call `get_goal({})` after review, verification, deployment, smoke, and backlog metadata are complete. Confirm the
aggregate Codex goal is still `active` because G004 is story 4 of 20. Serialize the complete tool result verbatim to
`/tmp/g004-active-goal.json`: preserve objective, status, budgets, usage, and every other returned field; do not
construct a smaller JSON object by hand. Validate the persisted file with `JSON.parse`, compare it to the just-returned
tool object, and assert its status is `active`.

Expected: the snapshot identifies the aggregate objective and reports `active`; no Codex-goal completion transition
occurs. Do not call `update_goal` for this intermediate aggregate story.

- [ ] Perform the single G004 Ultragoal completion checkpoint:

```bash
omx ultragoal checkpoint \
  --goal-id G004 \
  --status complete \
  --evidence "G004 complete: Units A-E independently deployed; E0 metadata published; full verification, online smoke, cleaner, code-reviewer and architect gates passed" \
  --codex-goal-json /tmp/g004-active-goal.json
```

Expected: exactly one G004 story completion checkpoint is appended after Unit E. No Unit A–D completion checkpoint
exists, no final-run quality-gate payload is passed, and the aggregate Codex goal remains active for G005.

## Plan Self-Review

- [ ] **Spec coverage:** Tasks 1–3 cover E0-04; Tasks 4–5 cover E0-06; Tasks 6–7 cover E0-07; Tasks 8–9 cover
  E0-13; Tasks 10–12 cover E0-14; Task 13 and the final gate cover regression, source ledger, generated artifacts,
  workflows, online smoke, deployment metadata, independent review, and the single G004 checkpoint.
- [ ] **Data-source consistency:** backlog owns task status; MDX owns published article metadata and relations;
  source ledger owns source/version/citation facts; registries own only category/policy definitions.
- [ ] **Type consistency:** `pattern_group`, `adjacent_topics`, `related_cases`, `related_questions`,
  `review_policy`, `registered_at`, `caseSeries`, and parser return shapes use identical names across producer,
  manifest, frontend, evaluator, and tests.
- [ ] **Compatibility:** existing routes and all 18 case orders are asserted before final handoff.
- [ ] **Authority:** workers stop at local commits; A–E deployment is leader-only; only the final Unit E gate completes
  and checkpoints G004.
