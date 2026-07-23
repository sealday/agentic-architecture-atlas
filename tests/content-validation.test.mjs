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
    official_sources: ['https://example.com/official'],
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
      10,
    );
  });
});

test('accepts all five valid launch cases with HTTPS official sources', async () => {
  await withTempRoot(async (root) => {
    await writeMdx(
      root,
      'empty-sources.mdx',
      validCaseFrontMatter('/cases/empty-sources', {official_sources: []}),
    );

    const result = await validateContent(root);

    assert.ok(
      result.errors.some(
        (error) => error.includes('official_sources') && error.includes('non-empty'),
      ),
    );
  });

  await withTempRoot(async (root) => {
    await writeMdx(
      root,
      'insecure-source.mdx',
      validCaseFrontMatter('/cases/insecure-source', {
        official_sources: ['http://example.com'],
      }),
    );

    const result = await validateContent(root);

    assert.ok(
      result.errors.some(
        (error) => error.includes('official_sources') && error.includes('HTTPS'),
      ),
    );
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

    const result = await validateContent(root, {requiredCollection: 'launch'});

    assert.equal(result.documents.length, 5);
    assert.deepEqual(result.errors, []);

    const cli = spawnSync(
      process.execPath,
      [validatorScript, root, '--require-launch-cases'],
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
        'official_sources:',
        '  - https://example.com/official',
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
