# Ultragoal G001 执行报告

## 状态

G001 已完成并提交。未修改 `.omx/ultragoal/`，未推送远端。

## 提交

- 功能提交：`b2211b42374420afe3d50802ef7b82b47d87dabd`
- 提交主题：`docs: establish content backlog baseline`
- 核对前发布基线：2026-07-23，`6b0ef133868a1b831cbc04962d7fda861648fc95`

## 修改文件

- `docs/content-backlog.md`
  - 首次纳入版本控制并声明为唯一长期任务源。
  - 增加本地 Ultragoal 与远端 checkbox/commit/deployment 的双层进度恢复说明。
  - 写入当前发布基线日期和 commit。
  - 将 E0-08、E0-09、E0-10 标为完成并附精炼证据。
- `tests/case-fact-inventory.test.mjs`
  - 用 `requiredCaseSlugs` canonical manifest 校验事实库存覆盖集合。
  - 移除固定 15 篇断言。
  - 为 New API、LiteLLM、Kong 增加关键运行事实保护。
- `docs/superpowers/specs/2026-07-20-agentic-architecture-atlas-design.md`
- `docs/superpowers/plans/2026-07-20-agentic-architecture-atlas.md`
- `docs/superpowers/specs/2026-07-22-second-batch-architecture-cases-design.md`
- `docs/superpowers/plans/2026-07-22-second-batch-architecture-cases.md`
  - 上述五篇/十五篇案例历史 design/plan 标记为 `Superseded`，替代来源指向 backlog。
- `docs/superpowers/specs/2026-07-23-architecture-learning-roadmap-design.md`
- `docs/superpowers/plans/2026-07-23-architecture-learning-roadmap.md`
  - 单页路线历史 design/plan 标记为 `Superseded`，并链接多文章路线 successor 与 backlog。

## 完成证据

### E0-08

- `scripts/content-schema.mjs` 的 canonical manifest 包含 catalog order 1–18。
- 事实库存测试现在比较库存 slug 集合与 `requiredCaseSlugs`，因此新增或遗漏案例都会失败。
- New API 保护 `GetRandomSatisfiedChannel`、`GetNextEnabledKey`、`shouldRetry`、`auto-disabled`、`retry index`。
- LiteLLM 保护 `PROXY_ADMIN`、`models: []`、`model_max_budget`、`all-team-models`、`all-proxy-models`。
- Kong 保护 `failover_criteria`、`retries`、`max_fails`、`fail_timeout`、`task ID`、`context ID`。

### E0-09

- 资产存在：`static/img/paths/software-architecture-learning-roadmap.png`。
- `tests/learning-path.test.mjs` 校验唯一 PNG、PNG 签名与大于 50 KB。
- 2026-07-23 核对线上
  `https://sealday.github.io/agentic-architecture-atlas/img/paths/software-architecture-learning-roadmap.png`
  返回 HTTP 200。

### E0-10

- 只标记确实被后续形态替代的六份历史 design/plan：
  - 单页学习路线 design/plan；
  - 五篇首发案例 design/plan；
  - 十五篇案例阶段 design/plan。
- 状态标记只位于文档开头，未改写历史正文目标、机制、边界或结论。
- 单页路线链接到多文章路线 design/plan；所有历史任务状态均链接到唯一 backlog。

## 验证

- `node --test tests/case-fact-inventory.test.mjs tests/learning-path.test.mjs`
  - 15/15 通过。
- `npm test`
  - 89/89 通过，0 失败。
- `npm run validate:content`
  - 验证 34 个内容文档。
- `npm run check:catalog`
  - 生成目录与已提交 catalog 一致。
- `git diff --check`
  - 通过。

## 自审

- 范围：仅 backlog、事实库存测试和六份已被替代的历史 design/plan。
- 事实完整性：没有修改任何案例正文或历史文档正文结论。
- 状态真实性：E0-08 在补齐三篇事实保护后才勾选；E0-09 同时有文件、测试和线上 URL；E0-10 有逐文件状态与替代链接。
- 可恢复性：backlog 明确本地 Ultragoal 是执行审计层，远端 checkbox、commit、deployment/URL 是持久证据层。
- 仓库卫生：未增加依赖，未生成或修改 `.omx` 状态，未推送。

## 剩余风险

- 功能提交尚未推送或部署；按任务约束留给 leader 处理。因此线上 URL 证明的是发布基线中 E0-09 图片已存在，不证明本次 backlog 与 superseded 标记已经上线。
- backlog 中记录的“当前发布基线”有意指向本次修改前已发布的 `6b0ef13`；下一次成功部署后应更新为实际远端发布 commit。
