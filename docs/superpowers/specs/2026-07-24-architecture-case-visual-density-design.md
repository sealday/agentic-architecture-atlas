# Architecture Case Visual Density Design

## Goal

Extend the architecture-case density reporter with a composite text-to-visual
metric. The metric must expose prose-heavy cases, distinguish explanatory
visual forms by reading value, and prevent a long all-text article from looking
healthy merely because its sentences and paragraphs are short.

The Microsoft multi-agent reference architecture case is the calibration
fixture. Its current mix—4,930 eligible prose characters, one raster
illustration, two Mermaid diagrams, two tables, and two non-Mermaid code
blocks—should score about 80. A complete delivery target must be strictly
greater than 90.

## Metric

Count one visual unit according to:

| Visual form | Weight | Rationale |
| --- | ---: | --- |
| Raster illustration (`png`, `jpg`, `jpeg`, `webp`) | 3.0 | Provides the strongest one-screen orientation and visual memory. |
| Mermaid diagram | 1.5 | Preserves deterministic topology but remains text-shaped and visually dense. |
| Markdown table | 0.75 | Supports comparison but still requires close reading. |
| Non-Mermaid fenced code block | 0.25 | Interrupts prose rhythm but is primarily technical text. |

Calculate:

```text
visual_units =
  raster_count × 3.0 +
  mermaid_count × 1.5 +
  table_count × 0.75 +
  code_count × 0.25

target_visual_units = max(2, eligible_prose_characters ÷ 1000 × 2)

visual_balance_score =
  min(100, round(visual_units ÷ target_visual_units × 100))
```

For the Microsoft calibration case:

```text
visual_units = 1×3 + 2×1.5 + 2×0.75 + 2×0.25 = 8
target_visual_units = 4930÷1000×2 = 9.86
score = round(8÷9.86×100) = 81
```

## Counting Boundaries

Eligible prose excludes front matter, fenced code, evidence cards, Markdown
tables, headings, list items, and Markdown image syntax. This keeps the
denominator aligned with the existing narrative-density model.

The reporter counts:

- raster images only when Markdown image destinations end in a supported
  raster extension, optionally followed by a query string;
- each Mermaid fence once;
- each Markdown table once, using its delimiter row;
- each non-Mermaid fenced code block once.

Images inside excluded front matter, code, tables, or evidence cards do not
contribute. SVGs and decorative JSX are not granted raster weight because the
reporter cannot prove their editorial role.

## Reporter Contract

`analyzeCaseText` returns a `visualBalance` object alongside the existing
paragraph count and warnings:

```js
{
  eligibleProseCharacters,
  rasterCount,
  mermaidCount,
  tableCount,
  codeCount,
  visualUnits,
  targetVisualUnits,
  score
}
```

It adds two advisory warnings:

- `missing-visual-content`: eligible prose is at least 800 characters and all
  four visual counts are zero;
- `low-visual-balance`: eligible prose is at least 800 characters and the score
  is not strictly greater than 90.

The low-balance message includes the score, required threshold, counts, and
weighted units so an editor can see which form is missing. Warnings remain
non-blocking in the CLI, matching the existing density reporter.

Short index and navigation pages below 800 eligible characters do not receive
either warning.

## Skill Guidance

Update the writing skill, article contract, and review checklist to:

- name `visual-balance` as part of density review;
- require a score strictly greater than 90 for a completed architecture case;
- state that Mermaid, tables, and code provide partial credit but cannot
  substitute automatically for an explanatory raster illustration;
- require editors to resolve `missing-visual-content` and review
  `low-visual-balance` by adding useful visuals, not decorative filler.

## Tests

Follow red-green-refactor:

1. Add a failing calibration test for the Microsoft-like fixture scoring about
   80.
2. Add failing tests for the exact weights, exclusions, 800-character floor,
   strict greater-than-90 threshold, and configurable threshold.
3. Add a failing documentation-contract test for the new warning names and
   completion threshold.
4. Implement the smallest parser and score calculation that passes.
5. Run the focused density suite, the reporter against `content/cases`, and the
   full repository verification.

## Non-goals

- No computer-vision judgment of illustration quality.
- No CI failure solely because of the advisory density report.
- No retroactive illustration generation for every existing case in this
  change.
- No credit for decorative JSX, icons, or unverified image-like markup.
