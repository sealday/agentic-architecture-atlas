import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {loadContentReviewInputs} from './generate-content-platform.mjs';

const factualRoles = new Set([
  'definition',
  'method',
  'runtime-fact',
  'case-evidence',
  'implementation',
]);

function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function requireCalendarDate(value, label) {
  if (!isCalendarDate(value)) {
    throw new RangeError(`${label} must be a valid calendar date`);
  }
}

function compareText(left, right) {
  return left.localeCompare(right, 'en');
}

function isValidPolicyEntry(id, policy) {
  return (
    typeof id === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) &&
    !['__proto__', 'constructor', 'prototype'].includes(id) &&
    policy !== null &&
    typeof policy === 'object' &&
    !Array.isArray(policy) &&
    Object.keys(policy).sort().join('\0') === [
      'id',
      'label',
      'calendar_months',
      'warning_days',
      'description',
    ].sort().join('\0') &&
    policy.id === id &&
    typeof policy.label === 'string' &&
    policy.label.trim() !== '' &&
    Number.isInteger(policy.calendar_months) &&
    policy.calendar_months > 0 &&
    Number.isInteger(policy.warning_days) &&
    policy.warning_days >= 0 &&
    typeof policy.description === 'string' &&
    policy.description.trim() !== ''
  );
}

function dateToEpochDay(dateText) {
  const [year, month, day] = dateText.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function addCalendarMonths(dateText, months) {
  requireCalendarDate(dateText, 'date');
  if (!Number.isInteger(months)) {
    throw new TypeError('months must be an integer');
  }
  const [year, month, day] = dateText.split('-').map(Number);
  const targetMonthStart = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(
    targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  return new Date(Date.UTC(
    targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth(),
    Math.min(day, lastDay),
  )).toISOString().slice(0, 10);
}

function previousCompleteMonth(asOf) {
  const [year, month] = asOf.split('-').map(Number);
  const end = new Date(Date.UTC(year, month - 1, 1));
  const start = new Date(Date.UTC(year, month - 2, 1));
  return {
    start: start.toISOString().slice(0, 10),
    end_exclusive: end.toISOString().slice(0, 10),
  };
}

function inWindow(value, window) {
  return (
    isCalendarDate(value) &&
    value >= window.start &&
    value < window.end_exclusive
  );
}

function documentSourceDetails(citations, sourceById) {
  const ids = [...new Set(citations.map(({source_id: sourceId}) => sourceId))]
    .sort(compareText);
  return ids.map((id) => {
    const source = sourceById.get(id);
    const roles = [...new Set(
      citations
        .filter(({source_id: sourceId}) => sourceId === id)
        .flatMap(({roles}) => Array.isArray(roles) ? roles : []),
    )].sort(compareText);
    return {
      id,
      roles,
      version: source?.version ?? null,
      checked_at: source?.checked_at ?? null,
      link_policy: source?.link_policy ?? null,
    };
  });
}

function dueDocument({
  document,
  ledgerDocument,
  policy,
  dueDate,
  sources,
  daysRemaining,
}) {
  return {
    slug: document.metadata.slug,
    policy: policy.id,
    analyzed_at: document.metadata.analyzed_at ?? null,
    source_cutoff: document.metadata.source_cutoff,
    ledger_reviewed_at: ledgerDocument?.reviewed_at ?? null,
    due_date: dueDate,
    ...(daysRemaining === undefined
      ? {reasons: ['interval-elapsed']}
      : {days_remaining: daysRemaining}),
    sources,
    minimum_manual_source_ids: sources
      .filter(({roles}) => roles.some((role) => factualRoles.has(role)))
      .map(({id}) => id),
  };
}

export function evaluateContentReviewHealth({
  documents,
  ledger,
  policyById,
  asOf,
}) {
  requireCalendarDate(asOf, 'asOf');
  const documentList = Array.isArray(documents) ? documents : [];
  const sources = Array.isArray(ledger?.sources) ? ledger.sources : [];
  const ledgerDocuments =
    ledger?.documents &&
    typeof ledger.documents === 'object' &&
    !Array.isArray(ledger.documents)
      ? ledger.documents
      : {};
  const policies = policyById instanceof Map ? policyById : new Map();
  const validPolicies = new Map();
  const errors = [];
  const warnings = [];
  const monthlyWindow = previousCompleteMonth(asOf);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const citedSourceIds = new Set();
  const citationsBySourceId = new Map();
  const dueDocuments = [];
  const approachingDueDocuments = [];
  let policyValidationFailed = !(policyById instanceof Map);

  if (!(policyById instanceof Map)) {
    errors.push('invalid-policy-definition: policyById must be a Map');
  }
  for (const [id, policy] of policies) {
    if (!isValidPolicyEntry(id, policy)) {
      policyValidationFailed = true;
      errors.push(
        `invalid-policy-definition: policy "${String(id)}" has an invalid shape`,
      );
      continue;
    }
    validPolicies.set(id, policy);
  }

  if (sources.length === 0 || documentList.length === 0) {
    errors.push(
      `inputs-non-empty: expected at least one source and one document; found ${sources.length} source(s) and ${documentList.length} document(s)`,
    );
  }

  for (const [ledgerPath, ledgerDocument] of Object.entries(ledgerDocuments)) {
    for (const citation of ledgerDocument.citations ?? []) {
      citedSourceIds.add(citation.source_id);
      let documentsByPath = citationsBySourceId.get(citation.source_id);
      if (!documentsByPath) {
        documentsByPath = new Map();
        citationsBySourceId.set(citation.source_id, documentsByPath);
      }
      let roles = documentsByPath.get(ledgerPath);
      if (!roles) {
        roles = new Set();
        documentsByPath.set(ledgerPath, roles);
      }
      for (const role of Array.isArray(citation.roles) ? citation.roles : []) {
        roles.add(role);
      }
    }
    if (!ledgerPath.startsWith('content/')) {
      errors.push(`${ledgerPath}: invalid-ledger-document-path`);
    }
  }

  for (const document of documentList) {
    const metadata = document?.metadata ?? {};
    const ledgerPath = `content/${document.file}`;
    const ledgerDocument = ledgerDocuments[ledgerPath];
    const citations = Array.isArray(ledgerDocument?.citations)
      ? ledgerDocument.citations
      : [];
    const sourceDetails = documentSourceDetails(citations, sourceById);

    for (const sourceDetail of sourceDetails) {
      if (
        sourceDetail.roles.some((role) => factualRoles.has(role)) &&
        (
          typeof sourceDetail.version !== 'string' ||
          sourceDetail.version.trim() === ''
        )
      ) {
        errors.push(
          `${ledgerPath}: source-version-missing: factual source "${sourceDetail.id}" is missing version`,
        );
      }
    }

    if (
      isCalendarDate(metadata.source_cutoff) &&
      isCalendarDate(ledgerDocument?.reviewed_at) &&
      ledgerDocument.reviewed_at < metadata.source_cutoff
    ) {
      errors.push(
        `${ledgerPath}: document-review-older-than-cutoff: reviewed_at ${ledgerDocument.reviewed_at} precedes source_cutoff ${metadata.source_cutoff}`,
      );
    }

    if (metadata.review_policy === undefined) {
      continue;
    }
    const policy = validPolicies.get(metadata.review_policy);
    if (!policy && !policies.has(metadata.review_policy)) {
      policyValidationFailed = true;
      errors.push(
        `${ledgerPath}: invalid-policy: review policy "${metadata.review_policy}" is not registered`,
      );
      continue;
    }
    if (!policy) {
      continue;
    }
    if (!isCalendarDate(metadata.source_cutoff)) {
      errors.push(
        `${ledgerPath}: invalid-source-cutoff: "${metadata.source_cutoff}" is not a valid calendar date`,
      );
      continue;
    }

    const dueDate = addCalendarMonths(
      metadata.source_cutoff,
      policy.calendar_months,
    );
    if (dueDate <= asOf) {
      dueDocuments.push(dueDocument({
        document,
        ledgerDocument,
        policy,
        dueDate,
        sources: sourceDetails,
      }));
      errors.push(
        `${ledgerPath}: interval-elapsed: quarterly review due since ${dueDate} (source_cutoff ${metadata.source_cutoff})`,
      );
      continue;
    }

    const daysRemaining = dateToEpochDay(dueDate) - dateToEpochDay(asOf);
    if (daysRemaining <= policy.warning_days) {
      approachingDueDocuments.push(dueDocument({
        document,
        ledgerDocument,
        policy,
        dueDate,
        sources: sourceDetails,
        daysRemaining,
      }));
      warnings.push(
        `${ledgerPath}: approaching due on ${dueDate} (${daysRemaining} day(s) remaining)`,
      );
    }
  }

  const bySlug = (left, right) =>
    compareText(left.slug, right.slug) ||
    compareText(left.policy, right.policy);
  dueDocuments.sort(bySlug);
  approachingDueDocuments.sort(bySlug);
  errors.sort(compareText);
  warnings.sort(compareText);
  const newSourceIds = sources
    .filter((source) => inWindow(source.registered_at, monthlyWindow))
    .map(({id}) => id)
    .sort(compareText);
  const newSources = newSourceIds.map((id) => {
    const citations = [...(citationsBySourceId.get(id) ?? new Map())]
      .map(([document, roles]) => ({
        document,
        roles: [...roles].sort(compareText),
      }))
      .sort((left, right) => compareText(left.document, right.document));
    return {
      id,
      citations,
      discovery_learning_only:
        citations.length > 0 &&
        citations.every(
          ({roles}) =>
            roles.length > 0 &&
            roles.every((role) => ['discovery', 'learning'].includes(role)),
        ),
    };
  });
  const recheckedSourceIds = sources
    .filter((source) => inWindow(source.checked_at, monthlyWindow))
    .map(({id}) => id)
    .sort(compareText);
  const orphanSourceIds = sources
    .map(({id}) => id)
    .filter((id) => !citedSourceIds.has(id))
    .sort(compareText);
  const inputsPassed = sources.length > 0 && documentList.length > 0;

  const report = {
    schema_version: 1,
    as_of: asOf,
    monthly_window: monthlyWindow,
    counts: {
      new_sources: newSourceIds.length,
      rechecked_sources: recheckedSourceIds.length,
      orphan_sources: orphanSourceIds.length,
      due_documents: dueDocuments.length,
      approaching_due_documents: approachingDueDocuments.length,
    },
    gates: {
      inputs_non_empty: inputsPassed ? 'passed' : 'failed',
      policy_validation: policyValidationFailed ? 'failed' : 'passed',
      review_health: errors.length === 0 ? 'passed' : 'failed',
    },
    new_source_ids: newSourceIds,
    new_sources: newSources,
    rechecked_source_ids: recheckedSourceIds,
    orphan_source_ids: orphanSourceIds,
    due_documents: dueDocuments,
    approaching_due_documents: approachingDueDocuments,
  };
  return {report, errors, warnings};
}

export function serializeReviewHealthJson(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function markdownList(values, format = (value) => `- ${value}`) {
  return values.length === 0 ? 'None.' : values.map(format).join('\n');
}

export function serializeReviewHealthMarkdown(report) {
  const gateRows = Object.entries(report.gates)
    .map(([name, value]) => `| ${name} | ${value} |`)
    .join('\n');
  const countRows = Object.entries(report.counts)
    .map(([name, value]) => `| ${name} | ${value} |`)
    .join('\n');
  const due = markdownList(
    report.due_documents,
    (document) =>
      `- \`${document.slug}\` — due ${document.due_date}; ${document.reasons.join(', ')}; sources: ${
        document.sources.map(({id}) => id).join(', ') || 'none'
      }`,
  );
  const approaching = markdownList(
    report.approaching_due_documents,
    (document) =>
      `- \`${document.slug}\` — due ${document.due_date}; ${document.days_remaining} day(s) remaining`,
  );
  const newSources = markdownList(
    report.new_sources,
    (source) => {
      const citations = source.citations.length === 0
        ? '  - No citations.'
        : source.citations.map(
          ({document, roles}) =>
            `  - \`${document}\` — roles: ${roles.join(', ') || 'none'}`,
        ).join('\n');
      return [
        `- \`${source.id}\` — Discovery/learning only: ${
          source.discovery_learning_only ? 'yes' : 'no'
        }`,
        citations,
      ].join('\n');
    },
  );
  return [
    '# Content review health',
    '',
    `As of: ${report.as_of}`,
    '',
    '## Counts and gates',
    '',
    '| Count | Value |',
    '| --- | ---: |',
    countRows,
    '',
    '| Gate | Status |',
    '| --- | --- |',
    gateRows,
    '',
    '## Monthly source review',
    '',
    `Window: ${report.monthly_window.start} to ${report.monthly_window.end_exclusive} (exclusive)`,
    '',
    '### Newly registered',
    '',
    newSources,
    '',
    '### Rechecked',
    '',
    markdownList(report.rechecked_source_ids),
    '',
    '### Orphan sources',
    '',
    markdownList(report.orphan_source_ids),
    '',
    '## Quarterly due documents',
    '',
    due,
    '',
    '## Approaching due',
    '',
    approaching,
    '',
  ].join('\n');
}

function usage() {
  return [
    'Usage:',
    '  node scripts/content-review-health.mjs --check [--as-of YYYY-MM-DD]',
    '  node scripts/content-review-health.mjs --report --as-of YYYY-MM-DD --json PATH --markdown PATH',
  ].join('\n');
}

function parseArgs(args) {
  const mode = args[0];
  if (mode !== '--check' && mode !== '--report') {
    throw new Error(usage());
  }
  const options = {
    mode,
    asOf: new Date().toISOString().slice(0, 10),
    hasExplicitAsOf: false,
    projectRoot: path.resolve(fileURLToPath(new URL('..', import.meta.url))),
  };
  const seenFlags = new Set();
  for (let index = 1; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      value === undefined ||
      !['--as-of', '--json', '--markdown', '--project-root'].includes(flag)
    ) {
      throw new Error(usage());
    }
    if (seenFlags.has(flag)) {
      throw new Error(`Duplicate CLI option "${flag}"\n${usage()}`);
    }
    seenFlags.add(flag);
    if (flag === '--as-of') {
      options.asOf = value;
      options.hasExplicitAsOf = true;
    }
    if (flag === '--json') options.jsonPath = path.resolve(value);
    if (flag === '--markdown') options.markdownPath = path.resolve(value);
    if (flag === '--project-root') options.projectRoot = path.resolve(value);
  }
  if (
    mode === '--check' &&
    (options.jsonPath !== undefined || options.markdownPath !== undefined)
  ) {
    throw new Error(usage());
  }
  if (
    mode === '--report' &&
    (options.jsonPath === undefined || options.markdownPath === undefined)
  ) {
    throw new Error(usage());
  }
  if (mode === '--report' && !options.hasExplicitAsOf) {
    throw new Error(
      `--report requires an explicit --as-of YYYY-MM-DD\n${usage()}`,
    );
  }
  return options;
}

async function writeReport(pathname, contents) {
  await mkdir(path.dirname(pathname), {recursive: true});
  await writeFile(pathname, contents);
}

export async function runContentReviewHealthCli(args) {
  const options = parseArgs(args);
  const inputs = await loadContentReviewInputs(options.projectRoot);
  const evaluated = evaluateContentReviewHealth({
    documents: inputs.documents,
    ledger: inputs.ledger,
    policyById: inputs.policyById,
    asOf: options.asOf,
  });
  const errors = [...inputs.errors, ...evaluated.errors].sort(compareText);
  if (inputs.errors.length > 0) {
    evaluated.report.gates.review_health = 'failed';
    if (
      inputs.errors.some((error) => error.includes('review-policies.json'))
    ) {
      evaluated.report.gates.policy_validation = 'failed';
    }
  }

  if (options.mode === '--report') {
    await Promise.all([
      writeReport(
        options.jsonPath,
        serializeReviewHealthJson(evaluated.report),
      ),
      writeReport(
        options.markdownPath,
        serializeReviewHealthMarkdown(evaluated.report),
      ),
    ]);
  }
  for (const warning of evaluated.warnings) {
    console.warn(warning);
  }
  if (errors.length > 0) {
    console.error(errors.join('\n'));
    return 1;
  }
  if (options.mode === '--check') {
    console.log(
      `Content review health passed for ${inputs.documents.length} document(s) and ${inputs.ledger.sources.length} source(s).`,
    );
  }
  return 0;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.exitCode = await runContentReviewHealthCli(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
