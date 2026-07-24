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
        '[案例](/cases/example/ "案例")',
        '[外部](https://example.com/path)',
      ].join('\n'),
    }),
    ['/cases/example', '/principles', '/styles/sty-00'],
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
  assert.match(errors, /missing visible related case or question link/);
});

test('accepts one visible related question when no related case is declared', () => {
  const questionManifest = structuredClone(manifest);
  const principle = questionManifest.topics.find(({id}) => id === 'PR-01');
  principle.related_cases = [];
  principle.related_questions = ['/questions/qst-01'];
  questionManifest.topics.push({
    id: 'QST-01',
    type: 'question',
    slug: '/questions/qst-01',
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
