import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmod, mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {analyzeCaseText} from '../.codex/skills/writing-architecture-cases/scripts/analyze_case_density.mjs';

const analyzerScript = fileURLToPath(
  new URL(
    '../.codex/skills/writing-architecture-cases/scripts/analyze_case_density.mjs',
    import.meta.url,
  ),
);

test('reports long prose without counting front matter, tables, or code', () => {
  const source = `---
title: Fixture
---

这是一个超过阈值的正文句子，因为它连续承担机制、版本、异常、恢复策略与迁移边界，所以应当被报告。

| 列 | 值 |
| --- | --- |
| 很长的表格内容 | 不应计入正文 |

\`\`\`ts
const longIdentifier = 'code is excluded';
\`\`\`
`;

  const result = analyzeCaseText(source, {sentenceLimit: 20});
  assert.equal(result.warnings.filter(({kind}) => kind === 'long-sentence').length, 1);
});

test('reports empty evidence cards', () => {
  const result = analyzeCaseText(
    '<details className="evidence-card"><summary>证据</summary></details>',
  );
  assert.equal(result.warnings[0].kind, 'empty-evidence-card');
});

test('uses 80 characters as the default sentence limit', () => {
  const result = analyzeCaseText(
    `${'句'.repeat(79)}。\n\n${'句'.repeat(80)}。`,
    {paragraphLimit: 1_000},
  );

  assert.deepEqual(
    result.warnings.filter(({kind}) => kind === 'long-sentence').map(({line}) => line),
    [3],
  );
});

test('uses 200 characters as the default paragraph limit', () => {
  const result = analyzeCaseText(`${'段'.repeat(200)}\n\n${'段'.repeat(201)}`, {
    sentenceLimit: 1_000,
  });

  assert.deepEqual(
    result.warnings.filter(({kind}) => kind === 'long-paragraph').map(({line}) => line),
    [3],
  );
});

test('ignores evidence-card markup in front matter, fenced code, and tables', () => {
  const source = `---
example: '<details className="evidence-card"><summary>配置</summary></details>'
---

\`\`\`mdx
<details className="evidence-card"><summary>代码</summary></details>
\`\`\`

类型 | 内容
--- | ---
表格 | <details className="evidence-card"><summary>单元格</summary></details>

<details className="evidence-card"><summary>正文证据</summary></details>
`;

  assert.deepEqual(
    analyzeCaseText(source).warnings
      .filter(({kind}) => kind === 'empty-evidence-card')
      .map(({line}) => line),
    [13],
  );
});

test('ignores pipe tables without outer pipes', () => {
  const source = `列名 | 内容
--- | ---
正文 | ${'这段表格内容不应计入正文密度'.repeat(20)}
`;
  const result = analyzeCaseText(source, {
    sentenceLimit: 20,
    paragraphLimit: 40,
  });

  assert.equal(result.paragraphs, 0);
  assert.equal(
    result.warnings.filter(({kind}) =>
      ['long-sentence', 'long-paragraph'].includes(kind),
    ).length,
    0,
  );
});

test('does not count Markdown link destinations or inline code identifiers', () => {
  const source = `简短[文档](https://example.com/${'long-path/'.repeat(
    20,
  )})\`${'TechnicalIdentifier'.repeat(20)}\`。`;
  const result = analyzeCaseText(source, {
    sentenceLimit: 5,
    paragraphLimit: 5,
  });

  assert.equal(
    result.warnings.filter(({kind}) =>
      ['long-sentence', 'long-paragraph'].includes(kind),
    ).length,
    0,
  );
});

test('reports long paragraphs and one warning for a consecutive dense run', () => {
  const source = [
    '第一个段落包含足够多的文字来超过限制。',
    '',
    '第二个段落同样包含足够多的文字来超过限制。',
    '',
    '第三个段落也包含足够多的文字来超过限制。',
  ].join('\n');

  const result = analyzeCaseText(source, {
    paragraphLimit: 10,
    consecutiveDenseLimit: 2,
  });

  assert.equal(result.paragraphs, 3);
  assert.deepEqual(
    result.warnings
      .filter(({kind}) => kind === 'long-paragraph')
      .map(({line}) => line),
    [1, 3, 5],
  );
  assert.deepEqual(
    result.warnings.filter(({kind}) => kind === 'dense-run').map(({line}) => line),
    [1],
  );
});

test('CLI recursively reports directory warnings without failing', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'case-writing-density-'));
  const nested = path.join(root, 'nested');
  const fixture = path.join(nested, 'dense.mdx');

  try {
    await mkdir(nested);
    await writeFile(fixture, `${'这是很长的正文内容'.repeat(30)}。\n`);

    const result = spawnSync(process.execPath, [analyzerScript, root], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`${fixture}:1 \\[long-sentence\\]`));
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('CLI reports warnings for a single MDX file without failing', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'case-writing-density-file-'));
  const fixture = path.join(root, 'dense.mdx');

  try {
    await writeFile(fixture, `${'这是很长的正文内容'.repeat(30)}。\n`);

    const result = spawnSync(process.execPath, [analyzerScript, fixture], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`${fixture}:1 \\[long-sentence\\]`));
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('CLI exits non-zero for a missing path', () => {
  const missingPath = path.join(tmpdir(), `missing-density-${process.pid}.mdx`);
  const result = spawnSync(process.execPath, [analyzerScript, missingPath], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing-density/);
});

test(
  'CLI exits non-zero when a file becomes unreadable after stat',
  {skip: typeof process.getuid === 'function' && process.getuid() === 0},
  async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'case-writing-density-unreadable-'));
    const fixture = path.join(root, 'unreadable.mdx');

    try {
      await writeFile(fixture, '正文。\n');
      await chmod(fixture, 0o000);

      const result = spawnSync(process.execPath, [analyzerScript, fixture], {
        encoding: 'utf8',
      });

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /unreadable\.mdx/u);
    } finally {
      await chmod(fixture, 0o600);
      await rm(root, {recursive: true, force: true});
    }
  },
);
