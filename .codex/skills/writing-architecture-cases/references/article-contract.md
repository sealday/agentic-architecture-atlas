# Architecture Case Article Contract

Read this contract before drafting or rewriting a complete architecture case. Preserve the sequence and exact heading text.

## Required H2 sequence

| Order | Heading | Purpose |
| --- | --- | --- |
| 1 | `## 学习问题` | Give 4–6 questions that drive the reading, prioritizing control, state, failure, boundary, and transfer. |
| 2 | `## 一页摘要` | Establish the architecture in 2–4 short paragraphs, then use one compact table to orient the reader. |
| 3 | `## 事实边界` | State the evidence scope and only the version boundaries that affect conclusions; defer anchor inventories. |
| 4 | `## 架构图` | Tell readers what relationship to inspect before the visual, include the selected original raster illustration when the visual scan triggers, retain a deterministic diagram when exact topology matters, then explain one task flow after it. |
| 5 | `## 控制权与任务流` | Trace a micro-scenario through roles, state, handoffs, failure, termination, and retry authority. |
| 6 | `## 关键源码导读` | State the reading purpose and shortest decisive source path; separate mechanism proof from business inference. |
| 7 | `## 架构决策与权衡` | For each decision, connect the problem, mechanism, cost, and applicability boundary. |
| 8 | `## 生产化分析` | Organize around concrete failures or operator actions; keep consequential risks visible. |
| 9 | `## 可迁移经验` | Explain what transfers, under which conditions, and where analogy stops. Preserve the three H3 headings below. |
| 10 | `## 来源` | Keep complete verifiable sources, grouped as primary architecture, source code, and supporting explanation. |

Under `## 可迁移经验`, preserve this exact H3 sequence:

1. `### 可直接复用的机制`
2. `### 只能有限类比的部分`
3. `### 不应照搬的部分`

Preserve front matter, stable slug, evidence labels (`已证实事实`, `基于证据的推断`, `个人分析`), supported findings, and source coverage. A label may govern a short single-topic block; start a new labeled block when epistemic status changes.

## Two-layer boundary

The visible narrative must carry:

- concepts required to follow the task flow;
- the claim, mechanism, architectural consequence, and trade-off;
- any limit that changes the conclusion;
- safety, permission, money, irreversible-side-effect, cancellation, version-compatibility, and recovery boundaries.

Evidence cards must carry verification details for an already visible claim:

- pinned versions, tags, and commits;
- exact repositories, files, symbols, line ranges, and supporting links;
- multiple anchors proving the same mechanism;
- terminology differences and optional implementation exceptions.

A card supplements the narrative; it never first introduces a critical concept or hides a consequential limit. Folding all cards must leave an accurate, coherent explanation. Give each card one verification topic.

Use this shape:

```mdx
<details className="evidence-card">
  <summary>证据：固定版本与源码入口</summary>

  - **版本：** `v1.2.3`
  - **源码：** `path/to/file.ts`
  - **边界：** 该证据支持机制说明，不证明业务效果。
</details>
```

## Section-level reading rhythm

Open with a concrete conflict or counterintuitive result, a transferable lens, and the evidence scope within three paragraphs. Keep one principal reader question per section. Use a labeled micro-scenario in `控制权与任务流` or `生产化分析`; trace actual supported mechanisms and return to a decision.

Introduce every table, diagram, and code block with the question it answers. Follow it with the conclusion or boundary the reader should retain. End the article by synthesizing the decision, trade-off, and transfer condition rather than repeating section summaries.

## Illustration boundary

Use the `illustrating-architecture-articles` skill for selected raster visuals. The image establishes orientation and makes one architectural judgment memorable; prose, Mermaid, tables, code, and evidence cards remain authoritative for exact names, topology, versions, and source claims.

For a complete case, run the visual scan in the writing skill. When a trigger applies:

- generate and embed at least one original image;
- place it after a paragraph that names what to inspect;
- add concise purpose-oriented alt text;
- state the conclusion or critical boundary after it;
- register the asset as an original illustration under repository source-governance rules.

Do not reuse supplied reference art, identifiable characters, signatures, watermarks, or exact compositions.

## Density reporter contract

The reporter uses 80/200 as advisory prose thresholds and reports more than 3 unique inline identifiers as `identifier-density` by default. Inline identifiers are excluded from prose-length measurement but retained for this separate warning; callers may pass `identifierLimit` to `analyzeCaseText`.

The separate `visual-balance` result counts eligible narrative prose and weights explanatory forms as follows:

| Visual form | Weight |
| --- | ---: |
| Markdown raster image (`png`, `jpg`, `jpeg`, `webp`) | 3.0 |
| Mermaid fence | 1.5 |
| Markdown table | 0.75 |
| Non-Mermaid fenced code block | 0.25 |

Its target is `max(2, eligible prose characters / 1000 × 2)`, and its score is the weighted units divided by that target, rounded and capped at 100. Eligible prose excludes front matter, fences, evidence cards, tables, headings, list items, and Markdown image syntax. A complete architecture case requires a score strictly greater than 90. Mermaid, tables, and code receive partial credit, but they do not automatically replace an explanatory raster illustration selected by the visual scan.

It also reports:

- `duplicate-evidence-summary` when one case repeats the same normalized evidence-card summary;
- `repeated-evidence-label` when adjacent narrative paragraphs repeat the same epistemic label;
- `missing-illustrative-label` when the scenario-bearing sections contain neither `说明性场景` nor `说明性演练`;
- `empty-evidence-card` for a card with no body;
- `unanchored-evidence-card` for a non-empty card with no source, file, symbol, version, commit, link, or other concrete evidence anchor.
- `missing-visual-content` when a case has at least 800 eligible prose characters and no counted visual form;
- `low-visual-balance` when a case has at least 800 eligible prose characters and its score is not strictly greater than the configured threshold.

A heading、table、code、list 与 evidence card 必须中断相邻叙事段落的 `dense-run`。The reporter does not combine dense prose across these functional boundaries, and warnings remain editorial review inputs rather than CI failures. Resolve visual-balance warnings with useful orientation, comparison, topology, or flow explanations; decorative filler is prohibited.
