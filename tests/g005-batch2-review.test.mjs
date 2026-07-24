import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {findMarkdownHeadings} from '../scripts/content-metadata.mjs';

const reviewFile = new URL('../docs/reviews/g005-batch2.md', import.meta.url);
const topicRoutes = new Map([
  ['FND-04', '/concepts/fnd-04'],
  ['FND-05', '/concepts/fnd-05'],
  ['MTH-01', '/methods/mth-01'],
  ['MTH-02', '/methods/mth-02'],
  ['MTH-03', '/methods/mth-03'],
]);
const requiredRoutes = [
  ...topicRoutes.values(),
  '/paths/architecture-thinking',
  '/references',
  '/references/primary/page/18',
];

async function readRequiredReview() {
  try {
    return await readFile(reviewFile, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      assert.fail(`Missing G005 Batch 2 review evidence: ${reviewFile.pathname}`);
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

test('requires a non-empty G005 Batch 2 review record', async () => {
  const review = await readRequiredReview();
  assert.match(review, /\S/u);
});

test('records visible editorial fact copyright and render PASS per topic', async () => {
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

test('records both required viewports in every topic review', async () => {
  const review = visibleReview(await readRequiredReview());

  for (const id of topicRoutes.keys()) {
    const section = sectionForHeading(review, id);
    assert.match(section, /\bdesktop\s+1440x1000\b/iu, `${id} needs desktop`);
    assert.match(section, /\bmobile\s+390x844\b/iu, `${id} needs mobile`);
  }
});

test('covers every Batch 2 topic path and source-ledger route', async () => {
  const routes = routeTokens(visibleReview(await readRequiredReview()));

  for (const route of requiredRoutes) {
    assert.ok(routes.has(route), `Review evidence must cover ${route}`);
  }
});

test('records visible interaction overflow and console checks', async () => {
  const review = visibleReview(await readRequiredReview());

  assert.match(
    review,
    /(?:^|\n)[^\n]*(?:interaction|交互)[^\n]*\bPASS\b/iu,
    'Review evidence must record interaction PASS',
  );
  assert.match(
    review,
    /(?:^|\n)[^\n]*overflow[^\n]*\bPASS\b|(?:^|\n)[^\n]*\bPASS\b[^\n]*overflow/iu,
    'Review evidence must record overflow PASS',
  );
  assert.match(
    review,
    /(?:^|\n)[^\n]*console[^\n]*\bPASS\b|(?:^|\n)[^\n]*\bPASS\b[^\n]*console/iu,
    'Review evidence must record console PASS',
  );
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

test('identifies implementation HEAD 15afc9d in visible evidence', async () => {
  const review = visibleReview(await readRequiredReview());
  assert.match(
    review,
    /\bimplementation\s+HEAD\b[^0-9a-f]{0,20}\b15afc9d\b/iu,
  );
});
