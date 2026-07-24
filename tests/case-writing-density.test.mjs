import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmod, mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
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

test('reports duplicate evidence summaries and consecutive evidence labels', () => {
  const source = `**已证实事实**：第一条机制说明。

**已证实事实**：第二条机制说明。

<details className="evidence-card">
  <summary>证据：固定版本</summary>

  - **版本：** \`v1.2.3\`
</details>

<details className="evidence-card">
  <summary>证据：固定版本</summary>

  - **源码：** \`src/runtime.ts\`
</details>
`;

  const result = analyzeCaseText(source);
  assert.equal(
    result.warnings.filter(({kind}) => kind === 'repeated-evidence-label').length,
    1,
  );
  assert.equal(
    result.warnings.filter(({kind}) => kind === 'duplicate-evidence-summary').length,
    1,
  );
});

test('reports scenario sections that omit an illustrative label', () => {
  const source = `## 控制权与任务流

一个请求进入执行器，失败后由另一个执行器接管。

## 生产化分析

生产环境还要检查恢复结果。
`;

  const result = analyzeCaseText(source);
  assert.deepEqual(
    result.warnings
      .filter(({kind}) => kind === 'missing-illustrative-label')
      .map(({line}) => line),
    [1],
  );
});

test('accepts a labeled illustrative exercise in scenario sections', () => {
  const source = `## 控制权与任务流

**说明性演练**：一个请求进入执行器，失败后由另一个执行器接管。

## 生产化分析

生产环境还要检查恢复结果。
`;

  const result = analyzeCaseText(source);
  assert.equal(
    result.warnings.filter(({kind}) => kind === 'missing-illustrative-label').length,
    0,
  );
});

test('reports evidence cards that state only a conclusion without an anchor', () => {
  const source = `<details className="evidence-card">
  <summary>证据：恢复边界</summary>

  - **结论：** 这说明系统可以恢复，但不能证明业务效果只发生一次。
</details>
`;

  const result = analyzeCaseText(source);
  assert.equal(
    result.warnings.filter(({kind}) => kind === 'unanchored-evidence-card').length,
    1,
  );
});

test('reports inline identifier density with a configurable limit', () => {
  const source =
    '这一段依次引入 `tenant_id`、`run_id`、`operation_id` 和 `policy_version` 来解释调用合同。';

  const defaultResult = analyzeCaseText(source);
  assert.equal(
    defaultResult.warnings.filter(({kind}) => kind === 'identifier-density').length,
    1,
  );

  const relaxedResult = analyzeCaseText(source, {identifierLimit: 4});
  assert.equal(
    relaxedResult.warnings.filter(({kind}) => kind === 'identifier-density').length,
    0,
  );
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

test('functional boundaries interrupt consecutive dense prose runs', () => {
  const boundaries = [
    '## 新的控制问题',
    '- 一个列表项',
    '```text\ncode boundary\n```',
    '| 列 | 值 |\n| --- | --- |\n| 表格 | 边界 |',
    `<details className="evidence-card">
  <summary>证据：固定版本</summary>

  - **版本：** \`v1.2.3\`
</details>`,
  ];

  for (const boundary of boundaries) {
    const source = [
      '第一个叙事段落包含足够多的文字来超过限制。',
      '',
      boundary,
      '',
      '第二个叙事段落同样包含足够多的文字来超过限制。',
    ].join('\n');
    const result = analyzeCaseText(source, {
      paragraphLimit: 10,
      consecutiveDenseLimit: 2,
    });

    assert.equal(
      result.warnings.filter(({kind}) => kind === 'dense-run').length,
      0,
      `boundary must break a dense run: ${boundary.split('\n')[0]}`,
    );
  }
});

test('scores the Microsoft-like visual mix at 81 and warns below the completion gate', () => {
  const source = [
    '正文'.repeat(2465),
    '',
    '![架构总览](/img/illustrations/microsoft-reference.png)',
    '',
    '```mermaid',
    'flowchart LR',
    '  A --> B',
    '```',
    '',
    '```mermaid',
    'stateDiagram-v2',
    '  Ready --> Running',
    '```',
    '',
    '```ts',
    'const first = true;',
    '```',
    '',
    '```json',
    '{"second": true}',
    '```',
    '',
    '| 维度 | 结论 |',
    '| --- | --- |',
    '| 控制 | 集中 |',
    '',
    '名称 | 取舍',
    '--- | ---',
    '恢复 | 有界',
  ].join('\n');

  const result = analyzeCaseText(source);

  assert.deepEqual(result.visualBalance, {
    eligibleProseCharacters: 4930,
    rasterCount: 1,
    mermaidCount: 2,
    tableCount: 2,
    codeCount: 2,
    visualUnits: 8,
    targetVisualUnits: 9.86,
    score: 81,
  });
  assert.equal(
    result.warnings.some(({kind}) => kind === 'low-visual-balance'),
    true,
  );
});

test('applies the exact visual-form weights', () => {
  const result = analyzeCaseText(`正文。

![总览](overview.webp?width=1200)

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`

\`\`\`ts
const value = 1;
\`\`\`

| 维度 | 结论 |
| --- | --- |
| 控制 | 集中 |
`);

  assert.equal(result.visualBalance.rasterCount, 1);
  assert.equal(result.visualBalance.mermaidCount, 1);
  assert.equal(result.visualBalance.tableCount, 1);
  assert.equal(result.visualBalance.codeCount, 1);
  assert.equal(result.visualBalance.visualUnits, 5.5);
  assert.equal(result.visualBalance.targetVisualUnits, 2);
  assert.equal(result.visualBalance.score, 100);
});

test('requires a visual-balance score strictly greater than the threshold', () => {
  const score90 = analyzeCaseText(
    `${'文'.repeat(1667)}

![总览](overview.png)
`,
  );
  assert.equal(score90.visualBalance.score, 90);
  assert.equal(
    score90.warnings.some(({kind}) => kind === 'low-visual-balance'),
    true,
  );

  const score91 = analyzeCaseText(
    `${'文'.repeat(1649)}

![总览](overview.jpg)
`,
  );
  assert.equal(score91.visualBalance.score, 91);
  assert.equal(
    score91.warnings.some(({kind}) => kind === 'low-visual-balance'),
    false,
  );

  const raisedThreshold = analyzeCaseText(
    `${'文'.repeat(1649)}

![总览](overview.jpeg)
`,
    {visualBalanceThreshold: 91},
  );
  assert.equal(
    raisedThreshold.warnings.some(({kind}) => kind === 'low-visual-balance'),
    true,
  );
});

test('warns long all-text cases but exempts pages below the prose floor', () => {
  const longResult = analyzeCaseText('文'.repeat(800));
  assert.deepEqual(
    longResult.warnings
      .filter(({kind}) =>
        ['missing-visual-content', 'low-visual-balance'].includes(kind),
      )
      .map(({kind}) => kind),
    ['missing-visual-content', 'low-visual-balance'],
  );

  const shortResult = analyzeCaseText('文'.repeat(799));
  assert.equal(
    shortResult.warnings.some(({kind}) =>
      ['missing-visual-content', 'low-visual-balance'].includes(kind),
    ),
    false,
  );

  const customFloor = analyzeCaseText('文'.repeat(799), {
    visualMinimumProseCharacters: 799,
  });
  assert.equal(
    customFloor.warnings.some(({kind}) => kind === 'missing-visual-content'),
    true,
  );
});

test('does not credit raster images in excluded content', () => {
  const source = `---
hero: "![front matter](front.png)"
---

\`\`\`md
![code](code.jpg)
\`\`\`

| 位置 | 图片 |
| --- | --- |
| 表格 | ![table](table.jpeg) |

<details className="evidence-card">
  <summary>证据：插图路径</summary>

  - **路径：** \`![evidence](evidence.webp)\`
</details>
`;

  assert.equal(analyzeCaseText(source).visualBalance.rasterCount, 0);
});

test('documents identifier density and functional reporter boundaries', async () => {
  const skillRoot = new URL(
    '../.codex/skills/writing-architecture-cases/',
    import.meta.url,
  );
  const sources = await Promise.all([
    readFile(new URL('SKILL.md', skillRoot), 'utf8'),
    readFile(new URL('references/article-contract.md', skillRoot), 'utf8'),
    readFile(new URL('references/review-checklist.md', skillRoot), 'utf8'),
  ]);
  const guidance = sources.join('\n');

  assert.match(guidance, /identifier-density/u);
  assert.match(guidance, /duplicate-evidence-summary/u);
  assert.match(guidance, /repeated-evidence-label/u);
  assert.match(guidance, /missing-illustrative-label/u);
  assert.match(guidance, /unanchored-evidence-card/u);
  assert.match(guidance, /visual-balance/u);
  assert.match(guidance, /missing-visual-content/u);
  assert.match(guidance, /low-visual-balance/u);
  assert.match(guidance, /3\.0[\s\S]*1\.5[\s\S]*0\.75[\s\S]*0\.25/u);
  assert.match(guidance, /(?:strictly greater than|严格大于|>)\s*90/u);
  assert.match(guidance, /decorative filler|装饰性填充/u);
  assert.match(
    guidance,
    /heading、table、code、list 与 evidence card.*中断.*dense-run/u,
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
