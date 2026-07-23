import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalizeTransportLocator,
  citationMatchesSource,
  extractExternalLinks,
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

test('keeps stable source identity across citation anchors queries and locator migration', () => {
  assert.equal(
    canonicalizeTransportLocator('HTTPS://GitHub.COM:443/Org/Repo/blob/main/file.js?plain=1#L10-L20'),
    'https://github.com/Org/Repo/blob/main/file.js?plain=1',
  );

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
});
