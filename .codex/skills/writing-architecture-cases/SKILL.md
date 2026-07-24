---
name: writing-architecture-cases
description: Use when drafting, rewriting, expanding, or reviewing architecture case studies in this repository, especially when dense evidence, source code, version boundaries, trade-offs, or AI-style prose make an article difficult to follow.
---

# Writing Architecture Cases

## Core principle

Write two cooperating layers: **the visible narrative helps a first-time reader understand; labeled evidence cards let a reviewer verify**. Folding every evidence card must still leave a complete, accurate argument.

Write for an engineer with software experience who is meeting this architecture for the first time. Preserve supported facts, evidence labels, sources, pinned versions or commits, conclusions, critical boundaries, front matter, slugs, and required headings. Delete only repetition. Never invent users, customers, incidents, metrics, benchmarks, first-person experiences or narration, production experience, or upstream guarantees.

For a complete case, **read `references/article-contract.md` before drafting or rewriting**. Before declaring any case complete, **read `references/review-checklist.md` and pass its four gates in order**.

**REQUIRED SUB-SKILL:** Use `illustrating-architecture-articles` whenever the visual scan below selects a raster illustration.

## Workflow

1. State the reader's 3–5 learning questions and the judgments they should retain.
2. Inventory every supplied fact, evidence label, source, version, path, boundary, required heading, and supported inference before editing.
3. Design one question per section; order the visible narrative around conflict, control, state, task flow, failure, recovery, and trade-offs.
4. Run a visual scan before drafting. Select a raster illustration when the article contains at least one of these:
   - a request or control path with 3+ handoffs;
   - a state loop, retry, failure branch, or recovery decision;
   - a hierarchy or ownership model with 3+ layers;
   - a comparison with 3+ aligned dimensions;
   - a central architectural judgment that benefits from a one-screen visual summary.

   For a complete case, generate and integrate at least one selected illustration; do not satisfy this step with a promise, Mermaid, table, or decorative image. Keep Mermaid or tables beside it when exact labels and relationships require deterministic rendering. If no trigger applies, record `插图判定：无需位图` with the reason in the self-review.
5. Draft the visible narrative without source inventories; make it independently accurate and understandable.
6. Generate each selected illustration after its surrounding claim and topology are stable. Place it immediately after the paragraph that tells the reader what to inspect, and follow it with the conclusion or boundary it supports.
7. Add one labeled evidence card per verification topic for fixed versions, source seams, multi-source support, and nonessential implementation exceptions.
8. Check density with:

   ```bash
   node .codex/skills/writing-architecture-cases/scripts/analyze_case_density.mjs content/cases
   ```

   Treat the report as editorial evidence, not a deletion quota. Defaults are 80 prose characters per sentence, 200 per narrative paragraph, and 3 unique inline identifiers per paragraph. Review `identifier-density`, `duplicate-evidence-summary`, `repeated-evidence-label`, `missing-illustrative-label`, and `unanchored-evidence-card` by category. Also review the `visual-balance` result: resolve `missing-visual-content`, and resolve `low-visual-balance` for a complete case until its score is strictly greater than 90. Add visuals that teach a supported architectural judgment, never decorative filler added only to raise the score. A heading、table、code、list 与 evidence card 会中断相邻叙事段落的 `dense-run`；不要跨这些功能边界合并告警。

9. Replace AI-pattern prose only where it appears: empty setup, repeated conclusion, slogan, fake suspense, mechanical parallelism, or exhaustive name dumping.
10. Compare source and result item by item; restore every fact, structure element, label, and boundary before improving style further.
11. Review the rendered page at desktop and mobile widths, including opening value, paragraph rhythm, illustrations, tables, code, links, and evidence-card behavior.

## Placement rule

Place an item in the **visible narrative** when a first-time reader needs it to follow the mechanism or when omitting it could change the conclusion or hide a safety, permission, money, irreversible-side-effect, version, cancellation, or recovery boundary.

Place an item in a labeled **evidence card** when it verifies an already visible claim: pinned tags or commits, exact files/functions/lines, repeated source anchors, terminology variants, or optional implementation exceptions. Render it as `<details className="evidence-card">` with one topic and a `<summary>` that names what it verifies. Introduce the claim and its consequential limit before the card.

When the source contains a long inventory of metrics, upgrade fields, source seams, or test scenarios, keep the inventory's selection principle and consequential limits visible, then place the complete inventory in one topic-specific evidence card. Keep required state names, migration conclusions, and explicit prohibitions visible.

## Output recipe

| Element | Required shape |
| --- | --- |
| Opening | Within three short paragraphs: concrete conflict or counterintuitive result; transferable lens; evidence/version scope with detailed anchors deferred. |
| Paragraph | One center of gravity, usually 2–4 sentences: claim → mechanism or cause → consequence/boundary. Start a new paragraph when control, level, contrast, or exception changes. |
| Scenario | Label it `说明性场景` unless it is sourced; trace one request, state change, failure, or recovery using only supported mechanisms; return to the architectural judgment. |
| Table | Introduce the question the table answers; keep comparable fields; follow with the decision the reader should draw. |
| Code or source | Explain why to inspect it; show the shortest useful path; state what it proves and what it does not prove. Put auxiliary anchors in evidence cards. |
| Migration item | Name the mechanism or rejected assumption, then state its transfer condition and consequential boundary. Preserve the required H3 sequence and every supported prohibition. |
| Ending | Synthesize the decision, trade-off, and transfer condition. End on an actionable boundary, not a slogan or repeated summary. |

When the task covers only an excerpt, preserve every supplied heading and evidence-bearing item even if the full article contract is outside the excerpt.

## Baseline failure controls

| Category | Task 1 evidence | Required control |
| --- | --- | --- |
| `EVIDENCE_STILL_INLINE` | Temporal rewrite left pinned-version prose and the full source-seam table in the primary path. | Keep the mechanism and consequential boundary visible; move verification inventories into topic-labeled evidence cards. |
| `FACT_LOSS` | ROS 2 lost fixed Jazzy anchors; Temporal review collapsed migration structure and explicit operational limits. | Build the inventory before editing and perform an item-by-item source/result comparison after drafting. Readability never substitutes for integrity. |
| `INVENTED_SCENE` | Not observed; the ROS 2 scene was correctly labeled. | Label illustrative scenes and constrain them to supported mechanisms. |
| `COSMETIC_ONLY` | Not observed; all baselines changed structure. | Reorder information layers when density is structural; sentence polish alone is not completion. |
| `LOW_DENSITY_FILLER` | Not observed. | Every lighter sentence must establish context, explain a term, bridge causality, trace flow, pose a check, or synthesize a decision. |
| `HIDDEN_CRITICAL_BOUNDARY` | Not observed. | Keep consequential safety, authorization, cost, irreversible-effect, version, cancellation, and recovery limits in the visible narrative. |
| `ILLUSTRATION_SKIPPED_UNDER_PRESSURE` | A direct-to-MDX baseline explicitly omitted raster assets when the deadline was short and the user did not mention images. | Make the visual scan a required delivery step; when a trigger applies, completion requires a generated, embedded, registered, and rendered asset. |

## Completion

Return a short self-review naming: preserved facts and structure, visible critical boundaries, evidence moved to cards, illustration decisions and asset paths, illustrative scenarios, and any unresolved verification gap. Do not claim completion until the ordered review gates pass.
