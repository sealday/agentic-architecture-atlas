# Visual Density and Four-Case Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a weighted visual-balance metric to the case density reporter, then revise the four lowest-scoring architecture cases until each scores strictly above 90 and is ready for publication.

**Architecture:** Extend the existing single-file density analyzer with a separately reported `visualBalance` result and two advisory warnings. Refresh LiteLLM, Kong, Kafka, and OpenAI Agents SDK with original raster illustrations that each teach one supported architectural judgment; article workers own only their MDX and image files, while the integrator owns the shared source ledger and generated projections.

**Tech Stack:** Node.js ESM, Node test runner, MDX, Docusaurus, built-in image generation, JSON source ledger, Playwright visual QA.

## Global Constraints

- Raster, Mermaid, table, and non-Mermaid code weights are exactly `3.0`, `1.5`, `0.75`, and `0.25`.
- `targetVisualUnits = max(2, eligibleProseCharacters / 1000 * 2)`.
- `score = min(100, round(visualUnits / targetVisualUnits * 100))`.
- Completed architecture cases must score strictly greater than `90`.
- Cases with at least `800` eligible prose characters and no visuals receive `missing-visual-content`.
- Cases with at least `800` eligible prose characters and score at or below `90` receive `low-visual-balance`.
- Density warnings remain advisory and do not change the CLI exit code.
- Generated illustrations must follow the project visual-language, prompt, originality, repository-integration, and source-governance contracts.
- Article workers must not edit `data/source-ledger.json` or generated JSON files; the integrator owns those shared files.
- The four refreshed cases are `litellm-virtual-keys-governance`, `kong-ai-gateway-routing-resilience`, `apache-kafka-consumer-groups`, and `openai-agents-sdk`.

---

### Task 1: Weighted visual-balance reporter

**Files:**
- Modify: `tests/case-writing-density.test.mjs`
- Modify: `.codex/skills/writing-architecture-cases/scripts/analyze_case_density.mjs`
- Modify: `.codex/skills/writing-architecture-cases/SKILL.md`
- Modify: `.codex/skills/writing-architecture-cases/references/article-contract.md`
- Modify: `.codex/skills/writing-architecture-cases/references/review-checklist.md`

**Interfaces:**
- Consumes: existing `analyzeCaseText(source, options)` API.
- Produces: `result.visualBalance` with `eligibleProseCharacters`, four counts, `visualUnits`, `targetVisualUnits`, and `score`; optional `visualBalanceThreshold` and `visualMinimumProseCharacters` options.

- [ ] **Step 1: Write failing score and warning tests**

Add tests that assert:

```js
const result = analyzeCaseText(microsoftLikeFixture);
assert.equal(result.visualBalance.score, 81);
assert.equal(result.warnings.some(({kind}) => kind === 'low-visual-balance'), true);
```

Also cover exact weights, a score of exactly 90 still warning, 91 not warning, a long all-text case receiving both warnings, a sub-800-character page receiving neither, and images inside front matter/code/table/evidence cards receiving no credit.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/case-writing-density.test.mjs
```

Expected: failures because `visualBalance` and the two warning kinds do not exist.

- [ ] **Step 3: Implement the minimal scanner and score**

Add focused helpers for eligible prose, Markdown raster images, Mermaid fences, non-Mermaid fences, and table delimiters. Preserve all existing paragraph-density behavior and warning ordering.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test tests/case-writing-density.test.mjs
```

Expected: all density tests pass with zero failures.

- [ ] **Step 5: Update the skill contracts**

Document `visual-balance`, `missing-visual-content`, `low-visual-balance`, exact weights, the strict `> 90` completion gate, and the prohibition against decorative filler.

- [ ] **Step 6: Commit**

```bash
git add tests/case-writing-density.test.mjs .codex/skills/writing-architecture-cases
git commit -m "feat: score architecture case visual density"
```

### Task 2: Refresh LiteLLM virtual-key governance

**Files:**
- Modify: `content/cases/litellm-virtual-keys-governance.mdx`
- Create: `static/img/illustrations/litellm-virtual-keys-governance-control-path.png`
- Create: `static/img/illustrations/litellm-virtual-keys-governance-budget-gates.png`
- Create: `static/img/illustrations/litellm-virtual-keys-governance-governance-boundary.png`

**Interfaces:**
- Consumes: Task 1 density reporter.
- Produces: three original raster illustrations embedded after inspection questions and followed by supported conclusions.

- [ ] **Step 1: Record the current score**

Run the density reporter against the article and retain its `low-visual-balance` score as the baseline.

- [ ] **Step 2: Generate three distinct visuals**

Use these visual jobs:

1. `control-path`: virtual key moves identity, budget, and model policy ahead of provider routing.
2. `budget-gates`: request passes budget and rate-limit gates before model access.
3. `governance-boundary`: governed proxy path versus the bypass risk of direct provider credentials.

Each image must use 6–14 closed labels taken from the article, warm-white 16:9 hand-drawn technical styling, no people, logos, signatures, watermarks, unsupported metrics, or invented guarantees.

- [ ] **Step 3: Integrate and verify the article**

Embed each asset with purpose-oriented Chinese alt text. Keep exact identifiers and evidence in prose, Mermaid, tables, or evidence cards. Run:

```bash
node .codex/skills/writing-architecture-cases/scripts/analyze_case_density.mjs content/cases/litellm-virtual-keys-governance.mdx
```

Expected: no `low-visual-balance`; computed score is strictly above 90.

### Task 3: Refresh Kong AI gateway resilience

**Files:**
- Modify: `content/cases/kong-ai-gateway-routing-resilience.mdx`
- Create: `static/img/illustrations/kong-ai-gateway-routing-resilience-control-layers.png`
- Create: `static/img/illustrations/kong-ai-gateway-routing-resilience-failure-route.png`
- Create: `static/img/illustrations/kong-ai-gateway-routing-resilience-policy-boundary.png`

**Interfaces:**
- Consumes: Task 1 density reporter.
- Produces: three original raster illustrations embedded with conclusions and boundaries.

- [ ] **Step 1: Record the current score**

Run the density reporter and retain the article's baseline warning.

- [ ] **Step 2: Generate three distinct visuals**

Use these visual jobs:

1. `control-layers`: client, gateway policy/routing, and provider responsibilities.
2. `failure-route`: upstream failure, bounded retry or fallback, and returned result.
3. `policy-boundary`: routing resilience does not erase authorization, cost, or duplicate-side-effect boundaries.

Keep topology and claims within the article's supported scope; use the project illustration contract.

- [ ] **Step 3: Integrate and verify the article**

Run the reporter and require a score strictly above 90 with no low-balance warning.

### Task 4: Refresh Kafka consumer groups

**Files:**
- Modify: `content/cases/apache-kafka-consumer-groups.mdx`
- Create: `static/img/illustrations/apache-kafka-consumer-groups-partition-ownership.png`
- Create: `static/img/illustrations/apache-kafka-consumer-groups-rebalance-loop.png`

**Interfaces:**
- Consumes: Task 1 density reporter.
- Produces: two original raster illustrations covering stable ownership and rebalance transitions.

- [ ] **Step 1: Record the current score**

Run the density reporter and retain the article's baseline warning.

- [ ] **Step 2: Generate two distinct visuals**

Use these visual jobs:

1. `partition-ownership`: topic partitions are divided among consumers in one group.
2. `rebalance-loop`: membership change causes revoke, reassignment, and return to stable consumption.

Do not imply exactly-once business effects or uninterrupted consumption.

- [ ] **Step 3: Integrate and verify the article**

Run the reporter and require a score strictly above 90 with no low-balance warning.

### Task 5: Refresh OpenAI Agents SDK

**Files:**
- Modify: `content/cases/openai-agents-sdk.mdx`
- Create: `static/img/illustrations/openai-agents-sdk-run-control.png`
- Create: `static/img/illustrations/openai-agents-sdk-handoff-vs-tool.png`
- Create: `static/img/illustrations/openai-agents-sdk-guardrail-boundary.png`

**Interfaces:**
- Consumes: Task 1 density reporter.
- Produces: three original raster illustrations covering run control, delegation semantics, and action gates.

- [ ] **Step 1: Record the current score**

Run the density reporter and retain the article's baseline warning.

- [ ] **Step 2: Generate three distinct visuals**

Use these visual jobs:

1. `run-control`: one run cycles through model decision, tool action, result, and termination.
2. `handoff-vs-tool`: handoff transfers conversational control while a tool performs bounded work and returns.
3. `guardrail-boundary`: input/output checks constrain the run but do not prove business authorization or idempotency.

Use exact supported terminology and no OpenAI logo or unsupported product guarantee.

- [ ] **Step 3: Integrate and verify the article**

Run the reporter and require a score strictly above 90 with no low-balance warning.

### Task 6: Register illustrations and regenerate projections

**Files:**
- Modify: `data/source-ledger.json`
- Modify: `src/generated/source-ledger.json`
- Modify: `src/generated/topic-indexes.json`
- Modify: `src/generated/topic-manifest.json`
- Modify: source-count tests only if deterministic registered-source totals require it.

**Interfaces:**
- Consumes: eleven final PNG assets and four updated MDX files.
- Produces: one unique `original-illustration` source and one article citation per asset.

- [ ] **Step 1: Add source and citation records**

For every asset, use `source_kind: "original-illustration"`,
`allowed_evidence_roles: ["illustration"]`,
`license: "LicenseRef-Atlas-Original"`, and
`copyright_policy: "original-atlas"`. Include `illustration-rights`,
`usage_mode: "original-illustration"`, a project-specific modification note,
and a boundary that the image explains but does not establish facts.

- [ ] **Step 2: Regenerate and validate**

Run:

```bash
npm run generate:content
npm run validate:content
npm run check:content
npm run check:reviews
```

Expected: all commands exit zero; update hard-coded registered-source counts only when failures show the exact new total.

### Task 7: Whole-change verification and publication

**Files:**
- Verify all files changed by Tasks 1–6.

**Interfaces:**
- Consumes: completed reporter, four refreshed cases, source ledger, and generated projections.
- Produces: verified commit on `main`, remote push, successful GitHub Pages deployment, and live-page evidence.

- [ ] **Step 1: Run focused score checks**

Run the reporter on all four articles. Each must report a score strictly above 90 and no `low-visual-balance`.

- [ ] **Step 2: Run full repository verification**

```bash
npm run verify
```

Expected: all tests, content validation, content checks, review checks, typecheck, and production build pass.

- [ ] **Step 3: Render desktop and mobile**

Serve the production build and inspect all four routes at 1440×900 and
390×844. Verify every image loads, labels remain legible, and neither page nor
visual overflows horizontally.

- [ ] **Step 4: Review and commit**

Review the complete diff for unsupported claims, source-governance gaps,
pseudo-text, or unrelated changes. Commit the integrated article and ledger
work with an intent-focused message.

- [ ] **Step 5: Push and verify deployment**

Push `main`, wait for the matching GitHub Pages workflow to succeed, then
probe all four live routes and eleven public PNG URLs for HTTP 200 responses.
