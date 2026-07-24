import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractInternalLinks,
  validateContentRelations,
} from '../scripts/content-relations.mjs';

const manifest = {
  schema_version: 1,
  topics: [
    {
      id: 'PR-01',
      type: 'principle',
      slug: '/principles/pr-01',
      published: true,
      adjacent_topics: ['STY-00'],
      related_cases: ['/cases/example'],
      related_questions: [],
    },
    {
      id: 'STY-00',
      type: 'style',
      slug: '/styles/sty-00',
      published: true,
      adjacent_topics: ['PR-01'],
      related_cases: ['/cases/example'],
      related_questions: [],
    },
    {
      id: 'CASE-01',
      type: 'case',
      slug: '/cases/example',
      published: true,
    },
  ],
};

const validDocument = {
  file: 'principles/pr-01.mdx',
  metadata: {content_type: 'principle', topic_id: 'PR-01'},
  body: [
    '[原则入口](/principles)',
    '[架构风格](/styles/sty-00)',
    '[案例](/cases/example)',
  ].join('\n'),
};

test('accepts visible parent, adjacent, and terminal links', () => {
  assert.deepEqual(
    validateContentRelations({documents: [validDocument], manifest}).errors,
    [],
  );
});

test('extracts and normalizes visible Markdown and JSX internal links', () => {
  assert.deepEqual(
    extractInternalLinks({
      body: [
        '[入口](/principles/?view=all#top)',
        '<a href="/styles/sty-00#tradeoffs">风格</a>',
        '<Link to="/methods/mth-03/?from=relations#lifecycle">方法</Link>',
        "<Link to='/modeling/mod-02/#container'>建模</Link>",
        '[案例](/cases/example/ "案例")',
        '[外部](https://example.com/path)',
      ].join('\n'),
    }),
    [
      '/cases/example',
      '/methods/mth-03',
      '/modeling/mod-02',
      '/principles',
      '/styles/sty-00',
    ],
  );
});

test('does not count Markdown images as visible relationship links', () => {
  const document = {
    ...validDocument,
    body: [
      '![原则入口](/principles)',
      '![架构风格](/styles/sty-00)',
      '![案例](/cases/example)',
    ].join('\n'),
  };
  assert.deepEqual(extractInternalLinks(document), []);
  assert.deepEqual(
    validateContentRelations({documents: [document], manifest}).errors,
    [
      'content/principles/pr-01.mdx: missing visible adjacent topic link "/styles/sty-00"',
      'content/principles/pr-01.mdx: missing visible parent link "/principles"',
      'content/principles/pr-01.mdx: missing visible related case or question link (expected one of: "/cases/example")',
    ],
  );
});

test('extracts only the outer destination from linked Markdown images', () => {
  assert.deepEqual(
    extractInternalLinks({
      body: [
        '[![parent diagram](/principles)](/not-a-relation)',
        '![adjacent diagram](/styles/sty-00)',
        '![case diagram](/cases/example)',
      ].join('\n'),
    }),
    ['/not-a-relation'],
  );
});

test('rejects prefixed and namespaced JSX pseudo-attributes', () => {
  const document = {
    ...validDocument,
    body: [
      '<Link data-to="/principles">目录</Link>',
      '<a aria-href="/styles/sty-00">风格</a>',
      '<svg><use xlink:href="/cases/example" /></svg>',
    ].join('\n'),
  };
  assert.deepEqual(extractInternalLinks(document), []);
  assert.deepEqual(
    validateContentRelations({documents: [document], manifest}).errors,
    [
      'content/principles/pr-01.mdx: missing visible adjacent topic link "/styles/sty-00"',
      'content/principles/pr-01.mdx: missing visible parent link "/principles"',
      'content/principles/pr-01.mdx: missing visible related case or question link (expected one of: "/cases/example")',
    ],
  );
});

test('ignores hidden and code-only internal links', () => {
  const document = {
    ...validDocument,
    body: [
      '<!-- [原则入口](/principles) -->',
      '```md',
      '[架构风格](/styles/sty-00)',
      '```',
      '`[案例](/cases/example)`',
    ].join('\n'),
  };
  assert.deepEqual(extractInternalLinks(document), []);
  assert.match(
    validateContentRelations({documents: [document], manifest}).errors.join(
      '\n',
    ),
    /missing visible parent link "\/principles"/,
  );
});

test('reports every missing visible adjacent link and the terminal OR gate', () => {
  const document = {
    ...validDocument,
    body: '[原则入口](/principles)',
  };
  const errors = validateContentRelations({
    documents: [document],
    manifest,
  }).errors.join('\n');
  assert.match(errors, /missing visible adjacent topic link "\/styles\/sty-00"/);
  assert.match(
    errors,
    /missing visible related case or question link \(expected one of: "\/cases\/example"\)/,
  );
});

test('lists every declared case and question candidate in terminal errors', () => {
  const mixedTerminalManifest = structuredClone(manifest);
  const principle = mixedTerminalManifest.topics.find(
    ({id}) => id === 'PR-01',
  );
  principle.related_questions = ['/questions/qst-01'];

  assert.deepEqual(
    validateContentRelations({
      documents: [
        {
          ...validDocument,
          body: validDocument.body.replace('[案例](/cases/example)', ''),
        },
      ],
      manifest: mixedTerminalManifest,
    }).errors,
    [
      'content/principles/pr-01.mdx: missing visible related case or question link (expected one of: "/cases/example", "/questions/qst-01")',
    ],
  );
});

test('accepts one visible related question when no related case is declared', () => {
  const questionManifest = structuredClone(manifest);
  const principle = questionManifest.topics.find(({id}) => id === 'PR-01');
  principle.related_cases = [];
  principle.related_questions = [
    '/questions/qst-01',
    '/questions/qst-02',
  ];
  questionManifest.topics.push({
    id: 'QST-01',
    type: 'question',
    slug: '/questions/qst-01',
    published: true,
  });
  questionManifest.topics.push({
    id: 'QST-02',
    type: 'question',
    slug: '/questions/qst-02',
    published: true,
  });

  assert.deepEqual(
    validateContentRelations({
      documents: [
        {
          ...validDocument,
          body: validDocument.body.replace(
            '[案例](/cases/example)',
            '[练习](/questions/qst-01)',
          ),
        },
      ],
      manifest: questionManifest,
    }).errors,
    [],
  );
});
