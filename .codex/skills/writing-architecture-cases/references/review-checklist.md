# Architecture Case Review Checklist

Run these gates in order. A later gate cannot compensate for failure in an earlier gate.

## 1. Fact integrity

- [ ] Compare the source and result item by item: facts, evidence labels, official sources, pinned versions/commits, source seams, conclusions, prohibitions, operational fields, and inference boundaries remain supported and present.
- [ ] Preserve front matter, stable slug, the ten required H2 headings, and all three migration H3 headings when they are in scope.
- [ ] Preserve supplied excerpt headings and evidence-bearing items even when reviewing or rewriting only part of a case.
- [ ] Keep fact, evidence-based inference, and personal analysis distinguishable.
- [ ] Invent no user, customer, incident, metric, benchmark, first-person experience or narration, production experience, or upstream guarantee.
- [ ] `FACT_LOSS`: no fixed anchor, required structure, explicit boundary, or supported detail disappeared merely to improve flow.
- [ ] `INVENTED_SCENE`: every unsourced scene is labeled `说明性场景`, uses only supported mechanisms, and makes no invented customer, incident, number, experience, or guarantee.

## 2. Narrative continuity

- [ ] Folding every evidence card still leaves a first-time reader able to explain control, state, task flow, failure, recovery, trade-off, and critical limits.
- [ ] The opening reaches a concrete conflict or conclusion, transferable lens, and evidence scope within three short paragraphs.
- [ ] Each section answers one main reader question; each paragraph advances one center of gravity.
- [ ] Scenarios return to an architectural judgment; tables, diagrams, and code have a before-reading question and an after-reading conclusion.
- [ ] The visual scan is recorded. When a trigger applies, at least one original raster illustration exists in the repository, is embedded after an inspection question, and is followed by its conclusion or boundary.
- [ ] The illustration and any nearby Mermaid/table divide responsibilities: the raster image orients; deterministic text and diagrams preserve exact labels, topology, versions, and evidence.
- [ ] `COSMETIC_ONLY`: if density came from mixed concerns or source inventories, the revision changes information placement and structure rather than only wording.
- [ ] `LOW_DENSITY_FILLER`: each lighter sentence establishes context, explains a term, bridges causality, traces flow, poses a check, or synthesizes a decision.

## 3. Evidence-layer integrity

- [ ] Each evidence card uses `<details className="evidence-card">`, has one topic, a descriptive `<summary>`, concrete anchors, and the boundary of what those anchors prove.
- [ ] Pinned versions, detailed source seams, repeated links, terminology variants, and optional exceptions move to cards after their claim is visible.
- [ ] Long inventories of metrics, upgrade fields, source seams, or test scenarios move to one topic-specific card after their selection principle and consequential limits are visible.
- [ ] `EVIDENCE_STILL_INLINE`: the main reading path contains the decisive mechanism and limit, not a full verification inventory.
- [ ] `HIDDEN_CRITICAL_BOUNDARY`: safety, authorization, cost, irreversible side effects, cancellation, version compatibility, and recovery limits remain visible whenever they affect the conclusion.
- [ ] No card first introduces a concept needed to understand the narrative, disguises inference as fact, or becomes an unlabeled evidence dump.

## 4. Density and AI-pattern pass

- [ ] Normal narrative paragraphs contain about 2–4 sentences; review any paragraph above 6 sentences.
- [ ] Review sentences above roughly 80 Chinese characters; split mixed claims while preserving identifiers and links that legitimately add length.
- [ ] Review paragraphs above roughly 200 Chinese characters for a second topic, changed control owner, contrast, exception, or layer transition.
- [ ] Review `identifier-density` above the default of three unique inline identifiers in a normal narrative paragraph; stage names or move verification-only fields to evidence cards without deleting facts.
- [ ] After two dense paragraphs, provide a functional pause: short explanation, labeled micro-scenario, checkpoint, diagram/table guide, or concise synthesis.
- [ ] Confirm heading、table、code、list 与 evidence card 中断相邻叙事的 `dense-run`; investigate any warning that appears to cross a functional boundary.
- [ ] Review `duplicate-evidence-summary` and `repeated-evidence-label`; keep summaries topic-specific and let one epistemic label govern a short coherent block instead of repeating it mechanically.
- [ ] Resolve `missing-illustrative-label` by labeling the supported micro-scenario `说明性场景` or `说明性演练`, not by inventing a story.
- [ ] Resolve `empty-evidence-card`; review `unanchored-evidence-card` and add a source, file, symbol, version, commit, link, or other concrete anchor when the block claims to be evidence.
- [ ] Review the `visual-balance` counts and exact weights: raster 3.0, Mermaid 1.5, table 0.75, and non-Mermaid code 0.25.
- [ ] Resolve `missing-visual-content`; for a complete case, resolve `low-visual-balance` until the score is strictly greater than 90.
- [ ] Every visual added for balance teaches a supported orientation, comparison, topology, flow, or boundary; no decorative filler exists only to raise the score.
- [ ] Remove empty setup, fake suspense, slogans, repeated conclusions, mechanical parallelism, synonym chains, and exhaustive name dumping.
- [ ] Confirm the ending states a decision, trade-off, or transfer condition without a generic inspirational close.
- [ ] Inspect every generated illustration at original size: exact Chinese labels, correct arrows/loops/states, supported facts only, no copied person/signature/watermark/layout, and no pseudo-text.
- [ ] Confirm every embedded illustration has purpose-oriented alt text, a stable `/img/illustrations/` path, and an `original-illustration` source-ledger citation with `illustration-rights`.
- [ ] Review rendered desktop and mobile views for opening value, paragraph rhythm, illustration legibility, overflow, evidence-card usability, and table/code readability.
