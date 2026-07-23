# 全站来源、版权与外链治理设计

**日期：** 2026-07-23  
**状态：** Approved for planning  
**范围：** `docs/content-backlog.md` 的 E0-03、E0-05、E0-11、E0-12，以及 G002 最终审查留下的两个小项  
**非目标：** 本设计不勾选 backlog、不推送、不部署、不更新发布基线，也不改变 Ultragoal 状态

## 1. 背景与成功标准

当前站点有 40 篇 MDX 文档，frontmatter 中共有 289 个去重后的
`official_sources` URL，正文中约有 443 个去重后的 HTTPS URL。资料库页面主要服务学习路线，
大量案例证据只存在于各篇文章，来源类型、证据用途、许可证、署名、版本和链接状态没有统一的
机器可读登记。`official_sources` 还混合了官方文档、源码、工程博客、社区索引和教程，名称与实际
语义不一致。

G003 完成后必须满足：

1. 每个站内文章使用的外部来源都在一个机器可读 source ledger 中登记；资料库页面由该 ledger
   生成，不再手工维护第二份来源目录。
2. 每个来源明确记录来源层级、类型、允许的证据用途、作者或机构、版本或发布日期、核查日期、
   许可证与使用边界。
3. 原则、模式和案例内容不能仅由 Awesome 列表、面试站、博客索引或其他聚合页支撑；学习索引
   只能承担选题发现和导航用途。
4. 版权审查有机器可检查的记录和发布者可勾选的清单，明确 CC BY、CC BY-SA、美国政府作品、
   许可不明和厂商材料的处理边界。
5. 外链检查能区分稳定永久链接、会漂移的 latest 文档、登录墙和已失效页面；网络失败、重定向
   变化和缓存缺失都不能静默通过。
6. 默认 CI 检查离线、确定、可重复；显式 live 检查才访问网络。
7. G002 的 backlog 空白标题和 `buildTopicManifest()` 直接调用非 HTTPS 来源都 fail closed。
8. backlog checkbox 仍是唯一人工任务状态。来源 ledger、链接观测缓存和内容生命周期都不能写入
   或推导 backlog 完成状态。

## 2. 方案比较

### 方案 A：继续扩展 `content/references/index.mdx`

在现有资料库中手工增加表格，并让测试扫描正文 URL 是否出现在该页。

优点是改动小、作者容易直接编辑。缺点是结构化信息难以可靠解析，同一 URL 的作者、许可证和
用途会在正文、frontmatter、资料库三处重复；manifest 和外链检查还要各自重新解析 MDX。该方案
会把展示页面误当数据源，不满足单一来源要求。

### 方案 B：把完整来源对象放入每篇 frontmatter

每篇文章直接维护来源 URL、类型、许可证、证据角色和署名。

它让文章自包含，但同一官方文档被多篇文章引用时会复制全部元数据。当前
`parseFrontMatter()` 只支持标量和标量数组，嵌套对象需要扩大 YAML 解析范围；即使引入完整 YAML
解析器，也无法消除跨文章重复和漂移。该方案不采用。

### 方案 C：集中 source ledger + 文档 citations + 生成投影（推荐）

新增 `data/source-ledger.json`，同时保存唯一来源记录和按文档路径组织的 citations。文章正文保留
可读的来源链接，但不再用 `official_sources` 复制 URL 清单。校验器保证正文外链、ledger citations
和来源记录闭合；生成器从同一次验证快照产出资料库投影与 topic manifest 的
`primary_sources` 兼容字段。

优点是来源元数据只有一个真源、citations 可按文章审查、资料库和 manifest 不会漂移。代价是
G003 需要一次性迁移现有 40 篇文档和约 443 个 URL。该迁移是建立全站治理闭环所需的成本，且可用
脚本生成初稿后逐条审校。

## 3. 数据模型

### 3.1 Source record 与 citation 分离

`data/source-ledger.json` 是来源元数据与文档 citation 的唯一机器可读真源。source record 表示
稳定的作品或页面身份；citation 表示某篇文章实际使用的精确 URL、证据用途和版权处理。多个
GitHub `#L` 锚点或 query/fragment 变体可以引用同一个 source ID，不能为每个锚点复制来源记录：

```json
{
  "schema_version": 1,
  "sources": [
    {
      "id": "src-c4-model",
      "canonical_locator": "https://c4model.com/",
      "transport_locator": "https://c4model.com/",
      "query_insensitive": false,
      "locator_aliases": [],
      "tombstone": null,
      "title": "C4 model",
      "author_or_org": "Simon Brown",
      "published_at": null,
      "checked_at": "2026-07-23",
      "version": "current page checked on 2026-07-23",
      "source_kind": "official-docs",
      "tier": "primary",
      "allowed_evidence_roles": ["definition", "method"],
      "license": "LicenseRef-All-Rights-Reserved",
      "license_scope": "Page text and diagrams; linked third-party material excluded",
      "license_evidence_url": "https://c4model.com/",
      "license_evidence_note": "No reuse license is declared on the checked page",
      "license_family_id": "https://c4model.com/",
      "license_family_grouping": "identity",
      "family_grouping_evidence_url": null,
      "copyright_policy": "facts-and-short-quotation",
      "usage_boundary": "Defines the model; does not prove that a concrete architecture is fit.",
      "link_policy": "stable",
      "expected_final_transport_locator": "https://c4model.com/",
      "expected_final_approved_at": "2026-07-23",
      "expected_final_approval_note": "Initial reviewed transport baseline"
    }
  ],
  "documents": {
    "content/paths/01-architecture-thinking.mdx": {
      "reviewed_at": "2026-07-23",
      "copyright_checks": [
        "original-structure",
        "quotation-boundary",
        "attribution-complete",
        "illustration-rights"
      ],
      "citations": [
        {
          "source_id": "src-c4-model",
          "citation_url": "https://c4model.com/#SystemContextDiagram",
          "roles": ["definition", "learning"],
          "manifest_primary": true,
          "usage_mode": "facts-summary",
          "attribution_note": "C4 model, Simon Brown",
          "modification_note": null,
          "excerpt": null,
          "quotation_reviewed": false
        }
      ]
    }
  }
}
```

`sources` 按 `id` 排序，`documents` 按路径排序，每个 `citations` 按
`source_id → citation_url → roles` 排序。稳定 ID 不从标题或 URL 自动重算。同一文档可以对同一
source 有多个 citation，但 exact `source_id + citation_url + roles` 不得重复。

locator 规则：

- `canonical_locator` 是该 source 当前公开身份 URL；允许 HTTPS URL 和站内绝对资产路径。
- `transport_locator` 是外链检查的网络目标。默认只清空 fragment，保留 query，同时规范化
  scheme/host 为小写并移除默认端口；路径大小写和尾斜杠不自动改写。
- 只有 source 显式声明 `query_insensitive: true` 且人工填写无 query 的 `transport_locator` 时，
  citations 的 query 变体才可共享请求。`?plain=1` 这类纯展示参数必须显式走此规则；具有语义的
  `?version=1`/`?version=2` 不得合并，应分别建立 source identity。
- `citation_url` 保留正文实际引用的完整 query、fragment 和 GitHub `#Lx-Ly`，不得被 transport
  canonicalization 改写。
- `locator_aliases` 保存对象
  `{locator, transport_locator, expected_final_transport_locator, expected_final_approved_at,
  expected_final_approval_note, superseded_at}`。旧 citation 可以
  继续匹配 alias；新内容必须使用 canonical locator 的同 transport base。
- URL 迁移时保留 source ID，把旧 canonical 放入 aliases，再更新 canonical、transport、version
  与 expected final。禁止“删除旧 source + 创建新 ID”。
- source 永久退役时写 `tombstone: {retired_at, replacement_source_id, reason}`；没有替代项时
  `replacement_source_id` 为 `null`。tombstone 记录仍保留，citation 不被历史重写。
- canonical URL、aliases 和 citation URL 按上述规则得到相同 transport base 时，只做
  一次网络请求；每个仍被 citation 使用的 alias transport 也必须检查。缓存结果按 transport
  locator 去重，再映射回 source/citation。

站内资产只用于记录原创或获授权插图，不进入网络健康检查。首个本地记录是
`/img/paths/software-architecture-learning-roadmap.png`，类型为
`original-illustration`，用途为 `illustration`。

### 3.2 来源层级与类型

`tier` 只允许：

- `primary`：标准、原作者材料、论文、官方文档、官方仓库、固定源码。
- `first-party`：工程团队的一手博客、事故报告、演讲、厂商参考架构。
- `secondary`：高质量教材、独立技术文章、第三方教程。
- `discovery`：Awesome 列表、路线图、面试站、博客索引和其他聚合导航。

`source_kind` 只允许：

- `standard`
- `paper`
- `official-docs`
- `official-repository`
- `source-code`
- `engineering-blog`
- `incident-report`
- `vendor-reference-architecture`
- `textbook`
- `independent-blog`
- `community-index`
- `original-illustration`

`source_kind=community-index` 必须使用 `tier=discovery`，其
`allowed_evidence_roles` 只能包含 `discovery` 与 `learning`。Awesome Software Architecture、
System Design Primer、roadmap.sh、面试站和博客索引都归入这一规则。它们可以帮助读者发现材料，
但不能支持运行行为、保证、性能数字、协议语义或案例结论。

### 3.3 证据用途

文档 citation 的 `roles` 只允许：

- `definition`
- `method`
- `runtime-fact`
- `case-evidence`
- `implementation`
- `historical-context`
- `comparison`
- `learning`
- `discovery`
- `illustration`

每个 citation 的角色必须是来源 `allowed_evidence_roles` 的子集。`case`、`principle` 和非索引
`pattern` 文档至少有一个 `tier` 为 `primary` 或 `first-party`、且角色包含
`definition`、`runtime-fact`、`case-evidence`、`implementation` 或 `method` 的来源。
`community-index`、`tier=discovery`、面试材料和聚合页即使与其他索引组合，也不能满足该门槛。

对现有索引页保留兼容例外：路径以 `/index.mdx` 结尾的导航页可以只使用 `learning` 或
`discovery`，但不得被 manifest 标成事实主来源。正文文章的 `## 来源` 区域和 frontmatter
之外的外链仍必须在 ledger 中登记。

## 4. 版权与署名治理

### 4.1 许可证记录

本阶段不引入完整 SPDX parser。`license` 只接受明确 allowlist：

- SPDX 2.3 identifier：`Apache-2.0`、`MIT`、`BSD-3-Clause`、`EPL-2.0`、
  `MPL-2.0`、`AGPL-3.0-only`、`GPL-3.0-only`、`CC-BY-4.0`、`CC-BY-SA-4.0`。
- 本站受控 LicenseRef：`LicenseRef-US-Gov-Public-Domain`、
  `LicenseRef-All-Rights-Reserved`、`LicenseRef-Proprietary-Standard`、
  `LicenseRef-Atlas-Original`。

任何其他值都 fail closed；不能用自由文本、`Public Domain`、`proprietary` 或猜测出的 SPDX
标识绕过审查，也不能用 Unknown 作为批量迁移兜底。每条 source 必须记录
`license_evidence_url` 或具体 `license_evidence_note`。以后扩大 allowlist 必须先完成现有来源
license inventory、增加 schema 测试和对应处理策略。

许可证记录必须配套 `license_scope`，明确它覆盖当前页面、仓库代码、单个图片，还是仅覆盖部分
材料。仓库许可证不自动覆盖 README 中链接的文章、书籍、视频和图片。

Task 2 迁移前必须先通过 Node inventory gate：严格解析十一列表格，校验每行 evidence URL/note、
exact license、scope 与 migration policy，并证明现有 40 篇文档提取出的每个 candidate source
family 都有记录。文本 grep 不能代替结构与覆盖校验。

license family identity 规则：

- GitHub URL 规范为 `github:<lowercase-owner>/<lowercase-repo>`；同 repo 的文件、tree、blob、query
  和多个 `#L` 锚点共享仓库 license family。
- DOI URL 或 `doi:` identifier 先 percent-decode 一次、Unicode NFC、移除 URL query/fragment，
  再把 DOI identifier lowercase，规范为 `doi:10.<registrant>/<suffix>`。不同完整 DOI 永不合并。
- 其他 URL 默认 identity 是 canonical page/work URL：lowercase scheme/host、移除默认端口与
  fragment，但保留语义 query、path case 和 trailing slash。同一 origin 的两个作品默认是两个
  family，不能共享 license。
- 只有 inventory 显式使用 `family_grouping=explicit:<id>` 且提供
  `grouping_evidence_url`，证据明确覆盖所有 grouped works 的共同版权/许可证范围时才允许合并。
  普通导航页、同域名或同机构不足以作为 grouping evidence。

`copyright_policy` 的处理规则：

| 许可证/材料 | 允许策略 |
| --- | --- |
| CC BY | `adapt-with-attribution`；保留作者、原链接、许可证和修改说明 |
| CC BY-SA | `adapt-sharealike-review`；确认本站许可证兼容后才改编，否则仅短引用和原创总结 |
| 美国政府作品 | `public-domain-with-provenance`；仍记录机构、入口和改动 |
| 许可不明 / All rights reserved | `facts-and-short-quotation`；只做事实核验、短引用和原创总结 |
| 厂商材料 | `vendor-claims-separated`；把通用机制、厂商实现和厂商自述结果分开 |
| 原创站内插图 | `original-atlas`；记录生成/绘制方式和资产路径 |

本阶段采用保守的 adapted-mode allowlist：

- `CC-BY-4.0`：允许 adapted modes，但必须 attribution + modification note。
- `CC-BY-SA-4.0`：允许 adapted modes，但必须 attribution、modification note 和 share-alike
  compatibility review。
- `LicenseRef-US-Gov-Public-Domain`：允许 adapted modes，但必须 provenance + modification note。
- `LicenseRef-Atlas-Original`：允许本站原创资产继续修改，并记录生成/绘制方式。
- `Apache-2.0`、`MIT`、`BSD-3-Clause`、`EPL-2.0`、`MPL-2.0`、
  `GPL-3.0-only`、`AGPL-3.0-only` 本阶段只允许 facts summary、short quotation、
  implementation evidence 和链接等非改编用途；文章不得用其承载 adapted text/illustration。
- 任何没有在上面明确定义 adapted policy 的新 license 都 fail closed。以后开放前必须先补 policy、
  RED fixtures、署名/notice/share-alike 义务和站点许可证兼容性审查。

### 4.2 Citation 级使用与署名

source record 的 license 只说明材料边界；每个 citation 还必须说明本站实际怎么使用：

- `usage_mode` 只允许 `facts-summary`、`short-quotation`、`adapted-text`、
  `adapted-illustration`、`original-illustration`、`navigation-only`。
- 所有 citation 都要求非空 `attribution_note`，包括 facts summary 与 navigation。
- `short-quotation` 要求 1–300 Unicode code points 的 `excerpt` 和
  `quotation_reviewed: true`；
  `modification_note` 必须为 `null`。excerpt 与对应 document 的可见正文都做 Unicode NFC、
  Markdown link label/强调符清理和连续空白折叠后，excerpt 必须能在正文中精确匹配；只填 ledger
  占位摘录、正文没有引用时失败。
- `adapted-text` 与 `adapted-illustration` 要求非空 `modification_note`、
  `quotation_reviewed: true`，且 source license/policy 明确允许改编。
- `facts-summary` 与 `navigation-only` 要求 `excerpt: null`；
  `navigation-only` 的 roles 只能是 `discovery`/`learning`。
- `original-illustration` 只允许站内 locator、`LicenseRef-Atlas-Original` 和
  `illustration` role，并在 `modification_note` 写明绘制或生成方式。
- `LicenseRef-All-Rights-Reserved` 禁止 adapted modes；
  `CC-BY-SA-4.0` 的 adapted modes 还要求 modification note 明确 share-alike 兼容性审查结论。

### 4.3 文档发布审查

每个 ledger 文档条目都必须有 `reviewed_at` 和四个
`copyright_checks`：

1. `original-structure`
2. `quotation-boundary`
3. `attribution-complete`
4. `illustration-rights`

缺少任一项时，验证失败。`.github/pull_request_template.md` 同时提供人类可勾选的发布检查：
来源登记、证据角色、短引用/改编边界、署名、插图权利和厂商自述标注。这个清单是审查入口，
ledger 是机器门槛；二者都不表示 backlog 任务完成。

## 5. 来源发现、正文与资料库闭环

新增 `scripts/source-ledger.mjs`，负责解析、规范化和验证 ledger，并从已经由
`readContentDocuments()` 读取的同一批文档中提取可见 HTTPS 链接。提取器忽略 frontmatter、
代码围栏和 HTML 注释，接受 Markdown 链接、自动链接和 MDX `href`。

闭环规则：

1. 每个文档正文外链必须对应 ledger 的一条 source 和该文档的一条 citation。
2. 每个 document citation 必须在正文或该文档的生成展示中实际出现，禁止孤儿 citation。
3. `content/references/index.mdx` 是生成展示入口，不要求把所有 ledger URL 再写回自身正文。
4. `official_sources` 从全部 40 篇文档移除，`requiredFields` 继续要求
   `source_cutoff`，来源完整性由 ledger 承担；原先只在 frontmatter 出现的索引来源改写为正文
   可见的简短来源入口，不能在迁移中消失。
5. `content/references/index.mdx` 保留治理说明和版权规则，来源卡片由
   `SourceLedger` 组件读取 `src/generated/source-ledger.json` 渲染。
6. 资料库按 tier 与 source kind 分组，显示作者/机构、用途、版本、核查日期、许可证、使用边界、
   被哪些文章使用和链接健康分类。

这保证“所有文章来源维护在资料库”不是靠复制 URL，而是由同一 ledger 同时驱动机器校验和页面
展示。

## 6. Manifest 与 G002 单写约束

`buildContentArtifacts()` 仍是生成管线入口。它读取一次内容文档、一次 backlog、一次关系表、
一次 source ledger 和一次 link-health cache；先验证内容、来源与离线 cache，再生成：

1. `src/generated/source-ledger.json`（合并公开 citation 与 health 状态）
2. `src/generated/topic-manifest.json`
3. `src/generated/topic-indexes.json`
4. `src/generated/case-catalog.json`

link cache 有两个不可混用的结果面：

- `validateLinkHealthCacheStructure()` 只返回 schema、transport coverage、source IDs、policy/
  expected-final 冲突和时间顺序错误。generation 只消费这一结果；结构通过时，即使 stale 也生成
  public ledger。
- `evaluateLinkHealthVerdict()` 返回 stale、超过 120 天、unexpected outcome 和待审批 redirect。
  `npm run check:links` 同时拒绝 structure errors 与 verdict failures，因此总 verify fail closed。

同一个 stale fixture 必须证明 `buildContentArtifacts()` 能生成并渲染 stale，但
`npm run check:links` 对它退出 1。

`buildTopicManifest()` 新增必需参数 `primarySourcesByFile`。citation 只有同时满足以下条件才进入
该映射：`manifest_primary: true`、source tier 为 `primary` 或 `first-party`、kind 不是
`community-index`、citation URL 为 HTTPS，并且 roles 至少包含 `definition`、`method`、
`runtime-fact`、`case-evidence` 或 `implementation`。secondary 的 comparison/learning、
discovery index 和仅 navigation citation 永不进入 `primary_sources`。函数本身仍逐项检查 URL；
即使测试或其他调用方
绕过 `validateContent()` 直接传入 `http://`、站内资产或非字符串，也返回带文件上下文的错误。
这样修复 G002 审查提出的直接调用缺口。

topic `status` 完全保持 G002 约定：

- backlog topic 的状态只从 `docs/content-backlog.md` checkbox 投影；
- legacy published document 的状态只描述 content lifecycle；
- ledger 的 `reviewed_at`、链接缓存 outcome 或版权检查不得写入 topic status；
- generator 不回写 backlog。

生成事务沿用 G002 的可恢复 staging 协议，固定替换顺序为 source ledger → topic manifest →
topic indexes → case catalog。中断时保留完整 staging，重跑按 digest 恢复。

## 7. 外链健康检查

### 7.1 Link policy

每个 HTTPS source 必须声明：

- `stable`：固定版本、固定 commit、标准页面或预期永久 URL。
- `floating`：`latest`、产品当前文档、无版本官方入口；变化频率更高，但最终 URL 变化仍需审查。
- `auth-required`：预期返回登录墙或 401/403，不能标为健康，只能显式标为需要人工访问。
- `retired`：transport 预期返回 404/410；source record 同时必须有 tombstone，历史 citation
  保留。retired HTTPS transport 仍在 cache coverage 中，只有站内资产排除。

### 7.2 确定性缓存

`data/source-link-health.json` 是网络观测缓存，不是来源真源：

```json
{
  "schema_version": 1,
  "generated_at": "2026-07-23T08:00:00.000Z",
  "results": [
    {
      "transport_locator": "https://c4model.com/",
      "source_ids": ["src-c4-model"],
      "last_attempt": {
        "at": "2026-07-23T08:00:00.000Z",
        "outcome": "healthy",
        "final_transport_locator": "https://c4model.com/",
        "http_status": 200,
        "login_wall_detected": false,
        "redirects": []
      },
      "last_success": {
        "at": "2026-07-23T08:00:00.000Z",
        "outcome": "healthy",
        "final_transport_locator": "https://c4model.com/",
        "http_status": 200
      },
      "attempt_history": [
        {
          "at": "2026-07-23T08:00:00.000Z",
          "outcome": "healthy",
          "final_transport_locator": "https://c4model.com/",
          "http_status": 200
        }
      ],
      "review_status": "healthy"
    }
  ]
}
```

`npm run check:links` 只读 ledger 与已提交缓存，不访问网络。它检查 schema、每个 canonical 和
仍被 citation 使用的 alias 所形成的唯一 HTTPS transport（包括 `link_policy=retired`）恰有一个
结果、source IDs 与 transport 分组一致、
last attempt/last success 不倒序、review status 与 link policy 相容、last success 不超过 120
天。只有站内 locator 排除在 coverage 外。输出按 transport locator 排序，因此本地和 CI
可重复。缺失、重复、过期、意外 4xx/5xx、timeout 或解析错误都退出 1。

`last_attempt` 记录最近一次真实结果，失败也不能被旧 healthy 覆盖；`last_success` 只在本次得到
policy 可接受的 healthy/auth-required/retired 结果时更新。若本次失败但仍有旧 success，
`review_status=stale` 并保留两者；若从未成功则
同样 stale 且 `last_success=null`。`auth-required` 和 `retired` 是显式状态，不冒充 healthy。

生成 `src/generated/source-ledger.json` 时把 cache 按 transport 合并到每个 public source，
公开最差状态优先的 `health_summary`，以及每个 canonical/cited-alias transport 的
`health_checks[]`（status、last attempt/success、HTTP status 与最终 transport）。
`SourceLedger` 必须可见渲染 `healthy`、`auth-required`、`retired`、`stale`，不能只显示“已核查”。

### 7.3 Live 检查

`npm run refresh:links` 显式联网并重写缓存；`npm run check:links:live` 显式联网但不写仓库，
供定时 CI 使用。实现使用 Node 24 全局 `fetch`，并提供可注入的
`checkSourceLink(target, {previousResult, fetchImpl, sleep, now, timeoutMs = 10000})`，其中 target
明确携带 transport locator、expected final、source IDs 与 policy：

- 最多跟随 5 次重定向，逐跳记录状态与 Location；
- 全局并发最多 6，同一 origin 并发最多 2；
- 先发 `HEAD`，遇到 403、405 或 501 再发带 `Range: bytes=0-65535` 的 `GET`；
- HTML 目标即使 HEAD 为 200 也做最多 64 KiB 的 ranged GET；最终 URL 含 login/signin/auth 或
  HTML 出现 password form/sign-in 标记时分类为 login wall。只有 `auth-required` policy 可接受；
- 每次请求使用 `AbortSignal.timeout(10000)`；
- 请求和缓存保留原始 locator，但 HTTP 最终 URL 比较移除 fragment，因为 fragment 不会传给服务端；
- transport 默认只移除 fragment 并保留 query；只有显式 query-insensitive source 才合并 query；
  citation 始终保留完整 query/fragment；
- `expected_final_transport_locator` 是唯一人工批准基线；live final 不匹配它时为
  `redirect-changed`。previous last success 只生成“相对上次变化”报告，不在 expected 已审批更新后
  veto；
- 401/403 或明确检测到的 200 login wall 只有 `auth-required` 可得到 `auth-required` outcome；
- 404/410 只有 `retired` 可得到 `retired` outcome；
- 429 与 503 最多重试 2 次；解析 Retry-After 秒数或 HTTP date，单次等待上限 5 秒，测试注入
  `sleep`，超限仍失败；
- 其他 5xx、超时、DNS/TLS 错误和重定向循环都失败。

网络检查不把上一次 healthy 缓存当作本次成功。失败结果写入 refresh 产物并让命令退出 1，因此
失败不会静默。

redirect 批准流程是：旧 success → 新 redirect 失败并追加 attempt history → 人工核验目标 →
更新 ledger expected final + approved date + approval note → 下一次 refresh 匹配新 expected 后成功。
cache 的 append-only `attempt_history` 保留旧 success、redirect failure 和新 success，previous 只
用于报告，不能阻止已批准基线生效。

120 天闭环是：运行 refresh 生成 cache → 审查 stale、redirect、auth、retired 与 license/source
变化 → 必要时更新 ledger expected final/alias/tombstone → 重新验证 → 提交 ledger 与 cache。
定时 workflow 没有写权限，只上传本次 JSON artifact 并在有错误或与已提交 cache/expected final
不一致时失败；它不自动提交、不自动建 PR。仓库维护者可基于 artifact 启动后续已授权任务。

### 7.4 CI

`npm run verify` 加入离线 `npm run check:links`。部署工作流因此不依赖互联网可用性。
新增 `.github/workflows/link-health.yml`，每月 1 日和手工触发时运行
`npm run check:links:live`；它不改仓库，不自动接受重定向，失败直接显示在 Actions。

## 8. 错误处理与迁移

所有错误使用确定顺序并包含来源：

- ledger schema：`data/source-ledger.json: source "id" ...`
- 文档引用：`content/...mdx: citation "source-id" "citation-url" ...`
- 未登记正文链接：`content/...mdx: unregistered external source "URL"`
- 证据门槛：`content/...mdx: case content requires a primary or first-party factual source`
- link cache：`data/source-link-health.json: transport "<locator>" sources ["id-a","id-b"]: ...`；
  所有诊断先按 transport locator，再按排序后的 source IDs 输出。

一次性迁移由脚本从 40 篇文档的 frontmatter 与正文 URL 收集候选，生成稳定 ID 初稿；实现者必须
逐条补齐作者、类型、证据用途、许可证和使用边界，不能提交 `unknown` 作者、空边界、模板文字或
未审校的自动分类。迁移完成后删除临时脚本，避免形成第二个生成入口。

先修 G002 两个 fail-closed 小项，再建立 ledger schema；之后迁移来源、接入 manifest 与资料库，
最后加入外链与 CI。每一步用 RED → GREEN 测试独立提交。

## 9. 验证与发布边界

实现完成时必须通过：

- backlog 空白标题和 manifest 非 HTTPS 的定向测试；
- source ledger schema、覆盖、证据用途、版权检查和索引不等于证据测试；
- 生成事务与资料库渲染测试；
- link cache 与注入式 live checker 测试；
- `npm run verify`；
- `git diff --check`；
- 独立审查。

实现 worker 只提交代码和验证证据。Ultragoal leader 负责 push、等待 Pages、检查
`/references` 以及受影响索引、更新 backlog checkbox 与发布基线、再次发布并 checkpoint。

## 10. 自审结论

- 没有未决占位符；数据字段、枚举、命令和失败语义均已确定。
- source ledger 是来源元数据与 citations 的唯一真源；link cache 只保存观测，不与其竞争。
- stable source identity、精确 citation 和 transport health 已分层；fragment 不制造重复请求，
  query 只有显式 query-insensitive 才共享，alias/tombstone 保留历史。
- backlog checkbox 的任务状态单写规则保持不变。
- 聚合索引的发现用途与事实证据用途已通过类型、tier、role 和文章门槛四层约束隔离。
- 网络检查与默认部署解耦，同时由缓存覆盖检查和定时 live workflow 保证失败可见。
- public ledger 合并 cache 只用于展示 health，不把网络结果回写为来源事实或任务状态。
