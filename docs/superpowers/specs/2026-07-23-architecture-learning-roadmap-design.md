# 软件架构学习路线改造设计

**Lifecycle：** Superseded（已取代；单页学习路线仅保留为历史设计记录）

**Successor：** 当前多文章路线设计见
[`2026-07-23-multi-article-learning-roadmap-design.md`](2026-07-23-multi-article-learning-roadmap-design.md)，
长期任务状态见 [`docs/content-backlog.md`](../../content-backlog.md)。

## 背景

当前 `/paths` 页面只有五篇 AI 原生案例组成的线性阅读清单。它能说明多智能体系统中控制权、状态和治理的递进关系，但不能承担“有开发经验、第一次系统学习软件架构”的学习入口：

- 路线没有解释学习阶段、先修关系、阶段目标或跳过条件。
- 现有案例以 intermediate 和 advanced 为主，没有 beginner 案例负责补齐架构基础。
- 可靠性、分布式状态、消息、隔离、协同、边缘与物理系统等案例没有进入路线。
- 外部来源只保存在 front matter 或资料库，正文没有说明读者应在何时、为了什么去读。
- 首页承诺“选择一条专题学习路径”，实际只有一条路径。

本次改造不把站点扩展成从编程基础开始的完整课程。目标读者已经具备软件开发经验，能够自行阅读文档、文章和开源仓库；站点需要做的是建立正确的知识依赖，筛选外部入口，并用现有案例训练架构判断。

## 目标

学习路线改造后，读者应当能够：

1. 理解软件架构首先处理质量属性、约束、边界和权衡，而不是框架选型。
2. 按依赖顺序建立模块设计、分布式系统、可靠性、扩展与治理知识。
3. 知道每个阶段哪些知识由本站案例覆盖，哪些需要通过外部材料补充。
4. 根据已有经验跳过熟悉内容，而不必机械地从第一项读到最后一项。
5. 通过简短检查点判断是否具备进入下一阶段的能力。
6. 在完成通用主干后，进入 Agentic、云原生、协作状态或边缘物理等专题。

## 非目标

- 不教授语言语法、Git、HTTP、Linux 命令或数据库 CRUD。
- 不复制外部仓库的完整目录或维护一份无差别链接合集。
- 不为每个主题编写本站原创基础教程。
- 不在本次改造中建设账户、学习进度、打卡、测验评分或课程后台。
- 不强制读者完成大型编码项目或认证考试。
- 不改变现有案例正文的事实、证据标签、版本边界和结论。

## 读者假设

目标读者是有实际开发经验、第一次系统学习软件架构的工程师。默认他们：

- 能读懂一种主流语言的应用代码和基本自动化测试。
- 使用过 HTTP API、关系型数据库和常见部署环境。
- 能根据指引阅读英文官方文档、GitHub 仓库和公开课程。
- 可能听过 DDD、CAP、消息队列、Kubernetes 或多智能体，但知识是零散的。

路线不以工具使用年限判断水平，而以阶段检查点判断是否可以跳过。

## 内容架构

页面采用“入口说明 → 六阶段主干 → 专题分支 → 使用方法”的结构。

### 入口说明

开头用短段落回答三个问题：

1. 这条路线适合谁。
2. 本站案例和外部资源分别承担什么角色。
3. 如何通过检查点跳过已经掌握的阶段。

路线不是厂商证书目录，也不是要求全部阅读的链接集合。主干建立共同语言，专题分支按工作需要选择。

### 阶段一：架构思维与表达

**核心问题**

- 功能需求、质量属性和约束如何共同形成架构决策？
- 如何用 C4、ADR 和场景化质量属性让架构可沟通、可复查？
- 什么情况下只是代码设计，什么情况下已经形成系统级架构决策？

**外部补充**

- Awesome Software Architecture：Architectural Design Principles。
- Awesome Software Architecture：Architecture Documentation 与 Modeling。
- C4 Model 官方站点或 arc42 官方文档，作为架构表达的一手入口。

**本站材料**

- Microsoft 多智能体参考架构：观察质量属性和治理约束如何改变组件设计。
- Micro Frontends + single-spa：观察业务边界、团队所有权和运行时边界并不自动一致。

**检查点**

给定一个熟悉的系统，读者能写出主要约束、三项关键质量属性、一张上下文图和一条带备选方案的 ADR。

### 阶段二：模块边界与应用架构

**核心问题**

- 耦合、内聚、依赖方向和信息隐藏如何影响变化成本？
- 分层、Hexagonal、Clean、Vertical Slice 和模块化单体分别解决什么问题？
- DDD 的限界上下文如何帮助划分职责，而不是增加术语？

**外部补充**

- Awesome Software Architecture：Modular Monolith、DDD、Hexagonal、Clean 与 Vertical Slice。
- Martin Fowler 或架构模式原作者材料，用于核对模式边界。

**本站材料**

- Micro Frontends + single-spa：业务垂直切片和共享依赖。
- OpenAI Agents SDK：Manager、Handoff 与确定性代码编排的职责边界。

**检查点**

读者能为一个熟悉应用划分模块，解释依赖方向，并说明为什么暂不拆成独立服务。

### 阶段三：分布式系统基础

**核心问题**

- 延迟、吞吐、可用性、一致性和扩展性之间如何权衡？
- 复制、分片、缓存、消息、重放和最终一致性分别引入什么新失败模式？
- 同步调用与异步消息如何改变所有权、错误处理和数据一致性？

**外部补充**

- System Design Primer：系统设计主题索引及其扩展性、一致性、缓存、队列和通信章节。
- Awesome Software Architecture：Messaging、Eventual Consistency、Caching、Sharding、CQRS 与 Distributed Transactions。

**本站材料**

- Apache Kafka Consumer Groups：分区所有权、offset、重放与背压。
- Temporal Durable Execution + Saga：事件历史、重试、补偿与副作用边界。
- Yjs CRDT Collaboration：结构收敛与业务语义批准的区别。

**检查点**

读者能画出一次跨服务写入的状态变化，指出至少三种失败窗口，并为重试、去重或补偿选择明确责任方。

### 阶段四：可靠性与状态管理

**核心问题**

- 重试、幂等、监督、协调循环和耐久执行各自适合处理哪类失败？
- 期望状态、观察状态、事件历史和业务事实应保存在哪里？
- 何时自动恢复，何时必须停止并交给人工？

**外部补充**

- Google SRE Workbook：Foundations、Practices 与 Processes 中与 SLO、监控、事件响应和复盘相关的章节。
- Awesome Software Architecture：Resiliency、Cloud Design Patterns、Back Pressure。

**本站材料**

- Erlang/OTP Supervision Tree：局部重启、升级和重启强度。
- Kubernetes Reconciliation Loop：spec/status、幂等协调和持续收敛。
- Temporal Durable Execution + Saga：确定性重放、Activity 和补偿。
- Apache Kafka Consumer Groups：rebalance、重复执行和背压。

**检查点**

读者能为一个长时任务定义状态机、超时、重试预算、幂等键、人工终态和恢复验证方法。

### 阶段五：扩展、隔离与生产治理

**核心问题**

- 如何用分区、cell、配额和薄路由控制容量与故障半径？
- 可观测性、安全、合规、成本和发布策略如何进入架构主路径？
- 平台能力与业务能力之间的责任边界在哪里？

**外部补充**

- System Design Primer：真实系统、瓶颈分析和扩展练习。
- Awesome Software Architecture：Microservices、Observability、Security、Cloud Design Patterns。
- Google SRE Workbook：SLO、告警、发布和事件管理。

**本站材料**

- AWS Cell Architecture + Shuffle Sharding：租户隔离与故障半径。
- Cloudflare Durable Objects + workerd：身份寻址的状态单元与热点边界。
- New API Channel Pool Routing：能力路由、Key 池、故障恢复和合规隔离。
- LiteLLM Virtual Keys：分层权限、预算限流、Guardrail 时序和供应商凭据托管。
- Microsoft 多智能体参考架构：身份、网络、数据、评估和平台治理。

**检查点**

读者能针对热点租户、依赖故障和发布回滚设计隔离边界，并说明监控信号、容量限制和恢复负责人。

### 阶段六：Agentic 架构专项

**核心问题**

- 多智能体系统中谁拥有下一步控制权、共享状态和最终结果责任？
- 确定性工作流、LLM 路由、Handoff、Supervisor 和层级团队如何选择？
- A2A、MCP、检查点、记忆、评估、权限和执行隔离如何组合？

**外部补充**

- OpenAI Agents SDK、LangGraph、Google ADK/A2A 与 MCP 的官方文档。
- Awesome Software Architecture 的 AI 主题只作为扩展入口，不替代上述一手资料。

**本站材料**

- OpenAI Agents SDK：最小控制原语。
- LangGraph Supervisor：显式状态和可恢复编排。
- Google ADK 与 A2A：本地层级编排和跨运行时互操作。
- AWS CLI Agent Orchestrator：进程、工作区、副作用和结果验收。
- Microsoft 多智能体参考架构：生产治理。

**检查点**

读者能为一个 Agentic 场景比较单智能体、Manager、Handoff 和确定性工作流，明确状态所有者、权限、失败恢复、人工接管和评估方式。

## 专题分支

主干完成后提供四条非强制分支：

### 云原生与平台

学习顺序为容器与部署、服务与网络、扩缩容与发布、可观测性与 SLO、GitOps/IaC、安全。外部优先使用 Kubernetes 官方教程、CNCF Curriculum 和 Google SRE Workbook；本站连接 Kubernetes、AWS Cell、Microsoft 与 Durable Objects 案例。

### 协作状态与前端架构

围绕多人或多 Agent 的共享状态、业务所有权、运行时组合和语义冲突展开。本站连接 Yjs 与 Micro Frontends 案例。

外部入口使用 Yjs 官方文档和 Awesome Software Architecture 的 Micro-Frontend 专题。

### 边缘与物理智能体

围绕断网自治、通信语义、生命周期、实时性和独立安全链展开。本站连接 KubeEdge 与 ROS 2 + DDS 案例。

外部入口使用 KubeEdge 官方文档和固定到 Jazzy 的 ROS 2 基础概念文档。

### Agent 平台与模型网关

围绕能力路由、租户隔离、身份与权限、成本、评估和可观测性展开。本站连接 New API、LiteLLM、Microsoft、OpenAI、LangGraph 和 Google ADK/A2A 案例，以 LiteLLM Virtual Keys 官方文档作为网关治理入口。

## 阶段卡片契约

每个阶段使用相同的信息顺序：

1. **为什么学**：说明它解决的架构判断问题。
2. **掌握这些问题**：列出三到五个学习问题。
3. **外部补充**：每阶段保留二到四个高价值入口。
4. **用本站案例深化**：说明案例验证什么机制，不只给出标题链接。
5. **检查点**：使用可观察的解释、图示或决策产出判断是否掌握。
6. **下一步**：明确主干下一阶段或可选分支。

外部链接按用途标记：

- **必读起点**：建立进入本站案例所需的共同语言。
- **查漏补缺**：读者不熟悉某个概念时使用。
- **深入拓展**：需要在工作中采用该机制时继续阅读。

同一个阶段不同时列出大量同类资源。优先级依次为原作者或官方资料、成熟开源学习路线、经过筛选的专题合集。Awesome Software Architecture 用作主题书架；System Design Primer 用作分布式系统与系统设计主入口；roadmap.sh 用作路线分支参考；OSSU 用于校准先修与阶段纪律；CNCF、Kubernetes 和 Google SRE 材料用于生产化校准。

## 页面与导航变化

第一阶段只修改内容和最小导航文案：

- 重写 `content/paths/index.mdx`，承载主干、分支、外部资源和检查点。
- 更新路径 front matter 的分析日期、来源截止日期、领域、质量属性和 `official_sources`。
- 将首页“选择一条专题学习路径”调整为符合实际结构的入口文案，避免暗示已有多个独立页面。
- 不新增路径数据模型、React 组件或进度系统。
- 不在本次范围内批量修改 17 篇案例正文；案例到路线的反向链接作为后续独立改造。

## 内容与来源边界

- 外部路线只用于学习结构和补充材料，不证明本站案例中的项目事实。
- 对外部仓库的介绍只陈述其公开结构和用途，不用 star 数量代替质量判断。
- 链接尽量指向具体章节或官方页面，不只指向仓库首页。
- 对持续更新的 roadmap 标明资料核查日期；不承诺其未来目录稳定。
- 本站案例仍保留各自的 `source_cutoff` 和证据标签。
- 学习检查点是本站课程设计，不冒充外部项目推荐或行业认证标准。

## 验证

实施完成后依次验证：

1. 所有新增外部链接格式正确，且页面中可直接点击。
2. 六个主干阶段均包含阶段卡片契约的六项内容。
3. 17 篇现有案例至少在主干或专题分支中出现一次。
4. 每个案例链接使用现有稳定 slug。
5. 页面没有把外部主题合集写成严格课程或一手项目证据。
6. `npm test`、内容校验、类型检查与 Docusaurus 构建通过。
7. 桌面和移动宽度下检查标题层级、列表密度、表格或链接换行。

## 成功标准

- 有开发经验的读者能在页面开头判断自己是否适合这条路线。
- 读者能解释为什么某个外部资源出现在某个阶段，而不是面对链接堆。
- 每个阶段都有进入条件、学习目标、案例深化和完成判断。
- 路线覆盖通用软件架构主干，同时保持 Agentic Architecture Atlas 的案例优势。
- 页面能够支持后续增加案例或专题，而不需要再次改写整条主干。
