import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {extractMarkdownBody} from '../scripts/content-metadata.mjs';
import {requiredCaseSlugs} from '../scripts/content-schema.mjs';

const learningPathFile = fileURLToPath(
  new URL('../content/paths/index.mdx', import.meta.url),
);
const homepageFile = fileURLToPath(
  new URL('../src/pages/index.tsx', import.meta.url),
);
const caseIndexFile = fileURLToPath(
  new URL('../content/cases/index.mdx', import.meta.url),
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

const branchHeadings = [
  '### 云原生与平台',
  '### 协作状态与前端架构',
  '### 边缘与物理智能体',
  '### Agent 平台与模型网关',
];

const externalAnchors = [
  'https://github.com/mehdihadeli/awesome-software-architecture',
  'https://github.com/donnemartin/system-design-primer',
  'https://roadmap.sh/software-architect',
  'https://c4model.com/',
  'https://arc42.org/',
  'https://sre.google/workbook/table-of-contents/',
  'https://github.com/cncf/curriculum',
  'https://kubernetes.io/docs/tutorials/kubernetes-basics/',
];

function markdownExternalLinks(source) {
  return [...source.matchAll(/\[[^\]]+\]\((https:\/\/[^)\s]+)\)/g)].map(
    ([, href]) => href,
  );
}

function toChineseNumber(value) {
  const digits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (value < 10) {
    return digits[value];
  }

  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return `${tens === 1 ? '' : digits[tens]}十${digits[ones]}`;
}

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
    let previousOffset = -1;
    for (const field of stageFields) {
      assert.match(stage, new RegExp(field.replaceAll('*', '\\*')));
      const offset = stage.indexOf(field);
      assert.ok(offset > previousOffset, `${field} is out of order in ${heading}`);
      previousOffset = offset;
    }
    for (const label of ['必读起点', '查漏补缺', '深入拓展']) {
      assert.match(stage, new RegExp(`\\*\\*${label}\\*\\*`));
    }
  }
});

test('labels external resources and links every canonical case', async () => {
  const source = await readFile(learningPathFile, 'utf8');
  const body = extractMarkdownBody(source);
  const externalLinks = markdownExternalLinks(body);

  for (const label of ['必读起点', '查漏补缺', '深入拓展']) {
    assert.match(body, new RegExp(`\\*\\*${label}\\*\\*`));
  }
  for (const anchor of externalAnchors) {
    assert.ok(
      externalLinks.some((href) => href.startsWith(anchor)),
      `Missing clickable external resource: ${anchor}`,
    );
  }
  for (const slug of requiredCaseSlugs) {
    assert.ok(body.includes(`](${slug})`), `Missing canonical case: ${slug}`);
  }
});

test('provides four optional branches with external starting points', async () => {
  const body = extractMarkdownBody(await readFile(learningPathFile, 'utf8'));

  for (const [index, heading] of branchHeadings.entries()) {
    const start = body.indexOf(heading);
    const end =
      index === branchHeadings.length - 1
        ? body.indexOf('## 如何把阅读变成架构能力', start)
        : body.indexOf(branchHeadings[index + 1], start);

    assert.notEqual(start, -1, `Missing branch heading: ${heading}`);
    assert.ok(end > start, `Branch has no bounded body: ${heading}`);
    assert.ok(
      markdownExternalLinks(body.slice(start, end)).length > 0,
      `Branch has no external starting point: ${heading}`,
    );
  }
});

test('describes one staged roadmap and the current catalog size', async () => {
  const [homepage, caseIndex] = await Promise.all([
    readFile(homepageFile, 'utf8'),
    readFile(caseIndexFile, 'utf8'),
  ]);

  assert.match(homepage, /沿软件架构主干开始/);
  assert.doesNotMatch(homepage, /选择一条专题学习路径/);
  assert.match(homepage, new RegExp(`${requiredCaseSlugs.length} 个跨生态案例`));
  assert.match(
    caseIndex,
    new RegExp(`${toChineseNumber(requiredCaseSlugs.length)}篇中的首发五篇`),
  );
});
