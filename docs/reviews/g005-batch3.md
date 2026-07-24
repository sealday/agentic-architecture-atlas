# G005 Batch 3 最终审阅证据

- 审核日期：2026-07-24
- implementation HEAD：`6af5b2d`
- 独立 factual critic：APPROVE
- 定向验证：47/47 PASS
- 内容验证：56 documents / 383 sources PASS
- 来源分布：primary 349、first-party 23、secondary 4、discovery 7，总计 383。
- `validate:content`：PASS
- `check:content`：PASS
- `check:links`：PASS
- `check:reviews`：PASS
- 本地 production build：PASS
- diff-check：PASS

## MTH-04

- 路由：`/methods/mth-04`
- editorial PASS：test、metric、monitor、SLO 与 release gate 的职责和非使用边界可见，完整演练的假设数值标注明确。
- fact PASS：O’Reilly 第二版与 Thoughtworks 来源支持适应度函数的分类、持续反馈和治理边界，没有把适应度函数等同于 SLO 或发布门禁。
- copyright PASS：反馈表、阈值分层与演练为本站原创归纳；受治理来源只作事实摘要和链接引用。
- render PASS：desktop 1440x1000 与 mobile 390x844 的 main、H1、表格、来源区和相邻链接正常；无 global overflow；console warning/error=0。

## MTH-05

- 路由：`/methods/mth-05`
- editorial PASS：五种方法矩阵的对象、时机、参与者、产物、故障执行方式、证据等级和非使用条件清楚，表格可见且正常。
- fact PASS：风险风暴与事前验尸界定为想象故障，威胁建模与 ATAM 界定为模型分析，GameDay 界定为实际演练观测且不等于生产保证；OWASP、SEI 与 AWS 的事实边界可追踪。
- copyright PASS：选择矩阵、排序字段和说明性演练为本站原创归纳；Simon Brown、HBR、OWASP、SEI 与 AWS 来源按治理记录使用。
- render PASS：desktop 1440x1000 与 mobile 390x844 的 main、H1、矩阵和来源区正常；页面无 global overflow；console warning/error=0。
- 代表视觉检查：mobile 390x844 的表格自身使用 `overflow-x:auto`，实测 `scrollLeft` 从 0 到 100，最大值 162，可正常横向滚动。

## MTH-06

- 路由：`/methods/mth-06`
- editorial PASS：需求、场景、风险、决定、实现和反馈的可变顺序与停止条件清楚，三个 Atlas synthesis 标记完整。
- fact PASS：QAW、ATAM、ADR 与适应度函数各自承担发现、分析、授权和反馈职责；C4 仅作架构表示，arc42 仅作文档组织。
- copyright PASS：闭环、反馈路由、停止条件、Mermaid 与说明性演练为本站原创综合；治理来源只支持各自局部方法。
- render PASS：desktop 1440x1000 与 mobile 390x844 的 main、H1、反馈环、来源区和相邻链接正常；反馈环实际可见，移动截图无 global clipping；console warning/error=0。
- 代表视觉检查：反馈环在两个视口均正常可见，移动视图没有页面级横向裁切。

## 路由与视口矩阵

以下七条路由均在 desktop 1440x1000 与 mobile 390x844 检查 main 和 H1，结果全部 PASS：

1. `/methods/mth-04`
2. `/methods/mth-05`
3. `/methods/mth-06`
4. `/paths/architecture-thinking`
5. `/methods`
6. `/references`
7. `/references/primary/page/18`

- overflow PASS：七条路由在两个视口均无 global overflow；MTH-05 的移动表格滚动边界局限在表格自身。
- console PASS：七条路由在两个视口的 warning/error 均为 0。
- internal-links PASS：内容生成、内部链接校验和 production build 均通过。
- reference pagination PASS：最终 primary 来源页为 `/references/primary/page/18`。

## 交互验证

- interaction PASS：在 `/paths/architecture-thinking` 精确点击唯一文本 `从需求到演进的架构闭环`，匹配元素 count 1，进入 `/methods/mth-06`，H1 正确，console warning/error=0。
- interaction PASS：在 `/references/primary/page/18` 精确点击唯一文本 `17`，匹配元素 count 1，进入 `/references/primary/page/17`，H1 正确，console warning/error=0。
