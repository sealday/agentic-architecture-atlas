import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  buildCaseCatalog,
  serializeCaseCatalog,
} from '../scripts/generate-case-catalog.mjs';
import {
  buildContentArtifacts,
  checkContentArtifacts,
  generatedPaths,
  serializePublicSourceLedger,
  writeContentArtifacts,
} from '../scripts/generate-content-platform.mjs';

const generatorScript = fileURLToPath(
  new URL('../scripts/generate-content-platform.mjs', import.meta.url),
);
const stagePath = 'src/generated/.content-platform-stage';

const caseBody = [
  '# Example case',
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
  '[C4 model](https://c4model.com/#SystemContextDiagram)',
].join('\n\n');

const conceptBody = [
  '# Example concept',
  '## 学习问题',
  '## 定义与尺度边界',
  '## 核心机制',
  '## 常见混淆',
  '## 说明性场景',
  '## 相邻主题',
  '## 来源',
  '[C4 model](https://c4model.com/#SystemContextDiagram)',
].join('\n\n');

const governedSource = {
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
  allowed_evidence_roles: ['definition', 'method'],
  license: 'LicenseRef-All-Rights-Reserved',
  license_scope: 'Page text and diagrams; third-party links excluded',
  license_evidence_url: 'https://c4model.com/',
  license_evidence_note: 'No reuse license is declared on the checked page',
  license_family_id: 'https://c4model.com/',
  license_family_grouping: 'identity',
  family_grouping_evidence_url: null,
  copyright_policy: 'facts-and-short-quotation',
  usage_boundary: 'Defines the model; does not prove concrete fitness.',
  link_policy: 'stable',
  expected_final_transport_locator: 'https://c4model.com/',
  expected_final_approved_at: '2026-07-23',
  expected_final_approval_note: 'Initial reviewed transport baseline',
};

const governedCitation = {
  source_id: 'src-c4-model',
  citation_url: 'https://c4model.com/#SystemContextDiagram',
  roles: ['definition'],
  manifest_primary: true,
  usage_mode: 'facts-summary',
  attribution_note: 'C4 model, Simon Brown',
  modification_note: null,
  excerpt: null,
  quotation_reviewed: false,
};

const governedDocument = {
  reviewed_at: '2026-07-23',
  copyright_checks: [
    'original-structure',
    'quotation-boundary',
    'attribution-complete',
    'illustration-rights',
  ],
  citations: [governedCitation],
};

const publicGovernedDocument = (title, slug) => ({
  title,
  slug,
  ...governedDocument,
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

async function writeDocument(root, relativePath, metadata, body) {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(
    filePath,
    `---\n${frontMatter(metadata)}\n---\n\n${body}\n`,
  );
}

async function withRepositoryFixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'content-platform-generation-'));
  const shared = {
    status: 'reviewed',
    difficulty: 'intermediate',
    analyzed_at: '2026-07-23',
    source_cutoff: '2026-07-01',
    confidence: 'high',
    domains: ['architecture'],
    agent_patterns: [],
    protocols: [],
    quality_attributes: ['reliability'],
    official_sources: ['https://example.com/source'],
  };

  try {
    await Promise.all([
      mkdir(path.join(root, 'docs'), {recursive: true}),
      mkdir(path.join(root, 'data'), {recursive: true}),
      mkdir(path.join(root, 'src/generated'), {recursive: true}),
      writeDocument(
        root,
        'content/concepts/example.mdx',
        {
          ...shared,
          title: 'Example concept',
          slug: '/concepts/example',
          content_type: 'concept',
          tags: ['concept'],
          summary: 'A projected concept.',
          topic_id: 'FND-01',
          priority: 'P0',
          depends_on: [],
          related_cases: [],
        },
        conceptBody,
      ),
      writeDocument(
        root,
        'content/cases/example.mdx',
        {
          ...shared,
          title: 'Example case',
          slug: '/cases/example',
          content_type: 'case',
          tags: ['case'],
          summary: 'A compatibility case.',
          series: 'ai-native',
          catalog_order: 1,
          featured: true,
          source_kinds: ['official-docs'],
          migration_targets: ['failure-supervision'],
        },
        caseBody,
      ),
    ]);
    await Promise.all([
      writeFile(
        path.join(root, 'docs/content-backlog.md'),
        '- [x] **FND-01 P0｜Example concept**。\n',
      ),
      writeFile(path.join(root, 'data/topic-relations.json'), '{}\n'),
      writeFile(
        path.join(root, 'data/source-ledger.json'),
        `${JSON.stringify({
          schema_version: 1,
          sources: [governedSource],
          documents: {
            'content/cases/example.mdx': governedDocument,
            'content/concepts/example.mdx': governedDocument,
          },
        }, null, 2)}\n`,
      ),
    ]);

    await run(root);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
}

test('builds all artifacts from one validated snapshot', async () => {
  await withRepositoryFixture(async (root) => {
    const originalReadFile = fs.promises.readFile;
    let sourceReads = 0;
    let ledgerReads = 0;
    fs.promises.readFile = async (...args) => {
      const [filePath] = args;
      if (
        typeof filePath === 'string' &&
        filePath.startsWith(path.join(root, 'content')) &&
        filePath.endsWith('.mdx')
      ) {
        sourceReads += 1;
      }
      if (filePath === path.join(root, 'data/source-ledger.json')) {
        ledgerReads += 1;
      }
      return originalReadFile(...args);
    };
    syncBuiltinESMExports();

    let first;
    let second;
    try {
      first = await buildContentArtifacts(root, {requiredCollection: null});
      assert.equal(sourceReads, 2);
      assert.equal(ledgerReads, 1);
      second = await buildContentArtifacts(root, {requiredCollection: null});
      assert.equal(sourceReads, 4);
      assert.equal(ledgerReads, 2);
    } finally {
      fs.promises.readFile = originalReadFile;
      syncBuiltinESMExports();
    }

    assert.deepEqual(Object.keys(first), [
      generatedPaths.sourceLedger,
      generatedPaths.manifest,
      generatedPaths.indexes,
      generatedPaths.caseCatalog,
    ]);
    assert.equal(
      first[generatedPaths.sourceLedger],
      serializePublicSourceLedger({
        schema_version: 1,
        sources: [governedSource],
        documents: {
          'content/cases/example.mdx': publicGovernedDocument(
            'Example case',
            '/cases/example',
          ),
          'content/concepts/example.mdx': publicGovernedDocument(
            'Example concept',
            '/concepts/example',
          ),
        },
      }),
    );
    assert.deepEqual(second, first);
    for (const serialized of Object.values(first)) {
      assert.ok(serialized.endsWith('\n'));
      assert.ok(!serialized.endsWith('\n\n'));
      assert.ok(!serialized.includes(root));
    }
  });
});

test('publishes document title and slug from the validated snapshot', () => {
  const publicLedger = JSON.parse(
    serializePublicSourceLedger(
      {
        schema_version: 1,
        sources: [governedSource],
        documents: {
          'content/cases/example.mdx': governedDocument,
        },
      },
      [
        {
          file: 'cases/example.mdx',
          metadata: {
            title: 'Validated example case',
            slug: '/validated/example-case',
          },
        },
      ],
    ),
  );

  assert.deepEqual(
    publicLedger.documents['content/cases/example.mdx'],
    publicGovernedDocument(
      'Validated example case',
      '/validated/example-case',
    ),
  );
});

test('writes and checks deterministic generated artifacts', async () => {
  await withRepositoryFixture(async (root) => {
    const expected = await buildContentArtifacts(root, {
      requiredCollection: null,
    });
    await writeContentArtifacts(root);

    for (const [relativePath, bytes] of Object.entries(expected)) {
      assert.equal(await readFile(path.join(root, relativePath), 'utf8'), bytes);
    }
    assert.deepEqual(
      await checkContentArtifacts(root),
      {matches: true, stale: []},
    );

    await writeFile(
      path.join(root, generatedPaths.indexes),
      `${expected[generatedPaths.indexes]} `,
    );
    assert.deepEqual(
      await checkContentArtifacts(root),
      {matches: false, stale: [generatedPaths.indexes]},
    );

    await writeContentArtifacts(root);
    await unlink(path.join(root, generatedPaths.caseCatalog));
    assert.deepEqual(
      await checkContentArtifacts(root),
      {matches: false, stale: [generatedPaths.caseCatalog]},
    );
  });
});

test('recovers idempotently after an interrupted replacement', async () => {
  await withRepositoryFixture(async (root) => {
    const expected = await buildContentArtifacts(root, {
      requiredCollection: null,
    });
    let replacements = 0;

    await assert.rejects(
      writeContentArtifacts(root, {
        replaceFile: async (stagedFile, targetFile) => {
          replacements += 1;
          if (replacements === 2) {
            throw new Error('injected second replacement failure');
          }
          await writeFile(targetFile, await readFile(stagedFile));
        },
      }),
      /injected second replacement failure/,
    );

    assert.equal(replacements, 2);
    const stagedNames = (
      await fs.promises.readdir(path.join(root, stagePath))
    ).sort();
    assert.deepEqual(stagedNames, [
      'case-catalog.json',
      'manifest.json',
      'source-ledger.json',
      'topic-indexes.json',
      'topic-manifest.json',
    ]);

    const interruptedCheck = await checkContentArtifacts(root);
    assert.equal(interruptedCheck.matches, false);
    assert.ok(interruptedCheck.stale.includes(stagePath));

    await writeContentArtifacts(root);
    for (const [relativePath, bytes] of Object.entries(expected)) {
      assert.equal(await readFile(path.join(root, relativePath), 'utf8'), bytes);
    }
    await assert.rejects(
      readFile(path.join(root, stagePath, 'manifest.json')),
      {code: 'ENOENT'},
    );
  });
});

test('derives the compatibility case catalog from the manifest', async () => {
  await withRepositoryFixture(async (root) => {
    const artifacts = await buildContentArtifacts(root, {
      requiredCollection: null,
    });
    assert.equal(
      artifacts[generatedPaths.caseCatalog],
      serializeCaseCatalog(
        await buildCaseCatalog(path.join(root, 'content')),
      ),
    );
  });
});

test('rejects invalid CLI mode combinations', () => {
  for (const args of [[], ['--write', '--check'], ['--unknown']]) {
    const result = spawnSync(process.execPath, [generatorScript, ...args], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(`${result.stdout}${result.stderr}`, /Usage:/);
  }
});
