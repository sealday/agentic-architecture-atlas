import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {requiredCaseSlugs} from '../scripts/content-schema.mjs';

const learningPathFile = fileURLToPath(
  new URL('../content/paths/index.mdx', import.meta.url),
);
const homepageFile = fileURLToPath(
  new URL('../src/pages/index.tsx', import.meta.url),
);

const stageHeadings = [
  '## 第一阶段：架构思维与表达',
  '## 第二阶段：模块边界与应用架构',
  '## 第三阶段：分布式系统基础',
  '## 第四阶段：可靠性与状态管理',
  '## 第五阶段：扩展、隔离与生产治理',
  '## 第六阶段：Agentic 架构专项',
];

const stageFields = [
  '**为什么学**',
  '**掌握这些问题**',
  '**外部补充**',
  '**用本站案例深化**',
  '**检查点**',
  '**下一步**',
];

const externalAnchors = [
  'https://github.com/mehdihadeli/awesome-software-architecture',
  'https://github.com/donnemartin/system-design-primer',
  'https://c4model.com/',
  'https://arc42.org/',
  'https://sre.google/workbook/table-of-contents/',
  'https://github.com/cncf/curriculum',
  'https://kubernetes.io/docs/tutorials/kubernetes-basics/',
];

test('structures the architecture roadmap as six complete stages', async () => {
  const source = await readFile(learningPathFile, 'utf8');

  for (const [index, heading] of stageHeadings.entries()) {
    const start = source.indexOf(heading);
    const end =
      index === stageHeadings.length - 1
        ? source.indexOf('## 专题分支', start)
        : source.indexOf(stageHeadings[index + 1], start);

    assert.notEqual(start, -1, `Missing stage heading: ${heading}`);
    assert.ok(end > start, `Stage has no bounded body: ${heading}`);

    const stage = source.slice(start, end);
    for (const field of stageFields) {
      assert.match(stage, new RegExp(field.replaceAll('*', '\\*')));
    }
  }
});

test('labels external resources and links every canonical case', async () => {
  const source = await readFile(learningPathFile, 'utf8');

  for (const label of ['必读起点', '查漏补缺', '深入拓展']) {
    assert.match(source, new RegExp(`\\*\\*${label}\\*\\*`));
  }
  for (const anchor of externalAnchors) {
    assert.ok(source.includes(anchor), `Missing external resource: ${anchor}`);
  }
  for (const slug of requiredCaseSlugs) {
    assert.ok(source.includes(`](${slug})`), `Missing canonical case: ${slug}`);
  }
});

test('describes the homepage entry as one staged roadmap', async () => {
  const source = await readFile(homepageFile, 'utf8');

  assert.match(source, /沿软件架构主干开始/);
  assert.doesNotMatch(source, /选择一条专题学习路径/);
});
