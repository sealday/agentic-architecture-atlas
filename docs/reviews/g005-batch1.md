# G005 Batch 1 逐页评审记录

评审范围为基础概念 FND-01、FND-02、FND-03、第一阶段路径与资料库静态分页。四门检查均以 2026-07-24 的正文、受治理来源和最终 HEAD `0f6eebb` 的视觉检查为依据。

## 最终 render 总验收

- render — PASS：在 desktop 1440x1000 与 mobile 390x844 检查 `/concepts/fnd-01`、`/concepts/fnd-02`、`/concepts/fnd-03`、`/paths/architecture-thinking` 和 `/references`，标题、正文、表格、阶段导航及四个来源层级入口均可见，无横向溢出。
- render — PASS：在两个视口检查代表分页 `/references/primary`、`/references/primary/page/17`、`/references/first-party/page/2`、`/references/secondary` 与 `/references/discovery`；每页卡片、字段和分页导航完整，无横向溢出。
- interaction — PASS：从 `/references/primary` 实际点击“下一页”、页码“17”、“上一页”，再执行浏览器 Back；地址、标题、当前页状态和卡片内容随导航正确更新，返回链路保持在 `/references` 路由族。
- runtime — PASS：上述路由和交互过程没有 console error；desktop 与 mobile 均未出现页面级或卡片级横向 overflow。

## FND-01

- editorial — PASS：开篇先解释架构与设计的尺度冲突，定义、机制、反例和非使用条件连续，结论保留影响范围与变更成本边界。
- fact — PASS：NASA、C4 与 ISO/IEC/IEEE 42010 的可见引用均与 source ledger 对齐；ISO 仅支持架构描述边界，不被扩张为架构质量或方法保证。
- copyright — PASS：正文为原创归纳，无长引文或复用插图；ledger 已记录 attribution、quotation boundary 与 illustration rights 检查。
- render — PASS：已在 desktop 1440x1000 与 mobile 390x844 检查真实路由 `/concepts/fnd-01` 和 `/paths/architecture-thinking`，标题、段落、表格、链接及阶段导航无溢出。

## FND-02

- editorial — PASS：驱动因素到 ASR 的筛选机制、QAW/ATAM 边界、失败模式和说明性场景完整，NASA 证据直接连接决定与验证。
- fact — PASS：NASA SWEHB Version D 7.07 直接支持 architectural drivers、driving requirements、关键决策、理由与验证证据之间的关系；NASA 项目语境未被推广为通用排名公式。
- copyright — PASS：仅保留官方链接和原创事实摘要，不复制 NASA、SEI 的长段文本或图表；ledger 记录 facts-summary 与完整署名。
- render — PASS：已在 desktop 1440x1000 与 mobile 390x844 检查真实路由 `/concepts/fnd-02` 和 `/paths/architecture-thinking`，正文链接、筛选表和阶段检查点可读且无横向溢出。

## FND-03

- editorial — PASS：原则、战术、模式、风格、参考架构和最佳实践六类顺序一致，定义、机制、混淆、场景及非普适边界相互呼应。
- fact — PASS：NISTIR 5517 官方 PDF 正文直接支持报告中的参考架构定义与制造控制范围；Atlas 不把该领域框架或六类操作性分类表宣称为普遍标准。
- copyright — PASS：NIST、SEI 只用于带出处的事实摘要，原创分类表和说明性场景已明确标注；无长引文或来源插图复用。
- render — PASS：已在 desktop 1440x1000 与 mobile 390x844 检查真实路由 `/concepts/fnd-03` 和 `/paths/architecture-thinking`，六类表格、外链与相邻主题导航可访问且无横向溢出。
