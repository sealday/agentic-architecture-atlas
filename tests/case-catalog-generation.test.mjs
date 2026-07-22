import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildCaseCatalog,
  checkCaseCatalog,
  serializeCaseCatalog,
  writeCaseCatalog,
} from '../scripts/generate-case-catalog.mjs';

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

function caseMetadata({title, slug, catalogOrder}) {
  return {
    title,
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
    tags: ['catalog', slug.slice(1)],
    official_sources: ['https://example.com/official'],
    summary: `${title} summary`,
    series: 'classic-distributed',
    catalog_order: catalogOrder,
    featured: catalogOrder === 1,
    source_kinds: ['official-docs'],
    migration_targets: ['failure-supervision'],
  };
}

async function writeDocument(root, relativePath, metadata, body = '# Reference') {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, `---\n${frontMatter(metadata)}\n---\n\n${body}\n`);
}

async function withCatalogFixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'case-catalog-generation-'));

  try {
    await Promise.all([
      writeDocument(
        root,
        'a-second.mdx',
        caseMetadata({title: 'Second case', slug: '/cases/second', catalogOrder: 2}),
        validCaseBody,
      ),
      writeDocument(
        root,
        'z-first.mdx',
        caseMetadata({title: 'First case', slug: '/cases/first', catalogOrder: 1}),
        validCaseBody,
      ),
      writeDocument(root, 'reference.mdx', {
        title: 'Reference document',
        slug: '/references/example',
        content_type: 'reference',
        status: 'reviewed',
        difficulty: 'beginner',
        analyzed_at: '2026-07-20',
        source_cutoff: '2026-07-01',
        confidence: 'high',
        domains: ['multi-agent'],
        agent_patterns: [],
        protocols: [],
        quality_attributes: ['clarity'],
        tags: ['reference'],
        official_sources: ['https://example.com/reference'],
      }),
    ]);

    await run(root);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
}

test('builds a deterministic catalog containing only ordered case fields', async () => {
  await withCatalogFixture(async (contentRoot) => {
    const entries = await buildCaseCatalog(contentRoot);
    const expectedKeys = [
      'title',
      'slug',
      'summary',
      'difficulty',
      'series',
      'catalog_order',
      'featured',
      'source_kinds',
      'migration_targets',
      'tags',
    ];

    assert.deepEqual(
      entries.map(({title, catalog_order}) => ({title, catalog_order})),
      [
        {title: 'First case', catalog_order: 1},
        {title: 'Second case', catalog_order: 2},
      ],
    );
    for (const entry of entries) {
      assert.deepEqual(Object.keys(entry), expectedKeys);
    }

    const firstSerialization = serializeCaseCatalog(entries);
    const secondSerialization = serializeCaseCatalog(entries);
    assert.equal(firstSerialization, secondSerialization);
    assert.ok(firstSerialization.endsWith('\n'));
    assert.ok(!firstSerialization.endsWith('\n\n'));
    assert.ok(!firstSerialization.includes(contentRoot));
  });
});

test('writes current catalog bytes and detects a stale output file', async () => {
  await withCatalogFixture(async (contentRoot) => {
    const outputPath = path.join(contentRoot, 'generated', 'case-catalog.json');
    await writeCaseCatalog({contentRoot, outputPath});

    const expected = serializeCaseCatalog(await buildCaseCatalog(contentRoot));
    assert.equal(await readFile(outputPath, 'utf8'), expected);
    assert.deepEqual(await checkCaseCatalog({contentRoot, outputPath}), {matches: true});

    await writeFile(outputPath, '[]\n');
    assert.deepEqual(await checkCaseCatalog({contentRoot, outputPath}), {matches: false});
  });
});
