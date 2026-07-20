import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {requiredCaseHeadings} from '../scripts/content-schema.mjs';
import {validateContent} from '../scripts/validate-content.mjs';

const validatorScript = fileURLToPath(new URL('../scripts/validate-content.mjs', import.meta.url));

const launchCaseSlugs = [
  '/cases/microsoft-multi-agent-reference-architecture',
  '/cases/openai-agents-sdk',
  '/cases/langgraph-supervisor',
  '/cases/google-adk-a2a',
  '/cases/aws-cli-agent-orchestrator',
];

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

test('reports the four missing launch cases when only the OpenAI case exists', async () => {
  await withTempRoot(async (root) => {
    await writeMdx(root, 'openai.mdx', validCaseFrontMatter('/cases/openai-agents-sdk'));

    const result = await validateContent(root, {requireLaunchCases: true});

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
        writeMdx(root, `case-${index + 1}.mdx`, validCaseFrontMatter(slug)),
      ),
    );

    const result = await validateContent(root, {requireLaunchCases: true});

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
