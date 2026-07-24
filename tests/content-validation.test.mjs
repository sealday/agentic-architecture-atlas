import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  classicCollectionSlugs,
  launchCaseSlugs,
  requiredCaseSlugs,
  requiredCaseHeadings,
  requiredMigrationHeadings,
  secondCollectionSlugs,
} from '../scripts/content-schema.mjs';
import {validateContent} from '../scripts/validate-content.mjs';

const validatorScript = fileURLToPath(new URL('../scripts/validate-content.mjs', import.meta.url));

const expectedCaseCatalog = [
  {slug: '/cases/microsoft-multi-agent-reference-architecture', catalog_order: 1},
  {slug: '/cases/openai-agents-sdk', catalog_order: 2},
  {slug: '/cases/langgraph-supervisor', catalog_order: 3},
  {slug: '/cases/google-adk-a2a', catalog_order: 4},
  {slug: '/cases/aws-cli-agent-orchestrator', catalog_order: 5},
  {slug: '/cases/erlang-otp-supervision-tree', catalog_order: 6},
  {slug: '/cases/kubernetes-reconciliation-loop', catalog_order: 7},
  {slug: '/cases/temporal-saga-durable-execution', catalog_order: 8},
  {slug: '/cases/apache-kafka-consumer-groups', catalog_order: 9},
  {slug: '/cases/aws-cell-shuffle-sharding', catalog_order: 10},
  {slug: '/cases/micro-frontends-single-spa', catalog_order: 11},
  {slug: '/cases/yjs-crdt-collaboration', catalog_order: 12},
  {slug: '/cases/cloudflare-durable-objects-workerd', catalog_order: 13},
  {slug: '/cases/kubeedge-cloud-edge-autonomy', catalog_order: 14},
  {slug: '/cases/ros2-dds-agent-lifecycle', catalog_order: 15},
  {slug: '/cases/new-api-channel-pool-routing', catalog_order: 16},
  {slug: '/cases/litellm-virtual-keys-governance', catalog_order: 17},
  {slug: '/cases/kong-ai-gateway-routing-resilience', catalog_order: 18},
];

const expectedLaunchCases = expectedCaseCatalog.slice(0, 5);
const expectedClassicCases = expectedCaseCatalog.slice(0, 10);
const expectedSecondCollectionCases = expectedCaseCatalog.slice(5);

async function withTempRoot(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'content-validation-'));

  try {
    await run(root);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
}

const validCaseBody = [
  '# Fixture',
  '## 学习问题',
  '## 一页摘要',
  '## 事实边界',
  '## 架构图',
  '## 控制权与任务流',
  '## 关键源码导读',
  '## 架构决策与权衡',
  '## 生产化分析',
  '## 可迁移经验',
  '### 可直接复用的机制',
  '### 只能有限类比的部分',
  '### 不应照搬的部分',
  '## 来源',
].join('\n\n');

async function writeMdx(root, relativePath, frontMatter, body = validCaseBody) {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `---\n${frontMatter}\n---\n\n${body}\n`);
}

function sourceLedgerFixture(overrides = {}) {
  return {
    schema_version: 1,
    sources: [
      {
        id: 'src-c4-model',
        canonical_locator: 'https://c4model.com/',
        transport_locator: 'https://c4model.com/',
        query_insensitive: false,
        locator_aliases: [],
        tombstone: null,
        title: 'C4 model',
        author_or_org: 'Simon Brown',
        published_at: null,
        checked_at: '2026-07-23',
        version: 'current page checked on 2026-07-23',
        source_kind: 'official-docs',
        tier: 'primary',
        allowed_evidence_roles: ['case-evidence'],
        license: 'LicenseRef-All-Rights-Reserved',
        license_scope: 'Page text and diagrams; third-party links excluded',
        license_evidence_url: 'https://c4model.com/',
        license_evidence_note: 'No reuse license is declared on the checked page',
        license_family_id: 'https://c4model.com/',
        license_family_grouping: 'identity',
        family_grouping_evidence_url: null,
        copyright_policy: 'facts-and-short-quotation',
        usage_boundary: 'Supports the fixture architecture claim.',
        link_policy: 'stable',
        expected_final_transport_locator: 'https://c4model.com/',
        expected_final_approved_at: '2026-07-23',
        expected_final_approval_note: 'Initial reviewed transport baseline',
      },
    ],
    documents: {
      'content/cases/example.mdx': {
        reviewed_at: '2026-07-23',
        copyright_checks: [
          'original-structure',
          'quotation-boundary',
          'attribution-complete',
          'illustration-rights',
        ],
        citations: [
          {
            source_id: 'src-c4-model',
            citation_url: 'https://c4model.com/',
            roles: ['case-evidence'],
            manifest_primary: true,
            usage_mode: 'facts-summary',
            attribution_note: 'C4 model, Simon Brown',
            modification_note: null,
            excerpt: null,
            quotation_reviewed: false,
          },
        ],
      },
    },
    ...overrides,
  };
}

async function writeSourceGovernanceProject(projectRoot, {body, ledger} = {}) {
  const contentRoot = path.join(projectRoot, 'content');
  await writeMdx(
    contentRoot,
    'cases/example.mdx',
    validCaseFrontMatter('/cases/example'),
    body ?? `${validCaseBody}\n\n[C4 model](https://c4model.com/)`,
  );
  await mkdir(path.join(projectRoot, 'data'), {recursive: true});
  await writeFile(
    path.join(projectRoot, 'data/source-ledger.json'),
    `${JSON.stringify(ledger ?? sourceLedgerFixture(), null, 2)}\n`,
  );
  return contentRoot;
}

function validCaseFrontMatter(slug, overrides = {}) {
  const values = {
    title: 'Launch case',
    slug,
    content_type: 'case',
    status: 'reviewed',
    difficulty: 'advanced',
    analyzed_at: '2026-07-20',
    source_cutoff: '2026-07-01',
    confidence: 'high',
    domains: ['multi-agent'],
    agent_patterns: ['supervisor'],
    protocols: [],
    quality_attributes: ['reliability'],
    tags: ['launch'],
    summary: 'A catalog summary',
    series: 'classic-distributed',
    catalog_order: 1,
    featured: false,
    source_kinds: ['official-docs'],
    migration_targets: ['failure-supervision'],
    ...overrides,
  };

  return Object.entries(values)
    .map(([field, value]) => {
      if (Array.isArray(value)) {
        return value.length === 0
          ? `${field}: []`
          : `${field}:\n${value.map((item) => `  - ${item}`).join('\n')}`;
      }

      return `${field}: ${value}`;
    })
    .join('\n');
}

test('rejects a document missing required metadata with file and field context', async () => {
  await withTempRoot(async (root) => {
    await writeMdx(root, 'cases/incomplete.mdx', 'title: Incomplete\ncontent_type: case');

    const result = await validateContent(root);

    assert.ok(
      result.errors.some(
        (error) => error.includes('cases/incomplete.mdx') && error.includes('slug'),
      ),
    );
  });
});

test('rejects an invalid enum with field and value context', async () => {
  await withTempRoot(async (root) => {
    await writeMdx(
      root,
      'cases/invalid-difficulty.mdx',
      validCaseFrontMatter('/cases/invalid-difficulty', {difficulty: 'expert-plus'}),
    );

    const result = await validateContent(root);

    assert.ok(
      result.errors.some(
        (error) => error.includes('difficulty') && error.includes('expert-plus'),
      ),
    );
  });
});

test('exports the literal approved catalog coverage in canonical order', () => {
  assert.deepEqual(
    launchCaseSlugs,
    expectedLaunchCases.map(({slug}) => slug),
  );
  assert.deepEqual(
    classicCollectionSlugs,
    expectedClassicCases.map(({slug}) => slug),
  );
  assert.deepEqual(
    requiredCaseSlugs,
    expectedCaseCatalog.map(({slug}) => slug),
  );
  assert.deepEqual(
    [...secondCollectionSlugs],
    expectedSecondCollectionCases.map(({slug}) => slug),
  );
});

test('reports staged catalog coverage failures', async () => {
  await withTempRoot(async (root) => {
    await writeMdx(
      root,
      'openai.mdx',
      validCaseFrontMatter('/cases/openai-agents-sdk', {catalog_order: 2}),
    );

    const result = await validateContent(root, {requiredCollection: 'launch'});

    assert.equal(
      result.errors.filter((error) => error.includes('Missing launch case')).length,
      4,
    );
    assert.ok(
      result.errors.some((error) =>
        error.includes('/cases/microsoft-multi-agent-reference-architecture'),
      ),
    );

    const cli = spawnSync(
      process.execPath,
      [validatorScript, root, '--require-launch-cases'],
      {encoding: 'utf8'},
    );
    assert.equal(cli.status, 1);
    assert.match(`${cli.stdout}${cli.stderr}`, /Missing launch case/);
  });

  await withTempRoot(async (root) => {
    await Promise.all(
      expectedLaunchCases.map(({slug, catalog_order}) =>
        writeMdx(
          root,
          `case-${catalog_order}.mdx`,
          validCaseFrontMatter(slug, {catalog_order}),
        ),
      ),
    );

    const classic = await validateContent(root, {requiredCollection: 'classic'});
    const complete = await validateContent(root, {requiredCollection: 'complete'});

    assert.equal(
      classic.errors.filter((error) => error.includes('Missing classic collection case')).length,
      5,
    );
    assert.equal(
      complete.errors.filter((error) => error.includes('Missing complete catalog case')).length,
      expectedCaseCatalog.length - expectedLaunchCases.length,
    );
  });
});

test('accepts all five structurally valid launch cases', async () => {
  await withTempRoot(async (root) => {
    await Promise.all(
      expectedLaunchCases.map(({slug, catalog_order}) =>
        writeMdx(
          root,
          `case-${catalog_order}.mdx`,
          validCaseFrontMatter(slug, {catalog_order}),
        ),
      ),
    );

    const result = await validateContent(root, {requiredCollection: 'launch'});

    assert.equal(result.documents.length, 5);
    assert.deepEqual(result.errors, []);
    for (const snapshot of result.documents) {
      assert.equal(typeof snapshot.filePath, 'string');
      assert.equal(typeof snapshot.file, 'string');
      assert.equal(typeof snapshot.source, 'string');
      assert.equal(typeof snapshot.body, 'string');
      assert.equal(typeof snapshot.metadata, 'object');
      assert.ok(Array.isArray(snapshot.headings));
    }

    const cliProjectRoot = path.join(root, 'cli-project');
    const cliContentRoot = path.join(cliProjectRoot, 'content');
    await Promise.all(
      expectedLaunchCases.map(({slug, catalog_order}) =>
        writeMdx(
          cliContentRoot,
          `case-${catalog_order}.mdx`,
          validCaseFrontMatter(slug, {catalog_order}),
          `${validCaseBody}\n\n[C4 model](https://c4model.com/)`,
        ),
      ),
    );
    const governedDocument =
      sourceLedgerFixture().documents['content/cases/example.mdx'];
    const cliLedger = sourceLedgerFixture({
      documents: Object.fromEntries(
        expectedLaunchCases.map(({catalog_order}) => [
          `content/case-${catalog_order}.mdx`,
          governedDocument,
        ]),
      ),
    });
    await mkdir(path.join(cliProjectRoot, 'data'), {recursive: true});
    await writeFile(
      path.join(cliProjectRoot, 'data/source-ledger.json'),
      `${JSON.stringify(cliLedger, null, 2)}\n`,
    );
    const cli = spawnSync(
      process.execPath,
      [validatorScript, cliContentRoot, '--require-launch-cases'],
      {encoding: 'utf8'},
    );
    assert.equal(cli.status, 0, cli.stderr);
  });
});

test('rejects a case missing required analysis sections', async () => {
  await withTempRoot(async (root) => {
    const relativePath = 'cases/front-matter-headings.mdx';
    const frontMatter = `${validCaseFrontMatter('/cases/front-matter-headings')}\n${requiredCaseHeadings.join('\n')}`;
    await writeMdx(
      root,
      relativePath,
      frontMatter,
      '# Body without required analysis headings',
    );

    const result = await validateContent(root);
    const headingErrors = result.errors.filter((error) =>
      error.includes(`${relativePath}: missing required case heading`),
    );

    assert.equal(headingErrors.length, requiredCaseHeadings.length);
    for (const heading of requiredCaseHeadings) {
      assert.ok(headingErrors.some((error) => error.includes(`"${heading}"`)));
    }
  });

  await withTempRoot(async (root) => {
    const relativePath = 'cases/missing-sections.mdx';
    await writeMdx(
      root,
      relativePath,
      validCaseFrontMatter('/cases/missing-sections'),
      '# Structurally valid case without the analysis contract',
    );

    const result = await validateContent(root);
    const headingErrors = result.errors.filter((error) =>
      error.includes(`${relativePath}: missing required case heading`),
    );

    assert.equal(headingErrors.length, requiredCaseHeadings.length);
    for (const heading of requiredCaseHeadings) {
      assert.ok(headingErrors.some((error) => error.includes(`"${heading}"`)));
    }
  });

  for (const [index, heading] of requiredCaseHeadings.entries()) {
    await withTempRoot(async (root) => {
      const relativePath = `cases/missing-one-${index}.mdx`;
      const body = validCaseBody
        .split('\n\n')
        .filter((line) => line !== heading)
        .join('\n\n');
      await writeMdx(
        root,
        relativePath,
        validCaseFrontMatter(`/cases/missing-one-${index}`),
        body,
      );

      const result = await validateContent(root);
      const headingErrors = result.errors.filter((error) =>
        error.includes(`${relativePath}: missing required case heading`),
      );

      assert.deepEqual(headingErrors, [
        `${relativePath}: missing required case heading "${heading}"`,
      ]);
    });
  }

  const hiddenHeadingCases = [
    ['backtick fence', '```markdown\n## 学习问题\n```'],
    ['tilde fence', '~~~markdown\n## 学习问题\n~~~'],
    ['HTML comment', '<!--\n## 学习问题\n-->'],
  ];

  for (const [index, [label, hiddenHeading]] of hiddenHeadingCases.entries()) {
    await withTempRoot(async (root) => {
      const relativePath = `cases/hidden-heading-${index}.mdx`;
      const body = `${validCaseBody.replace('## 学习问题\n\n', '')}\n\n${hiddenHeading}`;
      await writeMdx(
        root,
        relativePath,
        validCaseFrontMatter(`/cases/hidden-heading-${index}`),
        body,
      );

      const result = await validateContent(root);
      const headingErrors = result.errors.filter((error) =>
        error.includes(`${relativePath}: missing required case heading`),
      );

      assert.deepEqual(
        headingErrors,
        [`${relativePath}: missing required case heading "## 学习问题"`],
        label,
      );
    });
  }
});

test('rejects case H2 sections in a non-canonical order', async () => {
  await withTempRoot(async (root) => {
    const relativePath = 'cases/reordered-h2.mdx';
    const body = validCaseBody
      .replace('## 学习问题\n\n## 一页摘要', '## 一页摘要\n\n## 学习问题');
    await writeMdx(
      root,
      relativePath,
      validCaseFrontMatter('/cases/reordered-h2'),
      body,
    );

    const result = await validateContent(root);

    assert.ok(
      result.errors.some(
        (error) =>
          error.includes(`${relativePath}: invalid case H2 sequence`) &&
          error.includes('expected "## 学习问题"') &&
          error.includes('actual "## 一页摘要"'),
      ),
    );
  });
});

test('rejects duplicate case H2 sections', async () => {
  await withTempRoot(async (root) => {
    const relativePath = 'cases/duplicate-h2.mdx';
    const body = validCaseBody.replace(
      '## 一页摘要',
      '## 学习问题\n\n## 一页摘要',
    );
    await writeMdx(
      root,
      relativePath,
      validCaseFrontMatter('/cases/duplicate-h2'),
      body,
    );

    const result = await validateContent(root);

    assert.ok(
      result.errors.some(
        (error) =>
          error.includes(`${relativePath}: expected exactly 10 case H2 headings`) &&
          error.includes('found 11'),
      ),
    );
  });
});

test('validates catalog metadata only for cases', async () => {
  await withTempRoot(async (root) => {
    await writeMdx(
      root,
      'reference.mdx',
      [
        'title: Catalog reference',
        'slug: /references/catalog',
        'content_type: reference',
        'status: reviewed',
        'difficulty: beginner',
        'analyzed_at: 2026-07-20',
        'source_cutoff: 2026-07-01',
        'confidence: high',
        'domains: []',
        'agent_patterns: []',
        'protocols: []',
        'quality_attributes: []',
        'tags: []',
      ].join('\n'),
      '# Reference',
    );

    const result = await validateContent(root);

    assert.deepEqual(result.errors, []);
  });
});

test('rejects swapped canonical orders for approved launch cases', async () => {
  await withTempRoot(async (root) => {
    await Promise.all(
      expectedLaunchCases.map(({slug, catalog_order}) => {
        const swappedOrder = catalog_order === 1 ? 2 : catalog_order === 2 ? 1 : catalog_order;
        return writeMdx(
          root,
          `case-${catalog_order}.mdx`,
          validCaseFrontMatter(slug, {catalog_order: swappedOrder}),
        );
      }),
    );

    const result = await validateContent(root, {requiredCollection: 'launch'});
    const orderErrors = result.errors.filter((error) =>
      error.includes('approved catalog_order'),
    );

    assert.equal(orderErrors.length, 2);
    assert.ok(
      orderErrors.some(
        (error) =>
          error.includes('case-1.mdx') &&
          error.includes('/cases/microsoft-multi-agent-reference-architecture') &&
          error.includes('expected 1') &&
          error.includes('actual 2'),
      ),
    );
    assert.ok(
      orderErrors.some(
        (error) =>
          error.includes('case-2.mdx') &&
          error.includes('/cases/openai-agents-sdk') &&
          error.includes('expected 2') &&
          error.includes('actual 1'),
      ),
    );
  });
});

test('rejects a unique wrong order for every approved case', async () => {
  for (const {slug, catalog_order} of expectedCaseCatalog) {
    await withTempRoot(async (root) => {
      const actualOrder = catalog_order + 100;
      const relativePath = `cases/case-${catalog_order}.mdx`;
      await writeMdx(
        root,
        relativePath,
        validCaseFrontMatter(slug, {catalog_order: actualOrder}),
      );

      const result = await validateContent(root);
      const orderErrors = result.errors.filter((error) =>
        error.includes('approved catalog_order'),
      );

      assert.deepEqual(orderErrors, [
        `${relativePath}: slug "${slug}" has invalid approved catalog_order; expected ${catalog_order}, actual ${actualOrder}`,
      ]);
    });
  }
});

test('rejects prototype properties as unknown required collections', async () => {
  await withTempRoot(async (root) => {
    await assert.rejects(
      validateContent(root, {requiredCollection: 'constructor'}),
      /Unknown required collection "constructor"/,
    );
  });
});

test('rejects invalid case catalog scalar fields', async () => {
  const invalidCases = [
    ['empty summary', {summary: ''}, 'summary'],
    ['unknown series', {series: 'backend-architecture'}, 'series'],
    ['zero catalog order', {catalog_order: 0}, 'catalog_order'],
    ['negative catalog order', {catalog_order: -1}, 'catalog_order'],
    ['string catalog order', {catalog_order: 'first'}, 'catalog_order'],
    ['non-boolean featured', {featured: 'yes'}, 'featured'],
  ];

  for (const [index, [label, overrides, field]] of invalidCases.entries()) {
    await withTempRoot(async (root) => {
      await writeMdx(
        root,
        `invalid-${index}.mdx`,
        validCaseFrontMatter(`/cases/invalid-${index}`, overrides),
      );

      const result = await validateContent(root);

      assert.ok(result.errors.some((error) => error.includes(field)), label);
    });
  }
});

test('rejects invalid source kinds', async () => {
  const invalidCases = [
    ['empty', []],
    ['unknown', ['vendor-promise']],
  ];

  for (const [index, [label, sourceKinds]] of invalidCases.entries()) {
    await withTempRoot(async (root) => {
      await writeMdx(
        root,
        `invalid-source-kinds-${index}.mdx`,
        validCaseFrontMatter(`/cases/invalid-source-kinds-${index}`, {
          source_kinds: sourceKinds,
        }),
      );

      const result = await validateContent(root);

      assert.ok(result.errors.some((error) => error.includes('source_kinds')), label);
    });
  }
});

test('rejects invalid migration targets', async () => {
  const invalidCases = [
    ['empty', []],
    ['uppercase', ['Failure-supervision']],
    ['underscored', ['failure_supervision']],
    ['spaced', ['failure supervision']],
  ];

  for (const [index, [label, migrationTargets]] of invalidCases.entries()) {
    await withTempRoot(async (root) => {
      await writeMdx(
        root,
        `invalid-migration-targets-${index}.mdx`,
        validCaseFrontMatter(`/cases/invalid-migration-targets-${index}`, {
          migration_targets: migrationTargets,
        }),
      );

      const result = await validateContent(root);

      assert.ok(result.errors.some((error) => error.includes('migration_targets')), label);
    });
  }
});

test('reports duplicate slugs and catalog orders with both file paths', async () => {
  await withTempRoot(async (root) => {
    await writeMdx(
      root,
      'cases/first.mdx',
      validCaseFrontMatter('/cases/shared', {catalog_order: 9}),
    );
    await writeMdx(
      root,
      'cases/second.mdx',
      validCaseFrontMatter('/cases/shared', {catalog_order: 9}),
    );

    const result = await validateContent(root);
    const slugConflict = result.errors.find((error) => error.includes('duplicate slug'));
    const orderConflict = result.errors.find((error) => error.includes('duplicate catalog_order'));

    for (const conflict of [slugConflict, orderConflict]) {
      assert.ok(conflict);
      assert.match(conflict, /cases\/first\.mdx/);
      assert.match(conflict, /cases\/second\.mdx/);
    }
  });
});

test('requires migration analysis headings for second-collection cases', async () => {
  for (const [index, heading] of requiredMigrationHeadings.entries()) {
    await withTempRoot(async (root) => {
      const relativePath = `cases/missing-migration-${index}.mdx`;
      const body = validCaseBody
        .split('\n\n')
        .filter((line) => line !== heading)
        .join('\n\n');
      await writeMdx(
        root,
        relativePath,
        validCaseFrontMatter('/cases/erlang-otp-supervision-tree', {catalog_order: 6}),
        body,
      );

      const result = await validateContent(root);
      const headingErrors = result.errors.filter((error) =>
        error.includes(`${relativePath}: missing required migration heading`),
      );

      assert.deepEqual(headingErrors, [
        `${relativePath}: missing required migration heading "${heading}"`,
      ]);
    });
  }
});

test('requires migration H3 headings to belong to the migration section', async () => {
  await withTempRoot(async (root) => {
    const relativePath = 'cases/relocated-migration-h3.mdx';
    const migrationHeadings = requiredMigrationHeadings.join('\n\n');
    const body = validCaseBody
      .replace('## 学习问题', `## 学习问题\n\n${migrationHeadings}`)
      .replace(`\n\n${migrationHeadings}\n\n## 来源`, '\n\n## 来源');
    await writeMdx(
      root,
      relativePath,
      validCaseFrontMatter('/cases/erlang-otp-supervision-tree', {catalog_order: 6}),
      body,
    );

    const result = await validateContent(root);

    assert.ok(
      result.errors.some(
        (error) =>
          error.includes(`${relativePath}: migration H3 headings must appear under`) &&
          error.includes('"## 可迁移经验"'),
      ),
    );
  });
});

test('rejects migration H3 headings in a non-canonical order', async () => {
  await withTempRoot(async (root) => {
    const relativePath = 'cases/reordered-migration-h3.mdx';
    const reversedHeadings = [...requiredMigrationHeadings].reverse().join('\n\n');
    const body = validCaseBody.replace(
      requiredMigrationHeadings.join('\n\n'),
      reversedHeadings,
    );
    await writeMdx(
      root,
      relativePath,
      validCaseFrontMatter('/cases/erlang-otp-supervision-tree', {catalog_order: 6}),
      body,
    );

    const result = await validateContent(root);

    assert.ok(
      result.errors.some(
        (error) =>
          error.includes(`${relativePath}: invalid migration H3 sequence`) &&
          error.includes(`expected "${requiredMigrationHeadings[0]}"`) &&
          error.includes(`actual "${requiredMigrationHeadings.at(-1)}"`),
      ),
    );
  });
});

test('rejects duplicate migration H3 headings', async () => {
  await withTempRoot(async (root) => {
    const relativePath = 'cases/duplicate-migration-h3.mdx';
    const body = validCaseBody.replace(
      requiredMigrationHeadings[1],
      `${requiredMigrationHeadings[0]}\n\n${requiredMigrationHeadings[1]}`,
    );
    await writeMdx(
      root,
      relativePath,
      validCaseFrontMatter('/cases/erlang-otp-supervision-tree', {catalog_order: 6}),
      body,
    );

    const result = await validateContent(root);

    assert.ok(
      result.errors.some(
        (error) =>
          error.includes(`${relativePath}: expected exactly 3 migration H3 headings`) &&
          error.includes('found 4'),
      ),
    );
  });
});

test('does not count migration headings hidden outside Markdown body structure', async () => {
  const hiddenHeadingCases = [
    ['front matter', (heading) => ({frontMatter: `${heading}: hidden`, body: ''})],
    ['backtick fence', (heading) => ({body: `\`\`\`markdown\n${heading}\n\`\`\``})],
    ['tilde fence', (heading) => ({body: `~~~markdown\n${heading}\n~~~`})],
    ['HTML comment', (heading) => ({body: `<!--\n${heading}\n-->`})],
  ];

  for (const [headingIndex, heading] of requiredMigrationHeadings.entries()) {
    for (const [caseIndex, [label, makeHidden]] of hiddenHeadingCases.entries()) {
      await withTempRoot(async (root) => {
        const relativePath = `cases/hidden-migration-${headingIndex}-${caseIndex}.mdx`;
        const hidden = makeHidden(heading);
        const body = `${validCaseBody.replace(`${heading}\n\n`, '')}\n\n${hidden.body}`;
        const frontMatter = `${validCaseFrontMatter('/cases/erlang-otp-supervision-tree', {
          catalog_order: 6,
        })}${hidden.frontMatter ? `\n${hidden.frontMatter}` : ''}`;
        await writeMdx(root, relativePath, frontMatter, body);

        const result = await validateContent(root);
        const headingErrors = result.errors.filter((error) =>
          error.includes(`${relativePath}: missing required migration heading`),
        );

        assert.deepEqual(
          headingErrors,
          [`${relativePath}: missing required migration heading "${heading}"`],
          label,
        );
      });
    }
  }
});

function frontMatter(values) {
  return Object.entries(values)
    .map(([field, value]) => {
      if (Array.isArray(value)) {
        return value.length === 0
          ? `${field}: []`
          : `${field}:\n${value.map((item) => `  - ${item}`).join('\n')}`;
      }
      return `${field}: ${value}`;
    })
    .join('\n');
}

const knowledgeFixtures = new Map([
  ['concept', [
    '## 学习问题',
    '## 定义与尺度边界',
    '## 核心机制',
    '## 常见混淆',
    '## 说明性场景',
    '## 相邻主题',
    '## 来源',
  ]],
  ['principle', [
    '## 学习问题',
    '## 要保护的性质',
    '## 冲突与适用上下文',
    '## 机制',
    '## 误用与反原则',
    '## 适用尺度',
    '## 相邻原则',
    '## 说明性场景',
    '## 来源',
  ]],
  ['quality-attribute', [
    '## 学习问题',
    '## 定义与业务目标',
    '## 质量属性场景',
    '### Source',
    '### Stimulus',
    '### Environment',
    '### Artifact',
    '### Response',
    '### Response measure',
    '## 架构策略',
    '## 测量信号与阈值',
    '## 权衡与失败模式',
    '## 相邻质量属性',
    '## 说明性场景',
    '## 来源',
  ]],
  ['method', [
    '## 学习问题',
    '## 输入与参与者',
    '## 步骤',
    '## 产物',
    '## 完成判断',
    '## 常见失败',
    '## 与其他方法的衔接',
    '## 完整演练',
    '## 来源',
  ]],
  ['modeling', [
    '## 学习问题',
    '## 建模目标与输入',
    '## 参与者与步骤',
    '## 模型产物',
    '## 完成判断',
    '## 常见失败',
    '## 与其他模型的衔接',
    '## 完整演练',
    '## 来源',
  ]],
  ['style', [
    '## 学习问题',
    '## 组件、连接器与约束',
    '## 边界与控制流',
    '## 数据所有权与一致性',
    '## 部署单元与故障域',
    '## 团队拓扑',
    '## 质量属性收益与成本',
    '## 迁移路径',
    '## 禁用条件',
    '## 对比案例',
    '## 来源',
  ]],
]);

function validKnowledgeFrontMatter(type, overrides = {}) {
  return frontMatter({
    title: `${type} fixture`,
    slug: `/${type}s/fixture`,
    content_type: type,
    status: 'reviewed',
    difficulty: 'intermediate',
    analyzed_at: '2026-07-23',
    source_cutoff: '2026-07-23',
    confidence: 'high',
    domains: ['software-architecture'],
    agent_patterns: [],
    protocols: [],
    quality_attributes: ['maintainability'],
    tags: [type],
    official_sources: ['https://example.com/official'],
    summary: `${type} summary`,
    topic_id: 'FND-01',
    priority: 'P0',
    depends_on: [],
    related_cases: [],
    ...overrides,
  });
}

const patternHeadings = [
  '## 学习问题',
  '## 问题与适用上下文',
  '## 约束与驱动力',
  '## 结构与协作关系',
  '## 运行机制',
  '## 失败模式与误用',
  '## 质量属性权衡',
  '## 实现与迁移提示',
  '## 相邻模式与反模式',
  '## 说明性场景',
  '## 来源',
];

test('accepts the Pattern knowledge contract and excludes the Pattern index', async () => {
  await withTempRoot(async (root) => {
    await writeMdx(
      root,
      'patterns/rel-02.mdx',
      validKnowledgeFrontMatter('pattern', {
        topic_id: 'REL-02',
        slug: '/patterns/rel-02',
      }),
      patternHeadings.join('\n\n'),
    );
    await writeMdx(
      root,
      'patterns/index.mdx',
      frontMatter({
        title: '架构模式',
        slug: '/patterns',
        content_type: 'pattern',
        status: 'reviewed',
        difficulty: 'intermediate',
        analyzed_at: '2026-07-24',
        source_cutoff: '2026-07-24',
        confidence: 'high',
        domains: ['software-architecture'],
        agent_patterns: [],
        protocols: [],
        quality_attributes: ['maintainability'],
        tags: ['模式'],
      }),
      '# 架构模式',
    );

    const result = await validateContent(root);
    assert.deepEqual(result.errors, []);
  });
});

test('rejects a Pattern article with a reordered mechanism section', async () => {
  await withTempRoot(async (root) => {
    const reordered = [...patternHeadings];
    [reordered[4], reordered[5]] = [reordered[5], reordered[4]];
    await writeMdx(
      root,
      'patterns/rel-02.mdx',
      validKnowledgeFrontMatter('pattern', {
        topic_id: 'REL-02',
        slug: '/patterns/rel-02',
      }),
      reordered.join('\n\n'),
    );

    const result = await validateContent(root);
    assert.match(
      result.errors.join('\n'),
      /invalid ## 学习问题-contract H2 sequence at position 5/,
    );
  });
});

test('accepts all six knowledge content contracts', async () => {
  await withTempRoot(async (root) => {
    await Promise.all(
      [...knowledgeFixtures].map(([type, headings]) =>
        writeMdx(
          root,
          `${type}.mdx`,
          validKnowledgeFrontMatter(type),
          headings.join('\n\n'),
        ),
      ),
    );

    const result = await validateContent(root);

    assert.deepEqual(result.errors, []);
  });
});

test('rejects invalid knowledge metadata', async () => {
  const invalidFixtures = [
    ['missing-summary.mdx', 'concept', {summary: undefined}, 'summary'],
    ['invalid-priority.mdx', 'principle', {priority: 'P9'}, 'priority'],
    ['scalar-dependency.mdx', 'method', {depends_on: 'FND-02'}, 'depends_on'],
  ];

  for (const [file, type, overrides, field] of invalidFixtures) {
    await withTempRoot(async (root) => {
      const metadata = validKnowledgeFrontMatter(type, overrides)
        .split('\n')
        .filter((line) => !line.endsWith(': undefined'))
        .join('\n');
      await writeMdx(root, file, metadata, knowledgeFixtures.get(type).join('\n\n'));

      const result = await validateContent(root);

      assert.ok(
        result.errors.some(
          (error) =>
            error.includes(file) &&
            error.includes(type) &&
            error.includes(field),
        ),
        `${type} ${field}`,
      );
    });
  }
});

test('rejects missing or reordered knowledge headings', async () => {
  await withTempRoot(async (root) => {
    const type = 'concept';
    const headings = knowledgeFixtures.get(type);
    const relativePath = 'missing-heading.mdx';
    await writeMdx(
      root,
      relativePath,
      validKnowledgeFrontMatter(type),
      headings.filter((heading) => heading !== '## 核心机制').join('\n\n'),
    );

    const result = await validateContent(root);

    assert.ok(
      result.errors.some(
        (error) =>
          error.includes(relativePath) &&
          error.includes('## 核心机制'),
      ),
    );
  });

  await withTempRoot(async (root) => {
    const type = 'style';
    const headings = knowledgeFixtures.get(type);
    const relativePath = 'reordered-heading.mdx';
    const body = [
      headings[1],
      headings[0],
      ...headings.slice(2),
    ].join('\n\n');
    await writeMdx(root, relativePath, validKnowledgeFrontMatter(type), body);

    const result = await validateContent(root);

    assert.ok(
      result.errors.some(
        (error) =>
          error.includes(relativePath) &&
          error.includes('position 1') &&
          error.includes('## 学习问题') &&
          error.includes('## 组件、连接器与约束'),
      ),
    );
  });
});

test('keeps quality attribute scenario fields inside their section', async () => {
  await withTempRoot(async (root) => {
    const type = 'quality-attribute';
    const relativePath = 'misplaced-response-measure.mdx';
    const headings = knowledgeFixtures.get(type);
    const body = headings
      .filter((heading) => heading !== '### Response measure')
      .flatMap((heading) =>
        heading === '## 架构策略'
          ? [heading, '### Response measure']
          : [heading],
      )
      .join('\n\n');
    await writeMdx(root, relativePath, validKnowledgeFrontMatter(type), body);

    const result = await validateContent(root);

    assert.ok(
      result.errors.some(
        (error) =>
          error.includes(relativePath) &&
          error.includes('### Response measure') &&
          error.includes('## 质量属性场景'),
      ),
    );
  });
});

test('rejects conflicting catalog coverage flags', async () => {
  await withTempRoot(async (root) => {
    const cli = spawnSync(
      process.execPath,
      [validatorScript, root, '--require-launch-cases', '--require-complete-catalog'],
      {encoding: 'utf8'},
    );

    assert.equal(cli.status, 1);
    assert.match(`${cli.stdout}${cli.stderr}`, /conflicting coverage flags/i);
  });
});

test('the repository validator fails on unregistered article sources', async () => {
  await withTempRoot(async (projectRoot) => {
    const contentRoot = await writeSourceGovernanceProject(projectRoot, {
      body: `${validCaseBody}\n\n[C4 model](https://c4model.com/)\n\n[unregistered](https://example.com/unregistered)`,
    });

    const cli = spawnSync(process.execPath, [validatorScript, contentRoot], {
      encoding: 'utf8',
    });
    const output = `${cli.stdout}${cli.stderr}`;

    assert.equal(cli.status, 1);
    assert.match(
      output,
      /content\/cases\/example\.mdx: visible URL "https:\/\/example\.com\/unregistered" has no document citation/,
    );
  });
});

test('the repository validator reports source-ledger errors with file context', async () => {
  await withTempRoot(async (projectRoot) => {
    const fixture = sourceLedgerFixture();
    fixture.documents['content/cases/example.mdx'].citations[0].source_id =
      'src-missing';
    const contentRoot = await writeSourceGovernanceProject(projectRoot, {
      ledger: fixture,
    });

    const cli = spawnSync(process.execPath, [validatorScript, contentRoot], {
      encoding: 'utf8',
    });
    const output = `${cli.stdout}${cli.stderr}`;

    assert.equal(cli.status, 1);
    assert.match(
      output,
      /content\/cases\/example\.mdx.*src-missing.*does not exist/,
    );
  });
});
