# G005 Batch 2 最终审阅证据

- 审核日期：2026-07-24
- Final implementation HEAD：`15afc9d`
- Batch 2 publication implementation HEAD：`15afc9d`
- Rebase provenance：`15afc9d` 是 rebase 后的等价集成 hash，远端 `b9029aa` 保持。
- 独立 critic：APPROVE
- 定向验证：94/94 PASS
- 内容验证：53 documents / 377 sources PASS
- 集成来源分布：`b9029aa` 新增 1 个 primary source；integrated tiers 为 primary 345、first-party 22、secondary 3、discovery 7，总计 377。
- `check:content`：PASS
- `check:links`：PASS
- diff-check：PASS
- 本地 production build：PASS

## FND-04

- 路由：`/concepts/fnd-04`
- editorial PASS：权衡、敏感点、权衡点、风险与非风险的定义顺序清楚，边界和非使用条件可见。
- fact PASS：SEI ATAM 与 NASA SWEHB 的事实范围和归因一致，AWS terminal mapping 可追踪。
- copyright PASS：正文、表格与说明性场景为原创归纳；受治理来源仅作事实摘要与链接引用。
- render PASS：desktop 1440x1000 与 mobile 390x844 的 main、H1、表格和内部链接正常；overflow 检查无横向溢出；console warning/error=0。

## FND-05

- 路由：`/concepts/fnd-05`
- editorial PASS：技术债、架构债和演进式设计的差异、治理触发条件与非使用边界完整。
- fact PASS：Cunningham、SEI 官方 brochure 与 Fowler 的来源角色、日期和事实边界一致。
- copyright PASS：原创分类表和说明性场景明确，来源采用事实摘要，没有复制来源结构。
- render PASS：desktop 1440x1000 与 mobile 390x844 的 main、H1、表格和来源区正常；overflow 检查无横向溢出；console warning/error=0。
- 代表视觉检查：FND-05 desktop 1440x1000 页面无视觉异常。

## MTH-01

- 路由：`/methods/mth-01`
- editorial PASS：QAW 官方八步、约 30% 投票规则与 top 4–5 场景精炼顺序完整；Atlas adaptation 单独标明。
- fact PASS：QAW 是利益相关者驱动的场景发现与排序方法，不被表述为 ATAM 或架构批准。
- copyright PASS：本地证据字段、表格和数字演练均明确为本站说明性内容与假设数值。
- render PASS：desktop 1440x1000 与 mobile 390x844 的 main、H1、八步列表和表格正常；overflow 检查无横向溢出；console warning/error=0。

## MTH-02

- 路由：`/methods/mth-02`
- editorial PASS：condensed analytical loop、stakeholder scenario brainstorm/prioritization 与 present results 均清楚可见。
- fact PASS：QAW 被界定为可选上游，ATAM 不被表述为设计方法、认证或形式化证明。
- copyright PASS：证据判定表和数值演练为本站原创说明，SEI 与 NASA 仅支持其允许的事实角色。
- render PASS：desktop 1440x1000 与 mobile 390x844 的 main、H1、步骤和表格正常；overflow 检查无横向溢出；console warning/error=0。
- 代表视觉检查：MTH-02 mobile 390x844 页面无视觉异常。

## MTH-03

- 路由：`/methods/mth-03`
- editorial PASS：正式状态仅为 proposed、accepted、deprecated、superseded，复核被表达为 accepted 上的审计事件。
- fact PASS：Nygard 与 Fowler 支持 ADR 记录及替代关系，adr.github.io 仅作补充导航。
- copyright PASS：状态图和说明性演练为原创归纳，数字、编号与周期明确为假设。
- render PASS：desktop 1440x1000 与 mobile 390x844 的 main、H1、状态图和来源区正常；overflow 检查无横向溢出；console warning/error=0。

## 路由与视口矩阵

以下八条路由均在 desktop 1440x1000 与 mobile 390x844 检查 main 和 H1，结果全部 PASS：

1. `/concepts/fnd-04`
2. `/concepts/fnd-05`
3. `/methods/mth-01`
4. `/methods/mth-02`
5. `/methods/mth-03`
6. `/paths/architecture-thinking`
7. `/references`
8. `/references/primary/page/18`

- overflow PASS：八条路由在两个视口均无横向溢出。
- console PASS：八条路由在两个视口的 warning/error 均为 0。

## 交互验证

- interaction PASS：在 `/references/primary/page/18` 精确点击文本 `17`，匹配元素 count 1。
- 导航结果：进入 `/references/primary/page/17`，H1 为 `一手来源 · 第 17 页`。
- console PASS：交互前后 warning/error=0。
