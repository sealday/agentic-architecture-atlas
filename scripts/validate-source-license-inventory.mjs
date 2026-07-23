import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {readContentDocuments} from './content-metadata.mjs';

export const approvedInventoryLicenses = [
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

const inventoryColumns = [
  'source_family',
  'current_urls',
  'author_or_org',
  'license_evidence_url',
  'license_evidence_note',
  'checked_at',
  'exact_license',
  'scope_exclusions',
  'migration_policy',
  'family_grouping',
  'grouping_evidence_url',
];

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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

function canonicalizeUrl(value) {
  const url = new URL(value);
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

export function licenseFamilyIdentity(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return '';
  }
  const input = value.trim().normalize('NFC');
  if (input.startsWith('/')) {
    return input;
  }

  let doi;
  if (/^doi:/i.test(input)) {
    doi = input.slice(4);
  } else {
    try {
      const url = new URL(input);
      if (url.hostname.toLowerCase() === 'doi.org') {
        // URL query and fragment delimiters are transport metadata. Strip them
        // before decoding so percent-encoded ?/# remain part of the DOI suffix.
        doi = url.pathname.replace(/^\/+/, '');
      } else if (
        url.hostname.toLowerCase() === 'dl.acm.org' &&
        url.pathname.startsWith('/doi/')
      ) {
        doi = url.pathname.slice('/doi/'.length);
      } else if (url.hostname.toLowerCase() === 'github.com') {
        const [owner, repository] = url.pathname.split('/').filter(Boolean);
        return owner && repository
          ? `github:${owner.toLowerCase()}/${repository.toLowerCase()}`
          : canonicalizeUrl(input);
      }
    } catch {
      return '';
    }
  }

  if (doi !== undefined) {
    try {
      const normalized = decodeURIComponent(doi).normalize('NFC');
      return `doi:${normalized.toLowerCase()}`;
    } catch {
      return '';
    }
  }

  try {
    return canonicalizeUrl(input);
  } catch {
    return '';
  }
}

function parseRow(line) {
  if (!line.trim().startsWith('|') || !line.trim().endsWith('|')) {
    return null;
  }
  return line.trim().slice(1, -1).split('|').map((cell) => cell.trim());
}

function splitCurrentUrls(value) {
  return value
    .split(/\s*<br\s*\/?>\s*/i)
    .map((url) => url.trim())
    .filter(Boolean);
}

function isHttpsUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('https://')) {
    return false;
  }
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function parseInventory(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => {
    const cells = parseRow(line);
    return cells?.[0] === 'source_family';
  });
  if (headerIndex === -1) {
    return {entries: [], errors: ['inventory: missing eleven-column table header']};
  }

  const header = parseRow(lines[headerIndex]);
  const errors = [];
  if (
    header.length !== inventoryColumns.length ||
    header.some((column, index) => column !== inventoryColumns[index])
  ) {
    errors.push(
      `inventory: expected exact columns "${inventoryColumns.join(' | ')}"`,
    );
  }
  const separator = parseRow(lines[headerIndex + 1] ?? '');
  if (
    !separator ||
    separator.length !== inventoryColumns.length ||
    separator.some((cell) => !/^:?-{3,}:?$/.test(cell))
  ) {
    errors.push('inventory: table separator must contain exactly 11 columns');
  }

  const entries = [];
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    if (lines[index].trim() === '') {
      continue;
    }
    const cells = parseRow(lines[index]);
    if (!cells) {
      continue;
    }
    if (cells.length !== inventoryColumns.length) {
      errors.push(`inventory row ${index + 1}: expected exactly 11 columns; found ${cells.length}`);
      continue;
    }
    const entry = Object.fromEntries(inventoryColumns.map((column, columnIndex) => [
      column,
      cells[columnIndex],
    ]));
    entry.current_urls = splitCurrentUrls(entry.current_urls);
    entry.line = index + 1;
    entries.push(entry);
  }
  return {entries, errors};
}

export function validateSourceLicenseInventory(markdown, candidateUrls) {
  const parsed = parseInventory(markdown);
  const errors = [...parsed.errors];
  const familyEntries = new Map();
  const currentUrlEntries = new Map();
  const arrEvidenceNoteFamilies = new Map();

  for (const entry of parsed.entries) {
    const label = entry.source_family || `row ${entry.line}`;
    const prefix = `${label}:`;
    if (entry.source_family.trim() === '') {
      errors.push(`${prefix} source family must be non-empty`);
    }
    if (entry.current_urls.length === 0) {
      errors.push(`${prefix} current URLs must be non-empty`);
    }
    if (entry.author_or_org.trim() === '') {
      errors.push(`${prefix} author or organization must be non-empty`);
    }
    if (!isHttpsUrl(entry.license_evidence_url)) {
      errors.push(`${prefix} license evidence URL must be HTTPS`);
    }
    if (entry.license_evidence_note.trim() === '') {
      errors.push(`${prefix} evidence note must be non-empty`);
    }
    if (!isCalendarDate(entry.checked_at)) {
      errors.push(`${prefix} checked_at must be a valid calendar date`);
    }
    if (!approvedInventoryLicenses.includes(entry.exact_license)) {
      errors.push(`${prefix} license "${entry.exact_license}" is not in the approved allowlist`);
    }
    if (
      entry.current_urls.some((currentUrl) => {
        try {
          return new URL(currentUrl).hostname.toLowerCase() === 'kubernetes.io';
        } catch {
          return false;
        }
      }) &&
      entry.exact_license !== 'CC-BY-4.0'
    ) {
      errors.push(`${prefix} Kubernetes documentation must retain its official CC-BY-4.0 license`);
    }
    if (entry.scope_exclusions.trim() === '') {
      errors.push(`${prefix} scope exclusions must be non-empty`);
    }
    if (entry.migration_policy.trim() === '') {
      errors.push(`${prefix} migration policy must be non-empty`);
    }

    if (entry.family_grouping === 'identity') {
      if (entry.grouping_evidence_url !== 'not-applicable') {
        errors.push(`${prefix} identity grouping evidence URL must be "not-applicable"`);
      }
    } else if (/^explicit:[a-z0-9][a-z0-9-]*$/i.test(entry.family_grouping)) {
      if (!isHttpsUrl(entry.grouping_evidence_url)) {
        errors.push(`${prefix} explicit grouping evidence URL must be HTTPS`);
      }
      if (!/(shared|common).*(copyright|licen[cs]e)|(?:copyright|licen[cs]e).*(shared|common)/i.test(
        entry.license_evidence_note,
      )) {
        errors.push(`${prefix} explicit grouping requires evidence of shared copyright or common license scope`);
      }
      if (entry.source_family !== entry.family_grouping) {
        errors.push(`${prefix} source family must equal explicit grouping identifier`);
      }
    } else {
      errors.push(`${prefix} family grouping must be "identity" or "explicit:<id>"`);
    }

    if (familyEntries.has(entry.source_family)) {
      errors.push(`${prefix} duplicate source family`);
    } else {
      familyEntries.set(entry.source_family, entry);
    }

    for (const currentUrl of entry.current_urls) {
      const currentIdentity = licenseFamilyIdentity(currentUrl);
      if (currentIdentity === '') {
        errors.push(`${prefix} current URL "${currentUrl}" is invalid`);
      }
      if (
        entry.family_grouping === 'identity' &&
        currentIdentity !== entry.source_family
      ) {
        errors.push(
          `${prefix} current URL "${currentUrl}" resolves to source family "${currentIdentity}"`,
        );
      }
      if (currentUrlEntries.has(currentUrl)) {
        errors.push(
          `${prefix} duplicate current URL also listed by "${currentUrlEntries.get(currentUrl)}"`,
        );
      } else {
        currentUrlEntries.set(currentUrl, entry.source_family);
      }
    }

    if (entry.exact_license === 'LicenseRef-All-Rights-Reserved') {
      const normalizedNote = entry.license_evidence_note.trim().replace(/\s+/g, ' ');
      const families = arrEvidenceNoteFamilies.get(normalizedNote) ?? [];
      families.push(entry.source_family);
      arrEvidenceNoteFamilies.set(normalizedNote, families);

      let related = false;
      try {
        const evidence = new URL(entry.license_evidence_url);
        related = entry.current_urls.some((currentUrl) => {
          try {
            const current = new URL(currentUrl);
            if (evidence.hostname.toLowerCase() === current.hostname.toLowerCase()) {
              return true;
            }
            if (
              current.hostname.toLowerCase() === 'docs.yjs.dev' &&
              evidence.hostname.toLowerCase() === 'github.com' &&
              evidence.pathname.toLowerCase() === '/yjs/docs/blob/main/license.md'
            ) {
              return true;
            }
            return (
              current.hostname.toLowerCase() === 'github.com' &&
              licenseFamilyIdentity(entry.license_evidence_url) ===
                licenseFamilyIdentity(currentUrl)
            );
          } catch {
            return false;
          }
        });
      } catch {
        related = false;
      }
      if (!related) {
        errors.push(`${prefix} ARR evidence URL must be related to the checked family or work`);
      }
      if (!normalizedNote.includes(entry.author_or_org)) {
        errors.push(`${prefix} ARR evidence note must identify the author or institution`);
      }
      if (!normalizedNote.includes(entry.license_evidence_url)) {
        errors.push(`${prefix} ARR evidence note must identify the checked evidence URL`);
      }
    }
  }

  for (const [note, families] of arrEvidenceNoteFamilies) {
    if (note !== '' && families.length > 1) {
      errors.push(
        `ARR evidence note is reused across multiple families: ${families.join(', ')}`,
      );
    }
  }

  const candidateFamilies = new Set(
    [...candidateUrls].map(licenseFamilyIdentity).filter(Boolean),
  );
  const coveredFamilies = new Set();
  for (const entry of parsed.entries) {
    if (entry.family_grouping === 'identity') {
      coveredFamilies.add(entry.source_family);
      continue;
    }
    for (const currentUrl of entry.current_urls) {
      coveredFamilies.add(licenseFamilyIdentity(currentUrl));
    }
  }
  for (const family of candidateFamilies) {
    if (!coveredFamilies.has(family)) {
      errors.push(`${family}: missing inventory row for migration candidate`);
    }
  }
  for (const family of coveredFamilies) {
    if (!candidateFamilies.has(family)) {
      errors.push(`${family}: orphan inventory family is not used by migration candidates`);
    }
  }

  return {
    entries: parsed.entries.map(({line: _line, ...entry}) => entry),
    errors: errors.sort((left, right) => left.localeCompare(right, 'en')),
  };
}

/**
 * The source ledger is the runtime authority. The inventory remains a migration
 * audit snapshot, so fields represented in both artifacts must not drift.
 */
export function validateInventoryLedgerConsistency(
  inventoryEntries,
  sources,
  documents = {},
) {
  const errors = [];
  const sourcesByFamily = new Map();
  for (const source of sources) {
    const familySources = sourcesByFamily.get(source.license_family_id) ?? [];
    familySources.push(source);
    sourcesByFamily.set(source.license_family_id, familySources);
  }

  const normalizedTransport = (locator, queryInsensitive) => {
    if (typeof locator !== 'string') return '';
    if (locator.startsWith('/')) return locator.split('#', 1)[0];
    try {
      const url = new URL(locator);
      url.protocol = url.protocol.toLowerCase();
      url.hostname = url.hostname.toLowerCase();
      if (url.protocol === 'https:' && url.port === '443') url.port = '';
      if (url.protocol === 'http:' && url.port === '80') url.port = '';
      url.hash = '';
      if (queryInsensitive) url.search = '';
      return url.href;
    } catch {
      return '';
    }
  };
  const currentUrlMatchesSource = (currentUrl, source) => {
    const current = normalizedTransport(currentUrl, source.query_insensitive === true);
    const transports = [
      source.transport_locator,
      source.canonical_locator,
      ...(source.locator_aliases ?? []).flatMap((alias) => [
        alias.transport_locator,
        alias.locator,
      ]),
    ];
    return transports.some(
      (locator) =>
        normalizedTransport(locator, source.query_insensitive === true) === current,
    );
  };
  const sourceById = new Map(
    sources.filter((source) => source.id).map((source) => [source.id, source]),
  );
  const citationUrlsByFamily = new Map();
  for (const document of Object.values(documents)) {
    for (const citation of document?.citations ?? []) {
      const source = sourceById.get(citation.source_id);
      if (!source) continue;
      const values = citationUrlsByFamily.get(source.license_family_id) ?? [];
      values.push({url: citation.citation_url, source});
      citationUrlsByFamily.set(source.license_family_id, values);
    }
  }

  for (const entry of inventoryEntries) {
    const familySources = sourcesByFamily.get(entry.source_family) ?? [];
    if (familySources.length === 0) {
      errors.push(
        `migration snapshot family "${entry.source_family}" is missing from the runtime source ledger`,
      );
      continue;
    }
    for (const source of familySources) {
      const sharedFields = [
        ['author_or_org', entry.author_or_org, source.author_or_org],
        ['checked_at', entry.checked_at, source.checked_at],
        ['license', entry.exact_license, source.license],
        ['license_evidence_url', entry.license_evidence_url, source.license_evidence_url],
        ['license_evidence_note', entry.license_evidence_note, source.license_evidence_note],
        ['license_scope', entry.scope_exclusions, source.license_scope],
        ['license_family_grouping', entry.family_grouping, source.license_family_grouping],
        [
          'family_grouping_evidence_url',
          entry.grouping_evidence_url === 'not-applicable'
            ? null
            : entry.grouping_evidence_url,
          source.family_grouping_evidence_url,
        ],
      ];
      for (const [field, inventoryValue, ledgerValue] of sharedFields) {
        if (inventoryValue === ledgerValue) continue;
        errors.push(
          `runtime source ledger is authoritative: family "${source.license_family_id}" field "${field}" differs from the migration inventory snapshot`,
        );
      }
    }
    for (const currentUrl of entry.current_urls) {
      const representedBySource = familySources.some(
        (source) => currentUrlMatchesSource(currentUrl, source),
      );
      const representedByCitation = (
        citationUrlsByFamily.get(entry.source_family) ?? []
      ).some(({url, source}) =>
        normalizedTransport(url, source.query_insensitive === true) ===
        normalizedTransport(currentUrl, source.query_insensitive === true));
      if (!representedBySource && !representedByCitation) {
        errors.push(
          `migration snapshot current URL "${currentUrl}" is not represented by a runtime source locator or alias`,
        );
      }
    }
  }
  return {errors: errors.sort((left, right) => left.localeCompare(right, 'en'))};
}

function visibleUrls(body) {
  const urls = new Set();
  let fence;
  let inComment = false;
  for (const line of body.split(/\r?\n/)) {
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
    let visible = '';
    let cursor = 0;
    while (cursor < line.length) {
      if (inComment) {
        const end = line.indexOf('-->', cursor);
        if (end === -1) {
          cursor = line.length;
          continue;
        }
        inComment = false;
        cursor = end + 3;
        continue;
      }
      const start = line.indexOf('<!--', cursor);
      if (start === -1) {
        visible += line.slice(cursor);
        break;
      }
      visible += line.slice(cursor, start);
      const end = line.indexOf('-->', start + 4);
      if (end === -1) {
        inComment = true;
        break;
      }
      cursor = end + 3;
    }
    const openingFence = visible.match(/^ {0,3}([`~]{3,})(?:[^\r\n]*)$/);
    if (openingFence) {
      fence = {marker: openingFence[1][0], length: openingFence[1].length};
      continue;
    }
    const patterns = [
      /\]\((https:\/\/[^)\s]+)(?:\s+["'][^"']*["'])?\)/g,
      /<(https:\/\/[^>\s]+)>/g,
      /\bhref=(?:["'])(https:\/\/[^"']+)(?:["'])/g,
    ];
    for (const pattern of patterns) {
      for (const match of visible.matchAll(pattern)) {
        urls.add(match[1].replace(/[.,;:!?]+$/u, ''));
      }
    }
    for (const match of visible.matchAll(/\/img\/[A-Za-z0-9._/-]+\.(?:png|jpe?g|svg|webp)/g)) {
      urls.add(match[0]);
    }
  }
  return urls;
}

export async function collectMigrationCandidateUrls(contentRoot) {
  const documents = await readContentDocuments(contentRoot);
  const urls = new Set();
  for (const document of documents) {
    for (const url of document.metadata.official_sources ?? []) {
      urls.add(url);
    }
    for (const url of visibleUrls(document.body)) {
      urls.add(url);
    }
  }
  return [...urls].sort((left, right) => left.localeCompare(right, 'en'));
}

async function runCli() {
  const [inventoryPath, contentRoot] = process.argv.slice(2);
  if (!inventoryPath || !contentRoot) {
    console.error(
      'Usage: node scripts/validate-source-license-inventory.mjs <inventory.md> <content-root>',
    );
    process.exitCode = 1;
    return;
  }
  try {
    const [markdown, candidateUrls] = await Promise.all([
      readFile(inventoryPath, 'utf8'),
      collectMigrationCandidateUrls(contentRoot),
    ]);
    const result = validateSourceLicenseInventory(markdown, candidateUrls);
    if (result.errors.length > 0) {
      for (const error of result.errors) {
        console.error(error);
      }
      process.exitCode = 1;
      return;
    }
    console.log(
      `Validated ${result.entries.length} source license families covering ${candidateUrls.length} migration candidate URL(s).`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli();
}
