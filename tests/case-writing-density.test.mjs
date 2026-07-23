import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
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

test('CLI exits non-zero for a missing path', () => {
  const missingPath = path.join(tmpdir(), `missing-density-${process.pid}.mdx`);
  const result = spawnSync(process.execPath, [analyzerScript, missingPath], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing-density/);
});
