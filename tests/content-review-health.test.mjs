import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  addCalendarMonths,
  evaluateContentReviewHealth,
  serializeReviewHealthJson,
  serializeReviewHealthMarkdown,
} from '../scripts/content-review-health.mjs';
import {loadContentReviewInputs} from '../scripts/generate-content-platform.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const cli = path.join(projectRoot, 'scripts/content-review-health.mjs');

const policyById = new Map([
  ['quarterly-version-sensitive', {
    id: 'quarterly-version-sensitive',
    label: '季度版本敏感复核',
    calendar_months: 3,
    warning_days: 30,
    description: '季度复核',
  }],
]);

function source(overrides = {}) {
  return {
    id: 'src-floating',
    registered_at: '2026-07-24',
    checked_at: '2026-07-24',
    version: 'Current page checked on 2026-07-24',
    link_policy: 'floating',
    ...overrides,
  };
}

function citation(sourceId = 'src-floating', roles = ['runtime-fact']) {
  return {
    source_id: sourceId,
    roles,
  };
}

function fixture(overrides = {}) {
  const ledger = {
    schema_version: 1,
    sources: [source()],
    documents: {
      'content/cases/example.mdx': {
        reviewed_at: '2026-07-24',
        copyright_checks: [],
        citations: [citation()],
      },
    },
  };
  const documents = [{
    file: 'cases/example.mdx',
    metadata: {
      slug: '/cases/example',
      content_type: 'case',
      analyzed_at: '2026-07-24',
      source_cutoff: '2026-07-24',
      review_policy: 'quarterly-version-sensitive',
    },
  }];
  return {documents, ledger, policyById, asOf: '2026-08-01', ...overrides};
}

test('adds calendar months with UTC month-end clamping', () => {
  assert.equal(addCalendarMonths('2026-01-31', 3), '2026-04-30');
  assert.equal(addCalendarMonths('2024-11-30', 3), '2025-02-28');
  assert.equal(addCalendarMonths('2024-02-29', 12), '2025-02-28');
  assert.throws(() => addCalendarMonths('2026-02-30', 3), /valid calendar date/);
});

test('marks quarterly content due only on the exact interval boundary', () => {
  const before = evaluateContentReviewHealth(fixture({asOf: '2026-10-23'}));
  assert.equal(before.errors.length, 0);
  assert.deepEqual(before.report.due_documents, []);

  const due = evaluateContentReviewHealth(fixture({asOf: '2026-10-24'}));
  assert.match(due.errors.join('\n'), /interval-elapsed/);
  assert.deepEqual(due.report.due_documents.map(({slug, due_date, reasons}) => ({
    slug,
    due_date,
    reasons,
  })), [{
    slug: '/cases/example',
    due_date: '2026-10-24',
    reasons: ['interval-elapsed'],
  }]);
});

test('separates the previous complete month registered and rechecked lists', () => {
  const result = evaluateContentReviewHealth(fixture());
  assert.deepEqual(result.report.monthly_window, {
    start: '2026-07-01',
    end_exclusive: '2026-08-01',
  });
  assert.deepEqual(result.report.new_source_ids, ['src-floating']);
  assert.deepEqual(result.report.rechecked_source_ids, ['src-floating']);
});

test('does not infer due from checked_at or link_policy', () => {
  const changed = fixture({asOf: '2026-09-01'});
  changed.ledger.sources[0].checked_at = '2026-08-15';
  changed.ledger.sources[0].link_policy = 'floating';
  const result = evaluateContentReviewHealth(changed);
  assert.deepEqual(result.report.due_documents, []);
  assert.doesNotMatch(
    result.errors.join('\n'),
    /version change|floating-source-newer/,
  );
});

test('reports factual missing versions and old document reviews independently', () => {
  const input = fixture();
  input.ledger.sources[0].version = '   ';
  input.ledger.documents['content/cases/example.mdx'].reviewed_at = '2026-07-23';
  const result = evaluateContentReviewHealth(input);
  assert.match(result.errors.join('\n'), /source-version-missing/);
  assert.match(result.errors.join('\n'), /document-review-older-than-cutoff/);
  assert.doesNotMatch(result.errors.join('\n'), /interval-elapsed/);
});

test('reports warning_days without failing review health', () => {
  const result = evaluateContentReviewHealth(fixture({asOf: '2026-09-24'}));
  assert.equal(result.errors.length, 0);
  assert.match(result.warnings.join('\n'), /approaching due/);
  assert.deepEqual(
    result.report.approaching_due_documents.map(({slug, days_remaining}) => ({
      slug,
      days_remaining,
    })),
    [{slug: '/cases/example', days_remaining: 30}],
  );
  assert.equal(result.report.gates.review_health, 'passed');
});

test('reports orphans and sorts all identities and due sources stably', () => {
  const input = fixture({asOf: '2026-10-24'});
  input.ledger.sources.unshift(
    source({id: 'src-z', registered_at: '2026-06-01', checked_at: '2026-06-01'}),
    source({id: 'src-a', registered_at: '2026-06-01', checked_at: '2026-06-01'}),
  );
  input.ledger.documents['content/cases/example.mdx'].citations.unshift(
    citation('src-z', ['learning']),
  );
  const result = evaluateContentReviewHealth(input);
  assert.deepEqual(result.report.orphan_source_ids, ['src-a']);
  assert.deepEqual(
    result.report.due_documents[0].sources.map(({id}) => id),
    ['src-floating', 'src-z'],
  );
});

test('rejects invalid dates, policies, and empty canonical inputs', () => {
  assert.throws(
    () => evaluateContentReviewHealth(fixture({asOf: '2026-02-30'})),
    /asOf must be a valid calendar date/,
  );

  const unknown = fixture();
  unknown.documents[0].metadata.review_policy = 'unknown-policy';
  const invalid = evaluateContentReviewHealth(unknown);
  assert.match(invalid.errors.join('\n'), /invalid-policy/);
  assert.equal(invalid.report.gates.policy_validation, 'failed');

  const empty = evaluateContentReviewHealth(fixture({
    documents: [],
    ledger: {schema_version: 1, sources: [], documents: {}},
  }));
  assert.match(empty.errors.join('\n'), /inputs-non-empty/);
  assert.equal(empty.report.gates.inputs_non_empty, 'failed');
});

test('serializes deterministic JSON and complete Markdown sections', () => {
  const report = evaluateContentReviewHealth(fixture()).report;
  const json = serializeReviewHealthJson(report);
  assert.equal(json, serializeReviewHealthJson(report));
  assert.equal(JSON.parse(json).schema_version, 1);

  const markdown = serializeReviewHealthMarkdown(report);
  for (const heading of [
    '# Content review health',
    '## Counts and gates',
    '## Monthly source review',
    '## Quarterly due documents',
    '## Approaching due',
  ]) {
    assert.match(markdown, new RegExp(heading));
  }
  assert.match(markdown, /None\./);
});

test('loads non-empty canonical review inputs through generator plumbing', async () => {
  const inputs = await loadContentReviewInputs(projectRoot);
  assert.deepEqual(inputs.errors, []);
  assert.equal(inputs.documents.length, 46);
  assert.equal(inputs.ledger.sources.length, 363);
  assert.equal(
    inputs.policyById.get('quarterly-version-sensitive')?.calendar_months,
    3,
  );
});

test('real report CLI writes failure evidence before exiting one', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'review-health-cli-'));
  try {
    await mkdir(path.join(root, 'content/cases'), {recursive: true});
    await mkdir(path.join(root, 'data'), {recursive: true});
    await writeFile(
      path.join(root, 'data/review-policies.json'),
      `${JSON.stringify({
        schema_version: 1,
        policies: [...policyById.values()],
      })}\n`,
    );
    await writeFile(
      path.join(root, 'data/source-ledger.json'),
      `${JSON.stringify(fixture({asOf: '2026-10-24'}).ledger)}\n`,
    );
    await writeFile(
      path.join(root, 'content/cases/example.mdx'),
      [
        '---',
        'title: Example',
        'slug: /cases/example',
        'content_type: case',
        'status: reviewed',
        'analyzed_at: 2026-07-24',
        'source_cutoff: 2026-07-24',
        'review_policy: quarterly-version-sensitive',
        '---',
        '',
        '# Example',
      ].join('\n'),
    );
    const jsonPath = path.join(root, 'report.json');
    const markdownPath = path.join(root, 'report.md');
    const result = spawnSync(process.execPath, [
      cli,
      '--report',
      '--project-root',
      root,
      '--as-of',
      '2026-10-24',
      '--json',
      jsonPath,
      '--markdown',
      markdownPath,
    ], {encoding: 'utf8'});

    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /interval-elapsed/);
    assert.equal(JSON.parse(await readFile(jsonPath, 'utf8')).counts.due_documents, 1);
    assert.match(await readFile(markdownPath, 'utf8'), /\/cases\/example/);

    await rm(path.join(root, 'data/source-ledger.json'));
    const missingJsonPath = path.join(root, 'missing-input-report.json');
    const missingMarkdownPath = path.join(root, 'missing-input-report.md');
    const missingInput = spawnSync(process.execPath, [
      cli,
      '--report',
      '--project-root',
      root,
      '--as-of',
      '2026-10-24',
      '--json',
      missingJsonPath,
      '--markdown',
      missingMarkdownPath,
    ], {encoding: 'utf8'});
    assert.equal(missingInput.status, 1);
    assert.match(missingInput.stderr, /source-ledger\.json/);
    assert.equal(
      JSON.parse(await readFile(missingJsonPath, 'utf8')).gates.inputs_non_empty,
      'failed',
    );
    assert.match(
      await readFile(missingMarkdownPath, 'utf8'),
      /inputs_non_empty \| failed/,
    );
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
