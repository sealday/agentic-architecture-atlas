import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {validateContent} from '../scripts/validate-content.mjs';

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

async function writeMdx(root, relativePath, frontMatter) {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `---\n${frontMatter}\n---\n\n# Fixture\n`);
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

    assert.equal(result.errors.length, 4);
    assert.ok(
      result.errors.some((error) =>
        error.includes('/cases/microsoft-multi-agent-reference-architecture'),
      ),
    );
  });
});

test('accepts all five valid launch cases with HTTPS official sources', async () => {
  await withTempRoot(async (root) => {
    await Promise.all(
      launchCaseSlugs.map((slug, index) =>
        writeMdx(root, `case-${index + 1}.mdx`, validCaseFrontMatter(slug)),
      ),
    );

    const result = await validateContent(root, {requireLaunchCases: true});

    assert.equal(result.documents.length, 5);
    assert.deepEqual(result.errors, []);
  });
});
