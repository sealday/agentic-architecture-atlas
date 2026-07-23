# Agent Gateway Architecture Cases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three evidence-backed architecture cases covering New API channel scheduling, LiteLLM multi-tenant governance, and Kong AI Gateway routing resilience.

**Architecture:** Each case is an independent MDX article that follows the repository's ten-section case contract and two-layer narrative/evidence model. Shared integration is limited to front matter catalog metadata, the case index count, generated catalog output, and repository-wide verification.

**Tech Stack:** Docusaurus 3.10.2, MDX, Mermaid, Node.js 24, repository content validators and density reporter.

## Global Constraints

- Preserve the exact ten required H2 headings and three required migration H3 headings.
- Use only official documentation, official repositories, fixed source tags/commits, and clearly labeled inference.
- Do not invent customers, incidents, production metrics, benchmarks, first-person experience, or upstream guarantees.
- Keep safety, authorization, money, version, recovery, retry, and irreversible-side-effect boundaries visible.
- Treat upstream bans and risk controls as compliance boundaries; never describe credential rotation or fallback as a way to evade them.
- Do not add dependencies.

---

### Task 1: New API channel-pool case

**Files:**
- Create: `content/cases/new-api-channel-pool-routing.mdx`

**Interfaces:**
- Consumes: the case article contract and official New API documentation/source.
- Produces: a complete catalog-discoverable case with slug `/cases/new-api-channel-pool-routing`.

- [ ] Write front matter with catalog metadata, official sources, fixed evidence date, and a stable slug.
- [ ] Draft the opening and ten required sections around Ability lookup, priority tiers, weighted selection, multi-key polling, retry, disablement, and compliant recovery.
- [ ] Add a Mermaid flow and a `说明性场景` that traces one request through selection and failure isolation.
- [ ] Add evidence cards for fixed source anchors and version boundaries.
- [ ] Run `node .codex/skills/writing-architecture-cases/scripts/analyze_case_density.mjs content/cases/new-api-channel-pool-routing.mdx` and resolve material warnings.

### Task 2: LiteLLM virtual-key governance case

**Files:**
- Create: `content/cases/litellm-virtual-keys-governance.mdx`

**Interfaces:**
- Consumes: the case article contract, LiteLLM official documentation, fixed release/source, and the official security advisory.
- Produces: a complete catalog-discoverable case with slug `/cases/litellm-virtual-keys-governance`.

- [ ] Write front matter with catalog metadata, official sources, fixed evidence date, and a stable slug.
- [ ] Draft the opening and ten required sections around virtual keys, permission intersection, layered budgets/rate limits, guardrails, audit boundaries, and provider-key custody.
- [ ] Add a Mermaid flow and a `说明性场景` that traces a compromised or runaway tenant request through deterministic controls.
- [ ] Add evidence cards for fixed version, OSS/Enterprise boundaries, and the authentication-path advisory.
- [ ] Run `node .codex/skills/writing-architecture-cases/scripts/analyze_case_density.mjs content/cases/litellm-virtual-keys-governance.mdx` and resolve material warnings.

### Task 3: Kong routing-resilience case

**Files:**
- Create: `content/cases/kong-ai-gateway-routing-resilience.mdx`

**Interfaces:**
- Consumes: the case article contract and Kong official AI Gateway/load-balancing documentation.
- Produces: a complete catalog-discoverable case with slug `/cases/kong-ai-gateway-routing-resilience`.

- [ ] Write front matter with catalog metadata, official sources, fixed evidence date, and a stable slug.
- [ ] Draft the opening and ten required sections around routing objectives, failure classification, retry/fallback ordering, circuit breaking, observability, MCP/A2A, and tool-side-effect boundaries.
- [ ] Add a Mermaid flow and a `说明性场景` that distinguishes model inference retries from external tool actions.
- [ ] Add evidence cards for Kong 3.10+/3.13+ and Advanced/commercial feature boundaries.
- [ ] Run `node .codex/skills/writing-architecture-cases/scripts/analyze_case_density.mjs content/cases/kong-ai-gateway-routing-resilience.mdx` and resolve material warnings.

### Task 4: Catalog integration and factual review

**Files:**
- Modify: `content/cases/index.mdx`
- Modify: `src/generated/case-catalog.json`
- Review: all three new case files

**Interfaces:**
- Consumes: the three completed MDX articles.
- Produces: an updated catalog and a single fact-integrity review record in the final report.

- [ ] Change the visible case count from fifteen to eighteen.
- [ ] Run `npm run generate:catalog`.
- [ ] Compare every planned fact, boundary, label, heading, and source against the three articles.
- [ ] Check that folding evidence cards leaves a coherent explanation in each article.
- [ ] Remove AI-pattern prose without deleting evidence or critical boundaries.

### Task 5: Repository verification

**Files:**
- Verify: `content/cases/*.mdx`
- Verify: `src/generated/case-catalog.json`

**Interfaces:**
- Consumes: all completed content and generated artifacts.
- Produces: fresh verification evidence for completion.

- [ ] Run `npm run report:writing-density` and inspect warnings for the three new files.
- [ ] Run `npm run validate:content`.
- [ ] Run `npm run check:catalog`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run `npm run test`.
- [ ] Review rendered desktop and mobile pages or record the exact visual-verification gap.

