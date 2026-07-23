# Architecture Learning Roadmap Implementation Plan

> **Status:** Superseded（已取代；单页学习路线仅保留为历史实施记录）。
> 当前多文章路线实施记录见
> [`2026-07-23-multi-article-learning-roadmap.md`](2026-07-23-multi-article-learning-roadmap.md)，
> 长期任务状态见 [`docs/content-backlog.md`](../../content-backlog.md)。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shallow five-case reading list with a six-stage software-architecture learning roadmap that directs experienced developers to selected external foundations and uses every tracked case for mechanism-level study.

**Architecture:** Keep the implementation content-first: one MDX roadmap page, one focused contract test, the existing catalog manifest/generated artifact, and one homepage copy correction. Do not add a progress model, React roadmap component, account state, or new dependency.

**Tech Stack:** Docusaurus 3.10.2, MDX, TypeScript/React 19, Node.js 24 test runner, repository content metadata and catalog scripts.

## Global Constraints

- Target readers have software-development experience and are learning architecture systematically for the first time.
- Do not teach language syntax, Git, HTTP basics, Linux commands, or database CRUD.
- External resources provide general foundations; repository cases provide concrete mechanisms, boundaries, and trade-off analysis.
- Every main stage must contain: `为什么学`, `掌握这些问题`, `外部补充`, `用本站案例深化`, `检查点`, and `下一步`.
- Label external resources as `必读起点`, `查漏补缺`, or `深入拓展`.
- Prefer original/official sources, then mature open-source roadmaps, then curated topic collections.
- Do not modify the factual claims, evidence labels, source cutoffs, or conclusions of existing case articles.
- Do not add dependencies, a progress system, accounts, scored quizzes, or mandatory large projects.
- Include the concurrently committed `content/cases/litellm-virtual-keys-governance.mdx` as canonical catalog order 17 and cover it in the governance stage.

---

### Task 1: Restore the canonical catalog to all tracked cases

**Files:**
- Modify: `scripts/content-schema.mjs`
- Modify: `tests/content-validation.test.mjs`
- Regenerate: `src/generated/case-catalog.json`

**Interfaces:**
- Consumes: the tracked case metadata in `content/cases/new-api-channel-pool-routing.mdx`.
- Produces: `requiredCaseSlugs` containing all 17 tracked cases and a generated catalog whose bytes match the current content tree.

- [ ] **Step 1: Extend the failing catalog expectation**

Add New API as catalog order 16 in `tests/content-validation.test.mjs`:

```js
const expectedCaseCatalog = [
  {slug: '/cases/microsoft-multi-agent-reference-architecture', catalog_order: 1},
  {slug: '/cases/openai-agents-sdk', catalog_order: 2},
  {slug: '/cases/langgraph-supervisor', catalog_order: 3},
  {slug: '/cases/google-adk-a2a', catalog_order: 4},
  {slug: '/cases/aws-cli-agent-orchestrator', catalog_order: 5},
  {slug: '/cases/erlang-otp-supervision-tree', catalog_order: 6},
  {slug: '/cases/kubernetes-reconciliation-loop', catalog_order: 7},
  {slug: '/cases/temporal-saga-durable-execution', catalog_order: 8},
  {slug: '/cases/apache-kafka-consumer-groups', catalog_order: 9},
  {slug: '/cases/aws-cell-shuffle-sharding', catalog_order: 10},
  {slug: '/cases/micro-frontends-single-spa', catalog_order: 11},
  {slug: '/cases/yjs-crdt-collaboration', catalog_order: 12},
  {slug: '/cases/cloudflare-durable-objects-workerd', catalog_order: 13},
  {slug: '/cases/kubeedge-cloud-edge-autonomy', catalog_order: 14},
  {slug: '/cases/ros2-dds-agent-lifecycle', catalog_order: 15},
  {slug: '/cases/new-api-channel-pool-routing', catalog_order: 16},
  {slug: '/cases/litellm-virtual-keys-governance', catalog_order: 17},
];
```

- [ ] **Step 2: Run the focused test and confirm the manifest is stale**

Run:

```bash
node --test --test-name-pattern="exports the literal approved catalog coverage" tests/content-validation.test.mjs
```

Expected: FAIL because `requiredCaseSlugs` does not yet contain `/cases/new-api-channel-pool-routing`.

- [ ] **Step 3: Extend the canonical manifest**

Append the tracked case in `scripts/content-schema.mjs`:

```js
export const caseCatalogManifest = [
  {slug: '/cases/microsoft-multi-agent-reference-architecture', catalog_order: 1},
  {slug: '/cases/openai-agents-sdk', catalog_order: 2},
  {slug: '/cases/langgraph-supervisor', catalog_order: 3},
  {slug: '/cases/google-adk-a2a', catalog_order: 4},
  {slug: '/cases/aws-cli-agent-orchestrator', catalog_order: 5},
  {slug: '/cases/erlang-otp-supervision-tree', catalog_order: 6},
  {slug: '/cases/kubernetes-reconciliation-loop', catalog_order: 7},
  {slug: '/cases/temporal-saga-durable-execution', catalog_order: 8},
  {slug: '/cases/apache-kafka-consumer-groups', catalog_order: 9},
  {slug: '/cases/aws-cell-shuffle-sharding', catalog_order: 10},
  {slug: '/cases/micro-frontends-single-spa', catalog_order: 11},
  {slug: '/cases/yjs-crdt-collaboration', catalog_order: 12},
  {slug: '/cases/cloudflare-durable-objects-workerd', catalog_order: 13},
  {slug: '/cases/kubeedge-cloud-edge-autonomy', catalog_order: 14},
  {slug: '/cases/ros2-dds-agent-lifecycle', catalog_order: 15},
  {slug: '/cases/new-api-channel-pool-routing', catalog_order: 16},
  {slug: '/cases/litellm-virtual-keys-governance', catalog_order: 17},
];
```

- [ ] **Step 4: Regenerate the catalog**

Run:

```bash
npm run generate:catalog
```

Expected: `src/generated/case-catalog.json` is rewritten with New API as order 16 and LiteLLM as order 17.

- [ ] **Step 5: Verify the catalog contract**

Run:

```bash
node --test --test-name-pattern="exports the literal approved catalog coverage" tests/content-validation.test.mjs
npm run check:catalog
```

Expected: both commands PASS; the second reports `Catalog is current.`

- [ ] **Step 6: Commit the canonical catalog repair**

```bash
git add scripts/content-schema.mjs tests/content-validation.test.mjs src/generated/case-catalog.json
git commit -m "fix: register New API architecture case"
```

### Task 2: Lock the learning-roadmap content contract

**Files:**
- Create: `tests/learning-path.test.mjs`
- Test: `tests/learning-path.test.mjs`

**Interfaces:**
- Consumes: `requiredCaseSlugs` from `scripts/content-schema.mjs`, `content/paths/index.mdx`, and `src/pages/index.tsx`.
- Produces: regression checks for the six-stage structure, resource-role labels, external anchors, complete case coverage, and accurate homepage copy.

- [ ] **Step 1: Add the roadmap contract test**

Create `tests/learning-path.test.mjs`:

```js
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {requiredCaseSlugs} from '../scripts/content-schema.mjs';

const learningPathFile = fileURLToPath(
  new URL('../content/paths/index.mdx', import.meta.url),
);
const homepageFile = fileURLToPath(
  new URL('../src/pages/index.tsx', import.meta.url),
);

const stageHeadings = [
  '## 第一阶段：架构思维与表达',
  '## 第二阶段：模块边界与应用架构',
  '## 第三阶段：分布式系统基础',
  '## 第四阶段：可靠性与状态管理',
  '## 第五阶段：扩展、隔离与生产治理',
  '## 第六阶段：Agentic 架构专项',
];

const stageFields = [
  '**为什么学**',
  '**掌握这些问题**',
  '**外部补充**',
  '**用本站案例深化**',
  '**检查点**',
  '**下一步**',
];

const externalAnchors = [
  'https://github.com/mehdihadeli/awesome-software-architecture',
  'https://github.com/donnemartin/system-design-primer',
  'https://c4model.com/',
  'https://arc42.org/',
  'https://sre.google/workbook/table-of-contents/',
  'https://github.com/cncf/curriculum',
  'https://kubernetes.io/docs/tutorials/kubernetes-basics/',
];

test('structures the architecture roadmap as six complete stages', async () => {
  const source = await readFile(learningPathFile, 'utf8');

  for (const [index, heading] of stageHeadings.entries()) {
    const start = source.indexOf(heading);
    const end =
      index === stageHeadings.length - 1
        ? source.indexOf('## 专题分支', start)
        : source.indexOf(stageHeadings[index + 1], start);
    const stage = source.slice(start, end);

    assert.notEqual(start, -1, `Missing stage heading: ${heading}`);
    assert.ok(end > start, `Stage has no bounded body: ${heading}`);
    for (const field of stageFields) {
      assert.match(stage, new RegExp(field.replaceAll('*', '\\*')));
    }
  }
});

test('labels external resources and links every canonical case', async () => {
  const source = await readFile(learningPathFile, 'utf8');

  for (const label of ['必读起点', '查漏补缺', '深入拓展']) {
    assert.match(source, new RegExp(`\\*\\*${label}\\*\\*`));
  }
  for (const anchor of externalAnchors) {
    assert.ok(source.includes(anchor), `Missing external resource: ${anchor}`);
  }
  for (const slug of requiredCaseSlugs) {
    assert.ok(source.includes(`](${slug})`), `Missing canonical case: ${slug}`);
  }
});

test('describes the homepage entry as one staged roadmap', async () => {
  const source = await readFile(homepageFile, 'utf8');

  assert.match(source, /沿软件架构主干开始/);
  assert.doesNotMatch(source, /选择一条专题学习路径/);
});
```

- [ ] **Step 2: Run the new test and confirm current content fails**

Run:

```bash
node --test tests/learning-path.test.mjs
```

Expected: three failures because the current page has no six-stage contract, no complete case/resource coverage, and the homepage still says `选择一条专题学习路径`.

- [ ] **Step 3: Commit the failing contract**

```bash
git add tests/learning-path.test.mjs
git commit -m "test: define architecture roadmap contract"
```

### Task 3: Rewrite the learning path as a staged roadmap

**Files:**
- Modify: `content/paths/index.mdx`
- Test: `tests/learning-path.test.mjs`

**Interfaces:**
- Consumes: the approved design in `docs/superpowers/specs/2026-07-23-architecture-learning-roadmap-design.md` and the canonical case slugs.
- Produces: a visible roadmap for experienced developers with six main stages, four optional branches, selected external resources, case deep dives, skip rules, and checkpoints.

- [ ] **Step 1: Replace the front matter with the expanded scope**

Use this metadata:

```yaml
---
title: 软件架构学习路线
slug: /paths
content_type: path
status: reviewed
difficulty: intermediate
analyzed_at: 2026-07-23
source_cutoff: 2026-07-23
confidence: high
domains:
  - software-architecture
  - distributed-systems
  - multi-agent-systems
  - cloud-native
agent_patterns:
  - agents-as-tools
  - supervisor
  - handoff
  - hierarchical-teams
protocols:
  - A2A
  - MCP
quality_attributes:
  - reliability
  - scalability
  - maintainability
  - observability
  - security
  - interoperability
  - operability
tags:
  - 软件架构
  - 学习路线
  - 系统设计
  - 分布式系统
  - 生产架构
official_sources:
  - https://github.com/mehdihadeli/awesome-software-architecture
  - https://github.com/donnemartin/system-design-primer
  - https://roadmap.sh/software-architect
  - https://c4model.com/
  - https://arc42.org/
  - https://sre.google/workbook/table-of-contents/
  - https://github.com/cncf/curriculum
  - https://kubernetes.io/docs/tutorials/kubernetes-basics/
  - https://openai.github.io/openai-agents-python/multi_agent/
  - https://docs.langchain.com/oss/python/langgraph/overview
  - https://google.github.io/adk-docs/agents/multi-agents/
  - https://a2a-protocol.org/latest/
  - https://modelcontextprotocol.io/docs/getting-started/intro
---
```

- [ ] **Step 2: Add the reader contract and skip rule**

Open the visible page with:

```md
# 软件架构学习路线

这条路线写给已经做过软件开发、但架构知识仍然零散的工程师。它不从语言、Git 或 HTTP 基础开始，也不要求把所有外部链接依次读完；路线负责说明知识依赖和学习边界，外部资料负责建立通用概念，本站案例负责把概念放回真实系统验证。

每个阶段都以一个检查点结束。已经能够独立完成检查点的读者，可以跳过该阶段的“必读起点”，直接阅读不熟悉的案例或进入下一阶段。遇到陌生术语时再使用“查漏补缺”，只有工作需要采用该机制时才进入“深入拓展”。

外部资源的三种用途：

- **必读起点**：建立进入本站案例所需的共同语言。
- **查漏补缺**：补齐当前阶段的单个知识缺口。
- **深入拓展**：准备在真实项目中采用相关机制时继续阅读。
```

- [ ] **Step 3: Write all six stages with the fixed contract**

For each stage, use exactly these six bold field labels:

```md
## 第一阶段：架构思维与表达

**为什么学**

架构工作的起点是识别约束和质量属性，并让关键决策可以沟通、复查和演进。先建立这套表达方式，后续学习模式、分布式机制或 Agent 框架时，才不会退化成技术名词和组件清单。

**掌握这些问题**

- 功能需求、质量属性和硬约束如何共同形成架构决策？
- C4、ADR 和质量属性场景分别回答什么问题？
- 代码设计、应用结构和系统架构的决策尺度有什么不同？

**外部补充**

- **必读起点**：[Awesome Software Architecture](https://github.com/mehdihadeli/awesome-software-architecture#architectural-design-principles) 的设计原则主题，用于建立耦合、内聚、依赖和权衡的术语入口。
- **查漏补缺**：[C4 Model](https://c4model.com/) 与 [arc42](https://arc42.org/)，分别补架构图层级和结构化文档方法。
- **深入拓展**：[Architecture Documentation](https://github.com/mehdihadeli/awesome-software-architecture/blob/main/docs/architecture-documententation.md)，继续查找 ADR、C4、arc42 和示例。

**用本站案例深化**

- [Microsoft 多智能体参考架构](/cases/microsoft-multi-agent-reference-architecture)：观察治理、身份、网络和可观测性约束如何改变组件设计。
- [Micro Frontends + single-spa](/cases/micro-frontends-single-spa)：观察业务边界、团队所有权和运行时边界为何不能自动画等号。

**检查点**

为一个熟悉系统写出主要约束、三项关键质量属性、一张上下文图，以及一条包含备选方案和取舍的 ADR。能够解释这些产出如何约束后续设计，即可进入下一阶段。

**下一步**

继续学习模块边界；如果已经能稳定划分模块并解释依赖方向，可以直接进入第三阶段。
```

Write the remaining stages with the same six labels and this exact content contract:

| Stage | Why and questions | External resources | Repository cases | Checkpoint and next step |
| --- | --- | --- | --- | --- |
| `第二阶段：模块边界与应用架构` | Explain why change cost depends on cohesion, coupling, dependency direction, and information hiding. Ask how layered, Hexagonal, Clean, Vertical Slice, modular-monolith, and bounded-context approaches differ, and when a service split is premature. | `必读起点`: Awesome Software Architecture sections for Modular Monolith and Architectural Design Principles. `查漏补缺`: its DDD, Hexagonal, Clean, and Vertical Slice sections. `深入拓展`: original-author or official material reached through those sections. | Micro Frontends + single-spa; OpenAI Agents SDK. | Produce a module map and dependency direction for a familiar application, then explain why it should or should not be split into services. Continue to distributed systems. |
| `第三阶段：分布式系统基础` | Explain latency/throughput, availability/consistency, replication, partitioning, caching, messaging, replay, and eventual consistency. Ask how synchronous calls and asynchronous messages change ownership and failure handling. | `必读起点`: System Design Primer topic index. `查漏补缺`: Awesome Software Architecture sections for Messaging, Eventual Consistency, Caching, Sharding, CQRS, and Distributed Transactions. `深入拓展`: System Design Primer real-world architectures. | Apache Kafka Consumer Groups; Temporal Durable Execution + Saga; Yjs CRDT Collaboration. | Draw a cross-service write, identify at least three failure windows, and assign retry, deduplication, or compensation responsibility. Continue to reliability. |
| `第四阶段：可靠性与状态管理` | Explain retries, idempotency, supervision, reconciliation, durable execution, back pressure, cancellation, and human terminal states. Ask where desired state, observed state, event history, and business facts belong. | `必读起点`: Google SRE Workbook foundations and practices. `查漏补缺`: Awesome Software Architecture resilience, cloud-pattern, and back-pressure topics. `深入拓展`: SRE incident response and postmortem chapters. | Erlang/OTP Supervision Tree; Kubernetes Reconciliation Loop; Temporal Durable Execution + Saga; Apache Kafka Consumer Groups. | Define a long-running task's state machine, timeout, retry budget, idempotency key, human terminal state, and recovery check. Continue to production isolation. |
| `第五阶段：扩展、隔离与生产治理` | Explain partitioning, cells, quotas, thin routing, observability, security, cost, compliance, and release strategy. Ask how platform responsibilities differ from business responsibilities. | `必读起点`: System Design Primer bottleneck and scaling method. `查漏补缺`: Awesome Software Architecture sections for Microservices, Observability, Security, and Cloud Design Patterns. `深入拓展`: Google SRE Workbook SLO, alerting, release, and incident chapters. | AWS Cell Architecture + Shuffle Sharding; Cloudflare Durable Objects + workerd; New API Channel Pool Routing; LiteLLM Virtual Keys; Microsoft multi-agent reference architecture. | Design isolation for a hot tenant, dependency failure, and rollback; name signals, limits, and recovery ownership. Continue to Agentic architecture or a branch. |
| `第六阶段：Agentic 架构专项` | Explain control ownership, shared state, final-answer responsibility, deterministic workflows, LLM routing, Handoff, Supervisor, A2A, MCP, memory, evaluation, permissions, and execution isolation. | `必读起点`: official OpenAI Agents SDK and LangGraph multi-agent/state documentation. `查漏补缺`: official Google ADK, A2A, and MCP documentation. `深入拓展`: upstream repositories linked from those official sources. | OpenAI Agents SDK; LangGraph Supervisor; Google ADK and A2A; AWS CLI Agent Orchestrator; Microsoft multi-agent reference architecture. | Compare single-agent, Manager, Handoff, and deterministic workflow designs for one scenario; name state owner, permissions, recovery, human takeover, and evaluation. Continue to the relevant optional branch. |

Turn the table's English implementation instructions into concise Chinese reader-facing prose. Do not add unsupported project claims. Keep each external-resource list to two through four entries and state what each link helps the reader learn.

- [ ] **Step 4: Add four optional branches and complete remaining case coverage**

Append:

```md
## 专题分支

六阶段主干建立共同语言，不要求每位读者继续学习所有分支。根据工作中的系统边界选择一条，遇到新的职责再回来扩展。

### 云原生与平台

按“容器化与部署 → 服务与网络 → 扩缩容与发布 → 可观测性与 SLO → GitOps/IaC → 安全”推进。

- **必读起点**：[Kubernetes Basics](https://kubernetes.io/docs/tutorials/kubernetes-basics/)。
- **查漏补缺**：[CNCF Curriculum](https://github.com/cncf/curriculum)。
- **深入拓展**：[Google SRE Workbook](https://sre.google/workbook/table-of-contents/)。
- 本站案例：[Kubernetes Reconciliation Loop](/cases/kubernetes-reconciliation-loop)、[AWS Cell Architecture + Shuffle Sharding](/cases/aws-cell-shuffle-sharding)、[Cloudflare Durable Objects + workerd](/cases/cloudflare-durable-objects-workerd)。

### 协作状态与前端架构

围绕共享状态、所有权、运行时组合和语义冲突学习。以 [Yjs 文档](https://docs.yjs.dev/) 为外部起点，先读 [Yjs CRDT Collaboration](/cases/yjs-crdt-collaboration)，再通过 [Micro-Frontend 专题](https://github.com/mehdihadeli/awesome-software-architecture#micro-frontend) 补充运行时组合知识，并用 [Micro Frontends + single-spa](/cases/micro-frontends-single-spa) 比较状态边界与业务边界。

### 边缘与物理智能体

围绕断网自治、通信语义、生命周期、实时性和独立安全链学习。以 [KubeEdge 文档](https://kubeedge.io/docs/) 和 [ROS 2 Jazzy 基础概念](https://docs.ros.org/en/jazzy/Concepts/Basic.html) 为外部入口，依次阅读 [KubeEdge Cloud-Edge Autonomy](/cases/kubeedge-cloud-edge-autonomy) 与 [ROS 2 + DDS Agent Lifecycle](/cases/ros2-dds-agent-lifecycle)。

### Agent 平台与模型网关

围绕能力路由、租户隔离、身份权限、成本、评估和可观测性学习。以 [LiteLLM Virtual Keys 文档](https://docs.litellm.ai/docs/proxy/virtual_keys) 为外部起点，组合阅读 [New API Channel Pool Routing](/cases/new-api-channel-pool-routing)、[LiteLLM Virtual Keys](/cases/litellm-virtual-keys-governance)、[Microsoft 多智能体参考架构](/cases/microsoft-multi-agent-reference-architecture)、[OpenAI Agents SDK](/cases/openai-agents-sdk)、[LangGraph Supervisor](/cases/langgraph-supervisor) 与 [Google ADK/A2A](/cases/google-adk-a2a)。

## 如何把阅读变成架构能力

不要用“看完多少链接”衡量进度。每完成一个阶段，保留一份可以复查的产出：上下文图、ADR、模块边界、失败窗口、状态机、隔离方案或 Agent 控制权比较。再用本站案例反问三件事：它解决了什么约束，代价是什么，迁移到自己的系统时哪项前提并不成立。

外部合集会持续变化，本站记录的核查日期是 `2026-07-23`。当链接结构或上游结论发生变化时，应回到官方资料重新确认，不把路线中的摘要当作永久保证。
```

- [ ] **Step 5: Run the learning-path and content tests**

Run:

```bash
node --test tests/learning-path.test.mjs
npm run validate:content
```

Expected: both commands PASS.

- [ ] **Step 6: Commit the staged roadmap**

```bash
git add content/paths/index.mdx
git commit -m "docs: build staged architecture learning roadmap"
```

### Task 4: Correct the homepage learning-path promise

**Files:**
- Modify: `src/pages/index.tsx`
- Test: `tests/learning-path.test.mjs`

**Interfaces:**
- Consumes: the single staged roadmap at `/paths`.
- Produces: homepage link copy that describes one main roadmap instead of several already-existing paths.

- [ ] **Step 1: Update the link label**

Replace:

```tsx
<Link className={styles.textLink} to="/paths">
  选择一条专题学习路径 <span aria-hidden="true">→</span>
</Link>
```

with:

```tsx
<Link className={styles.textLink} to="/paths">
  沿软件架构主干开始 <span aria-hidden="true">→</span>
</Link>
```

- [ ] **Step 2: Run the focused regression test**

Run:

```bash
node --test tests/learning-path.test.mjs
```

Expected: all three tests PASS.

- [ ] **Step 3: Commit the homepage correction**

```bash
git add src/pages/index.tsx
git commit -m "docs: align homepage with staged roadmap"
```

### Task 5: Verify content, generated artifacts, and rendering

**Files:**
- Verify: `content/paths/index.mdx`
- Verify: `src/pages/index.tsx`
- Verify: `src/generated/case-catalog.json`
- Verify: `tests/learning-path.test.mjs`

**Interfaces:**
- Consumes: all deliverables from Tasks 1–4.
- Produces: fresh evidence that tests, metadata validation, catalog generation, types, and production rendering agree.

- [ ] **Step 1: Run targeted verification**

Run:

```bash
node --test tests/learning-path.test.mjs
npm run validate:content
npm run check:catalog
```

Expected: all commands PASS and the catalog reports current.

- [ ] **Step 2: Run the full repository verification**

Run:

```bash
npm run verify
```

Expected: tests, content validation, catalog check, TypeScript typecheck, and Docusaurus production build all PASS.

- [ ] **Step 3: Check the built page at desktop and mobile widths**

Start the built site:

```bash
npm run serve -- --host 127.0.0.1
```

Inspect `/paths` at approximately 1440 px and 390 px widths. Confirm:

- stage headings remain visually distinguishable;
- external-resource labels wrap without overlapping;
- nested lists retain readable indentation;
- long GitHub link labels do not create horizontal overflow;
- the route remains understandable with external links unopened.

Stop the local server after inspection.

- [ ] **Step 4: Review the final diff**

Run:

```bash
git status --short
git diff 4e0edbe --check
git diff 4e0edbe --stat
```

Expected: no whitespace errors; only the canonical catalog repair, roadmap test/content, homepage copy, and implementation/design documentation are in scope.

- [ ] **Step 5: Commit any verification-only correction**

If visual inspection required a correction, stage only its exact files and commit:

```bash
git add content/paths/index.mdx src/pages/index.tsx tests/learning-path.test.mjs
git commit -m "docs: polish architecture roadmap rendering"
```

If no correction was needed, do not create an empty commit.
