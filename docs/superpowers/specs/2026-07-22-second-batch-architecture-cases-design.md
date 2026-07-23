# 第二批十个架构案例与可扩展目录设计规格

**日期：** 2026-07-22
**状态：** Superseded（已取代；十五篇案例目标已实现并继续扩展）
**替代文档：** 当前任务与 18 篇案例基线见
[`docs/content-backlog.md`](../../content-backlog.md)。
**仓库：** `sealday/agentic-architecture-atlas`
**本地根目录：** `/Users/seal/projects/tego-arch`
**站点：** `https://sealday.github.io/agentic-architecture-atlas/`

## 1. 背景

首版已经发布五个 AI 多智能体原生案例，分别覆盖企业参考架构、轻量控制权模型、持久化运行时、跨系统协议和编码 Agent 编排。第二批不继续堆叠同类 AI 框架，而是从经典分布式系统、前端协同、边缘计算和机器人系统中选择十个成熟架构实践，研究它们迁移到 AI 多智能体系统时可直接复用、只能有限类比和不能照搬的部分。

本次采用方案 B：新增十篇完整案例，同时建立由 MDX front matter 驱动的案例目录。案例元数据只在正文文件中维护一次，首页、案例库和后续筛选界面从构建期目录读取，避免案例增长后出现多份列表漂移。

完成后站点共有十五篇案例。

## 2. 目标

- 新增十篇与现有深度相同的中文案例，不创建只有摘要的占位页。
- 用跨领域案例补齐故障监督、持续协调、持久化执行、事件消息、故障隔离、前端组合、协同状态、边缘状态、云边自治和物理智能体等观察轴。
- 给所有案例增加稳定的系列、目录摘要、来源类型和迁移目标元数据。
- 由 front matter 自动生成案例目录，首页和案例库不再复制案例标题、链接与摘要。
- 保留现有五篇首发案例的突出位置，同时为第二批十篇提供清晰的研究地图。
- 继续保证内容校验、类型检查、生产构建和 GitHub Pages 部署全部通过后才能发布。

## 3. 非目标

本次不建设：

- 全文搜索服务、服务端数据库或动态内容后台。
- 可视化知识图谱、自动推荐或个性化学习路径。
- 案例排行榜、框架选型榜或“最佳架构”结论。
- 十个项目的可运行 Demo、云资源部署脚本或性能基准环境。
- 对上游项目进行完整代码审计、安全认证或许可证合规审查。
- 将跨领域类比写成上游项目的官方 AI 使用建议。

## 4. 第二批十个案例

### 4.1 经典分布式架构迁移

#### Erlang/OTP Supervision Tree

- **Slug：** `/cases/erlang-otp-supervision-tree`
- **研究主线：** worker/supervisor 分工、`one_for_one`、`one_for_all`、`rest_for_one`、重启强度和逐级故障升级。
- **迁移问题：** Agent 失败由谁恢复；模型错误、工具错误和状态损坏是否需要不同恢复策略；何时停止重试并升级给人工。
- **主要来源：** Erlang/OTP 官方监督树文档与 `erlang/otp` 源码。
- **边界：** BEAM 轻量进程不能直接等同于昂贵、带外部副作用的 LLM Agent。

#### Kubernetes Reconciliation Loop

- **Slug：** `/cases/kubernetes-reconciliation-loop`
- **研究主线：** spec/status、期望状态与实际状态、控制循环、事件重投、所有权和幂等协调。
- **迁移问题：** Agent 系统是否应接收目标状态而不是命令序列；多个控制者如何避免反复覆盖；状态如何持续收敛。
- **主要来源：** Kubernetes Controller 官方文档、kubelet sync loop 和 `kubernetes/kubernetes` 源码。
- **边界：** 非确定性模型不能不加预算和终止条件地运行无限协调循环。

#### Temporal Durable Execution + Saga

- **Slug：** `/cases/temporal-saga-durable-execution`
- **研究主线：** Saga 补偿事务、事件历史、确定性 Workflow、可重试 Activity、任务队列和长任务恢复。
- **迁移问题：** LLM 与工具调用放在哪个执行边界；如何避免重放时重复发送邮件、付款或修改外部系统；何时补偿或转人工。
- **主要来源：** 1987 年 Saga 原始论文、Temporal 官方架构说明与 `temporalio/temporal` 源码。
- **边界：** 持久化执行不自动保证业务操作的幂等和正确补偿。

#### Apache Kafka Consumer Groups

- **Slug：** `/cases/apache-kafka-consumer-groups`
- **研究主线：** append-only log、分区顺序、消费组、分区所有权、offset、rebalance、重放和背压。
- **迁移问题：** Agent 消息应按用户、任务还是会话分区；任务归属变化时如何避免重复执行；审计与重放保留多久。
- **主要来源：** LinkedIn 2011 年 Kafka 论文与工程文章、Apache Kafka 官方文档和源码。
- **边界：** Kafka 只保证分区内顺序，不能把它描述成跨 Agent 的全局顺序或事务总线。

#### AWS Cell Architecture + Shuffle Sharding

- **Slug：** `/cases/aws-cell-shuffle-sharding`
- **研究主线：** cell、bulkhead、固定容量单元、租户路由、shuffle sharding、故障半径和逐 cell 发布。
- **迁移问题：** 是否按租户、风险等级或数据域隔离 Agent；模型配额、执行器、队列和记忆是否应共同分片；单个失控 Agent 最多影响多少用户。
- **主要来源：** Amazon Builders' Library、2014 年 AWS Architecture Blog、AWS Cell-Based Architecture 指南和归档的 Route 53 Infima 源码。
- **边界：** `awslabs/route53-infima` 已于 2024 年归档，只作为历史实现证据，不能作为新系统推荐依赖。

### 4.2 前端协同与组合架构

#### Micro Frontends + single-spa

- **Slug：** `/cases/micro-frontends-single-spa`
- **研究主线：** 垂直业务切分、container/root config、运行时组合、加载/挂载/卸载生命周期、跨应用契约和独立部署。
- **迁移问题：** Agent 是否拥有完整业务切片；共享 Shell、认证和工具由谁维护；共享状态是否会重新制造分布式单体。
- **主要来源：** Cam Jackson 的 Micro Frontends 经典文章、single-spa 官方文档与源码。
- **边界：** 微前端首先解决组织和独立交付问题，小团队或单一发布节奏不应为了形式强行拆分。

#### Yjs CRDT 协同前端

- **Slug：** `/cases/yjs-crdt-collaboration`
- **研究主线：** shared types、CRDT update、provider、awareness、离线编辑、并发合并、快照和持久化边界。
- **迁移问题：** 人和多个 Agent 同时编辑一个工作区时如何合并；临时意图和正式数据是否分通道；离线 Agent 恢复后如何同步。
- **主要来源：** Yjs 官方文档、`yjs/yjs` 源码和内部数据结构说明。
- **边界：** CRDT 只解决特定共享状态的收敛，不自动提供权限、业务事务或语义冲突解决。

### 4.3 边缘与物理智能体

#### Cloudflare Durable Objects + workerd

- **Slug：** `/cases/cloudflare-durable-objects-workerd`
- **研究主线：** 全局唯一身份、单线程协调单元、持久化状态、协调原子、边缘放置和分片。
- **迁移问题：** 会话、任务或租户是否对应一个协调对象；如何避免全局锁；热点对象如何再分片；边缘状态如何鉴权和迁移。
- **主要来源：** Cloudflare Durable Objects 官方文档、参考架构和 `cloudflare/workerd` 源码。
- **边界：** 开源 `workerd` 的本地 Durable Objects 行为不等同于 Cloudflare 生产平台的全球放置、迁移和存储实现。

#### KubeEdge Cloud-Edge Autonomy

- **Slug：** `/cases/kubeedge-cloud-edge-autonomy`
- **研究主线：** CloudCore/EdgeCore、CloudHub/EdgeHub、MetaManager、DeviceTwin、期望/实际设备状态、断网自治和控制面/数据面分离。
- **迁移问题：** 云端规划和边缘执行如何分权；网络中断后边缘 Agent 的授权范围；模型、工具与策略如何同步和回滚。
- **主要来源：** KubeEdge 官方架构文档和 `kubeedge/kubeedge` 源码。
- **边界：** 使用固定 release/commit 分析，避免把不同 KubeEdge 版本的组件和设备管理语义混在一起。

#### ROS 2 + DDS Agent Lifecycle

- **Slug：** `/cases/ros2-dds-agent-lifecycle`
- **研究主线：** Topic、Service、Action、DDS QoS、Managed Node 生命周期、Executor、Callback Group、反馈、取消和抢占。
- **迁移问题：** 如何区分持续消息流、短工具调用和长任务；Agent 启动是否等于获得执行权；外部 supervisor 如何管理 Agent 生命周期。
- **主要来源：** ROS 2 官方仓库、ROS 2 interface/executor 文档和 Managed Node 设计文档。
- **边界：** ROS 2 的实时性和物理设备约束不能被简化为普通 Web Agent 消息传递；实现阶段固定稳定发行版和源码 commit。

## 5. 内容系列与元数据

所有 `content_type: case` 文档新增以下字段：

```yaml
summary: 一句话目录摘要
series: classic-distributed
catalog_order: 6
featured: false
source_kinds:
  - official-docs
  - open-source-project
migration_targets:
  - failure-supervision
  - retry-escalation
```

约束如下：

- `summary`：非空单行字符串，只用于目录卡片，不复制正文摘要。
- `series`：必填枚举：
  - `ai-native`
  - `classic-distributed`
  - `frontend-architecture`
  - `edge-physical`
- `catalog_order`：全局唯一正整数，现有五篇为 1–5，第二批为 6–15。
- `featured`：布尔值。现有五篇保持 `true`，第二批默认为 `false`。
- `source_kinds`：至少一项，允许值为：
  - `official-docs`
  - `open-source-project`
  - `classic-paper`
  - `engineering-blog`
  - `reference-architecture`
- `migration_targets`：至少一项，用匹配 `^[a-z0-9]+(?:-[a-z0-9]+)*$` 的稳定 kebab-case 词汇描述该案例可迁移的架构能力；首版不设封闭枚举，以便后续新增能力轴。

现有五篇的顺序固定为 Microsoft、OpenAI、LangGraph、Google、AWS，对应 `catalog_order: 1` 至 `5`；第二批按第 4 节出现顺序对应 `6` 至 `15`。

现有五篇需要补齐这些字段，但不改写其核心结论。首页精选卡片改为从目录中筛选 `featured: true`，不再单独手写标题、链接和摘要。

## 6. 跨领域迁移分析契约

十篇新增案例继续使用现有十个 H2：

1. 学习问题
2. 一页摘要
3. 事实边界
4. 架构图
5. 控制权与任务流
6. 关键源码导读
7. 架构决策与权衡
8. 生产化分析
9. 可迁移经验
10. 来源

在 `## 可迁移经验` 下，第二批十篇必须包含三个 H3：

- `### 可直接复用的机制`
- `### 只能有限类比的部分`
- `### 不应照搬的部分`

这样无需改变首发五篇的 H2 合同，同时能阻止跨领域文章把相似词汇误写成等价语义。正文继续区分已证实事实、基于证据的推断和个人分析。

## 7. 构建期案例目录

### 7.1 单一事实来源

MDX front matter 是案例目录的唯一事实来源。目录生成器读取 `content/cases/*.mdx`，只选择 `content_type: case` 的文件，输出稳定排序的生成文件。

实现结构固定为：

```text
scripts/
├── content-metadata.mjs
├── content-schema.mjs
├── generate-case-catalog.mjs
└── validate-content.mjs
src/
├── components/
│   └── CaseCatalog/
├── data/
│   └── caseCatalog.ts
└── generated/
    └── case-catalog.json
```

- `content-metadata.mjs`：负责文件发现、front matter 解析和规范化；验证器与目录生成器复用它。
- `generate-case-catalog.mjs`：生成只包含展示所需字段的 JSON，不复制正文。
- `caseCatalog.ts`：定义前端类型并导出目录、精选集合和系列分组。
- `CaseCatalog`：负责案例库的分组和筛选展示。

生成目录的每一项只包含 `title`、`slug`、`summary`、`difficulty`、`series`、`catalog_order`、`featured`、`source_kinds`、`migration_targets` 和 `tags`。正文、完整来源列表和分析日期不复制到前端目录文件。

生成文件提交到仓库。`npm run generate:catalog` 更新文件，`npm run check:catalog` 在 CI 中重新计算并比较，发现目录漂移时失败并给出修复命令。生成过程必须确定性排序，禁止包含时间戳或绝对路径。

### 7.2 目录校验

目录生成前检查：

- slug、`catalog_order` 全局唯一。
- 所有案例包含新增目录字段。
- `series`、`source_kinds` 使用允许值。
- `catalog_order` 是正整数。
- `featured` 是布尔值。
- `summary` 和 `migration_targets` 非空。
- 第二批十个 slug 全部存在。
- 第二批十篇包含三个迁移分析 H3。

不在 CI 中对外部来源执行网络请求，避免上游限流和瞬时网络故障阻断构建。来源有效性在内容审阅阶段使用固定 commit 和官方页面人工核验。

## 8. 页面设计

### 8.1 首页

保留现有 Hero 和五篇首发卡片。首发卡片数据改为来自生成目录。

在首发卡片与阅读路径之间增加“经典架构迁移地图”板块，用紧凑列表而不是十张大型卡片展示第二批：

- 经典分布式架构迁移：5 篇
- 前端协同与组合架构：2 篇
- 边缘与物理智能体：3 篇

每项显示案例标题、核心迁移目标和案例链接。该板块说明第二批的研究方法，而不是把十个项目包装成 AI 框架推荐榜。

### 8.2 案例库

`content/cases/index.mdx` 保留研究方法和证据标签，引入 `CaseCatalog` 组件展示十五篇案例。

案例库提供客户端筛选：

- 系列
- 难度
- 来源类型
- 迁移目标

默认按系列和 `catalog_order` 排序。筛选后没有结果时显示明确空状态和“清除筛选”按钮。首版不实现全文搜索和 URL 查询参数同步；案例页面 URL 保持稳定。

### 8.3 导航与侧边栏

顶层导航不新增十个项目名称。侧边栏继续由 `content/cases/` 自动生成，案例库负责发现和筛选，避免案例增长导致导航线性膨胀。

## 9. 来源与证据策略

- 先使用原始论文、官方工程博客、官方文档和上游源码。
- GitHub 源码链接固定到实施时核对的 commit SHA。
- 当前行为与历史设计发生变化时，同时标注历史语境和当前版本，不混写。
- 归档项目明确显示归档日期和用途；不把历史实现写成当前依赖建议。
- 商业平台公开文档只支持已公开行为，不推断未公开的全球调度、存储或控制面实现。
- `source_cutoff` 统一记录实际核验日期；初始目标为 2026-07-22，若实施跨日则使用实际完成日期。

## 10. 交付顺序

### 阶段 1：目录基础设施

- 提取共享 front matter 解析模块。
- 扩展 schema、验证器和测试。
- 给现有五篇补齐目录元数据。
- 生成目录并接入首页和案例库。

### 阶段 2：经典分布式架构迁移

- Erlang/OTP
- Kubernetes Reconciliation
- Temporal + Saga
- Apache Kafka
- AWS Cell + Shuffle Sharding

这五篇完成内容审阅、构建和视觉冒烟后可独立发布。

### 阶段 3：前端、边缘与物理智能体

- Micro Frontends + single-spa
- Yjs CRDT
- Cloudflare Durable Objects + workerd
- KubeEdge
- ROS 2 + DDS

这五篇完成后，站点达到十五篇完整案例。

## 11. 错误处理

- 缺少新增 front matter：验证失败并显示文件与字段。
- slug 或排序号重复：验证失败并列出冲突文件。
- 目录文件过期：`check:catalog` 失败并提示运行 `npm run generate:catalog`。
- 第二批案例缺少迁移分析子章节：内容校验失败。
- 生成目录为空或系列未知：前端构建前失败，不渲染静默空页。
- 筛选无匹配：页面显示空状态，不抛出运行时错误。
- 上游来源已归档或版本漂移：正文显式标注，不用相似的新项目替换历史证据。

## 12. 测试与验证

### 内容和生成器

- 现有五篇补齐新增字段后通过验证。
- 十个新增 slug 全部存在。
- metadata 类型、枚举、唯一性和非空约束具有失败测试。
- 三个迁移分析 H3 具有缺失测试，并排除 front matter、代码围栏和 HTML 注释中的伪标题。
- 目录生成在相同输入下字节级稳定。
- `check:catalog` 能检测手工修改或遗漏重新生成。

### 前端

- 首页只显示五篇 `featured: true` 的大型案例卡片。
- 迁移地图显示第二批十篇，并按 5/2/3 分组。
- 案例库显示十五篇且无重复 slug。
- 每个筛选维度和组合筛选具有组件或纯函数测试。
- 空状态可以通过键盘清除筛选。

### 全站

- `npm test`
- `npm run validate:content`
- `npm run check:catalog`
- `npm run typecheck`
- `npm run build`
- 首页、案例库和十五个案例的本地生产路由冒烟检查。
- 首页与案例库在桌面/移动、浅色/深色模式下截图验收。
- GitHub Actions 部署成功后检查线上首页、案例库和新增十个 HTTPS 路由。

## 13. 成功标准

- 站点共有十五篇完整案例，其中新增十篇全部达到现有十段式分析深度。
- 第二批每篇都明确区分可直接复用、有限类比和不可照搬。
- 首页保留首发五篇的视觉重点，并清楚呈现第二批十篇研究地图。
- 案例库由 MDX front matter 自动生成，可按系列、难度、来源和迁移目标筛选。
- 新增案例不要求修改顶层导航或手工维护另一份案例清单。
- 所有本地验证、生产构建、GitHub Actions 和线上路由检查通过。
