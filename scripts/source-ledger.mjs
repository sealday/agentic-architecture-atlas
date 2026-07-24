import {licenseFamilyIdentity} from './validate-source-license-inventory.mjs';

export const sourceKinds = [
  'standard',
  'paper',
  'official-docs',
  'official-repository',
  'source-code',
  'engineering-blog',
  'incident-report',
  'vendor-reference-architecture',
  'textbook',
  'independent-blog',
  'community-index',
  'original-illustration',
];

export const sourceTiers = ['primary', 'first-party', 'secondary', 'discovery'];

export const evidenceRoles = [
  'definition',
  'method',
  'runtime-fact',
  'case-evidence',
  'implementation',
  'historical-context',
  'comparison',
  'learning',
  'discovery',
  'illustration',
];

export const linkPolicies = ['stable', 'floating', 'auth-required', 'retired'];

export const approvedLicenses = [
  'Apache-2.0',
  'MIT',
  'BSD-3-Clause',
  'EPL-2.0',
  'MPL-2.0',
  'AGPL-3.0-only',
  'GPL-3.0-only',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'CC-BY-NC-ND-4.0',
  'CC0-1.0',
  'LicenseRef-CC-BY-NC-ND-Unversioned',
  'LicenseRef-MCP-Specification-Transition',
  'LicenseRef-New-API-Docs-License-Conflict',
  'LicenseRef-US-Gov-Public-Domain',
  'LicenseRef-All-Rights-Reserved',
  'LicenseRef-Proprietary-Standard',
  'LicenseRef-Atlas-Original',
];

export const requiredCopyrightChecks = [
  'original-structure',
  'quotation-boundary',
  'attribution-complete',
  'illustration-rights',
];

const copyrightPolicies = [
  'adapt-with-attribution',
  'adapt-sharealike-review',
  'public-domain-with-provenance',
  'facts-and-short-quotation',
  'vendor-claims-separated',
  'original-atlas',
];

const usageModes = [
  'facts-summary',
  'short-quotation',
  'adapted-text',
  'adapted-illustration',
  'original-illustration',
  'navigation-only',
];

const requiredPolicyByLicense = new Map([
  ['CC-BY-4.0', 'adapt-with-attribution'],
  ['CC-BY-SA-4.0', 'adapt-sharealike-review'],
  ['LicenseRef-US-Gov-Public-Domain', 'public-domain-with-provenance'],
  ['LicenseRef-All-Rights-Reserved', 'facts-and-short-quotation'],
  ['CC-BY-NC-ND-4.0', 'facts-and-short-quotation'],
  ['LicenseRef-Proprietary-Standard', 'facts-and-short-quotation'],
  ['LicenseRef-MCP-Specification-Transition', 'facts-and-short-quotation'],
  ['LicenseRef-CC-BY-NC-ND-Unversioned', 'facts-and-short-quotation'],
  ['LicenseRef-New-API-Docs-License-Conflict', 'facts-and-short-quotation'],
]);

const requiredPolicyByKind = new Map([
  ['vendor-reference-architecture', 'vendor-claims-separated'],
  ['original-illustration', 'original-atlas'],
]);

const adaptedModes = new Set(['adapted-text', 'adapted-illustration']);

const noAdaptLicenses = new Set([
  'Apache-2.0',
  'MIT',
  'BSD-3-Clause',
  'EPL-2.0',
  'MPL-2.0',
  'GPL-3.0-only',
  'AGPL-3.0-only',
  'CC-BY-NC-ND-4.0',
  'CC0-1.0',
  'LicenseRef-All-Rights-Reserved',
  'LicenseRef-Proprietary-Standard',
  'LicenseRef-MCP-Specification-Transition',
  'LicenseRef-CC-BY-NC-ND-Unversioned',
  'LicenseRef-New-API-Docs-License-Conflict',
]);

const explicitAdaptLicenses = new Set([
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'LicenseRef-US-Gov-Public-Domain',
  'LicenseRef-Atlas-Original',
]);

const sourceKeys = [
  'id',
  'canonical_locator',
  'transport_locator',
  'query_insensitive',
  'locator_aliases',
  'tombstone',
  'title',
  'author_or_org',
  'published_at',
  'registered_at',
  'checked_at',
  'version',
  'source_kind',
  'tier',
  'allowed_evidence_roles',
  'license',
  'license_scope',
  'license_evidence_url',
  'license_evidence_note',
  'license_family_id',
  'license_family_grouping',
  'family_grouping_evidence_url',
  'copyright_policy',
  'usage_boundary',
  'link_policy',
  'expected_final_transport_locator',
  'expected_final_approved_at',
  'expected_final_approval_note',
];

const aliasKeys = [
  'locator',
  'transport_locator',
  'expected_final_transport_locator',
  'expected_final_approved_at',
  'expected_final_approval_note',
  'superseded_at',
];

const tombstoneKeys = ['retired_at', 'replacement_source_id', 'reason'];
const documentKeys = ['reviewed_at', 'copyright_checks', 'citations'];
const citationKeys = [
  'source_id',
  'citation_url',
  'roles',
  'manifest_primary',
  'usage_mode',
  'attribution_note',
  'modification_note',
  'excerpt',
  'quotation_reviewed',
];

const factualRoles = new Set([
  'definition',
  'method',
  'runtime-fact',
  'case-evidence',
  'implementation',
]);
const factRequiredTypes = new Set(['case', 'principle', 'pattern']);

function emptyLedger() {
  return {schema_version: 1, sources: [], documents: {}};
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function validateExactKeys(value, expectedKeys, label, errors) {
  if (!isObject(value)) {
    errors.push(`${label}: expected an object`);
    return false;
  }
  const expected = new Set(expectedKeys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) {
      errors.push(`${label}: unknown field "${key}"`);
    }
  }
  for (const key of expectedKeys) {
    if (!Object.hasOwn(value, key)) {
      errors.push(`${label}: missing required field "${key}"`);
    }
  }
  return true;
}

function isHttps(value) {
  if (typeof value !== 'string' || !value.startsWith('https://')) {
    return false;
  }
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isLocalLocator(value) {
  return typeof value === 'string' && /^\/(?!\/)[^\s#?]+$/.test(value);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function validateEnum(value, allowed, label, errors) {
  if (!allowed.includes(value)) {
    errors.push(`${label}: invalid value "${value}"`);
  }
}

function validateStringArray(value, allowed, label, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${label}: must be a non-empty array`);
    return;
  }
  const seen = new Set();
  for (const item of value) {
    if (!allowed.includes(item)) {
      errors.push(`${label}: invalid value "${item}"`);
    }
    if (seen.has(item)) {
      errors.push(`${label}: duplicate value "${item}"`);
    }
    seen.add(item);
  }
}

export function canonicalizeTransportLocator(locator) {
  if (isLocalLocator(locator)) {
    return locator;
  }
  const url = new URL(locator);
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  if (
    (url.protocol === 'https:' && url.port === '443') ||
    (url.protocol === 'http:' && url.port === '80')
  ) {
    url.port = '';
  }
  url.hash = '';
  return url.href;
}

function transportForCitation(locator, queryInsensitive) {
  const transport = canonicalizeTransportLocator(locator);
  if (!queryInsensitive || isLocalLocator(transport)) {
    return transport;
  }
  const url = new URL(transport);
  url.search = '';
  return url.href;
}

export function citationMatchesSource(citationUrl, source) {
  if (!nonEmpty(citationUrl) || !isObject(source)) {
    return false;
  }
  let citationTransport;
  try {
    citationTransport = transportForCitation(citationUrl, source.query_insensitive === true);
  } catch {
    return false;
  }
  const transports = [
    source.transport_locator,
    ...(Array.isArray(source.locator_aliases)
      ? source.locator_aliases.map((alias) => alias?.transport_locator)
      : []),
  ];
  return transports.some((transport) => {
    try {
      return transportForCitation(transport, source.query_insensitive === true) === citationTransport;
    } catch {
      return false;
    }
  });
}

function validateLocatorPair(locator, transport, queryInsensitive, label, errors) {
  if (!isHttps(locator) && !isLocalLocator(locator)) {
    errors.push(`${label} locator must be HTTPS or an absolute local asset path`);
    return;
  }
  if (/[#]/.test(locator)) {
    errors.push(`${label} canonical_locator/locator must not contain a fragment`);
  }
  if (typeof transport !== 'string' || /#/.test(transport)) {
    errors.push(`${label} transport_locator must be a fragment-free string`);
    return;
  }
  let expected;
  try {
    expected = canonicalizeTransportLocator(locator);
    if (queryInsensitive && isHttps(expected)) {
      const url = new URL(expected);
      url.search = '';
      expected = url.href;
    }
  } catch {
    errors.push(`${label} locator is invalid`);
    return;
  }
  if (transport !== expected) {
    errors.push(
      `${label} transport_locator "${transport}" is inconsistent; expected "${expected}"`,
    );
  }
}

function validateAlias(alias, source, index, errors) {
  const label = `source "${source.id}" alias ${index + 1}`;
  if (!validateExactKeys(alias, aliasKeys, label, errors)) {
    return;
  }
  validateLocatorPair(
    alias.locator,
    alias.transport_locator,
    source.query_insensitive,
    label,
    errors,
  );
  validateExpectedFinalTransport(
    alias.expected_final_transport_locator,
    alias.transport_locator,
    label,
    errors,
  );
  if (!isCalendarDate(alias.expected_final_approved_at)) {
    errors.push(`${label}: expected-final approval date must be a valid calendar date`);
  }
  if (!nonEmpty(alias.expected_final_approval_note)) {
    errors.push(`${label}: expected-final approval note must be non-empty`);
  }
  if (!isCalendarDate(alias.superseded_at)) {
    errors.push(`${label}: superseded_at must be a valid calendar date`);
  }
}

function validateExpectedFinalTransport(expected, transport, label, errors) {
  if (!isHttps(transport)) {
    if (expected !== transport) {
      errors.push(
        `${label}: local expected-final transport must equal its transport`,
      );
    }
    return;
  }
  if (!isHttps(expected)) {
    errors.push(`${label}: expected-final transport must be HTTPS`);
    return;
  }
  try {
    if (canonicalizeTransportLocator(expected) !== expected) {
      errors.push(
        `${label}: expected-final transport must be canonical and omit fragments`,
      );
    }
  } catch {
    errors.push(`${label}: expected-final transport is invalid`);
  }
}

function validateTombstone(source, errors) {
  const label = `source "${source.id}" tombstone`;
  if (source.link_policy === 'retired') {
    if (!isObject(source.tombstone)) {
      errors.push(`source "${source.id}": retired source must have a tombstone`);
      return;
    }
  } else if (source.tombstone !== null) {
    errors.push(`source "${source.id}": active source must not carry a tombstone`);
    return;
  }
  if (!isObject(source.tombstone)) {
    return;
  }
  if (!validateExactKeys(source.tombstone, tombstoneKeys, label, errors)) {
    return;
  }
  if (!isCalendarDate(source.tombstone.retired_at)) {
    errors.push(`${label}: retired_at must be a valid calendar date`);
  }
  if (
    source.tombstone.replacement_source_id !== null &&
    !nonEmpty(source.tombstone.replacement_source_id)
  ) {
    errors.push(`${label}: replacement_source_id must be null or non-empty`);
  }
  if (!nonEmpty(source.tombstone.reason)) {
    errors.push(`${label}: reason must be non-empty`);
  }
}

function validateSource(source, index, errors) {
  const label = `source ${index + 1}${nonEmpty(source?.id) ? ` "${source.id}"` : ''}`;
  if (!validateExactKeys(source, sourceKeys, label, errors)) {
    return;
  }
  if (!nonEmpty(source.id) || !/^src-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.id)) {
    errors.push(`${label}: id must be stable kebab-case beginning with "src-"`);
  }
  if (typeof source.query_insensitive !== 'boolean') {
    errors.push(`${label}: query_insensitive must be boolean`);
  }
  validateLocatorPair(
    source.canonical_locator,
    source.transport_locator,
    source.query_insensitive,
    label,
    errors,
  );
  if (!Array.isArray(source.locator_aliases)) {
    errors.push(`${label}: locator_aliases must be an array`);
  } else {
    source.locator_aliases.forEach((alias, aliasIndex) =>
      validateAlias(alias, source, aliasIndex, errors));
  }
  for (const [field, value] of [
    ['title', source.title],
    ['author_or_org', source.author_or_org],
    ['version', source.version],
    ['license_scope', source.license_scope],
    ['usage_boundary', source.usage_boundary],
    ['expected_final_approval_note', source.expected_final_approval_note],
  ]) {
    if (!nonEmpty(value)) {
      errors.push(`${label}: ${field} must be non-empty`);
    }
  }
  if (source.published_at !== null && !isCalendarDate(source.published_at)) {
    errors.push(`${label}: published_at must be null or a valid calendar date`);
  }
  if (!isCalendarDate(source.registered_at)) {
    errors.push(`${label}: registered_at must be a valid calendar date`);
  }
  if (!isCalendarDate(source.checked_at)) {
    errors.push(`${label}: checked_at must be a valid calendar date`);
  }
  if (!isCalendarDate(source.expected_final_approved_at)) {
    errors.push(`${label}: expected-final approval date must be a valid calendar date`);
  }
  validateExpectedFinalTransport(
    source.expected_final_transport_locator,
    source.transport_locator,
    label,
    errors,
  );
  validateEnum(source.source_kind, sourceKinds, `${label}: source_kind`, errors);
  validateEnum(source.tier, sourceTiers, `${label}: tier`, errors);
  validateStringArray(
    source.allowed_evidence_roles,
    evidenceRoles,
    `${label}: allowed_evidence_roles`,
    errors,
  );
  validateEnum(source.license, approvedLicenses, `${label}: license allowlist`, errors);
  if (
    source.license_evidence_url !== null &&
    !isHttps(source.license_evidence_url)
  ) {
    errors.push(`${label}: license_evidence_url must be null or HTTPS`);
  }
  if (!nonEmpty(source.license_evidence_note) && source.license_evidence_url === null) {
    errors.push(`${label}: license evidence URL or note is required`);
  }
  const expectedFamily = licenseFamilyIdentity(source.canonical_locator);
  if (source.license_family_grouping === 'identity') {
    if (source.license_family_id !== expectedFamily) {
      errors.push(
        `${label}: license_family_id "${source.license_family_id}" does not match inventory identity "${expectedFamily}"`,
      );
    }
    if (source.family_grouping_evidence_url !== null) {
      errors.push(`${label}: identity family grouping evidence URL must be null`);
    }
  } else if (/^explicit:[a-z0-9][a-z0-9-]*$/i.test(source.license_family_grouping)) {
    if (
      source.license_family_id !== source.license_family_grouping ||
      !isHttps(source.family_grouping_evidence_url)
    ) {
      errors.push(`${label}: explicit license family grouping requires matching ID and shared-scope HTTPS evidence`);
    }
  } else {
    errors.push(`${label}: invalid license_family_grouping`);
  }
  validateEnum(
    source.copyright_policy,
    copyrightPolicies,
    `${label}: copyright_policy`,
    errors,
  );
  const expectedCopyrightPolicy =
    requiredPolicyByKind.get(source.source_kind) ??
    requiredPolicyByLicense.get(source.license);
  if (
    expectedCopyrightPolicy !== undefined &&
    source.copyright_policy !== expectedCopyrightPolicy
  ) {
    errors.push(
      `${label}: copyright_policy actual "${source.copyright_policy}" must equal expected "${expectedCopyrightPolicy}"`,
    );
  }
  if (isHttps(source.canonical_locator)) {
    validateEnum(source.link_policy, linkPolicies, `${label}: link_policy`, errors);
  } else if (source.link_policy !== null) {
    errors.push(`${label}: local source link_policy must be null`);
  }
  if (source.source_kind === 'community-index') {
    if (source.tier !== 'discovery') {
      errors.push(`${label}: community-index must use discovery tier`);
    }
    for (const role of source.allowed_evidence_roles ?? []) {
      if (!['discovery', 'learning'].includes(role)) {
        errors.push(`${label}: community-index role "${role}" is not discovery/learning`);
      }
    }
  }
  if (source.source_kind === 'original-illustration') {
    if (!isLocalLocator(source.canonical_locator)) {
      errors.push(`${label}: original-illustration must use a local locator`);
    }
    if (
      !Array.isArray(source.allowed_evidence_roles) ||
      source.allowed_evidence_roles.some((role) => role !== 'illustration')
    ) {
      errors.push(`${label}: original-illustration may only use illustration role`);
    }
  }
  validateTombstone(source, errors);
}

function validateCitation(citation, documentPath, index, sourcesById, errors) {
  const label = `${documentPath} citation ${index + 1}`;
  if (!validateExactKeys(citation, citationKeys, label, errors)) {
    return;
  }
  if (!nonEmpty(citation.source_id)) {
    errors.push(`${label}: source_id must be non-empty`);
  }
  if (!isHttps(citation.citation_url) && !isLocalLocator(citation.citation_url)) {
    errors.push(`${label}: citation_url must be HTTPS or a local asset`);
  }
  validateStringArray(citation.roles, evidenceRoles, `${label}: roles`, errors);
  if (typeof citation.manifest_primary !== 'boolean') {
    errors.push(`${label}: manifest_primary must be boolean`);
  }
  validateEnum(citation.usage_mode, usageModes, `${label}: usage_mode`, errors);
  if (!nonEmpty(citation.attribution_note)) {
    errors.push(`${label}: attribution_note must be non-empty`);
  }
  for (const field of ['modification_note', 'excerpt']) {
    if (citation[field] !== null && !nonEmpty(citation[field])) {
      errors.push(`${label}: ${field} must be null or non-empty`);
    }
  }
  if (typeof citation.quotation_reviewed !== 'boolean') {
    errors.push(`${label}: quotation_reviewed must be boolean`);
  }
  const source = sourcesById.get(citation.source_id);
  if (!source) {
    errors.push(`${label}: dangling citation source "${citation.source_id}" does not exist`);
    return;
  }
  if (!citationMatchesSource(citation.citation_url, source)) {
    errors.push(`${label}: citation URL does not match source canonical or alias transport`);
  }
  for (const role of citation.roles ?? []) {
    if (!source.allowed_evidence_roles?.includes(role)) {
      errors.push(`${label}: citation role "${role}" is not allowed by source "${source.id}"`);
    }
  }
  if (citation.usage_mode === 'short-quotation') {
    const excerptLength = typeof citation.excerpt === 'string'
      ? [...citation.excerpt.normalize('NFC')].length
      : 0;
    if (excerptLength < 1 || excerptLength > 300) {
      errors.push(`${label}: short-quotation excerpt must contain 1–300 Unicode code points`);
    }
    if (citation.quotation_reviewed !== true) {
      errors.push(`${label}: short-quotation quotation_reviewed must be true`);
    }
    if (citation.modification_note !== null) {
      errors.push(`${label}: short-quotation modification_note must be null`);
    }
  }
  if (adaptedModes.has(citation.usage_mode)) {
    if (!nonEmpty(citation.modification_note)) {
      errors.push(`${label}: ${citation.usage_mode} modification_note must be non-empty`);
    }
    if (citation.quotation_reviewed !== true) {
      errors.push(`${label}: ${citation.usage_mode} quotation_reviewed must be true`);
    }
    if (!explicitAdaptLicenses.has(source.license)) {
      const reason = noAdaptLicenses.has(source.license)
        ? 'no-adaptation license policy'
        : 'explicit adaptation policy required';
      errors.push(
        `${label}: source "${source.id}" license "${source.license}" usage_mode "${citation.usage_mode}" is forbidden: ${reason}`,
      );
    }
    if (
      source.license === 'CC-BY-SA-4.0' &&
      !/share[- ]alike.*(?:review|compatib)|(?:review|compatib).*share[- ]alike/iu.test(
        citation.modification_note ?? '',
      )
    ) {
      errors.push(
        `${label}: source "${source.id}" CC-BY-SA-4.0 adaptation requires a share-alike compatibility review in modification_note`,
      );
    }
  }
  if (
    ['facts-summary', 'navigation-only'].includes(citation.usage_mode) &&
    citation.excerpt !== null
  ) {
    errors.push(`${label}: ${citation.usage_mode} excerpt must be null`);
  }
  if (
    citation.usage_mode === 'navigation-only' &&
    citation.roles?.some((role) => !['discovery', 'learning'].includes(role))
  ) {
    errors.push(`${label}: navigation-only roles must be discovery/learning`);
  }
  if (citation.usage_mode === 'original-illustration') {
    if (
      source.source_kind !== 'original-illustration' ||
      source.license !== 'LicenseRef-Atlas-Original' ||
      !isLocalLocator(citation.citation_url) ||
      citation.roles?.some((role) => role !== 'illustration')
    ) {
      errors.push(
        `${label}: original-illustration usage requires a local LicenseRef-Atlas-Original source and illustration role`,
      );
    }
    if (!nonEmpty(citation.modification_note)) {
      errors.push(`${label}: original-illustration modification_note must describe its creation`);
    }
  }
}

function validateDocumentEntry(documentPath, entry, sourcesById, errors) {
  const label = `document "${documentPath}"`;
  if (!/^content\/.+\.mdx?$/.test(documentPath)) {
    errors.push(`${label}: document path must start with "content/" and name an MDX file`);
  }
  if (!validateExactKeys(entry, documentKeys, label, errors)) {
    return;
  }
  if (!isCalendarDate(entry.reviewed_at)) {
    errors.push(`${label}: reviewed_at must be a valid calendar date`);
  }
  if (!Array.isArray(entry.copyright_checks)) {
    errors.push(`${label}: copyright_checks must be an array`);
  } else {
    const seen = new Set();
    for (const check of entry.copyright_checks) {
      if (seen.has(check)) {
        errors.push(`${label}: copyright_checks contains duplicate "${check}"`);
      }
      seen.add(check);
    }
    for (const check of requiredCopyrightChecks) {
      if (!seen.has(check)) {
        errors.push(`${label}: copyright_checks missing "${check}"`);
      }
    }
    for (const check of seen) {
      if (!requiredCopyrightChecks.includes(check)) {
        errors.push(`${label}: copyright_checks contains unknown "${check}"`);
      }
    }
  }
  if (!Array.isArray(entry.citations)) {
    errors.push(`${label}: citations must be an array`);
    return;
  }
  const exactCitations = new Set();
  entry.citations.forEach((citation, index) => {
    validateCitation(citation, documentPath, index, sourcesById, errors);
    if (!isObject(citation)) {
      return;
    }
    const key = `${citation.source_id}\0${citation.citation_url}\0${JSON.stringify(citation.roles)}`;
    if (exactCitations.has(key)) {
      errors.push(`${label}: duplicate citation "${citation.source_id}" "${citation.citation_url}"`);
    }
    exactCitations.add(key);
  });
}

function validateGlobalLocatorUniqueness(sources, errors) {
  const canonicalOwners = new Map();
  const locatorOwners = new Map();
  const transportOwners = new Map();
  for (const source of sources) {
    if (!isObject(source) || !nonEmpty(source.id)) {
      continue;
    }
    const locators = [
      {kind: 'canonical locator', locator: source.canonical_locator, transport: source.transport_locator},
      ...(Array.isArray(source.locator_aliases)
        ? source.locator_aliases.map((alias) => ({
            kind: 'alias locator',
            locator: alias?.locator,
            transport: alias?.transport_locator,
          }))
        : []),
    ];
    if (canonicalOwners.has(source.canonical_locator)) {
      errors.push(
        `source "${source.id}": duplicate canonical locator conflicts with "${canonicalOwners.get(source.canonical_locator)}"`,
      );
    } else {
      canonicalOwners.set(source.canonical_locator, source.id);
    }
    for (const {kind, locator, transport} of locators) {
      if (locatorOwners.has(locator) && locatorOwners.get(locator) !== source.id) {
        errors.push(
          `source "${source.id}": ${kind} conflicts with source "${locatorOwners.get(locator)}"`,
        );
      } else {
        locatorOwners.set(locator, source.id);
      }
      if (transportOwners.has(transport) && transportOwners.get(transport) !== source.id) {
        errors.push(
          `source "${source.id}": conflicting transport locator also belongs to "${transportOwners.get(transport)}"`,
        );
      } else {
        transportOwners.set(transport, source.id);
      }
    }
  }
}

function validateReplacementGraph(sourcesById, errors) {
  for (const source of sourcesById.values()) {
    const replacement = source.tombstone?.replacement_source_id;
    if (replacement !== null && replacement !== undefined && !sourcesById.has(replacement)) {
      errors.push(`source "${source.id}": tombstone replacement "${replacement}" does not exist`);
    }
  }
  for (const source of sourcesById.values()) {
    const seen = new Set();
    let cursor = source;
    while (cursor?.tombstone?.replacement_source_id) {
      if (seen.has(cursor.id)) {
        errors.push(`source "${source.id}": tombstone replacement cycle detected`);
        break;
      }
      seen.add(cursor.id);
      cursor = sourcesById.get(cursor.tombstone.replacement_source_id);
    }
  }
}

export function parseSourceLedger(value, file = 'data/source-ledger.json') {
  const errors = [];
  if (!validateExactKeys(value, ['schema_version', 'sources', 'documents'], file, errors)) {
    return {ledger: emptyLedger(), errors: errors.sort((a, b) => a.localeCompare(b, 'en'))};
  }
  if (value.schema_version !== 1) {
    errors.push(`${file}: schema_version must equal 1`);
  }
  if (!Array.isArray(value.sources)) {
    errors.push(`${file}: sources must be an array`);
  }
  if (!isObject(value.documents)) {
    errors.push(`${file}: documents must be an object`);
  }
  if (!Array.isArray(value.sources) || !isObject(value.documents)) {
    return {ledger: emptyLedger(), errors: errors.sort((a, b) => a.localeCompare(b, 'en'))};
  }

  value.sources.forEach((source, index) => validateSource(source, index, errors));
  const sourcesById = new Map();
  for (const source of value.sources) {
    if (!isObject(source) || !nonEmpty(source.id)) {
      continue;
    }
    if (sourcesById.has(source.id)) {
      errors.push(`source "${source.id}": duplicate source id`);
    } else {
      sourcesById.set(source.id, source);
    }
  }
  validateGlobalLocatorUniqueness(value.sources, errors);
  validateReplacementGraph(sourcesById, errors);
  for (const [documentPath, entry] of Object.entries(value.documents)) {
    validateDocumentEntry(documentPath, entry, sourcesById, errors);
  }
  return {
    ledger: errors.length > 0 ? emptyLedger() : value,
    errors: errors.sort((left, right) => left.localeCompare(right, 'en')),
  };
}

function stripHtmlComments(line, state) {
  let visible = '';
  let cursor = 0;
  while (cursor < line.length) {
    if (state.inComment) {
      const end = line.indexOf('-->', cursor);
      if (end === -1) {
        return visible;
      }
      state.inComment = false;
      cursor = end + 3;
      continue;
    }
    const start = line.indexOf('<!--', cursor);
    if (start === -1) {
      return visible + line.slice(cursor);
    }
    visible += line.slice(cursor, start);
    const end = line.indexOf('-->', start + 4);
    if (end === -1) {
      state.inComment = true;
      return visible;
    }
    cursor = end + 3;
  }
  return visible;
}

function cleanExtractedUrl(url) {
  return url.replace(/[.,;:!?]+$/u, '');
}

export function visibleMdxLines(document) {
  const lines = [];
  const state = {inComment: false};
  let fence;
  for (const line of String(document?.body ?? '').split(/\r?\n/)) {
    if (fence) {
      const closingFence = line.match(/^ {0,3}([`~]{3,})[ \t]*$/);
      if (
        closingFence &&
        fence.marker === closingFence[1][0] &&
        closingFence[1].length >= fence.length
      ) {
        fence = undefined;
      }
      continue;
    }
    const visible = stripHtmlComments(line, state);
    const openingFence = visible.match(/^ {0,3}([`~]{3,})(?:[^\r\n]*)$/);
    if (openingFence) {
      fence = {marker: openingFence[1][0], length: openingFence[1].length};
      continue;
    }
    lines.push(visible);
  }
  return lines;
}

function protectInlineCodeSpans(text) {
  const spans = [];
  let protectedText = '';
  let cursor = 0;
  while (cursor < text.length) {
    const openingStart = text.indexOf('`', cursor);
    if (openingStart === -1) {
      protectedText += text.slice(cursor);
      break;
    }
    protectedText += text.slice(cursor, openingStart);
    let openingEnd = openingStart;
    while (text[openingEnd] === '`') {
      openingEnd += 1;
    }
    const fenceLength = openingEnd - openingStart;
    let closingStart = openingEnd;
    while (closingStart < text.length) {
      const candidateStart = text.indexOf('`', closingStart);
      if (candidateStart === -1) {
        closingStart = -1;
        break;
      }
      let candidateEnd = candidateStart;
      while (text[candidateEnd] === '`') {
        candidateEnd += 1;
      }
      if (candidateEnd - candidateStart === fenceLength) {
        closingStart = candidateStart;
        break;
      }
      closingStart = candidateEnd;
    }
    if (closingStart === -1) {
      protectedText += text.slice(openingStart);
      break;
    }
    const token = `\uE000CODE${spans.length}\uE001`;
    spans.push({
      token,
      content: text.slice(openingEnd, closingStart),
    });
    protectedText += token;
    cursor = closingStart + fenceLength;
  }
  return {protectedText, spans};
}

export function normalizeVisibleQuotation(text) {
  const visibleText = visibleMdxLines({body: text})
    .join('\n')
    .normalize('NFC');
  const {protectedText, spans} = protectInlineCodeSpans(visibleText);
  let normalized = protectedText
    .replace(/\[([^\]]+)\]\((?:[^()]|\([^)]*\))*\)/gu, '$1')
    .replace(/<(https:\/\/[^>\s]+)>/gu, '$1')
    .replace(/^\s{0,3}>\s?/gmu, '')
    .replace(/\*\*(?=\S)(.+?\S)\*\*/gsu, '$1')
    .replace(
      /(^|[\s([{>"'])__(?=\S)(.+?\S)__(?=$|[\s)\]}>.,!?;:'"])/gmu,
      '$1$2',
    )
    .replace(/\*(?=\S)(.+?\S)\*/gsu, '$1')
    .replace(
      /(^|[\s([{>"'])_(?=\S)(.+?\S)_(?=$|[\s)\]}>.,!?;:'"])/gmu,
      '$1$2',
    )
    .replace(/~~(?=\S)(.+?\S)~~/gsu, '$1');
  for (const {token, content} of spans) {
    normalized = normalized.replace(token, () => content);
  }
  return normalized.replace(/\s+/gu, ' ').trim();
}

export function isTopLevelSourceLedgerMount(line) {
  return /^ {0,3}<SourceLedger(?:[ \t]+[^>\r\n]*)?\/> *$/.test(String(line));
}

export function extractExternalLinks(document) {
  const urls = new Set();
  for (const visible of visibleMdxLines(document)) {
    if (
      document?.file === 'references/index.mdx' &&
      isTopLevelSourceLedgerMount(visible)
    ) {
      continue;
    }
    const patterns = [
      /\]\((https:\/\/[^)\s]+)(?:\s+["'][^"']*["'])?\)/g,
      /<(https:\/\/[^>\s]+)>/g,
      /\bhref=(?:["'])(https:\/\/[^"']+)(?:["'])/g,
    ];
    for (const pattern of patterns) {
      for (const match of visible.matchAll(pattern)) {
        urls.add(cleanExtractedUrl(match[1]));
      }
    }
  }
  return [...urls].sort((left, right) => left.localeCompare(right, 'en'));
}

function hasVisibleSourceLedgerMount(document) {
  return visibleMdxLines(document).some(isTopLevelSourceLedgerMount);
}

function documentLedgerPath(document) {
  const file = String(document.file ?? '').replaceAll('\\', '/');
  return file.startsWith('content/') ? file : `content/${file}`;
}

function citationSort(left, right) {
  return (
    left.source_id.localeCompare(right.source_id, 'en') ||
    left.citation_url.localeCompare(right.citation_url, 'en') ||
    left.roles.join('\0').localeCompare(right.roles.join('\0'), 'en')
  );
}

function isEligiblePrimary(source, citation) {
  return (
    citation.manifest_primary === true &&
    ['primary', 'first-party'].includes(source.tier) &&
    source.source_kind !== 'community-index' &&
    isHttps(citation.citation_url) &&
    citation.roles.some((role) => factualRoles.has(role)) &&
    citation.roles.every((role) => source.allowed_evidence_roles.includes(role)) &&
    citation.usage_mode !== 'navigation-only'
  );
}

function isUncitedDiscoveryInventorySource(source) {
  return (
    source.source_kind === 'community-index' &&
    source.tier === 'discovery' &&
    Array.isArray(source.allowed_evidence_roles) &&
    source.allowed_evidence_roles.length > 0 &&
    source.allowed_evidence_roles.every((role) =>
      ['discovery', 'learning'].includes(role),
    )
  );
}

export function validateSourceGovernance(documents, ledger) {
  const errors = [];
  const sourceById = new Map(ledger.sources.map((source) => [source.id, source]));
  const documentByPath = new Map(
    documents.map((document) => [documentLedgerPath(document), document]),
  );
  const primarySourcesByFile = new Map();

  for (const [documentPath, document] of documentByPath) {
    const ledgerDocument = ledger.documents[documentPath];
    if (!ledgerDocument) {
      if (documentPath !== 'content/references/index.mdx') {
        errors.push(`${documentPath}: missing ledger document entry`);
      }
      primarySourcesByFile.set(document.file, []);
      continue;
    }
    const visibleUrls = extractExternalLinks(document);
    const visibleSet = new Set(visibleUrls);
    const citedUrls = new Set(ledgerDocument.citations.map((citation) => citation.citation_url));
    const hasGeneratedSourceCards =
      documentPath === 'content/references/index.mdx' &&
      hasVisibleSourceLedgerMount(document);
    const checkSet = new Set(ledgerDocument.copyright_checks);
    if (checkSet.size !== ledgerDocument.copyright_checks.length) {
      errors.push(`${documentPath}: copyright_checks contains a duplicate`);
    }
    for (const check of requiredCopyrightChecks) {
      if (!checkSet.has(check)) {
        errors.push(`${documentPath}: copyright_checks missing "${check}"`);
      }
    }

    for (const url of visibleUrls) {
      if (!citedUrls.has(url)) {
        errors.push(`${documentPath}: visible URL "${url}" has no document citation`);
        continue;
      }
      const citations = ledgerDocument.citations.filter(
        (citation) => citation.citation_url === url,
      );
      if (!citations.some((citation) => {
        const source = sourceById.get(citation.source_id);
        return source && citationMatchesSource(url, source);
      })) {
        errors.push(`${documentPath}: visible URL "${url}" has no matching source record`);
      }
    }
    for (const citation of ledgerDocument.citations) {
      const source = sourceById.get(citation.source_id);
      if (source) {
        for (const role of citation.roles) {
          if (!source.allowed_evidence_roles.includes(role)) {
            errors.push(
              `${documentPath}: citation role "${role}" is not allowed by source "${source.id}"`,
            );
          }
          if (
            source.source_kind === 'community-index' &&
            !['discovery', 'learning'].includes(role)
          ) {
            errors.push(
              `${documentPath}: community-index citation role "${role}" must be discovery/learning`,
            );
          }
        }
      }
      if (
        isHttps(citation.citation_url) &&
        !visibleSet.has(citation.citation_url) &&
        !hasGeneratedSourceCards
      ) {
        errors.push(
          `${documentPath}: citation "${citation.source_id}" URL "${citation.citation_url}" is not visible in the document`,
        );
      }
      if (
        isLocalLocator(citation.citation_url) &&
        !document.body.includes(citation.citation_url) &&
        !hasGeneratedSourceCards
      ) {
        errors.push(
          `${documentPath}: local citation "${citation.source_id}" URL "${citation.citation_url}" is not visible in the document`,
        );
      }
      if (citation.usage_mode === 'short-quotation' && nonEmpty(citation.excerpt)) {
        const normalizedBody = normalizeVisibleQuotation(document.body);
        const normalizedExcerpt = normalizeVisibleQuotation(citation.excerpt);
        if (
          normalizedExcerpt.length === 0 ||
          !normalizedBody.includes(normalizedExcerpt)
        ) {
          errors.push(
            `${documentPath}: citation "${citation.source_id}" excerpt is not present in the visible document body`,
          );
        }
      }
    }

    const factualSourceIds = new Set(
      ledgerDocument.citations
        .filter((citation) =>
          citation.roles.some((role) => factualRoles.has(role)),
        )
        .map((citation) => citation.source_id),
    );
    for (const sourceId of factualSourceIds) {
      const source = sourceById.get(sourceId);
      if (source && !nonEmpty(source.version)) {
        errors.push(
          `${documentPath}: factual source "${sourceId}" is missing version`,
        );
      }
    }

    const primary = [];
    for (const citation of ledgerDocument.citations) {
      const source = sourceById.get(citation.source_id);
      if (!source) {
        continue;
      }
      const eligible = isEligiblePrimary(source, citation);
      if (citation.manifest_primary && !eligible) {
        errors.push(
          `${documentPath}: citation "${citation.source_id}" cannot be manifest_primary`,
        );
      }
      if (eligible) {
        primary.push(citation.citation_url);
      }
    }
    primarySourcesByFile.set(
      document.file,
      [...new Set(primary)].sort((left, right) => left.localeCompare(right, 'en')),
    );

    const isIndex = /\/index\.mdx?$/.test(documentPath);
    if (factRequiredTypes.has(document.metadata?.content_type) && !isIndex) {
      const hasFactual = ledgerDocument.citations.some((citation) => {
        const source = sourceById.get(citation.source_id);
        return (
          source &&
          ['primary', 'first-party'].includes(source.tier) &&
          source.source_kind !== 'community-index' &&
          citation.roles.some((role) => factualRoles.has(role))
        );
      });
      if (!hasFactual) {
        errors.push(
          `${documentPath}: ${document.metadata.content_type} requires a primary/first-party factual source`,
        );
      }
    }
  }

  for (const documentPath of Object.keys(ledger.documents)) {
    if (!documentByPath.has(documentPath)) {
      errors.push(`${documentPath}: ledger document does not exist in content`);
    }
  }

  const citedSourceIds = new Set(
    Object.values(ledger.documents).flatMap(({citations}) =>
      citations.map(({source_id: sourceId}) => sourceId),
    ),
  );
  for (const source of ledger.sources) {
    if (
      !citedSourceIds.has(source.id) &&
      !isUncitedDiscoveryInventorySource(source)
    ) {
      errors.push(
        `source "${source.id}": source is not cited by any ledger document`,
      );
    }
  }

  const governedLedger = {
    schema_version: 1,
    sources: [...ledger.sources].sort((left, right) => left.id.localeCompare(right.id, 'en')),
    documents: Object.fromEntries(
      Object.entries(ledger.documents)
        .sort(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([documentPath, entry]) => [
          documentPath,
          {...entry, citations: [...entry.citations].sort(citationSort)},
        ]),
    ),
  };
  return {
    errors: errors.sort((left, right) => left.localeCompare(right, 'en')),
    governedLedger,
    primarySourcesByFile,
  };
}
