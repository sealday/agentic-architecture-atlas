import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {findMarkdownHeadings} from '../scripts/content-metadata.mjs';

const reviewFile = new URL('../docs/reviews/g005-batch3.md', import.meta.url);
const topicRoutes = new Map([
  ['MTH-04', '/methods/mth-04'],
  ['MTH-05', '/methods/mth-05'],
  ['MTH-06', '/methods/mth-06'],
]);
const finalPrimaryRoute = '/references/primary/page/18';
const requiredRoutes = [
  ...topicRoutes.values(),
  '/paths/architecture-thinking',
  '/methods',
  '/references',
  finalPrimaryRoute,
];

async function readRequiredReview() {
  try {
    return await readFile(reviewFile, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      assert.fail(`Missing G005 Batch 3 review evidence: ${reviewFile.pathname}`);
    }
    throw error;
  }
}

function visibleReview(source) {
  return source.replace(/<!--[\s\S]*?-->/gu, '');
}

function sectionForHeading(source, headingText) {
  const headings = findMarkdownHeadings(source).filter(({level}) => level === 2);
  const index = headings.findIndex(({text}) => text === headingText);
  assert.notEqual(index, -1, `Missing real heading: ## ${headingText}`);
  const start = source.indexOf('\n', headings[index].offset);
  const end = headings[index + 1]?.offset ?? source.length;
  return source.slice(start === -1 ? end : start + 1, end);
}

function routeTokens(source) {
  return new Set(source.match(/\/[a-z0-9][a-z0-9/-]*/giu) ?? []);
}

test('requires a non-empty G005 Batch 3 review record', async () => {
  const review = await readRequiredReview();
  assert.match(review, /\S/u);
});

test('records visible editorial fact copyright and render PASS per method', async () => {
  const review = visibleReview(await readRequiredReview());

  for (const id of topicRoutes.keys()) {
    const section = sectionForHeading(review, id);
    for (const gate of ['editorial', 'fact', 'copyright', 'render']) {
      assert.match(
        section,
        new RegExp(`(?:^|\\n)[^\\n]*${gate}[^\\n]*\\bPASS\\b`, 'iu'),
        `${id} must record visible ${gate} PASS`,
      );
    }
  }
});

test('records both required viewports in every method review', async () => {
  const review = visibleReview(await readRequiredReview());

  for (const id of topicRoutes.keys()) {
    const section = sectionForHeading(review, id);
    assert.match(section, /\bdesktop\s+1440x1000\b/iu, `${id} needs desktop`);
    assert.match(section, /\bmobile\s+390x844\b/iu, `${id} needs mobile`);
  }
});

test('covers every Batch 3 method path and reference route', async () => {
  const routes = routeTokens(visibleReview(await readRequiredReview()));

  for (const route of requiredRoutes) {
    assert.ok(routes.has(route), `Review evidence must cover ${route}`);
  }
});

test('records the MTH-06 feedback loop and MTH-05 matrix as visible', async () => {
  const review = visibleReview(await readRequiredReview());
  assert.match(
    sectionForHeading(review, 'MTH-06'),
    /反馈环[^。\n]{0,40}(?:可见|正常)|(?:可见|正常)[^。\n]{0,40}反馈环/u,
    'MTH-06 review must confirm the feedback loop is visible',
  );
  assert.match(
    sectionForHeading(review, 'MTH-05'),
    /(?:表格|矩阵)[^。\n]{0,40}(?:可见|正常)|(?:可见|正常)[^。\n]{0,40}(?:表格|矩阵)/u,
    'MTH-05 review must confirm the comparison table is visible',
  );
});

test('records path-to-MTH-06 and reference pagination interactions', async () => {
  const review = visibleReview(await readRequiredReview());
  const interactionLines = review
    .split(/\r?\n/)
    .filter((line) => /(?:interaction|交互)[^\n]*\bPASS\b/iu.test(line));

  assert.ok(
    interactionLines.some(
      (line) =>
        line.includes('/paths/architecture-thinking') &&
        line.includes('/methods/mth-06'),
    ),
    'Interaction PASS must follow the path to MTH-06',
  );
  assert.ok(
    interactionLines.some(
      (line) =>
        line.includes('/references') && line.includes(finalPrimaryRoute),
    ),
    `Interaction PASS must cover pagination to ${finalPrimaryRoute}`,
  );
});

test('records visible overflow console and internal-link checks', async () => {
  const review = visibleReview(await readRequiredReview());
  for (const [label, pattern] of [
    ['overflow', /overflow/iu],
    ['console', /console/iu],
    ['internal links', /internal[- ]?links?|内部链接/iu],
  ]) {
    assert.ok(
      review
        .split(/\r?\n/)
        .some((line) => pattern.test(line) && /\bPASS\b/iu.test(line)),
      `Review evidence must record visible ${label} PASS`,
    );
  }
});

test('rejects hidden PASS pending language and backslash compatibility markers', async () => {
  const review = await readRequiredReview();
  const visible = visibleReview(review);

  assert.doesNotMatch(
    review,
    /<!--[\s\S]*?\bPASS\b[\s\S]*?-->/iu,
    'Review PASS evidence must not be hidden in HTML comments',
  );
  assert.doesNotMatch(
    review,
    /\\(?:n|b)/u,
    'Review evidence must not contain backslash compatibility markers',
  );
  assert.doesNotMatch(
    visible,
    /\bpending\b|(?:仍需|尚待|待|后续|随后)[^，。；\n]{0,40}复核|复核[^，。；\n]{0,20}(?:待完成|未完成)/iu,
    'Final review evidence must not retain pending language',
  );
});

test('identifies implementation HEAD ac1c1f8 in visible evidence', async () => {
  const review = visibleReview(await readRequiredReview());
  assert.match(
    review,
    /\bimplementation\s+HEAD\b[^0-9a-f]{0,20}\bac1c1f8\b/iu,
  );
});
