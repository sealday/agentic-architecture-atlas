import assert from 'node:assert/strict';
import test from 'node:test';

import {
  approvedLicenses,
  canonicalizeTransportLocator,
  citationMatchesSource,
  extractExternalLinks,
  isTopLevelSourceLedgerMount,
  normalizeVisibleQuotation,
  parseSourceLedger,
  validateSourceGovernance,
} from '../scripts/source-ledger.mjs';

const validSource = {
  id: 'src-c4-model',
  canonical_locator: 'https://c4model.com/',
  transport_locator: 'https://c4model.com/',
  query_insensitive: false,
  locator_aliases: [],
  tombstone: null,
  title: 'C4 model',
  author_or_org: 'Simon Brown',
  published_at: null,
  registered_at: '2026-07-24',
  checked_at: '2026-07-23',
  version: 'current page checked on 2026-07-23',
  source_kind: 'official-docs',
  tier: 'primary',
  allowed_evidence_roles: ['definition', 'method'],
  license: 'LicenseRef-All-Rights-Reserved',
  license_scope: 'Page text and diagrams; third-party links excluded',
  license_evidence_url: 'https://c4model.com/',
  license_evidence_note: 'No reuse license is declared on the checked page',
  license_family_id: 'https://c4model.com/',
  license_family_grouping: 'identity',
  family_grouping_evidence_url: null,
  copyright_policy: 'facts-and-short-quotation',
  usage_boundary: 'Defines the model; does not prove concrete fitness.',
  link_policy: 'stable',
  expected_final_transport_locator: 'https://c4model.com/',
  expected_final_approved_at: '2026-07-23',
  expected_final_approval_note: 'Initial reviewed transport baseline',
};

const validCitation = {
  source_id: 'src-c4-model',
  citation_url: 'https://c4model.com/#SystemContextDiagram',
  roles: ['definition'],
  manifest_primary: true,
  usage_mode: 'facts-summary',
  attribution_note: 'C4 model, Simon Brown',
  modification_note: null,
  excerpt: null,
  quotation_reviewed: false,
};

const validDocument = {
  reviewed_at: '2026-07-23',
  copyright_checks: [
    'original-structure',
    'quotation-boundary',
    'attribution-complete',
    'illustration-rights',
  ],
  citations: [validCitation],
};

function ledger(overrides = {}) {
  return {
    schema_version: 1,
    sources: [validSource],
    documents: {'content/cases/example.mdx': validDocument},
    ...overrides,
  };
}

function document(overrides = {}) {
  return {
    filePath: '/repo/content/cases/example.mdx',
    file: 'cases/example.mdx',
    source: '',
    body: '[C4](https://c4model.com/#SystemContextDiagram)',
    metadata: {content_type: 'case'},
    headings: [],
    ...overrides,
  };
}

function sourceFixture(id, overrides = {}) {
  const canonical = `https://example.com/${id}`;
  return {
    ...validSource,
    id,
    canonical_locator: canonical,
    transport_locator: canonical,
    license_family_id: canonical,
    expected_final_transport_locator: canonical,
    ...overrides,
  };
}

function citationFixture(source, overrides = {}) {
  return {
    ...validCitation,
    source_id: source.id,
    citation_url: source.canonical_locator,
    roles: [source.allowed_evidence_roles[0]],
    manifest_primary: false,
    ...overrides,
  };
}

test('validates canonical source records and document citations', () => {
  const parsed = parseSourceLedger(ledger());
  assert.deepEqual(parsed.errors, []);

  const governed = validateSourceGovernance([document()], parsed.ledger);
  assert.deepEqual(governed.errors, []);
  assert.deepEqual(governed.governedLedger, parsed.ledger);
  assert.deepEqual(
    governed.primarySourcesByFile.get('cases/example.mdx'),
    ['https://c4model.com/#SystemContextDiagram'],
  );

  const cc0Source = {
    ...validSource,
    id: 'src-cc0-index',
    canonical_locator: 'https://github.com/example/public-index',
    transport_locator: 'https://github.com/example/public-index',
    license_family_id: 'github:example/public-index',
    expected_final_transport_locator: 'https://github.com/example/public-index',
    license: 'CC0-1.0',
    source_kind: 'community-index',
    tier: 'discovery',
    allowed_evidence_roles: ['discovery', 'learning'],
  };
  const cc0Parsed = parseSourceLedger(ledger({sources: [cc0Source], documents: {}}));
  assert.deepEqual(cc0Parsed.errors, []);
});

test('requires a valid source registration date', () => {
  const fixture = ledger();
  fixture.sources[0] = {
    ...fixture.sources[0],
    registered_at: '2026-02-30',
  };
  const parsed = parseSourceLedger(fixture);
  assert.match(
    parsed.errors.join('\n'),
    /registered_at must be a valid calendar date/,
  );
});

test('factual citations independently require a non-empty source version', () => {
  const fixture = ledger();
  fixture.sources[0] = {...fixture.sources[0], version: ''};

  const governed = validateSourceGovernance([document()], fixture);

  assert.match(
    governed.errors.join('\n'),
    /content\/cases\/example\.mdx: factual source "src-c4-model" is missing version/,
  );
  assert.doesNotMatch(
    governed.errors.join('\n'),
    /version change|floating-source-newer/,
  );
});

test('rejects an uncited primary or non-discovery source', () => {
  const uncited = sourceFixture('src-uncited-primary');
  const parsed = parseSourceLedger(
    ledger({sources: [validSource, uncited]}),
  );
  assert.deepEqual(parsed.errors, []);

  const governed = validateSourceGovernance([document()], parsed.ledger);

  assert.match(
    governed.errors.join('\n'),
    /source "src-uncited-primary".*not cited by any ledger document/,
  );
});

test('permits uncited discovery inventory only under the strict community-index boundary', () => {
  const discoveryInventory = sourceFixture('src-discovery-inventory', {
    source_kind: 'community-index',
    tier: 'discovery',
    allowed_evidence_roles: ['discovery', 'learning'],
  });
  const parsed = parseSourceLedger(
    ledger({sources: [validSource, discoveryInventory]}),
  );
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(
    validateSourceGovernance([document()], parsed.ledger).errors,
    [],
  );

  for (const invalid of [
    {...discoveryInventory, source_kind: 'official-docs'},
    {...discoveryInventory, tier: 'secondary'},
    {
      ...discoveryInventory,
      allowed_evidence_roles: ['discovery', 'definition'],
    },
  ]) {
    const governed = validateSourceGovernance(
      [document()],
      ledger({sources: [validSource, invalid]}),
    );
    assert.match(
      governed.errors.join('\n'),
      /source "src-discovery-inventory".*not cited by any ledger document/,
    );
  }
});

test('projects only citations that satisfy every manifest primary gate', async (t) => {
  const cases = [
    {
      name: 'primary factual',
      source: {
        tier: 'primary',
        source_kind: 'official-docs',
        allowed_evidence_roles: ['definition'],
      },
      citation: {
        roles: ['definition'],
        manifest_primary: true,
        usage_mode: 'facts-summary',
      },
      expectedProjection: true,
      expectedError: null,
    },
    {
      name: 'secondary comparison',
      source: {
        tier: 'secondary',
        source_kind: 'textbook',
        allowed_evidence_roles: ['comparison'],
      },
      citation: {
        roles: ['comparison'],
        manifest_primary: true,
        usage_mode: 'facts-summary',
      },
      expectedProjection: false,
      expectedError: /cannot be manifest_primary/,
    },
    {
      name: 'community index',
      source: {
        tier: 'discovery',
        source_kind: 'community-index',
        allowed_evidence_roles: ['learning'],
      },
      citation: {
        roles: ['learning'],
        manifest_primary: true,
        usage_mode: 'facts-summary',
      },
      expectedProjection: false,
      expectedError: /cannot be manifest_primary/,
    },
    {
      name: 'navigation only',
      source: {
        tier: 'primary',
        source_kind: 'official-docs',
        allowed_evidence_roles: ['learning'],
      },
      citation: {
        roles: ['learning'],
        manifest_primary: true,
        usage_mode: 'navigation-only',
      },
      expectedProjection: false,
      expectedError: /cannot be manifest_primary/,
    },
    {
      name: 'not explicitly primary',
      source: {
        tier: 'primary',
        source_kind: 'official-docs',
        allowed_evidence_roles: ['definition'],
      },
      citation: {
        roles: ['definition'],
        manifest_primary: false,
        usage_mode: 'facts-summary',
      },
      expectedProjection: false,
      expectedError: null,
    },
  ];

  for (const fixture of cases) {
    await t.test(fixture.name, () => {
      const source = sourceFixture(
        `src-projection-${fixture.name.replaceAll(' ', '-')}`,
        fixture.source,
      );
      const citation = citationFixture(source, fixture.citation);
      const governed = validateSourceGovernance(
        [
          document({
            body: `[Source](${citation.citation_url})`,
            metadata: {content_type: 'reference'},
          }),
        ],
        {
          schema_version: 1,
          sources: [source],
          documents: {
            'content/cases/example.mdx': {
              ...validDocument,
              citations: [citation],
            },
          },
        },
      );

      assert.deepEqual(
        governed.primarySourcesByFile.get('cases/example.mdx'),
        fixture.expectedProjection ? [citation.citation_url] : [],
      );
      if (fixture.expectedError) {
        assert.match(
          governed.errors.join('\n'),
          new RegExp(
            `content/cases/example\\.mdx: citation "${source.id}" ${fixture.expectedError.source}`,
          ),
        );
      } else {
        assert.deepEqual(governed.errors, []);
      }
    });
  }
});

test('rejects duplicate sources invalid enums and dangling citations', () => {
  const malformedSource = {
    ...validSource,
    id: 'src-malformed',
    canonical_locator: 'https://example.com/work#fragment',
    transport_locator: 'https://example.com/work?lost=1',
    query_insensitive: false,
    author_or_org: '',
    checked_at: '2026-02-30',
    version: '',
    source_kind: 'search-result',
    tier: 'trusted',
    allowed_evidence_roles: ['truth'],
    license: 'Unknown',
    license_scope: '',
    license_family_id: 'https://example.com/',
    copyright_policy: 'copy-anything',
    usage_boundary: '',
    link_policy: 'sometimes',
    extra: true,
  };
  const duplicate = {...validSource};
  const malformedDocument = {
    ...validDocument,
    reviewed_at: '2026-02-30',
    citations: [
      {...validCitation, source_id: 'src-missing'},
      {...validCitation, source_id: 'src-c4-model', roles: ['runtime-fact']},
      {...validCitation},
      {...validCitation},
    ],
    extra: true,
  };
  const parsed = parseSourceLedger({
    schema_version: 1,
    sources: [validSource, duplicate, malformedSource],
    documents: {
      'outside/example.mdx': malformedDocument,
      'content/missing.mdx': malformedDocument,
    },
    extra: true,
  });
  const joined = parsed.errors.join('\n');
  assert.deepEqual(parsed.ledger, {
    schema_version: 1,
    sources: [],
    documents: {},
  });

  for (const pattern of [
    /unknown field.*extra/i,
    /duplicate source id/i,
    /duplicate canonical locator/i,
    /canonical_locator.*fragment/i,
    /source_kind/i,
    /tier/i,
    /allowed_evidence_roles/i,
    /license.*allowlist/i,
    /copyright_policy/i,
    /link_policy/i,
    /author_or_org.*non-empty/i,
    /version.*non-empty/i,
    /license_scope.*non-empty/i,
    /usage_boundary.*non-empty/i,
    /license_family_id/i,
    /reviewed_at.*calendar date/i,
    /document path.*content\//i,
    /dangling|does not exist/i,
    /citation role/i,
    /duplicate citation/i,
  ]) {
    assert.match(joined, pattern);
  }

  const aliasAndLifecycle = parseSourceLedger(ledger({
    sources: [
      {
        ...validSource,
        locator_aliases: [{
          locator: 'https://old.example.com/c4',
          transport_locator: 'https://old.example.com/c4',
        }],
      },
      {
        ...validSource,
        id: 'src-retired',
        canonical_locator: 'https://example.com/retired',
        transport_locator: 'https://example.com/retired',
        license_family_id: 'https://example.com/retired',
        expected_final_transport_locator: 'https://example.com/retired',
        link_policy: 'retired',
      },
      {
        ...validSource,
        id: 'src-active-tombstone',
        canonical_locator: 'https://example.com/active',
        transport_locator: 'https://example.com/active',
        license_family_id: 'https://example.com/active',
        expected_final_transport_locator: 'https://example.com/active',
        tombstone: {
          retired_at: '2026-07-23',
          replacement_source_id: 'src-does-not-exist',
          reason: 'Moved',
        },
      },
    ],
  }));
  const lifecycleErrors = aliasAndLifecycle.errors.join('\n');
  assert.match(lifecycleErrors, /alias.*missing required field.*expected_final_transport_locator/i);
  assert.match(lifecycleErrors, /retired source must have a tombstone/i);
  assert.match(lifecycleErrors, /active source must not carry a tombstone/i);
  assert.match(lifecycleErrors, /replacement.*does not exist/i);

  const queryAndTransportConflict = parseSourceLedger(ledger({
    sources: [
      {
        ...validSource,
        id: 'src-query-one',
        canonical_locator: 'https://example.com/work?display=one',
        transport_locator: 'https://example.com/work',
        query_insensitive: true,
        license_family_id: 'https://example.com/work?display=one',
        expected_final_transport_locator: 'https://example.com/work',
      },
      {
        ...validSource,
        id: 'src-query-two',
        canonical_locator: 'https://example.com/work?display=two',
        transport_locator: 'https://example.com/work',
        query_insensitive: true,
        license_family_id: 'https://example.com/work?display=two',
        expected_final_transport_locator: 'https://example.com/work',
      },
    ],
  }));
  assert.match(
    queryAndTransportConflict.errors.join('\n'),
    /conflicting transport locator/i,
  );
});

test('extracts visible external links without code or comment false positives', () => {
  const links = extractExternalLinks({
    file: 'paths/example.mdx',
    body: [
      '[Visible](https://Example.com/Path?x=1#part).',
      '<https://example.com/auto?q=1#anchor>',
      '<Card href="https://example.com/mdx#part" />',
      '```md',
      '[Hidden](https://example.com/code)',
      '```javascript',
      '[Still hidden](https://example.com/not-a-closing-fence)',
      '```',
      '<!--',
      '```md',
      '-->',
      '[Visible after comment](https://example.com/comment-fence)',
      '<!-- [Hidden](https://example.com/comment) -->',
      '[Visible again](https://Example.com/Path?x=1#part)',
    ].join('\n'),
  });
  assert.deepEqual(links, [
    'https://example.com/auto?q=1#anchor',
    'https://example.com/comment-fence',
    'https://example.com/mdx#part',
    'https://Example.com/Path?x=1#part',
  ]);
  assert.deepEqual(
    extractExternalLinks({
      file: 'references/index.mdx',
      body: '<SourceLedger href="https://example.com/generated" />',
    }),
    [],
  );

  for (const falseMount of [
    '`<SourceLedger />`',
    '\\<SourceLedger />',
    '{/* example string: "<SourceLedger />" */}',
    '    <SourceLedger />',
    '\t<SourceLedger />',
  ]) {
    assert.deepEqual(
      extractExternalLinks({
        file: 'references/index.mdx',
        body: `${falseMount} [Visible](https://example.com/still-visible)`,
      }),
      ['https://example.com/still-visible'],
    );
  }
});

test('recognizes only line-exclusive top-level SourceLedger mounts', () => {
  assert.equal(isTopLevelSourceLedgerMount('<SourceLedger />'), true);
  assert.equal(
    isTopLevelSourceLedgerMount('   <SourceLedger mode="compact" />'),
    true,
  );
  for (const line of [
    '    <SourceLedger />',
    '\t<SourceLedger />',
    '`<SourceLedger />`',
    '\\<SourceLedger />',
    '"<SourceLedger />"',
    '{const example = "<SourceLedger />"}',
    '<SourceLedger></SourceLedger>',
    '<SourceLedger /> trailing text',
  ]) {
    assert.equal(isTopLevelSourceLedgerMount(line), false, line);
  }
});

test('requires complete copyright review records', () => {
  const missing = parseSourceLedger(ledger({
    documents: {
      'content/cases/example.mdx': {
        ...validDocument,
        copyright_checks: [
          'original-structure',
          'original-structure',
          'quotation-boundary',
        ],
      },
    },
  }));
  const joined = missing.errors.join('\n');
  assert.match(joined, /copyright_checks.*duplicate/i);
  assert.match(joined, /attribution-complete/i);
  assert.match(joined, /illustration-rights/i);

  const community = {
    ...validSource,
    id: 'src-index',
    canonical_locator: 'https://example.com/index',
    transport_locator: 'https://example.com/index',
    expected_final_transport_locator: 'https://example.com/index',
    license_family_id: 'https://example.com/index',
    source_kind: 'community-index',
    tier: 'secondary',
    allowed_evidence_roles: ['definition'],
  };
  const local = {
    ...validSource,
    id: 'src-illustration',
    canonical_locator: '/img/example.png',
    transport_locator: '/img/example.png',
    query_insensitive: false,
    license_family_id: '/img/example.png',
    license: 'LicenseRef-Atlas-Original',
    source_kind: 'original-illustration',
    tier: 'primary',
    allowed_evidence_roles: ['definition'],
    copyright_policy: 'original-atlas',
    link_policy: null,
    expected_final_transport_locator: '/img/example.png',
  };
  const parsed = parseSourceLedger(ledger({sources: [validSource, community, local]}));
  assert.match(parsed.errors.join('\n'), /community-index.*discovery/i);
  assert.match(parsed.errors.join('\n'), /original-illustration.*illustration/i);
});

test('allows query-only transport differences for query-insensitive source identity', () => {
  const canonical = 'https://example.com/download';
  const queryTransport = `${canonical}?download=1`;
  const queryInsensitiveSource = sourceFixture('src-query-download', {
    canonical_locator: canonical,
    transport_locator: queryTransport,
    query_insensitive: true,
    license_family_id: canonical,
    expected_final_transport_locator: queryTransport,
  });
  const citation = citationFixture(queryInsensitiveSource, {
    citation_url: `${canonical}?view=reader#overview`,
  });
  const parsed = parseSourceLedger(ledger({
    sources: [queryInsensitiveSource],
    documents: {
      'content/cases/example.mdx': {
        ...validDocument,
        citations: [citation],
      },
    },
  }));

  assert.deepEqual(parsed.errors, []);
  assert.equal(citationMatchesSource(citation.citation_url, queryInsensitiveSource), true);

  for (const invalidTransport of [
    'http://example.com/download?download=1',
    'https://other.example.com/download?download=1',
    'https://example.com/other?download=1',
    'https://example.com/download?download=1#fragment',
  ]) {
    const invalid = parseSourceLedger(ledger({
      sources: [{
        ...queryInsensitiveSource,
        transport_locator: invalidTransport,
      }],
      documents: {},
    }));
    assert.match(
      invalid.errors.join('\n'),
      /transport_locator/u,
      `Must reject non-query transport difference: ${invalidTransport}`,
    );
  }
});

test('keeps stable source identity across citation anchors queries and locator migration', () => {
  assert.equal(
    canonicalizeTransportLocator('HTTPS://GitHub.COM:443/Org/Repo/blob/main/file.js?plain=1#L10-L20'),
    'https://github.com/Org/Repo/blob/main/file.js?plain=1',
  );

  const approvedRedirect = parseSourceLedger(
    ledger({
      sources: [
        {
          ...validSource,
          expected_final_transport_locator:
            'https://docs.example.com/current-page',
          expected_final_approved_at: '2026-07-24',
          expected_final_approval_note:
            'Permanent HTTPS redirect manually reviewed',
        },
      ],
    }),
  );
  assert.deepEqual(approvedRedirect.errors, []);

  const github = {
    ...validSource,
    id: 'src-github-file',
    canonical_locator: 'https://github.com/Org/Repo/blob/main/file.js',
    transport_locator: 'https://github.com/Org/Repo/blob/main/file.js',
    query_insensitive: true,
    license_family_id: 'github:org/repo',
    expected_final_transport_locator: 'https://github.com/Org/Repo/blob/main/file.js',
  };
  for (const url of [
    'https://github.com/Org/Repo/blob/main/file.js#L10-L20',
    'https://github.com/Org/Repo/blob/main/file.js#L30-L35',
    'https://github.com/Org/Repo/blob/main/file.js?plain=1#L10-L20',
  ]) {
    assert.equal(citationMatchesSource(url, github), true);
  }

  const querySensitive = {...github, query_insensitive: false};
  assert.equal(
    citationMatchesSource('https://github.com/Org/Repo/blob/main/file.js?version=1', querySensitive),
    false,
  );
  assert.notEqual(
    canonicalizeTransportLocator('https://example.com/work?version=1'),
    canonicalizeTransportLocator('https://example.com/work?version=2'),
  );

  const wrongQueryCitation = parseSourceLedger({
    schema_version: 1,
    sources: [{
      ...validSource,
      id: 'src-version-one',
      canonical_locator: 'https://example.com/work?version=1',
      transport_locator: 'https://example.com/work?version=1',
      license_family_id: 'https://example.com/work?version=1',
      expected_final_transport_locator: 'https://example.com/work?version=1',
    }],
    documents: {
      'content/cases/example.mdx': {
        ...validDocument,
        citations: [{
          ...validCitation,
          source_id: 'src-version-one',
          citation_url: 'https://example.com/work?version=2',
        }],
      },
    },
  });
  assert.match(
    wrongQueryCitation.errors.join('\n'),
    /citation URL does not match source canonical or alias transport/i,
  );

  const migrated = {
    ...github,
    canonical_locator: 'https://github.com/Org/Repo/blob/main/new-file.js',
    transport_locator: 'https://github.com/Org/Repo/blob/main/new-file.js',
    expected_final_transport_locator: 'https://github.com/Org/Repo/blob/main/new-file.js',
    locator_aliases: [{
      locator: 'https://github.com/Org/Repo/blob/main/file.js',
      transport_locator: 'https://github.com/Org/Repo/blob/main/file.js',
      expected_final_transport_locator: 'https://github.com/Org/Repo/blob/main/file.js',
      expected_final_approved_at: '2026-07-23',
      expected_final_approval_note: 'Approved historical transport',
      superseded_at: '2026-07-23',
    }],
  };
  assert.equal(
    citationMatchesSource('https://github.com/Org/Repo/blob/main/file.js#L10-L20', migrated),
    true,
  );
  assert.equal(
    citationMatchesSource(
      'https://github.com/Org/Repo/blob/main/file.js#L10-L20',
      {...migrated, locator_aliases: []},
    ),
    false,
  );

  const retiredA = {
    ...validSource,
    id: 'src-a',
    tombstone: {retired_at: '2026-07-23', replacement_source_id: 'src-b', reason: 'Moved'},
    link_policy: 'retired',
  };
  const retiredB = {
    ...validSource,
    id: 'src-b',
    canonical_locator: 'https://example.com/b',
    transport_locator: 'https://example.com/b',
    license_family_id: 'https://example.com/b',
    expected_final_transport_locator: 'https://example.com/b',
    tombstone: {retired_at: '2026-07-23', replacement_source_id: 'src-a', reason: 'Moved'},
    link_policy: 'retired',
  };
  const parsed = parseSourceLedger(ledger({sources: [retiredA, retiredB]}));
  assert.match(parsed.errors.join('\n'), /replacement cycle/i);

  const secondary = {
    ...validSource,
    id: 'src-secondary',
    canonical_locator: 'https://example.com/comparison',
    transport_locator: 'https://example.com/comparison',
    license_family_id: 'https://example.com/comparison',
    expected_final_transport_locator: 'https://example.com/comparison',
    source_kind: 'independent-blog',
    tier: 'secondary',
    allowed_evidence_roles: ['comparison'],
  };
  const secondaryCitation = {
    ...validCitation,
    source_id: secondary.id,
    citation_url: secondary.canonical_locator,
    roles: ['comparison'],
    manifest_primary: true,
  };
  const invalidProjection = validateSourceGovernance(
    [document({
      body: `[Comparison](${secondary.canonical_locator})`,
      metadata: {content_type: 'reference'},
    })],
    {
      schema_version: 1,
      sources: [secondary],
      documents: {
        'content/cases/example.mdx': {
          ...validDocument,
          citations: [secondaryCitation],
        },
        'content/missing.mdx': validDocument,
      },
    },
  );
  assert.match(invalidProjection.errors.join('\n'), /cannot be manifest_primary/i);
  assert.match(invalidProjection.errors.join('\n'), /ledger document does not exist/i);
  assert.deepEqual(
    invalidProjection.primarySourcesByFile.get('cases/example.mdx'),
    [],
  );

  const invalidDirectGovernance = validateSourceGovernance(
    [document()],
    {
      schema_version: 1,
      sources: [validSource],
      documents: {
        'content/cases/example.mdx': {
          ...validDocument,
          copyright_checks: ['original-structure'],
          citations: [{
            ...validCitation,
            roles: ['runtime-fact'],
          }],
        },
      },
    },
  );
  assert.match(
    invalidDirectGovernance.errors.join('\n'),
    /citation role "runtime-fact".*not allowed/i,
  );
  assert.match(
    invalidDirectGovernance.errors.join('\n'),
    /copyright_checks.*attribution-complete/i,
  );

  const localIllustration = {
    ...validSource,
    id: 'src-local-illustration',
    canonical_locator: '/img/example.png',
    transport_locator: '/img/example.png',
    license_family_id: '/img/example.png',
    expected_final_transport_locator: '/img/example.png',
    source_kind: 'original-illustration',
    allowed_evidence_roles: ['illustration'],
    license: 'LicenseRef-Atlas-Original',
    copyright_policy: 'original-atlas',
    link_policy: null,
  };
  const orphanedLocalCitation = validateSourceGovernance(
    [document({body: '# No image here', metadata: {content_type: 'reference'}})],
    {
      schema_version: 1,
      sources: [localIllustration],
      documents: {
        'content/cases/example.mdx': {
          ...validDocument,
          citations: [{
            ...validCitation,
            source_id: localIllustration.id,
            citation_url: localIllustration.canonical_locator,
            roles: ['illustration'],
            manifest_primary: false,
            usage_mode: 'original-illustration',
          }],
        },
      },
    },
  );
  assert.match(
    orphanedLocalCitation.errors.join('\n'),
    /local citation.*not visible/i,
  );

  const referencesOrphan = validateSourceGovernance(
    [document({
      filePath: '/repo/content/references/index.mdx',
      file: 'references/index.mdx',
      body: '# Hand-written references page',
      metadata: {content_type: 'reference'},
    })],
    {
      schema_version: 1,
      sources: [validSource],
      documents: {
        'content/references/index.mdx': validDocument,
      },
    },
  );
  assert.match(referencesOrphan.errors.join('\n'), /not visible/i);

  const generatedReferences = validateSourceGovernance(
    [document({
      filePath: '/repo/content/references/index.mdx',
      file: 'references/index.mdx',
      body: '<SourceLedger />',
      metadata: {content_type: 'reference'},
    })],
    {
      schema_version: 1,
      sources: [validSource],
      documents: {
        'content/references/index.mdx': validDocument,
      },
    },
  );
  assert.deepEqual(generatedReferences.errors, []);

  for (const hiddenBody of [
    '<!-- <SourceLedger /> -->',
    '```mdx\n<SourceLedger />\n```',
    '`<SourceLedger />`',
    '\\<SourceLedger />',
    '{/* example string: "<SourceLedger />" */}',
  ]) {
    const hiddenReferences = validateSourceGovernance(
      [document({
        filePath: '/repo/content/references/index.mdx',
        file: 'references/index.mdx',
        body: hiddenBody,
        metadata: {content_type: 'reference'},
      })],
      {
        schema_version: 1,
        sources: [validSource],
        documents: {
          'content/references/index.mdx': validDocument,
        },
      },
    );
    assert.match(hiddenReferences.errors.join('\n'), /not visible/i);
  }

  const exclusiveComponent = validateSourceGovernance(
    [document({
      filePath: '/repo/content/references/index.mdx',
      file: 'references/index.mdx',
      body: '  <SourceLedger mode="compact" />  ',
      metadata: {content_type: 'reference'},
    })],
    {
      schema_version: 1,
      sources: [validSource],
      documents: {
        'content/references/index.mdx': validDocument,
      },
    },
  );
  assert.deepEqual(exclusiveComponent.errors, []);
});

test('does not treat learning indexes as factual evidence', () => {
  const indexes = ['src-index-one', 'src-index-two', 'src-index-three'].map((id) =>
    sourceFixture(id, {
      source_kind: 'community-index',
      tier: 'discovery',
      allowed_evidence_roles: ['discovery', 'learning'],
    }));
  const indexCitations = indexes.map((source) =>
    citationFixture(source, {
      roles: ['learning'],
      usage_mode: 'navigation-only',
    }));
  const governed = validateSourceGovernance(
    [document({
      body: indexes.map((source) => `[Index](${source.canonical_locator})`).join('\n'),
    })],
    ledger({
      sources: indexes,
      documents: {
        'content/cases/example.mdx': {...validDocument, citations: indexCitations},
      },
    }),
  );
  assert.match(
    governed.errors.join('\n'),
    /case requires a primary\/first-party factual source/i,
  );

  const disguised = parseSourceLedger(ledger({
    sources: [{
      ...indexes[0],
      tier: 'secondary',
      allowed_evidence_roles: ['definition'],
    }],
    documents: {},
  }));
  assert.match(disguised.errors.join('\n'), /community-index must use discovery tier/i);
  assert.match(disguised.errors.join('\n'), /community-index role "definition"/i);

  const blog = sourceFixture('src-independent-blog', {
    source_kind: 'independent-blog',
    tier: 'secondary',
    allowed_evidence_roles: ['comparison'],
  });
  const blogGoverned = validateSourceGovernance(
    [document({body: `[Comparison](${blog.canonical_locator})`})],
    ledger({
      sources: [blog],
      documents: {
        'content/cases/example.mdx': {
          ...validDocument,
          citations: [citationFixture(blog, {roles: ['comparison']})],
        },
      },
    }),
  );
  assert.match(
    blogGoverned.errors.join('\n'),
    /case requires a primary\/first-party factual source/i,
  );
});

test('enforces license-specific copyright policies', () => {
  const cases = [
    ['CC-BY-4.0', 'facts-and-short-quotation', 'adapt-with-attribution'],
    ['CC-BY-SA-4.0', 'facts-and-short-quotation', 'adapt-sharealike-review'],
    [
      'LicenseRef-US-Gov-Public-Domain',
      'facts-and-short-quotation',
      'public-domain-with-provenance',
    ],
    ['LicenseRef-All-Rights-Reserved', 'adapt-with-attribution', 'facts-and-short-quotation'],
    [
      'LicenseRef-MCP-Specification-Transition',
      'adapt-with-attribution',
      'facts-and-short-quotation',
    ],
    [
      'LicenseRef-CC-BY-NC-ND-Unversioned',
      'adapt-with-attribution',
      'facts-and-short-quotation',
    ],
    [
      'LicenseRef-New-API-Docs-License-Conflict',
      'adapt-with-attribution',
      'facts-and-short-quotation',
    ],
  ];
  for (const [license, actual, expected] of cases) {
    const source = sourceFixture(`src-policy-${cases.indexOf(cases.find((item) => item[0] === license))}`, {
      license,
      copyright_policy: actual,
    });
    const parsed = parseSourceLedger(ledger({sources: [source], documents: {}}));
    assert.match(parsed.errors.join('\n'), new RegExp(source.id));
    assert.match(parsed.errors.join('\n'), new RegExp(actual));
    assert.match(parsed.errors.join('\n'), new RegExp(expected));
  }

  const vendor = sourceFixture('src-vendor', {
    source_kind: 'vendor-reference-architecture',
    tier: 'first-party',
    license: 'CC-BY-4.0',
    copyright_policy: 'adapt-with-attribution',
  });
  assert.match(
    parseSourceLedger(ledger({sources: [vendor], documents: {}})).errors.join('\n'),
    /src-vendor.*adapt-with-attribution.*vendor-claims-separated/i,
  );

  const original = sourceFixture('src-original', {
    canonical_locator: '/img/original.png',
    transport_locator: '/img/original.png',
    license_family_id: '/img/original.png',
    expected_final_transport_locator: '/img/original.png',
    source_kind: 'original-illustration',
    allowed_evidence_roles: ['illustration'],
    license: 'LicenseRef-Atlas-Original',
    copyright_policy: 'facts-and-short-quotation',
    link_policy: null,
  });
  assert.match(
    parseSourceLedger(ledger({sources: [original], documents: {}})).errors.join('\n'),
    /src-original.*facts-and-short-quotation.*original-atlas/i,
  );

  const cc0 = sourceFixture('src-cc0-approved', {
    source_kind: 'community-index',
    tier: 'discovery',
    allowed_evidence_roles: ['discovery', 'learning'],
    license: 'CC0-1.0',
    copyright_policy: 'facts-and-short-quotation',
  });
  assert.deepEqual(
    parseSourceLedger(ledger({sources: [cc0], documents: {}})).errors,
    [],
  );
});

test('keeps vendor claims and illustration rights explicit', () => {
  const vendor = sourceFixture('src-vendor-claim', {
    source_kind: 'vendor-reference-architecture',
    tier: 'first-party',
    copyright_policy: 'vendor-claims-separated',
    allowed_evidence_roles: ['case-evidence'],
  });
  const original = sourceFixture('src-original-art', {
    canonical_locator: '/img/original-art.png',
    transport_locator: '/img/original-art.png',
    license_family_id: '/img/original-art.png',
    expected_final_transport_locator: '/img/original-art.png',
    source_kind: 'original-illustration',
    allowed_evidence_roles: ['illustration'],
    license: 'LicenseRef-Atlas-Original',
    copyright_policy: 'original-atlas',
    link_policy: null,
  });
  const missingRights = parseSourceLedger(ledger({
    sources: [vendor, original],
    documents: {
      'content/cases/example.mdx': {
        ...validDocument,
        copyright_checks: validDocument.copyright_checks.filter(
          (check) => check !== 'illustration-rights',
        ),
        citations: [
          citationFixture(vendor, {roles: ['case-evidence']}),
          citationFixture(original, {
            roles: ['definition'],
            usage_mode: 'original-illustration',
            modification_note: 'Drawn by Atlas',
            quotation_reviewed: true,
          }),
        ],
      },
    },
  }));
  const errors = missingRights.errors.join('\n');
  assert.match(errors, /illustration-rights/i);
  assert.match(errors, /original-illustration.*illustration role|citation role "definition"/i);
});

test('enforces citation-level quotation adaptation and attribution records', () => {
  const adaptedLicenses = [
    'Apache-2.0',
    'MIT',
    'BSD-3-Clause',
    'EPL-2.0',
    'MPL-2.0',
    'GPL-3.0-only',
    'AGPL-3.0-only',
    'LicenseRef-All-Rights-Reserved',
    'LicenseRef-Proprietary-Standard',
    'CC-BY-NC-ND-4.0',
    'LicenseRef-CC-BY-NC-ND-Unversioned',
    'LicenseRef-MCP-Specification-Transition',
    'LicenseRef-New-API-Docs-License-Conflict',
    'CC0-1.0',
  ];
  for (const [index, license] of adaptedLicenses.entries()) {
    const source = sourceFixture(`src-no-adapt-${index}`, {
      license,
      source_kind: license === 'CC0-1.0' ? 'community-index' : 'official-docs',
      tier: license === 'CC0-1.0' ? 'discovery' : 'primary',
      allowed_evidence_roles: license === 'CC0-1.0' ? ['learning'] : ['implementation'],
    });
    const citation = citationFixture(source, {
      roles: [source.allowed_evidence_roles[0]],
      usage_mode: 'adapted-text',
      modification_note: 'Translated and condensed',
      quotation_reviewed: true,
    });
    const parsed = parseSourceLedger(ledger({
      sources: [source],
      documents: {
        'content/cases/example.mdx': {...validDocument, citations: [citation]},
      },
    }));
    assert.match(parsed.errors.join('\n'), new RegExp(`${source.id}.*${license}.*adapted-text`, 'i'));
  }

  const conservativeLicenses = [
    'Apache-2.0',
    'MIT',
    'BSD-3-Clause',
    'EPL-2.0',
    'MPL-2.0',
    'GPL-3.0-only',
    'AGPL-3.0-only',
    'LicenseRef-All-Rights-Reserved',
    'LicenseRef-Proprietary-Standard',
    'CC-BY-NC-ND-4.0',
    'LicenseRef-MCP-Specification-Transition',
    'LicenseRef-CC-BY-NC-ND-Unversioned',
    'LicenseRef-New-API-Docs-License-Conflict',
    'CC0-1.0',
  ];
  for (const [index, license] of conservativeLicenses.entries()) {
    const isCommunity = license === 'CC0-1.0';
    const source = sourceFixture(`src-conservative-${index}`, {
      license,
      source_kind: isCommunity ? 'community-index' : 'official-docs',
      tier: isCommunity ? 'discovery' : 'primary',
      allowed_evidence_roles: isCommunity
        ? ['discovery', 'learning']
        : ['implementation', 'learning'],
      copyright_policy: 'facts-and-short-quotation',
    });
    const citations = [
      citationFixture(source, {
        roles: ['learning'],
        usage_mode: 'navigation-only',
      }),
      citationFixture(source, {
        citation_url: `${source.canonical_locator}#facts`,
        roles: [isCommunity ? 'learning' : 'implementation'],
        usage_mode: 'facts-summary',
      }),
      citationFixture(source, {
        citation_url: `${source.canonical_locator}#quote`,
        roles: [isCommunity ? 'learning' : 'implementation'],
        usage_mode: 'short-quotation',
        excerpt: 'quoted words',
        quotation_reviewed: true,
      }),
    ];
    assert.deepEqual(
      parseSourceLedger(ledger({
        sources: [source],
        documents: {
          'content/cases/example.mdx': {...validDocument, citations},
        },
      })).errors,
      [],
      license,
    );

    if (isCommunity) {
      const factual = citationFixture(source, {
        roles: ['implementation'],
        usage_mode: 'facts-summary',
      });
      assert.match(
        parseSourceLedger(ledger({
          sources: [source],
          documents: {
            'content/cases/example.mdx': {
              ...validDocument,
              citations: [factual],
            },
          },
        })).errors.join('\n'),
        /community-index|citation role "implementation"/i,
      );
    }
  }

  const unapproved = sourceFixture('src-unapproved-adapt', {
    license: 'LicenseRef-Future-Unapproved',
  });
  const unapprovedCitation = citationFixture(unapproved, {
    usage_mode: 'adapted-text',
    modification_note: 'Adapted for Atlas',
    quotation_reviewed: true,
  });
  const unapprovedErrors = parseSourceLedger(ledger({
    sources: [unapproved],
    documents: {
      'content/cases/example.mdx': {
        ...validDocument,
        citations: [unapprovedCitation],
      },
    },
  })).errors.join('\n');
  assert.match(unapprovedErrors, /license allowlist.*LicenseRef-Future-Unapproved/i);
  assert.match(
    unapprovedErrors,
    /src-unapproved-adapt.*LicenseRef-Future-Unapproved.*adapted-text.*explicit adaptation policy required/i,
  );

  const futureLicense = 'LicenseRef-Future-Schema-Approved';
  approvedLicenses.push(futureLicense);
  try {
    const future = sourceFixture('src-future-adapt', {license: futureLicense});
    const futureCitation = citationFixture(future, {
      usage_mode: 'adapted-illustration',
      modification_note: 'Adapted for Atlas',
      quotation_reviewed: true,
    });
    const futureErrors = parseSourceLedger(ledger({
      sources: [future],
      documents: {
        'content/cases/example.mdx': {
          ...validDocument,
          citations: [futureCitation],
        },
      },
    })).errors.join('\n');
    assert.doesNotMatch(futureErrors, /license allowlist/i);
    assert.match(
      futureErrors,
      /src-future-adapt.*LicenseRef-Future-Schema-Approved.*adapted-illustration.*explicit adaptation policy required/i,
    );
  } finally {
    approvedLicenses.splice(approvedLicenses.indexOf(futureLicense), 1);
  }

  for (const [index, license] of [
    'CC-BY-4.0',
    'CC-BY-SA-4.0',
    'LicenseRef-US-Gov-Public-Domain',
    'LicenseRef-Atlas-Original',
  ].entries()) {
    const isOriginal = license === 'LicenseRef-Atlas-Original';
    const source = sourceFixture(`src-adapt-${index}`, {
      canonical_locator: isOriginal ? '/img/adapt.png' : `https://example.com/adapt-${index}`,
      transport_locator: isOriginal ? '/img/adapt.png' : `https://example.com/adapt-${index}`,
      license_family_id: isOriginal ? '/img/adapt.png' : `https://example.com/adapt-${index}`,
      expected_final_transport_locator: isOriginal ? '/img/adapt.png' : `https://example.com/adapt-${index}`,
      source_kind: isOriginal ? 'original-illustration' : 'official-docs',
      allowed_evidence_roles: [isOriginal ? 'illustration' : 'implementation'],
      license,
      copyright_policy: [
        'adapt-with-attribution',
        'adapt-sharealike-review',
        'public-domain-with-provenance',
        'original-atlas',
      ][index],
      link_policy: isOriginal ? null : 'stable',
    });
    const valid = citationFixture(source, {
      roles: source.allowed_evidence_roles,
      usage_mode: isOriginal ? 'adapted-illustration' : 'adapted-text',
      modification_note: license === 'CC-BY-SA-4.0'
        ? 'Condensed; share-alike compatibility reviewed and approved'
        : 'Condensed with changes recorded',
      quotation_reviewed: true,
    });
    assert.deepEqual(
      parseSourceLedger(ledger({
        sources: [source],
        documents: {
          'content/cases/example.mdx': {...validDocument, citations: [valid]},
        },
      })).errors,
      [],
    );
    const missingModification = {
      ...valid,
      modification_note: null,
      quotation_reviewed: false,
    };
    assert.match(
      parseSourceLedger(ledger({
        sources: [source],
        documents: {
          'content/cases/example.mdx': {
            ...validDocument,
            citations: [missingModification],
          },
        },
      })).errors.join('\n'),
      /modification_note.*non-empty|quotation_reviewed.*true/i,
    );
  }

  const quoteSource = validSource;
  for (const invalid of [
    {...validCitation, usage_mode: 'short-quotation', excerpt: null},
    {
      ...validCitation,
      usage_mode: 'short-quotation',
      excerpt: 'quoted words',
      attribution_note: '',
    },
    {
      ...validCitation,
      usage_mode: 'short-quotation',
      excerpt: 'quoted words',
      quotation_reviewed: false,
    },
    {...validCitation, usage_mode: 'facts-summary', excerpt: 'not allowed'},
    {...validCitation, usage_mode: 'navigation-only', excerpt: 'not allowed'},
    {...validCitation, usage_mode: 'navigation-only', roles: ['definition']},
  ]) {
    const parsed = parseSourceLedger(ledger({
      sources: [quoteSource],
      documents: {
        'content/cases/example.mdx': {...validDocument, citations: [invalid]},
      },
    }));
    assert.notEqual(parsed.errors.length, 0);
  }

  for (const usage_mode of ['facts-summary', 'short-quotation']) {
    const allowed = {
      ...validCitation,
      usage_mode,
      excerpt: usage_mode === 'short-quotation' ? 'quoted words' : null,
      quotation_reviewed: usage_mode === 'short-quotation',
    };
    assert.deepEqual(
      parseSourceLedger(ledger({
        documents: {
          'content/cases/example.mdx': {...validDocument, citations: [allowed]},
        },
      })).errors,
      [],
    );
  }
});

test('matches normalized quotation excerpts in the corresponding visible document body', () => {
  assert.equal(
    normalizeVisibleQuotation(
      '**Visible** [label](https://example.com/destination) <https://example.com/auto>',
    ),
    'Visible label https://example.com/auto',
  );
  assert.equal(
    normalizeVisibleQuotation('`foo_bar` and v1~beta remain distinct from foobar and v1beta'),
    'foo_bar and v1~beta remain distinct from foobar and v1beta',
  );
  assert.equal(normalizeVisibleQuotation('`v1~~beta~~`'), 'v1~~beta~~');
  assert.notEqual(normalizeVisibleQuotation('`v1~~beta~~`'), 'v1beta');
  assert.equal(normalizeVisibleQuotation('`**literal**`'), '**literal**');
  assert.notEqual(normalizeVisibleQuotation('`**literal**`'), 'literal');
  assert.equal(
    normalizeVisibleQuotation('Use ``a `tick` and **literal**`` exactly'),
    'Use a `tick` and **literal** exactly',
  );
  assert.equal(
    normalizeVisibleQuotation('**strong** _emphasis_ and ~~reviewed removal~~'),
    'strong emphasis and reviewed removal',
  );

  const quotation = {
    ...validCitation,
    usage_mode: 'short-quotation',
    excerpt: '这是 C4 的 规范化 摘录。',
    quotation_reviewed: true,
  };
  const parsed = parseSourceLedger(ledger({
    documents: {
      'content/cases/example.mdx': {...validDocument, citations: [quotation]},
    },
  }));
  assert.deepEqual(parsed.errors, []);

  const visible = validateSourceGovernance(
    [document({
      body: [
        `[C4](https://c4model.com/#SystemContextDiagram)`,
        '> 这是 **C4** 的',
        '> [规范化](https://c4model.com/#SystemContextDiagram) 摘录。',
        '<!-- 示例占位摘录 -->',
        '```md',
        '示例占位摘录',
        '```',
      ].join('\n'),
    })],
    parsed.ledger,
  );
  assert.deepEqual(visible.errors, []);

  const missing = validateSourceGovernance(
    [document({body: '[C4](https://c4model.com/#SystemContextDiagram)'})],
    parsed.ledger,
  );
  assert.match(
    missing.errors.join('\n'),
    /content\/cases\/example\.mdx.*src-c4-model.*excerpt.*visible/i,
  );

  const inlineQuotation = {
    ...quotation,
    excerpt: 'Use `v1~~beta~~` and ``**literal**``.',
  };
  const inlineParsed = parseSourceLedger(ledger({
    documents: {
      'content/cases/example.mdx': {
        ...validDocument,
        citations: [inlineQuotation],
      },
    },
  }));
  const inlineVisible = validateSourceGovernance(
    [document({
      body: [
        '[C4](https://c4model.com/#SystemContextDiagram)',
        '> Use `v1~~beta~~` and ``**literal**``.',
      ].join('\n'),
    })],
    inlineParsed.ledger,
  );
  assert.deepEqual(inlineVisible.errors, []);
});
