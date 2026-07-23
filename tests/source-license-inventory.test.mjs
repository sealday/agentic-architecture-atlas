import assert from 'node:assert/strict';
import test from 'node:test';

import {
  licenseFamilyIdentity,
  validateInventoryLedgerConsistency,
  validateSourceLicenseInventory,
} from '../scripts/validate-source-license-inventory.mjs';

const header = [
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

function table(rows) {
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

const c4Row = [
  'https://c4model.com/',
  'https://c4model.com/#SystemContextDiagram',
  'Simon Brown',
  'https://c4model.com/',
  'The audit checked Simon Brown’s C4 work at https://c4model.com/; no reusable license notice for the work was found, so Atlas retains only the link and an original factual summary.',
  '2026-07-23',
  'LicenseRef-All-Rights-Reserved',
  'Page text and diagrams only; third-party links excluded',
  'Facts summary and short quotation only',
  'identity',
  'not-applicable',
];

test('accepts eleven-column license inventory rows with exact evidence', () => {
  const result = validateSourceLicenseInventory(
    table([c4Row]),
    ['https://c4model.com/#SystemContextDiagram'],
  );

  assert.deepEqual(result.errors, []);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].exact_license, 'LicenseRef-All-Rights-Reserved');

  const cc0 = [...c4Row];
  cc0[0] = 'github:example/public-index';
  cc0[1] = 'https://github.com/example/public-index';
  cc0[3] = 'https://raw.githubusercontent.com/example/public-index/main/LICENSE';
  cc0[4] = 'Repository license text identifies CC0 1.0 Universal';
  cc0[6] = 'CC0-1.0';
  const cc0Result = validateSourceLicenseInventory(
    table([cc0]),
    ['https://github.com/example/public-index'],
  );
  assert.deepEqual(cc0Result.errors, []);

  for (const license of [
    'CC-BY-NC-ND-4.0',
    'LicenseRef-CC-BY-NC-ND-Unversioned',
    'LicenseRef-MCP-Specification-Transition',
  ]) {
    const controlled = [...c4Row];
    controlled[6] = license;
    const controlledResult = validateSourceLicenseInventory(
      table([controlled]),
      ['https://c4model.com/#SystemContextDiagram'],
    );
    assert.deepEqual(controlledResult.errors, []);
  }
});

test('rejects missing columns evidence license scope and migration policy', () => {
  const malformed = [
    [...c4Row.slice(0, 10)],
    [...c4Row.slice(0, 3), 'http://example.com/license', '', '2026-02-30', 'Unknown', '', '', 'identity', 'not-applicable'],
    [...c4Row.slice(0, 3), 'https://', 'Evidence note', '2026-07-23', 'MIT', 'Page only', 'Facts only', 'identity', 'not-applicable'],
    [...c4Row, 'extra-cell'],
  ];
  const result = validateSourceLicenseInventory(table(malformed), []);
  const joined = result.errors.join('\n');

  assert.match(joined, /exactly 11 columns/i);
  assert.match(joined, /license evidence URL.*HTTPS/i);
  assert.match(joined, /evidence note.*non-empty/i);
  assert.match(joined, /checked_at.*calendar date/i);
  assert.match(joined, /license.*allowlist/i);
  assert.match(joined, /scope exclusions.*non-empty/i);
  assert.match(joined, /migration policy.*non-empty/i);

  const pseudoHttps = [...c4Row];
  pseudoHttps[3] = 'https://';
  const pseudoResult = validateSourceLicenseInventory(
    table([pseudoHttps]),
    ['https://c4model.com/#SystemContextDiagram'],
  );
  assert.match(pseudoResult.errors.join('\n'), /license evidence URL.*HTTPS/i);
});

test('covers every migration candidate source family', () => {
  const missing = validateSourceLicenseInventory(table([c4Row]), [
    'https://c4model.com/#SystemContextDiagram',
    'https://example.com/work',
  ]);
  assert.match(missing.errors.join('\n'), /https:\/\/example\.com\/work.*missing/i);

  const orphan = validateSourceLicenseInventory(
    table([c4Row, [
      'https://example.com/work',
      'https://example.com/work',
      'Example Org',
      'https://example.com/work',
      'No reuse license is declared on the checked page',
      '2026-07-23',
      'LicenseRef-All-Rights-Reserved',
      'Current page only',
      'Facts summary only',
      'identity',
      'not-applicable',
    ]]),
    ['https://c4model.com/#SystemContextDiagram'],
  );
  assert.match(orphan.errors.join('\n'), /https:\/\/example\.com\/work.*orphan/i);
});

test('keeps different works and licenses on one origin in separate families', () => {
  assert.equal(
    licenseFamilyIdentity('https://example.com/work-a?version=1#part'),
    'https://example.com/work-a?version=1',
  );
  assert.equal(
    licenseFamilyIdentity('https://example.com/work-b?version=1#part'),
    'https://example.com/work-b?version=1',
  );
  assert.notEqual(
    licenseFamilyIdentity('https://example.com/work?version=1'),
    licenseFamilyIdentity('https://example.com/work?version=2'),
  );
});

test('groups GitHub anchors by lowercase owner and repository', () => {
  assert.equal(
    licenseFamilyIdentity('https://github.com/OpenAI/OpenAI-Agents-Python/blob/main/src/x.py#L1-L3'),
    'github:openai/openai-agents-python',
  );
  assert.equal(
    licenseFamilyIdentity('https://github.com/openai/openai-agents-python/tree/main?plain=1#L9'),
    'github:openai/openai-agents-python',
  );
});

test('normalizes complete DOI identities without merging distinct DOIs', () => {
  assert.equal(
    licenseFamilyIdentity('https://doi.org/10.1145%2F3368089.3409742?download=1#page'),
    'doi:10.1145/3368089.3409742',
  );
  assert.equal(
    licenseFamilyIdentity('doi:10.1145/3368089.3409743'),
    'doi:10.1145/3368089.3409743',
  );
  assert.equal(
    licenseFamilyIdentity('doi:10.1000/ABC%3Ftracking=1'),
    'doi:10.1000/abc?tracking=1',
  );
  assert.equal(
    licenseFamilyIdentity('https://doi.org/10.1000/ABC%23section'),
    'doi:10.1000/abc#section',
  );
  assert.equal(
    licenseFamilyIdentity('https://doi.org/10.1000/ABC%3Fpart?download=1#viewer'),
    'doi:10.1000/abc?part',
  );
  assert.notEqual(
    licenseFamilyIdentity('https://doi.org/10.1000/ABC%3Fpart'),
    licenseFamilyIdentity('https://doi.org/10.1000/ABC?part'),
  );
  assert.notEqual(
    licenseFamilyIdentity('https://doi.org/10.1000/ABC%23part'),
    licenseFamilyIdentity('https://doi.org/10.1000/ABC#part'),
  );
  assert.notEqual(
    licenseFamilyIdentity('doi:10.1145/3368089.3409742'),
    licenseFamilyIdentity('doi:10.1145/3368089.3409743'),
  );
});

test('rejects copied ARR audit notes and unrelated evidence URLs', () => {
  const copiedNote =
    'Checked the named work and found no reusable license; Atlas uses only links and facts.';
  const first = [...c4Row];
  first[4] = copiedNote;
  const second = [
    'https://example.com/work',
    'https://example.com/work',
    'Example Institution',
    'https://unrelated.example.net/terms',
    copiedNote,
    '2026-07-23',
    'LicenseRef-All-Rights-Reserved',
    'Only the named work',
    'Facts summary and short quotation only',
    'identity',
    'not-applicable',
  ];
  const result = validateSourceLicenseInventory(
    table([first, second]),
    ['https://c4model.com/#SystemContextDiagram', 'https://example.com/work'],
  );
  const joined = result.errors.join('\n');
  assert.match(joined, /ARR evidence note.*reused across.*famil/i);
  assert.match(joined, /evidence URL.*related.*family|family.*evidence URL/i);
});

test('requires each ARR audit note to identify its institution and checked evidence URL', () => {
  const vague = [...c4Row];
  vague[4] =
    'This unique procedural note says no reusable license was found and facts are allowed.';
  const result = validateSourceLicenseInventory(
    table([vague]),
    ['https://c4model.com/#SystemContextDiagram'],
  );
  assert.match(
    result.errors.join('\n'),
    /ARR evidence note.*author|ARR evidence note.*evidence URL/i,
  );
});

test('prevents Kubernetes documentation families from being downgraded to ARR', () => {
  const kubernetes = [
    'https://kubernetes.io/docs/concepts/architecture/',
    'https://kubernetes.io/docs/concepts/architecture/',
    'Kubernetes project',
    'https://kubernetes.io/docs/concepts/architecture/',
    'The official Kubernetes documentation footer identifies CC BY 4.0 for the named documentation page.',
    '2026-07-24',
    'LicenseRef-All-Rights-Reserved',
    'Named documentation page only; code samples and third-party material excluded',
    'Adapt with attribution within the documented CC BY 4.0 scope',
    'identity',
    'not-applicable',
  ];
  const result = validateSourceLicenseInventory(
    table([kubernetes]),
    ['https://kubernetes.io/docs/concepts/architecture/'],
  );
  assert.match(result.errors.join('\n'), /kubernetes.*CC-BY-4\.0/i);
});

test('keeps inventory snapshot and runtime ledger authority fields aligned', () => {
  const inventory = validateSourceLicenseInventory(
    table([c4Row]),
    ['https://c4model.com/#SystemContextDiagram'],
  );
  const source = {
    canonical_locator: 'https://c4model.com/',
    license_family_id: 'https://c4model.com/',
    author_or_org: 'Different Author',
    checked_at: '2026-07-22',
    published_at: null,
    license: 'MIT',
    license_scope: 'Different scope',
    license_evidence_url: 'https://example.com/license',
    license_evidence_note: 'Different evidence',
    license_family_grouping: 'identity',
    family_grouping_evidence_url: null,
  };
  const result = validateInventoryLedgerConsistency(inventory.entries, [source]);
  const joined = result.errors.join('\n');
  assert.match(joined, /runtime source ledger is authoritative/i);
  assert.match(joined, /author_or_org/i);
  assert.match(joined, /license/i);
  assert.match(joined, /license_evidence_url/i);
  assert.match(joined, /license_scope/i);
  assert.match(joined, /checked_at/i);
});

test('requires shared copyright evidence for explicit family grouping', () => {
  const explicit = [...c4Row];
  explicit[0] = 'explicit:c4-family';
  explicit[9] = 'explicit:c4-family';
  explicit[10] = 'not-applicable';
  let result = validateSourceLicenseInventory(table([explicit]), [
    'https://c4model.com/#SystemContextDiagram',
  ]);
  assert.match(result.errors.join('\n'), /grouping evidence.*HTTPS/i);

  explicit[10] = 'https://c4model.com/licensing';
  explicit[4] = 'Same origin';
  result = validateSourceLicenseInventory(table([explicit]), [
    'https://c4model.com/#SystemContextDiagram',
  ]);
  assert.match(result.errors.join('\n'), /shared.*copyright|common.*license/i);
});
