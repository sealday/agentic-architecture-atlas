import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  launchCaseSlugs,
  requiredCaseHeadings,
  requiredMigrationHeadings,
} from '../scripts/content-schema.mjs';
import {validateContent} from '../scripts/validate-content.mjs';

const validatorScript = fileURLToPath(new URL('../scripts/validate-content.mjs', import.meta.url));

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

test('reports staged catalog coverage failures', async () => {
  await withTempRoot(async (root) => {
    await writeMdx(root, 'openai.mdx', validCaseFrontMatter('/cases/openai-agents-sdk'));

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
      launchCaseSlugs.map((slug, index) =>
        writeMdx(
          root,
          `case-${index + 1}.mdx`,
          validCaseFrontMatter(slug, {catalog_order: index + 1}),
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
      launchCaseSlugs.map((slug, index) =>
        writeMdx(
          root,
          `case-${index + 1}.mdx`,
          validCaseFrontMatter(slug, {catalog_order: index + 1}),
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

test('validates catalog metadata only for cases', async () => {
  await withTempRoot(async (root) => {
    await writeMdx(
      root,
      'reference.mdx',
      validCaseFrontMatter('/references/catalog', {
        content_type: 'reference',
        summary: '',
        series: 'unknown',
        catalog_order: 'first',
        featured: 'yes',
        source_kinds: [],
        migration_targets: [],
      }),
      '# Reference',
    );

    const result = await validateContent(root);

    assert.deepEqual(result.errors, []);
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
