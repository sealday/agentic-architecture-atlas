---
name: illustrating-architecture-articles
description: Use when creating, revising, or integrating raster illustrations for Tego Arch articles, especially Chinese hand-drawn architecture infographics, process diagrams, state or recovery flows, comparison cards, and visual summaries.
---

# Illustrating Architecture Articles

## Core principle

Turn one architectural judgment into one original, readable visual. Use the warm hand-drawn information-design language in `references/visual-language.md`; do not imitate a named artist, reuse a reference character, reproduce a signature, or copy a source composition.

**REQUIRED SUB-SKILL:** Use `imagegen` for raster generation or editing.

Before generating, read:

- `references/visual-language.md` for the project style and layout grammar;
- `references/prompt-contract.md` for the brief and prompt recipe;
- `references/repository-integration.md` before saving or embedding a final asset.

## Workflow

1. Extract the article's claim, mechanism, control owner, states, failure branch, recovery action, and boundary. Illustrate only supported content.
2. Select one visual job:
   - overview flow for control and handoffs;
   - state/recovery map for transitions and loops;
   - comparison board for 3+ comparable dimensions;
   - layered model for hierarchy or responsibility;
   - visual summary for one decisive conclusion.
3. Write a closed illustration brief using the prompt contract. Keep generated text to a title plus 6–14 short labels. Put exact details in MDX, Mermaid, tables, or captions.
4. Generate with the built-in image tool in a 16:9 landscape composition unless the article layout requires another ratio. Treat supplied images as style references, not edit targets or reusable assets.
5. Inspect the image at original size and article width. Verify every Chinese character, arrow, state, loop, label, and color-independent relationship.
6. If one property fails, make one targeted edit. If text remains wrong, regenerate with fewer labels or blank label areas; never publish pseudo-Chinese or silently change a fact.
7. Save the selected image under `static/img/illustrations/<article-slug>-<visual-job>.png`, add concise Chinese alt text and a caption that states what to inspect, then complete the repository registration steps.
8. Run focused content validation and render the affected page at desktop and mobile widths.

## Output contract

Return:

- the final image path and MDX insertion;
- the final prompt and reference-image roles;
- a visual QA result covering text, topology, factual scope, responsive readability, and forbidden marks;
- the source-ledger entry or explicit registration gap;
- the validation commands and results.

## Common mistakes

| Failure | Correction |
| --- | --- |
| Copying a sample's mascot, signature, or exact layout | Rebuild from article semantics with project-generic icons and a new composition. |
| Asking the model to typeset a paragraph | Use short closed-label vocabulary; move detail back to the article. |
| Decorative image that teaches nothing | Name the single judgment the reader should retain, or omit the image. |
| Image replaces exact architecture evidence | Pair it with precise prose, Mermaid, table, or evidence card. |
| Asset exists only in the generator output directory | Copy it into `static/img/illustrations/` and register it before completion. |
| Writer promises an image but does not generate it | Do not mark the article complete until the file exists and the rendered page is checked. |
