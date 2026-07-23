# 全站来源、版权与外链治理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立覆盖全部文章的单一 source ledger、可执行版权与署名门槛、离线可重复且失败可见的外链检查，并强制学习索引不能充当事实证据。

**Architecture:** `data/source-ledger.json` 是来源元数据和 document citations 的唯一机器真源；内容、topic manifest 和 `/references` 都消费同一验证快照。`data/source-link-health.json` 仅保存网络观测，默认 CI 离线校验，显式命令和定时 workflow 执行 live 检查。

**Tech Stack:** Node.js 24 ESM、`node:test`、Docusaurus 3.10、React 19、TypeScript 6、JSON、GitHub Actions

## Global Constraints

- `docs/content-backlog.md` checkbox 是唯一人工任务状态；实现 worker 不修改 checkbox、发布基线或 Ultragoal 状态。
- 不增加 npm 依赖；使用 Node.js 24 内置 `fetch`、`AbortSignal.timeout`、`crypto` 和 `fs/promises`。
- 所有来源元数据和 document citations 只人工维护在 `data/source-ledger.json`。
- `data/source-link-health.json` 是观测缓存，不得被解释为来源真相或任务状态。
- `community-index` 和 `tier=discovery` 只能承担 `discovery` 或 `learning`，不能满足事实证据门槛。
- 生成文件继续使用 G002 的 staging + digest + fixed-order replace 恢复协议。
- 生成的 topic `status` 继续只投影 backlog checkbox 或内容生命周期，来源与链接状态不得参与。
- 默认 `npm run verify` 不访问网络。
- 实现 worker 不 push、不部署、不 checkpoint，也不在部署前勾选 E0-03、E0-05、E0-11、E0-12。

---

## File map

### New files

- `data/source-ledger.json`：全站来源记录、document citations 和版权审查记录的 canonical source。
- `data/source-link-health.json`：已提交的外链观测缓存。
- `scripts/source-ledger.mjs`：ledger schema、正文 URL 提取、citations 和证据门槛校验。
- `scripts/source-link-health.mjs`：离线缓存校验、live HTTP 检查和 CLI。
- `tests/source-ledger.test.mjs`：ledger schema、覆盖、版权和索引证据边界。
- `tests/source-link-health.test.mjs`：缓存及可注入 live checker。
- `tests/source-ledger-rendering.test.mjs`：资料库组件和页面连接。
- `src/components/SourceLedger/index.tsx`：渲染全站来源。
- `src/components/SourceLedger/styles.module.css`：资料库响应式样式。
- `.github/pull_request_template.md`：发布版权与来源检查清单。
- `.github/workflows/link-health.yml`：月度和手工 live 外链检查。
- `docs/source-license-inventory.md`：迁移前逐来源家族的许可证证据与最终映射审计。
- `scripts/validate-source-license-inventory.mjs`：inventory Markdown 结构、许可证值与候选覆盖校验。
- `tests/source-license-inventory.test.mjs`：inventory parser 与候选 source-family coverage。

### Modified files

- `scripts/backlog-topics.mjs`：空白标题 fail closed。
- `scripts/content-schema.mjs`：移除 `official_sources` 必需字段。
- `scripts/validate-content.mjs`：接入来源治理验证结果。
- `scripts/topic-manifest.mjs`：从 ledger 投影 primary sources，并直接拒绝非 HTTPS。
- `scripts/generate-content-platform.mjs`：读取 ledger，生成四个 artifact。
- `package.json`：来源与链接命令以及 verify gate。
- `content/**/*.mdx`：移除 `official_sources`；正文 URL 保留并由 ledger 登记。
- `content/references/index.mdx`：从手写来源清单改为生成资料库入口。
- `src/generated/source-ledger.json`：生成后的公开来源投影。
- `src/generated/topic-manifest.json`、`src/generated/topic-indexes.json`：来源投影更新。
- `tests/backlog-topics.test.mjs`、`tests/topic-manifest.test.mjs`：G002 两个审查小项。
- `tests/content-validation.test.mjs`、`tests/content-platform-generation.test.mjs`、
  `tests/topic-index.test.mjs`：新接口与四文件生成事务。
- `.github/workflows/deploy.yml`：保持默认 verify，无 live 网络访问；只补充显式注释。

---

### Task 1: Close the two G002 fail-closed gaps

**Files:**
- Modify: `tests/backlog-topics.test.mjs`
- Modify: `scripts/backlog-topics.mjs`
- Modify: `tests/topic-manifest.test.mjs`
- Modify: `scripts/topic-manifest.mjs`

**Interfaces:**
- Consumes: `parseBacklogTopics(source, file)`
- Produces: 空白标题错误；`buildTopicManifest()` 对每个 projected primary source 执行 HTTPS 检查。

- [ ] **Step 1: Add the backlog blank-title RED fixture**

在 `rejects malformed or unknown topic candidates instead of dropping them` 的 cases 中加入：

```js
{
  name: 'blank title',
  source: '- [ ] **FND-06 P0｜   **。',
  expected: /FND-06.*title.*non-empty|non-empty.*FND-06/i,
  candidateId: 'FND-06',
},
```

并断言 `parseBacklogTopics()` 不返回 `FND-06` topic。

- [ ] **Step 2: Run the backlog RED test**

Run:

```bash
node --test --test-name-pattern="rejects malformed or unknown topic candidates instead of dropping them" tests/backlog-topics.test.mjs
```

Expected: FAIL because the parser currently accepts a whitespace-only captured title.

- [ ] **Step 3: Reject the blank title before adding the topic**

在 `parseBacklogTopics()` 中规范化标题并 fail closed：

```js
const title = rawTitle.trim().replace(/[。.]\s*$/, '');
if (title === '') {
  errors.push(
    `${location(file, index + 1)}: topic ${id} title must be non-empty`,
  );
  continue;
}

topics.push({
  id,
  type,
  title,
  slug: `/${route}/${id.toLowerCase()}`,
  priority,
  complete: checked.toLowerCase() === 'x',
  line: index + 1,
});
```

- [ ] **Step 4: Add direct manifest non-HTTPS RED cases**

在 `tests/topic-manifest.test.mjs` 的
`rejects invalid published source and review metadata` 中加入：

```js
for (const invalidSources of [
  ['http://example.com/insecure'],
  ['/img/local-only.png'],
  [42],
]) {
  const invalid = buildTopicManifest({
    backlogSource: source,
    documents: [publishedConcept({official_sources: invalidSources})],
  });
  assert.match(
    invalid.errors.join('\n'),
    /content\/concepts\/architecture-scale\.mdx: published topic "FND-01" primary source .* must be an HTTPS URL/,
  );
}
```

- [ ] **Step 5: Run the manifest RED test**

Run:

```bash
node --test --test-name-pattern="rejects invalid published source and review metadata" tests/topic-manifest.test.mjs
```

Expected: FAIL because `buildTopicManifest()` currently checks only array non-emptiness.

- [ ] **Step 6: Validate every projected URL inside `buildTopicManifest()`**

在现有 non-empty check 后加入：

```js
for (const primarySource of projected.primary_sources ?? []) {
  if (
    typeof primarySource !== 'string' ||
    !primarySource.startsWith('https://')
  ) {
    errors.push(
      `content/${file}: published topic "${id}" primary source "${primarySource}" must be an HTTPS URL`,
    );
  }
}
```

该保护在 Task 4 改用 `primarySourcesByFile` 后仍保留。

- [ ] **Step 7: Verify GREEN and commit**

Run:

```bash
node --test tests/backlog-topics.test.mjs tests/topic-manifest.test.mjs
git diff --check
git add scripts/backlog-topics.mjs scripts/topic-manifest.mjs \
  tests/backlog-topics.test.mjs tests/topic-manifest.test.mjs
git commit -m "fix: fail closed on malformed content sources"
```

Expected: both test files PASS; one focused commit.

---

### Precondition Gate: Inventory current source licenses before Task 2

**Files:**
- Create: `docs/source-license-inventory.md`
- Create: `scripts/validate-source-license-inventory.mjs`
- Create: `tests/source-license-inventory.test.mjs`
- Inspect: `content/**/*.mdx`

- [ ] **Step 1: Inventory every current external source family**

从现有 40 篇 MDX 的 frontmatter/body 提取 URL，按作品/仓库而不是锚点去重。inventory 是严格
Markdown table，每行恰有十一列：

```text
source_family | current_urls | author_or_org | license_evidence_url | license_evidence_note |
checked_at | exact_license | scope_exclusions | migration_policy | family_grouping |
grouping_evidence_url
```

网页没有复用许可时，记录页面上的版权证据和
`LicenseRef-All-Rights-Reserved`，不能填 Unknown。仓库 license 只覆盖仓库声明的范围，不扩张到
README 外链、图片、书籍或视频。

- [ ] **Step 2: Lock the allowlist from actual inventory**

初始支持：

```js
[
  'Apache-2.0',
  'MIT',
  'BSD-3-Clause',
  'EPL-2.0',
  'MPL-2.0',
  'AGPL-3.0-only',
  'GPL-3.0-only',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'LicenseRef-US-Gov-Public-Domain',
  'LicenseRef-All-Rights-Reserved',
  'LicenseRef-Proprietary-Standard',
  'LicenseRef-Atlas-Original',
]
```

inventory 发现新 SPDX 时，先在本文件加入证据与使用策略，再扩 schema/test；不得把它降级成
Unknown 或使用相近许可证代替。

- [ ] **Step 3: Write the Node structural validator and RED/GREEN tests**

导出：

```js
licenseFamilyIdentity(url)
// GitHub => github:<lowercase-owner>/<lowercase-repo>
// DOI URL/identifier => doi:<fully normalized lowercase DOI>
// other HTTPS => canonical page/work URL with fragment removed and semantic query preserved

validateSourceLicenseInventory(markdown, candidateUrls)
// => {entries, errors}
```

测试名：

```js
test('accepts eleven-column license inventory rows with exact evidence', () => {});
test('rejects missing columns evidence license scope and migration policy', () => {});
test('covers every migration candidate source family', () => {});
test('keeps different works and licenses on one origin in separate families', () => {});
test('groups GitHub anchors by lowercase owner and repository', () => {});
test('normalizes complete DOI identities without merging distinct DOIs', () => {});
test('requires shared copyright evidence for explicit family grouping', () => {});
```

validator 必须检查：

- 每个 data row 恰十一列，禁止额外/缺失 pipe cell；
- source family/current URLs/author 非空；
- evidence URL 为 HTTPS，evidence note 非空；
- checked_at 是真实 calendar date；
- exact license 在 approved allowlist；
- scope exclusions 与 migration policy 非空；
- GitHub identity 固定到 lowercase owner/repo，同 repo 多文件/锚点归为一族；
- DOI percent-decode once + NFC + lowercase，并保留完整 registrant/suffix；不同 DOI 分开；
- 其他 URL 默认 canonical page/work identity，去 fragment、保留语义 query；同 origin 不自动合并；
- `family_grouping=identity` 时 `grouping_evidence_url=not-applicable`；
- `family_grouping=explicit:<id>` 时 grouping evidence 必须为 HTTPS，且 evidence note 明确共同版权/
  license scope；没有证据或只因同域名而 grouping 时失败；
- current URLs 都能归入 row source family 或有合规 explicit grouping；
- 从 40 篇文档提取的每个候选 family 至少有一行，inventory orphan family 失败；
- duplicate family 与 duplicate current URL 失败；
- diagnostics 按 source family 排序。

- [ ] **Step 4: Enforce the gate**

Run:

```bash
node --test tests/source-license-inventory.test.mjs
node scripts/validate-source-license-inventory.mjs \
  docs/source-license-inventory.md content
git diff --check docs/source-license-inventory.md
```

Expected: non-zero test count, all PASS, CLI reports all migration candidate source families covered. Task 2
cannot start until this gate passes.

- [ ] **Step 5: Commit**

```bash
git add docs/source-license-inventory.md scripts/validate-source-license-inventory.mjs \
  tests/source-license-inventory.test.mjs
git commit -m "docs: inventory source license evidence"
```

---

### Task 2: Define and validate the canonical source ledger

**Files:**
- Create: `scripts/source-ledger.mjs`
- Create: `tests/source-ledger.test.mjs`
- Create: `data/source-ledger.json`
- Modify: `scripts/content-schema.mjs`
- Modify: `tests/content-validation.test.mjs`

**Interfaces:**
- Produces:

```js
parseSourceLedger(value, file = 'data/source-ledger.json')
// => {ledger: {schema_version, sources, documents}, errors: string[]}

extractExternalLinks(document)
// => string[] sorted unique HTTPS URLs, excluding frontmatter, code fences,
//    HTML comments, and content/references/index.mdx generated cards

validateSourceGovernance(documents, ledger)
// => {
//   errors: string[],
//   governedLedger: {schema_version: 1, sources: Array, documents: Object},
//   primarySourcesByFile: Map<string, string[]>
// }
```

- [ ] **Step 1: Write source-ledger schema RED tests**

创建 `tests/source-ledger.test.mjs`，加入精确测试名：

```js
test('validates canonical source records and document citations', () => {});
test('rejects duplicate sources invalid enums and dangling citations', () => {});
test('extracts visible external links without code or comment false positives', () => {});
test('requires complete copyright review records', () => {});
test('keeps stable source identity across citation anchors queries and locator migration', () => {});
```

有效 fixture 使用：

```js
const validSource = {
  id: 'src-c4-model',
  canonical_locator: 'https://c4model.com/',
  transport_locator: 'https://c4model.com/',
  query_insensitive: false,
  locator_aliases: [],
  tombstone: null,
  title: 'C4 model',
  author_or_org: 'Simon Brown',
  published_at: null,
  checked_at: '2026-07-23',
  version: 'current page checked on 2026-07-23',
  source_kind: 'official-docs',
  tier: 'primary',
  allowed_evidence_roles: ['definition', 'method'],
  license: 'LicenseRef-All-Rights-Reserved',
  license_scope: 'Page text and diagrams; third-party links excluded',
  license_evidence_url: 'https://c4model.com/',
  license_evidence_note: 'No reuse license is declared on the checked page',
  license_family_id: 'https://c4model.com/',
  license_family_grouping: 'identity',
  family_grouping_evidence_url: null,
  copyright_policy: 'facts-and-short-quotation',
  usage_boundary: 'Defines the model; does not prove concrete fitness.',
  link_policy: 'stable',
  expected_final_transport_locator: 'https://c4model.com/',
  expected_final_approved_at: '2026-07-23',
  expected_final_approval_note: 'Initial reviewed transport baseline',
};

const validDocument = {
  reviewed_at: '2026-07-23',
  copyright_checks: [
    'original-structure',
    'quotation-boundary',
    'attribution-complete',
    'illustration-rights',
  ],
  citations: [{
    source_id: 'src-c4-model',
    citation_url: 'https://c4model.com/#SystemContextDiagram',
    roles: ['definition'],
    manifest_primary: true,
    usage_mode: 'facts-summary',
    attribution_note: 'C4 model, Simon Brown',
    modification_note: null,
    excerpt: null,
    quotation_reviewed: false,
  }],
};
```

错误 fixtures 必须覆盖：

- duplicate `id`、duplicate canonical locator 和 conflicting transport locator；
- 未知字段；
- 非法 `source_kind`、`tier`、role、license、copyright policy、link policy；
- `community-index` 使用非 discovery tier 或事实 role；
- citation 指向不存在 source；
- citation role 不在 source allowed roles；
- document path 不以 `content/` 开头或不存在；
- 日期无效；
- 空作者、空版本、空 license scope、空 usage boundary；
- license family ID 与 inventory identity 不一致，或 explicit grouping 缺共享范围 evidence；
- canonical/alias 缺 expected-final approval date/note；
- alias 对象缺 locator/transport/expected final/superseded_at，或与其他 source canonical/alias 冲突；
- tombstone replacement 指向不存在 source 或形成 replacement cycle；
- retired source 缺 tombstone，active source 意外携带 tombstone；
- HTTPS source 缺 link policy；
- 本地 illustration 使用事实角色。
- citation URL 不能匹配 source canonical/alias transport base；
- exact duplicate citation；
- canonical/transport locator 含 fragment，或 query preservation/query-insensitive 声明不一致；

稳定身份测试使用同一 GitHub file source ID，citations 分别为 `#L10-L20`、`#L30-L35` 和
`?plain=1#L10-L20`；只有 fixture 显式 `query_insensitive: true` 时才断言一个 transport。
另用 `?version=1`/`?version=2` 负测，断言默认保留 query、不能共享 source/transport。
随后把 canonical 从旧 URL 移入
`locator_aliases: [{locator, transport_locator, expected_final_transport_locator,
expected_final_approved_at, expected_final_approval_note, superseded_at}]`、
换成新 URL，断言 source ID 和历史 citation 继续有效；删除 alias 时历史 citation 必须失败。

- [ ] **Step 2: Run source-ledger RED**

Run:

```bash
node --test tests/source-ledger.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/source-ledger.mjs`.

- [ ] **Step 3: Implement constants, strict-object validation, and normalization**

在 `scripts/source-ledger.mjs` 导出：

```js
export const sourceKinds = [
  'standard',
  'paper',
  'official-docs',
  'official-repository',
  'source-code',
  'engineering-blog',
  'incident-report',
  'vendor-reference-architecture',
  'textbook',
  'independent-blog',
  'community-index',
  'original-illustration',
];

export const sourceTiers = ['primary', 'first-party', 'secondary', 'discovery'];
export const evidenceRoles = [
  'definition',
  'method',
  'runtime-fact',
  'case-evidence',
  'implementation',
  'historical-context',
  'comparison',
  'learning',
  'discovery',
  'illustration',
];
export const linkPolicies = ['stable', 'floating', 'auth-required', 'retired'];
export const approvedLicenses = [
  'Apache-2.0',
  'MIT',
  'BSD-3-Clause',
  'EPL-2.0',
  'MPL-2.0',
  'AGPL-3.0-only',
  'GPL-3.0-only',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'LicenseRef-US-Gov-Public-Domain',
  'LicenseRef-All-Rights-Reserved',
  'LicenseRef-Proprietary-Standard',
  'LicenseRef-Atlas-Original',
];
export const requiredCopyrightChecks = [
  'original-structure',
  'quotation-boundary',
  'attribution-complete',
  'illustration-rights',
];
```

实现 `isCalendarDate()`、`validateExactKeys()`、稳定排序和错误累积。解析失败返回
`{ledger: {schema_version: 1, sources: [], documents: {}}, errors}`，不抛出第一处错误并丢失其余
上下文。JSON 语法错误由调用方加文件名后报告。

实现并导出：

```js
canonicalizeTransportLocator(locator)
// lowercase scheme/host, remove default port and fragment, preserve query;
// preserve path case and trailing slash

citationMatchesSource(citationUrl, source)
// true when citation transport equals canonical or one locator_alias.transport_locator
```

默认 `transport_locator` 必须等于 `canonicalizeTransportLocator(canonical_locator)`。
`query_insensitive: true` 时允许显式 transport 再清空 query，并要求正/负 fixture 证明参数只是
展示用途；validator 不静默改写 ledger，而是报告不一致。

- [ ] **Step 4: Implement visible-link extraction**

复用 `readContentDocuments()` 已提供的 `body`。扫描器按行维护 code fence 与 HTML comment 状态，
从可见文本提取：

```js
const markdownLink = /\]\((https:\/\/[^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
const autoLink = /<(https:\/\/[^>\s]+)>/g;
const mdxHref = /\bhref=(?:["'])(https:\/\/[^"']+)(?:["'])/g;
```

去掉 URL fragment 之外的 Markdown 尾随标点，保留 query 和 fragment，返回
`localeCompare('en')` 排序的唯一数组。frontmatter 不参与提取。

- [ ] **Step 5: Seed the ledger from every current document**

创建一次性本地迁移脚本只用于生成工作副本，执行后删除，不提交脚本。最终
`data/source-ledger.json` 必须：

- 为当前 40 篇 MDX 建立 `documents` 条目；
- 登记全部正文可见 HTTPS URL 和学习路线原创图片；
- 把 Awesome Software Architecture、System Design Primer、roadmap.sh、面试站和博客索引标为
  `community-index` / `discovery`；
- 固定 GitHub commit URL 标为 `source-code` 或 `official-repository` / `primary`；
- 工程团队官方博客标为 `engineering-blog` / `first-party`；
- 厂商参考架构标为 `vendor-reference-architecture` / `first-party`；
- 对发布日期未知使用 JSON `null`，不能用访问日期代替；
- 每条 source 填写具体作者/机构、版本、许可证范围、署名和使用边界；
- 同一 GitHub file 的多个 `#L`/fragment 变体合并为一个 source record；query 默认保留，只有
  inventory 证明为展示参数并显式 query-insensitive 时才共享 transport；精确 URL 保留在 citations；
- 每篇 document 填写四个 copyright checks；
- 每个 citation 填写 usage mode、attribution note 和条件性 quotation/adaptation 字段；
- `sources`、documents keys、citations 均稳定排序。

禁止提交形如 `"Unknown"`, `"generated entry"`, `"review later"` 的自动迁移残留。

- [ ] **Step 6: Remove `official_sources` from the schema and all content**

从 `requiredFields` 删除 `'official_sources'`。删除全部 40 篇 MDX frontmatter 的
`official_sources` 块，正文链接保持不变。若一个索引来源原先只存在于 frontmatter，则在该索引
正文增加一个简短的“外部学习起点”链接，使 ledger citation 仍有可见消费点。删除 `validateContent()` 针对
`official_sources` 的旧 URL 检查；来源完整性在 `validateSourceGovernance()` 中统一处理。

更新 `tests/content-validation.test.mjs`：

- 将 `validCaseFrontMatter()` 移除 `official_sources`；
- 删除旧的空数组/HTTP frontmatter 断言；
- 把测试名 `accepts all five valid launch cases with HTTPS official sources`
  改为 `accepts all five structurally valid launch cases`；
- 保留 Task 1 对 `buildTopicManifest()` 直接调用的 HTTPS 单元测试。

- [ ] **Step 7: Implement cross-document governance validation**

`validateSourceGovernance()` 必须验证：

```js
const factualRoles = new Set([
  'definition',
  'method',
  'runtime-fact',
  'case-evidence',
  'implementation',
]);

const factRequiredTypes = new Set(['case', 'principle', 'pattern']);
```

- 每个非 references 文档有一个 ledger document 条目；
- ledger 不含不存在文档；
- 每个可见 HTTPS URL 有 source 和 citation；
- 每个 citation URL 在正文出现，references 页的 generated cards 是唯一例外；
- citation roles 是 source allowed roles 子集；
- `community-index` 只能使用 discovery/learning；
- 非 index 的 case/principle/pattern 至少有 primary/first-party factual source；
- 四个 copyright checks 完整且没有重复；
- `primarySourcesByFile` 只投影 `manifest_primary: true`、tier 为 primary/first-party、
  source kind 非 community-index、HTTPS 且 roles 包含 definition/method/runtime-fact/
  case-evidence/implementation 的 citation URL；
- secondary comparison/learning、navigation-only 与 discovery citation 即使显式设置
  `manifest_primary` 也失败，不能进入 manifest。

同时把 `validateContent()` 返回值从裁剪后的 `{file, metadata}` 改为完整的
`{filePath, file, source, body, metadata, headings}` document snapshot。现有消费者继续只读取
所需字段；Task 4 必须直接复用该 snapshot，不能二次扫描 content。

错误按 document path、source ID、URL 排序。

- [ ] **Step 8: Verify GREEN and commit**

Run:

```bash
node --test tests/source-ledger.test.mjs tests/content-validation.test.mjs
node --input-type=module - <<'EOF'
import {readFile} from 'node:fs/promises';
import {readContentDocuments} from './scripts/content-metadata.mjs';
import {
  parseSourceLedger,
  validateSourceGovernance,
} from './scripts/source-ledger.mjs';
const documents = await readContentDocuments('content');
const parsed = parseSourceLedger(
  JSON.parse(await readFile('data/source-ledger.json', 'utf8')),
);
const governed = validateSourceGovernance(documents, parsed.ledger);
if (parsed.errors.length || governed.errors.length) {
  throw new Error([...parsed.errors, ...governed.errors].join('\n'));
}
console.log(`Validated ${parsed.ledger.sources.length} sources across ${documents.length} documents.`);
EOF
git diff --check
git add data/source-ledger.json scripts/source-ledger.mjs \
  scripts/content-schema.mjs scripts/validate-content.mjs \
  tests/source-ledger.test.mjs tests/content-validation.test.mjs content
git commit -m "feat: establish the canonical source ledger"
```

Expected: tests PASS; command reports 40 documents and a non-zero source count; no
`official_sources:` remains under `content/`.

---

### Task 3: Enforce evidence and copyright policies adversarially

**Files:**
- Modify: `tests/source-ledger.test.mjs`
- Modify: `scripts/source-ledger.mjs`
- Create: `.github/pull_request_template.md`

**Interfaces:**
- Consumes: validated ledger shape from Task 2.
- Produces: fail-closed evidence boundary and a human publication checklist.

- [ ] **Step 1: Add RED tests for index laundering and license boundaries**

新增测试：

```js
test('does not treat learning indexes as factual evidence', () => {});
test('enforces license-specific copyright policies', () => {});
test('keeps vendor claims and illustration rights explicit', () => {});
test('enforces citation-level quotation adaptation and attribution records', () => {});
test('matches normalized quotation excerpts in the corresponding visible document body', () => {});
```

fixtures 必须覆盖：

- 一个 case 同时使用三个 `community-index`，仍因缺 factual source 失败；
- `community-index` 伪装为 `tier=secondary` 失败；
- independent blog 可做 comparison，但不能独自满足 case factual gate；
- CC BY 缺 `adapt-with-attribution` 失败；
- CC BY-SA 缺 `adapt-sharealike-review` 失败；
- US government work 缺 `public-domain-with-provenance` 失败；
- 未盘点许可证和 `LicenseRef-All-Rights-Reserved` 使用改编策略失败；
- vendor reference architecture 缺 `vendor-claims-separated` 失败；
- original illustration 缺 `illustration` role 或 document `illustration-rights` 失败。
- short quotation 缺 excerpt、attribution note 或 quotation review 失败；
- short quotation excerpt 只存在 ledger、未出现在对应 document visible body 失败；
- adapted text/illustration 缺 modification note 或使用不允许改编的 LicenseRef 失败；
- facts summary/navigation 带 excerpt 失败；
- navigation-only 带事实 role 失败；
- SPDX allowlist 外字符串和未批准的 `LicenseRef-*` 失败。
- `BSD-3-Clause` adapted text/illustration 失败；
- `EPL-2.0` adapted text/illustration 失败；
- `MPL-2.0` adapted text/illustration 失败；
- `GPL-3.0-only` adapted text/illustration 失败；
- `AGPL-3.0-only` adapted text/illustration 失败；
- `Apache-2.0`、`MIT` 以及任何未定义 adapted policy 的 license 同样 fail closed；
- 上述许可证仍允许 facts-summary、short-quotation、implementation evidence 和链接 citation。

- [ ] **Step 2: Run RED**

Run:

```bash
node --test tests/source-ledger.test.mjs 2>&1 | tee /tmp/tego-arch-g003-source-ledger-red.tap
rg -Eq '^# tests [1-9][0-9]*$' /tmp/tego-arch-g003-source-ledger-red.tap
test "$(rg -c '^not ok ' /tmp/tego-arch-g003-source-ledger-red.tap)" -ge 1
```

Expected: non-zero test count and at least one FAIL from the new index/copyright/citation/excerpt policies.

- [ ] **Step 3: Implement the policy matrix**

在 `scripts/source-ledger.mjs` 使用确切映射：

```js
const requiredPolicyByLicense = new Map([
  ['CC-BY-4.0', 'adapt-with-attribution'],
  ['CC-BY-SA-4.0', 'adapt-sharealike-review'],
  ['LicenseRef-US-Gov-Public-Domain', 'public-domain-with-provenance'],
  ['LicenseRef-All-Rights-Reserved', 'facts-and-short-quotation'],
]);

const requiredPolicyByKind = new Map([
  ['vendor-reference-architecture', 'vendor-claims-separated'],
  ['original-illustration', 'original-atlas'],
]);
```

当 kind 与 license 都有要求时，kind 规则优先。错误必须同时包含 source ID、实际值和期望值。

再按 citation `usage_mode` 强制：

```js
const adaptedModes = new Set(['adapted-text', 'adapted-illustration']);
const noAdaptLicenses = new Set([
  'Apache-2.0',
  'MIT',
  'BSD-3-Clause',
  'EPL-2.0',
  'MPL-2.0',
  'GPL-3.0-only',
  'AGPL-3.0-only',
  'LicenseRef-All-Rights-Reserved',
  'LicenseRef-Proprietary-Standard',
]);

const explicitAdaptLicenses = new Set([
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'LicenseRef-US-Gov-Public-Domain',
  'LicenseRef-Atlas-Original',
]);
```

adapted modes 只接受 `explicitAdaptLicenses`；不在该集合中的任何当前或未来 license 都失败。
`noAdaptLicenses` 用于给当前 inventory 输出具体错误，不能被当成“其他 license 默认允许”。

所有 citation 要求非空 attribution note；short quotation 要求 1–300 Unicode code points excerpt +
`quotation_reviewed=true`；adapted modes 要求 modification note +
`quotation_reviewed=true` 且 license 可改编；facts summary/navigation 的 excerpt 必须为 null。

实现：

```js
normalizeVisibleQuotation(text)
// Unicode NFC; replace Markdown links with labels; remove emphasis markers;
// ignore fenced code and HTML comments; collapse all whitespace to one space
```

对 excerpt 和对应 document body 调用该函数，并要求
`normalizedBody.includes(normalizedExcerpt)`。正测使用跨行 blockquote；负测使用
`excerpt: '示例占位摘录'` 且正文不含该字符串，必须带 document path 与 source ID 报错。

- [ ] **Step 4: Add the exact PR checklist**

创建 `.github/pull_request_template.md`：

```markdown
## 来源与版权发布检查

- [ ] 新增或修改的外部来源已登记到 `data/source-ledger.json`，正文链接与 document citation 闭合。
- [ ] Awesome、路线图、面试站、博客索引只标为 discovery/learning，没有承担事实证据。
- [ ] 事实、跨来源推断、厂商自述和本站分析在正文中可区分。
- [ ] 每个 citation 的 usage mode、署名、摘录审查与修改说明满足许可证条件。
- [ ] 短引用没有扩展成逐段翻译，仓库许可证没有被错误套用到第三方链接或图片。
- [ ] 插图为本站原创或有明确授权，来源、许可证和修改情况已记录。
- [ ] `npm run verify` 已通过；需要联网复核时另行运行 `npm run check:links:live`。
```

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
node --test tests/source-ledger.test.mjs 2>&1 | tee /tmp/tego-arch-g003-source-ledger-green.tap
rg -Eq '^# tests [1-9][0-9]*$' /tmp/tego-arch-g003-source-ledger-green.tap
rg -Eq '^# pass [1-9][0-9]*$' /tmp/tego-arch-g003-source-ledger-green.tap
! rg -q '^not ok ' /tmp/tego-arch-g003-source-ledger-green.tap
rg -n "community-index|CC-BY-SA-4.0|vendor-claims-separated|original-illustration" \
  scripts/source-ledger.mjs data/source-ledger.json
git diff --check
git add scripts/source-ledger.mjs tests/source-ledger.test.mjs \
  data/source-ledger.json .github/pull_request_template.md
git commit -m "feat: enforce source evidence and copyright policy"
```

Expected: all source-ledger tests PASS and policy terms appear in implementation and real data.

---

### Task 4: Feed the ledger into manifest and the recoverable generator

**Files:**
- Modify: `scripts/topic-manifest.mjs`
- Modify: `scripts/generate-content-platform.mjs`
- Modify: `tests/topic-manifest.test.mjs`
- Modify: `tests/content-platform-generation.test.mjs`
- Modify: `src/generated/topic-manifest.json`
- Modify: `src/generated/topic-indexes.json`
- Modify: `src/generated/case-catalog.json`
- Create: `src/generated/source-ledger.json`

**Interfaces:**
- `buildTopicManifest({backlogSource, documents, relations, primarySourcesByFile})`
- `serializePublicSourceLedger(governedLedger) => string`
- `generatedPaths.sourceLedger = 'src/generated/source-ledger.json'`

- [ ] **Step 1: Convert manifest fixtures to `primarySourcesByFile` RED tests**

在 `tests/topic-manifest.test.mjs` 增加 helper：

```js
const primarySources = (...entries) =>
  new Map(entries.length ? entries : [
    [
      'concepts/architecture-scale.mdx',
      ['https://example.com/architecture-scale'],
    ],
  ]);
```

所有 published document 调用显式传 `primarySourcesByFile`。新增：

```js
test('projects only validated ledger sources into the manifest', () => {});
```

验证：

- metadata 中即使残留 `official_sources` 也被忽略；
- 只有通过 citation `manifest_primary` 严格门槛的映射值成为 `primary_sources`；
- primary factual citation 可进入；secondary comparison/learning、community index、
  navigation-only 和未显式 primary 的 citation 均不进入；
- 缺 file key 产生 non-empty primary source error；
- `http://`、站内路径和非字符串仍由 `buildTopicManifest()` 自身拒绝。

- [ ] **Step 2: Add four-artifact RED tests**

更新 `tests/content-platform-generation.test.mjs` fixture，复制
`data/source-ledger.json` fixture，并断言：

```js
assert.deepEqual(Object.keys(first), [
  generatedPaths.sourceLedger,
  generatedPaths.manifest,
  generatedPaths.indexes,
  generatedPaths.caseCatalog,
]);
```

staging 期望文件增加 `source-ledger.json`。中断测试仍在第二次 replace 抛错，并验证四个 target 可
重放恢复。source document reads 仍只发生一次；ledger 只读一次。

- [ ] **Step 3: Run RED**

Run:

```bash
node --test tests/topic-manifest.test.mjs tests/content-platform-generation.test.mjs
```

Expected: FAIL because signatures and generated path still use G002 three-artifact shape.

- [ ] **Step 4: Change the manifest projection boundary**

把 `projectDocument()` 改为接受 `primarySources`：

```js
function projectDocument(id, file, metadata, existing, primarySources) {
  // existing case-catalog projection remains unchanged
  return {
    id,
    type: metadata.content_type,
    title: metadata.title,
    slug: metadata.slug,
    priority: existing?.priority ?? metadata.priority ?? null,
    status: existing?.status ?? contentStatus(file, metadata.status),
    dependencies: copyArray(metadata.depends_on ?? []),
    primary_sources: copyArray(primarySources ?? []),
    related_cases: copyArray(metadata.related_cases ?? []),
    reviewed_at: metadata.analyzed_at,
    published: true,
    presentation,
  };
}
```

`buildTopicManifest()` 查找：

```js
const primarySources = primarySourcesByFile.get(file) ?? [];
const projected = projectDocument(id, file, metadata, existing, primarySources);
```

保留 Task 1 的逐 URL HTTPS 验证。`projectPublishedDocuments()` 新增可选
`primarySourcesByFile = new Map()` 参数，兼容 case catalog 测试，但不回读 frontmatter URL。

- [ ] **Step 5: Extend the generation snapshot**

`buildContentArtifacts()`：

1. 读取和 JSON.parse `data/source-ledger.json`；
2. `parseSourceLedger()`；
3. 让 `validateContent()` 返回已有 document snapshot；
4. `validateSourceGovernance(validation.documents, ledger)`；
5. 将 `primarySourcesByFile` 传给 manifest；
6. 将 `governedLedger` 的公开字段序列化为第一个 artifact；Task 6 再合并 link-health cache。

固定 `generatedPaths`：

```js
export const generatedPaths = {
  sourceLedger: 'src/generated/source-ledger.json',
  manifest: 'src/generated/topic-manifest.json',
  indexes: 'src/generated/topic-indexes.json',
  caseCatalog: 'src/generated/case-catalog.json',
};
```

所有 write/check/staging/recovery 循环继续使用 `Object.values(generatedPaths)`，固定顺序即上面声明
顺序。

- [ ] **Step 6: Generate and verify GREEN**

Run:

```bash
node --test tests/topic-manifest.test.mjs tests/content-platform-generation.test.mjs
npm run generate:content
npm run check:content
node --input-type=module - <<'EOF'
import manifest from './src/generated/topic-manifest.json' with {type: 'json'};
for (const topic of manifest.topics.filter(({published}) => published)) {
  if (topic.primary_sources.some((url) => !url.startsWith('https://'))) {
    throw new Error(`Non-HTTPS manifest source for ${topic.id}`);
  }
}
console.log(`Checked ${manifest.topics.length} manifest topics.`);
EOF
```

Expected: tests PASS; four artifacts current; every manifest primary source is HTTPS.

- [ ] **Step 7: Commit**

```bash
git add scripts/topic-manifest.mjs scripts/generate-content-platform.mjs \
  scripts/source-ledger.mjs tests/topic-manifest.test.mjs \
  tests/content-platform-generation.test.mjs src/generated
git commit -m "feat: generate source-governed content artifacts"
```

---

### Task 5: Render the complete source library from the generated ledger

**Files:**
- Create: `src/components/SourceLedger/index.tsx`
- Create: `src/components/SourceLedger/styles.module.css`
- Create: `tests/source-ledger-rendering.test.mjs`
- Modify: `content/references/index.mdx`
- Modify: `tests/topic-index.test.mjs`

**Interfaces:**

```ts
type SourceLedgerProps = {
  tier?: 'primary' | 'first-party' | 'secondary' | 'discovery';
};
```

- [ ] **Step 1: Write rendering RED tests**

创建三个精确测试：

```js
test('renders the generated source ledger instead of a hand-maintained catalog', async () => {});
test('shows provenance copyright evidence roles and usage boundaries', async () => {});
test('labels discovery indexes as navigation rather than factual evidence', async () => {});
```

断言：

- component imports `@site/src/generated/source-ledger.json`；
- references page imports and renders `<SourceLedger />`；
- manual `### C4 Model` 等来源条目从 MDX 删除；
- component renders author/org、source kind、tier、version、checked_at、license、copyright policy、
  usage boundary、evidence roles 和 used-by links；
- community index card 显示“选题/学习导航，不是事实证据”；
- local illustration 不渲染成外链；
- HTTPS canonical locator 使用 `<a href>`；
- document path 转换为对应 metadata slug，而不是猜测文件 URL。

- [ ] **Step 2: Run RED**

Run:

```bash
node --test tests/source-ledger-rendering.test.mjs
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement `SourceLedger`**

组件导入 generated JSON，按 tier 顺序
`primary → first-party → secondary → discovery` 和 source kind、title 排序。每个卡片输出：

```tsx
<article className={styles.card} key={source.id}>
  <h3>
    {source.canonical_locator.startsWith('https://') ? (
      <a href={source.canonical_locator}>{source.title}</a>
    ) : (
      source.title
    )}
  </h3>
  <dl className={styles.metadata}>
    <dt>作者或机构</dt><dd>{source.author_or_org}</dd>
    <dt>来源层级</dt><dd>{tierLabels[source.tier]}</dd>
    <dt>来源类型</dt><dd>{kindLabels[source.source_kind]}</dd>
    <dt>版本</dt><dd>{source.version}</dd>
    <dt>核查日期</dt><dd>{source.checked_at}</dd>
    <dt>许可证</dt><dd>{source.license}</dd>
    <dt>使用边界</dt><dd>{source.usage_boundary}</dd>
  </dl>
</article>
```

为 source 构造 citations 时读取 generated documents，将 document slug 和 title 一并放入 public ledger；
组件不从文件名猜 slug。

- [ ] **Step 4: Replace the hand-maintained reference cards**

`content/references/index.mdx` 保留：

- 来源层级解释；
- “索引不等于证据”规则；
- 版权处理表；
- link policy 说明；
- 如何登记来源。

删除全部手写来源 `###` 卡片，加入：

```mdx
import SourceLedger from '@site/src/components/SourceLedger';

## 全站来源清单

以下条目由 `data/source-ledger.json` 生成。条目显示来源能够支持什么，也显示它不能单独证明什么。

<SourceLedger />
```

- [ ] **Step 5: Add responsive and accessible styling**

CSS 使用 semantic article/dl，移动端单列，`min-width: 768px` 两列；不固定高度，不隐藏 overflow，
链接继承站点 focus 样式。tier heading 和 discovery warning 必须为可见文本，不只用颜色表达。

- [ ] **Step 6: Verify GREEN**

Run:

```bash
node --test tests/source-ledger-rendering.test.mjs tests/topic-index.test.mjs
npm run typecheck
npm run build
```

Expected: tests/typecheck/build PASS; `/references` is generated by one component and has no broken links.

- [ ] **Step 7: Commit**

```bash
git add src/components/SourceLedger content/references/index.mdx \
  tests/source-ledger-rendering.test.mjs tests/topic-index.test.mjs \
  src/generated/source-ledger.json
git commit -m "feat: render the canonical source library"
```

---

### Task 6: Add deterministic cached and injectable live link checks

**Files:**
- Create: `scripts/source-link-health.mjs`
- Create: `tests/source-link-health.test.mjs`
- Create: `data/source-link-health.json`
- Modify: `package.json`
- Modify: `scripts/generate-content-platform.mjs`
- Modify: `tests/content-platform-generation.test.mjs`
- Modify: `src/generated/source-ledger.json`
- Modify: `src/components/SourceLedger/index.tsx`
- Modify: `tests/source-ledger-rendering.test.mjs`

**Interfaces:**

```js
buildLinkTargets(ledger)
// => Array<{
//   transport_locator: string,
//   expected_final_transport_locator: string,
//   expected_final_approved_at: string,
//   expected_final_approval_note: string,
//   source_ids: string[],
//   link_policy: 'stable' | 'floating' | 'auth-required' | 'retired',
// }>

validateLinkHealthCacheStructure(ledger, cache)
// => {errors: string[]}

evaluateLinkHealthVerdict(ledger, cache, {now = new Date()})
// => {failures: string[]}

checkSourceLink(
  target,
  {
    previousResult,
    fetchImpl = fetch,
    sleep,
    now = new Date(),
    timeoutMs = 10000,
  } = {},
)
// => Promise<LinkHealthResult>

checkLiveLinks(
  ledger,
  {
    previousCache,
    fetchImpl = fetch,
    sleep,
    now = new Date(),
    timeoutMs = 10000,
    globalConcurrency = 6,
    perOriginConcurrency = 2,
  } = {},
)
// => Promise<{cache, errors}>

mergePublicLedgerHealth(governedLedger, cache)
// => generated public ledger with health status per source
```

CLI:

```text
node scripts/source-link-health.mjs --check-cache
node scripts/source-link-health.mjs --live [--output <path>]
node scripts/source-link-health.mjs --refresh
```

- [ ] **Step 1: Write cache RED tests**

测试名：

```js
test('validates complete transport-deduplicated link-health cache coverage', () => {});
test('separates last attempt last success and stale review status', () => {});
test('rejects missing duplicate stale and policy-incompatible cache results', () => {});
test('generates a stale public ledger while the offline link verdict fails', async () => {});
```

fixtures 覆盖：

- every canonical and cited-alias unique HTTPS transport（active、auth-required、retired 都包括）
  恰有一个 result；
- 同一 GitHub file 的 fragments 默认共享；`?plain=1` 只有显式 query-insensitive 时共享；
- `?version=1`/`?version=2` 默认保留 query 并形成不同 source/transport；
- local illustration 无 result；
- cache 超过 120 calendar days；
- cache transport/source_ids 与 ledger canonicalization 分组不同；
- 同一 deduped transport 的 sources 声明冲突 policy 或 expected final；
- stable source 的 final transport URL 不同；默认比较前只用
  `const transportUrl = new URL(locator); transportUrl.hash = ''` 移除 fragment 并保留 query；
- final transport 与人工批准 expected final 不同；previous final 只报告变化，不作为 verdict；
- auth-required 只接受 `outcome=auth-required` 与 401/403，或
  `http_status=200 + login_wall_detected=true`；
- retired 只接受 `outcome=retired` 与 404/410；
- healthy 只接受 200–299；
- failed last attempt 保留旧 last success，但 review status 必须 stale；
- unknown outcome、duplicate source、orphan result 均失败。

前两类错误分开断言：missing/duplicate/coverage/policy conflict 进入 structure errors；stale、
age、unexpected outcome、unapproved redirect 进入 verdict failures。共享 stale fixture 必须断言：

```js
assert.deepEqual(validateLinkHealthCacheStructure(ledger, staleCache).errors, []);
assert.match(
  evaluateLinkHealthVerdict(ledger, staleCache, {now}).failures.join('\n'),
  /stale/,
);
assert.match(
  (await buildContentArtifacts(root))[generatedPaths.sourceLedger],
  /"health_summary": "stale"/,
);
```

- [ ] **Step 2: Write live-check RED tests**

测试名：

```js
test('follows bounded HTTPS redirects and records every hop', async () => {});
test('falls back from unsupported HEAD to ranged GET', async () => {});
test('limits global and per-origin concurrency', async () => {});
test('retries bounded Retry-After responses and recovers from 429', async () => {});
test('detects a 200 HTML login wall instead of reporting healthy', async () => {});
test('accepts an approved expected-final change without previous-success veto', async () => {});
test('classifies auth retired timeout server and redirect failures', async () => {});
test('does not reuse an old healthy result when the live request fails', async () => {});
```

使用可注入 `fetchImpl` 返回真实 `Response`：

```js
const fetchImpl = async (url, options) => {
  calls.push({url, options});
  return new Response(null, {status: 200});
};
```

断言 `HEAD`、403/405/501 fallback、`Range: bytes=0-65535`、最多 5 跳、`AbortSignal`、HTTPS
downgrade 拒绝、全局 6/同 origin 2 并发、Retry-After 秒数与 HTTP date 最多 2 次且单次不超过
5 秒、按 transport 排序，以及失败 attempt 仍进入新 cache 且 errors 非空。

- [ ] **Step 3: Run RED**

Run:

```bash
node --test tests/source-link-health.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 4: Implement separate cache structure and verdict evaluation**

严格检查：

```js
const maxSuccessAgeMs = 120 * 24 * 60 * 60 * 1000;
const checkedSources = ledger.sources.filter(
  ({canonical_locator}) => canonical_locator.startsWith('https://'),
);
```

按 `transport_locator` 分组，`retired` HTTPS source 仍需 result；仅 local source 排除。
`last_attempt` 永远代表本次结果；`last_success` 只在 policy 可接受的
healthy/auth-required/retired outcome 时更新。所有 errors 按
transport locator 排序，不依赖 JSON 输入顺序。

structure function 绝不检查 freshness/review status；verdict function 不重复 schema/coverage。
两者的诊断都格式为
`data/source-link-health.json: transport "<locator>" sources ["id-a","id-b"]: ...`，先按
transport locator、再按排序后的 source IDs 输出。

- [ ] **Step 5: Implement live checking**

请求 helper：

```js
const response = await fetchImpl(transportUrl, {
  method,
  redirect: 'manual',
  headers: method === 'GET'
    ? {'Range': 'bytes=0-65535', 'User-Agent': 'agentic-architecture-atlas-link-check/1'}
    : {'User-Agent': 'agentic-architecture-atlas-link-check/1'},
  signal: AbortSignal.timeout(timeoutMs),
});
```

规则：

- 301/302/303/307/308 读取 Location，最多 5 跳；
- relative Location 用 `new URL(location, currentUrl)`；
- final URL 必须 HTTPS；
- request/citation 保留完整 URL；默认 transport 只去 fragment、保留 query。只有
  `query_insensitive: true` 与显式无 query transport 才合并 query variants；
- HEAD 403/405/501 时回退 ranged GET；
- HTML HEAD 200 也执行最多 64 KiB GET；login/signin/auth final path 或 password/sign-in HTML
  分类为 login wall；
- stable 的 final URL 变化为 `redirect-changed`；
- stable/floating 都只与人工批准的 `expected_final_transport_locator` 比较；previous last-success
  只生成变化报告，不参与 pass/fail；
- auth-required 的 401/403 或 detected 200 login wall 为 `auth-required`；
- retired 的 404/410 为 `retired`；
- 429/503 按 Retry-After 最多重试 2 次，单次等待上限 5 秒；其他
  5xx/timeout/DNS/TLS/loop 为 error；
- 任一 error 使 live/refresh CLI exit 1；
- refresh 即使失败也原子写入本次 last attempt 和 append-only `attempt_history`；旧 success 只
  作为历史保留并把 status 置 stale。

批准流测试完整执行三次：

1. expected=old，old final healthy；
2. final=new，结果 redirect-changed，last success 仍 old，history 追加 failure；
3. 只更新 ledger expected/approved date/approval note 后再次请求 new，结果 healthy，last success
   更新 new，history 同时保留 old success、redirect failure、new success。

第三步必须证明 previous old success 只产生 report note，不再 veto。

并发调度用两个 semaphore：global 6、按 `new URL(transport).origin` 2。测试注入 promise gate
测量峰值，不依赖真实计时。

- [ ] **Step 6: Merge cache into the generated/public ledger**

先写 RED：

```js
test('merges healthy auth retired and stale health into the public ledger', () => {});
test('renders healthy auth-required retired and stale source health', () => {});
```

`mergePublicLedgerHealth()` 按 transport 把 cache 状态加入每个 source。一个 source 可有 canonical
和 cited alias 多个 transport，因此输出：

```js
health_summary: 'healthy' | 'auth-required' | 'retired' | 'stale',
health_checks: [{
  transport_locator: string,
  status: 'healthy' | 'auth-required' | 'retired' | 'stale',
  last_attempt_at: string,
  last_success_at: string | null,
  http_status: number | null,
  final_transport_locator: string | null,
}]
```

`buildContentArtifacts()` 新增读取 `data/source-link-health.json`，只调用
`validateLinkHealthCacheStructure()` 后再生成
`src/generated/source-ledger.json`；source ledger component 显示四种状态、last attempt 和 last
success。summary 使用 `stale > auth-required > retired > healthy` 最差优先顺序；没有 cache 或
cache 结构/coverage 非法时 generation fail closed。显式 `review_status=stale` 仍可生成并展示，
但 `npm run check:links` 同时运行 structure + `evaluateLinkHealthVerdict()`，与总 verify 一起退出
1，直到人工审查并提交新 cache/ledger。

- [ ] **Step 7: Add exact package commands**

```json
"check:links": "node scripts/source-link-health.mjs --check-cache",
"check:links:live": "node scripts/source-link-health.mjs --live",
"refresh:links": "node scripts/source-link-health.mjs --refresh",
"verify": "npm run test && npm run validate:content && npm run check:content && npm run check:links && npm run typecheck && npm run build"
```

CLI 缺 mode、多 mode、未知 mode、`--output` 缺路径或把 output 用于非 live mode 时均打印 usage
并 exit 1。live 带 output 时无论检查成功或失败都原子写 report，然后按检查 verdict 设置 exit。

- [ ] **Step 8: Produce the first reviewed cache**

Run:

```bash
npm run refresh:links
npm run check:links
```

如果 live 网络中有登录墙、永久重定向、retired URL 或真实失败，先保留 last attempt/last
success，再人工审查并更新 ledger 的 policy、expected final、alias 或 tombstone；不得把失败 URL
简单删除或伪写为 200。重复执行 refresh 直到没有未解释错误，然后离线 check 必须 PASS。

120 天维护闭环固定为 refresh → review generated diff → 更新 ledger/cache → targeted + offline
verify → commit。worker 只执行当前已授权实现提交；定时 workflow 只产出 artifact，不自动建 PR。

- [ ] **Step 9: Verify GREEN and commit**

Run:

```bash
node --test tests/source-link-health.test.mjs tests/source-ledger-rendering.test.mjs \
  tests/content-platform-generation.test.mjs
npm run generate:content
npm run check:links
git diff --check
git add scripts/source-link-health.mjs tests/source-link-health.test.mjs \
  data/source-link-health.json data/source-ledger.json package.json \
  scripts/generate-content-platform.mjs tests/content-platform-generation.test.mjs \
  src/generated/source-ledger.json src/components/SourceLedger/index.tsx \
  tests/source-ledger-rendering.test.mjs
git commit -m "feat: add reproducible source link health checks"
```

Expected: tests PASS; cache covers every ledger HTTPS source; default check makes no network calls.

---

### Task 7: Put source and link gates into validation and CI

**Files:**
- Modify: `scripts/validate-content.mjs`
- Modify: `tests/content-validation.test.mjs`
- Create: `tests/workflow-configuration.test.mjs`
- Create: `.github/workflows/link-health.yml`
- Modify: `.github/workflows/deploy.yml`
- Modify: `package.json`

**Interfaces:**
- `validate:content` remains the public structural + source governance CLI.
- `verify` remains the deployment gate and remains offline.

- [ ] **Step 1: Add CLI integration RED tests**

在 `tests/content-validation.test.mjs` 增加：

```js
test('the repository validator fails on unregistered article sources', async () => {});
test('the repository validator reports source-ledger errors with file context', async () => {});
```

fixture root 包含 `content/` 与 `data/source-ledger.json`。第一个 fixture 在正文加入
`[unregistered](https://example.com/unregistered)`；第二个让 citation 指向 missing source。
spawn CLI 并断言 exit 1 和精确 URL/path。

- [ ] **Step 2: Run RED**

Run:

```bash
node --test --test-name-pattern="the repository validator fails on unregistered article sources|the repository validator reports source-ledger errors with file context" tests/content-validation.test.mjs
```

Expected: FAIL because current CLI only validates MDX structure.

- [ ] **Step 3: Integrate ledger loading without rereading content**

`runCli()` 根据 content root 的父目录读取 `data/source-ledger.json`，调用
`parseSourceLedger()` 和 `validateSourceGovernance(result.documents, ledger)`。Task 2 已让
`validateContent()` 返回的 documents 保留 `body`、`source` 和 metadata；本任务直接复用该
snapshot，不再次读取 MDX。

CLI success 输出：

```text
Validated 40 content document(s) and N registered source(s).
```

JSON parse、ledger schema、document governance errors 与 content errors 合并后稳定排序输出。

- [ ] **Step 4: Add the scheduled live workflow**

创建 `.github/workflows/link-health.yml`：

```yaml
name: Check external source links

on:
  schedule:
    - cron: '17 2 1 * *'
  workflow_dispatch:

permissions:
  contents: read

jobs:
  check-links:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - name: Check live links
        run: npm run check:links:live -- --output /tmp/source-link-health-live.json
      - name: Upload live link report
        if: always()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with:
          name: source-link-health-live
          path: /tmp/source-link-health-live.json
          if-no-files-found: error
```

checkout、setup-node 与 upload-artifact 必须保持上述 40 位 immutable commit，不得改为 mutable
tag。live CLI 的 `--output` 在成功或失败时都原子写 JSON；workflow 保持 `contents: read`，不提交、
不建 PR。

- [ ] **Step 5: Make the offline boundary explicit**

`.github/workflows/deploy.yml` 的 Verify step 前增加注释：

```yaml
# npm run verify uses the committed link-health cache and does not access external sites.
- name: Verify site
  run: npm run verify
```

`package.json` 的 `verify` 保持 Task 6 确定顺序，不调用 `check:links:live` 或 `refresh:links`。

- [ ] **Step 6: Add workflow YAML and structure tests**

创建 `tests/workflow-configuration.test.mjs`，测试名：

```js
test('keeps deploy verification offline and live links in a read-only scheduled workflow', async () => {});
test('pins every GitHub action and uploads the live report even on failure', async () => {});
test('keeps workflow YAML indentation and top-level keys unambiguous', async () => {});
```

不增加 YAML dependency。测试读取两个 workflow，断言：

- 无 tab、无行尾空格、每个文件 `name/on/permissions/jobs` 顶层 key 恰一次；
- `link-health.yml` 同时有 schedule 与 workflow_dispatch、`contents: read`、30 分钟 timeout；
- live command 带 exact output path，artifact step 有 `if: always()` 和 `if-no-files-found: error`；
- 所有 `uses:` 匹配 `@[0-9a-f]{40}`，禁止 mutable tags；
- deploy workflow 只调用 offline `npm run verify`，不出现 live/refresh；
- link workflow 不出现 `git push`、PR API 或 write permission。

完整 YAML 语义的最终解析器是 GitHub Actions；leader push 后必须确认对应 workflow 被 GitHub 接受。
本地结构测试负责在 push 前捕获本次可控的缩进、重复 key、缺字段与权限回归。

- [ ] **Step 7: Verify GREEN and workflow structure**

Run:

```bash
node --test tests/content-validation.test.mjs
npm run validate:content
npm run check:content
npm run check:links
node --test tests/workflow-configuration.test.mjs
```

Expected: all checks PASS; workflows use pinned action commits and the scheduled job is read-only.

- [ ] **Step 8: Commit**

```bash
git add scripts/validate-content.mjs tests/content-validation.test.mjs \
  tests/workflow-configuration.test.mjs .github/workflows/deploy.yml \
  .github/workflows/link-health.yml package.json
git commit -m "ci: enforce source governance and link health"
```

---

### Task 8: Full verification, adversarial review, and leader handoff

**Files:**
- Modify only when verification exposes a defect: files listed in Tasks 1–7.
- Do not modify: `docs/content-backlog.md`, `.omx/`, publication baseline.

**Interfaces:**
- Produces: reviewed local commits and evidence for the Ultragoal leader.
- Does not produce: push, Pages deployment, checkbox updates, release metadata, checkpoint.

- [ ] **Step 1: Run targeted governance tests**

Run:

```bash
node --test tests/backlog-topics.test.mjs \
  tests/content-validation.test.mjs \
  tests/source-ledger.test.mjs \
  tests/source-link-health.test.mjs \
  tests/topic-manifest.test.mjs \
  tests/content-platform-generation.test.mjs \
  tests/source-ledger-rendering.test.mjs \
  tests/topic-index.test.mjs
npm run validate:content
npm run check:content
npm run check:links
```

Expected: all tests and offline checks PASS.

- [ ] **Step 2: Run the complete repository gate**

Run:

```bash
npm run verify
git diff --check
git status --short
```

Expected: tests, content/source validation, generated artifact check, offline links, typecheck and Docusaurus
build PASS.

- [ ] **Step 3: Perform an adversarial review**

Review with fresh eyes against E0-03/E0-05/E0-11/E0-12 and the design:

- sample at least one source of every `source_kind`;
- verify one GitHub file with multiple `#L`/query citations keeps one stable source ID and one transport request;
- verify canonical migration through alias preserves historical citation and tombstone preserves retired identity;
- sample one case, one path, pattern index and references page;
- verify Awesome/System Design Primer/roadmap/community indexes cannot satisfy factual gate;
- verify a source URL added only to article body fails;
- verify a ledger source added without document citation fails or is explicitly permitted as discovery inventory;
- verify CC BY, CC BY-SA, US government, all-rights-reserved and vendor policies;
- verify BSD/EPL/MPL/GPL/AGPL plus Apache/MIT adapted citations fail while non-adapt evidence remains valid;
- verify Node license inventory gate rejects malformed rows and any uncovered migration candidate family;
- verify GitHub repository license scope does not claim linked third-party material;
- verify local roadmap image provenance;
- verify expected/previous redirect changes, 200 login wall, 403 fallback, bounded Retry-After recovery,
  per-origin concurrency, retired coverage, timeout and 5xx;
- verify failed last attempt does not overwrite last success and public cards render stale/auth/retired/healthy;
- verify default `npm run verify` performs no live fetch;
- verify manifest status remains backlog/content lifecycle only;
- verify four-artifact interrupted replacement recovery;
- verify references page shows every ledger source.

Any blocking finding gets a new RED test, minimal fix, targeted test, full verify and separate review-fix commit.

- [ ] **Step 4: Scan for migration residue and accidental second writers**

Run:

```bash
test -z "$(rg -n '^official_sources:' content --glob '*.mdx' || true)"
test -z "$(rg -n 'T[B]D|T[O]DO|generated entry|review later|Unknown author' \
  data/source-ledger.json data/source-link-health.json \
  scripts/source-ledger.mjs scripts/source-link-health.mjs || true)"
test -z "$(rg -n 'writeFile.*content-backlog|content-backlog.*writeFile|ultragoal checkpoint' \
  scripts/source-ledger.mjs scripts/source-link-health.mjs || true)"
git diff --check
```

Expected: all commands exit 0. A legitimate prose occurrence must be rewritten precisely rather than excluded
with a broad ignore.

- [ ] **Step 5: Commit review fixes if needed**

If review required changes:

```bash
npm run verify
git diff --check
git add data/source-ledger.json data/source-link-health.json \
  scripts/source-ledger.mjs scripts/source-link-health.mjs \
  scripts/content-schema.mjs scripts/validate-content.mjs \
  scripts/topic-manifest.mjs scripts/generate-content-platform.mjs \
  src/generated src/components/SourceLedger content \
  tests .github package.json
git commit -m "fix: address source governance review"
```

If no tracked diff exists, do not create an empty commit.

- [ ] **Step 6: Hand off evidence and stop**

Report:

- implementation and review commit SHAs;
- total source count and document count;
- targeted and full verification results;
- `npm run check:content` and `npm run check:links` exact success output;
- independent review verdict;
- post-push routes:
  - `/references`
  - `/paths`
  - `/cases`
  - `/patterns`

The Ultragoal leader then performs the remaining story gate:

1. review and push the implementation commits;
2. wait for the matching Pages run;
3. inspect the four routes and confirm source cards, discovery warnings and existing content;
4. separately delegate the docs-only backlog checkbox and publication-baseline update after successful deployment;
5. review, commit, push and deploy that metadata update;
6. take a fresh active `get_goal` snapshot and checkpoint G003;
7. continue to G004 without marking the aggregate goal complete.

## Plan self-review

- **Spec coverage:** Tasks 2–5 cover source ledger, evidence roles, copyright and generated library; Tasks 6–7
  cover offline/live links and CI; Task 1 covers both G002 minor findings; Task 8 covers final adversarial evidence.
- **Placeholder scan:** Every task names exact files, interfaces, test names, commands, expected failure/success and
  commit boundaries. Migration records forbid unresolved auto-generated values.
- **Type consistency:** `primarySourcesByFile` is a `Map<string, string[]>` from
  `validateSourceGovernance()` through `buildTopicManifest()`; generated public source ledger is the first
  replacement target and merges the separately validated observational link cache without changing canonical
  source metadata.
- **Publication boundary:** No worker task pushes, deploys, checks backlog items, updates release baseline or
  checkpoints Ultragoal.
