# Repository Integration

## Save and embed

Use a stable, semantic filename:

```text
static/img/illustrations/<article-slug>-<visual-job>.png
```

Embed it with the public path:

```mdx
![<concise Chinese purpose-oriented alt text>](/img/illustrations/<article-slug>-<visual-job>.png)
```

Introduce the question before the image and state the architectural conclusion or boundary after it. Do not use the generated image as the only exact representation of state names, version details, or source-backed topology.

## Register an original illustration

Update `data/source-ledger.json` using the repository's current schema:

1. Add a `sources` record for the public local locator.
2. Set `source_kind` to `original-illustration`.
3. Allow only the `illustration` evidence role.
4. Use `LicenseRef-Atlas-Original` and `copyright_policy: original-atlas`.
5. Limit `license_scope` to the named image.
6. State in `usage_boundary` that the image explains an article relationship and does not establish factual claims.
7. Add the article document citation with:
   - `copyright_checks` including `illustration-rights`;
   - `roles: ["illustration"]`;
   - `usage_mode: original-illustration`;
   - a non-empty `modification_note` describing generation and project-specific composition;
   - no claim that supplied style references were copied or adapted.

Do not reuse another image's source ID. Follow current repository ID-generation and review conventions rather than inventing a conflicting identifier.

## Validate

Run the smallest relevant checks first, then the project gates affected by source registration:

```bash
npm run validate:content
npm run generate:content
npm run check:content
npm run check:reviews
npm run build
```

Open the affected page at desktop and mobile widths. Verify the public asset path, intrinsic dimensions, caption rhythm, light/dark framing, and absence of overflow. If source generation changes derived files, include the generated result expected by repository policy.
