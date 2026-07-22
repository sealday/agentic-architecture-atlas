import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  extractMarkdownBody,
  findContentFiles,
  findMarkdownHeadings,
  parseFrontMatter,
  readContentDocuments,
} from '../scripts/content-metadata.mjs';

test('parses catalog scalar types and arrays', () => {
  const source = `---
title: "A case"
subtitle: 'Quoted value'
featured: false
published: true
catalog_order: 6
protocols: []
source_kinds:
  - official-docs
  - open-source-project
---
# Body`;
  assert.deepEqual(parseFrontMatter(source), {
    title: 'A case',
    subtitle: 'Quoted value',
    featured: false,
    published: true,
    catalog_order: 6,
    protocols: [],
    source_kinds: ['official-docs', 'open-source-project'],
  });
});

test('removes a BOM before parsing front matter and extracting the body', () => {
  const source = '\uFEFF---\r\ntitle: BOM case\r\n---\r\n## Body';

  assert.deepEqual(parseFrontMatter(source), {title: 'BOM case'});
  assert.equal(extractMarkdownBody(source), '## Body');
});

test('discovers Markdown files recursively in sorted order', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'content-metadata-'));

  try {
    await mkdir(path.join(root, 'nested'), {recursive: true});
    await Promise.all([
      writeFile(path.join(root, 'z.mdx'), ''),
      writeFile(path.join(root, 'a.md'), ''),
      writeFile(path.join(root, 'ignored.txt'), ''),
      writeFile(path.join(root, 'nested', 'b.mdx'), ''),
    ]);

    assert.deepEqual(await findContentFiles(root), [
      path.join(root, 'a.md'),
      path.join(root, 'nested', 'b.mdx'),
      path.join(root, 'z.mdx'),
    ]);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('reads content documents with the public result shape', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'content-documents-'));
  const filePath = path.join(root, 'nested', 'case.mdx');
  const source = '---\ntitle: A case\nfeatured: true\n---\n## Body';

  try {
    await mkdir(path.dirname(filePath), {recursive: true});
    await writeFile(filePath, source);

    assert.deepEqual(await readContentDocuments(root), [
      {
        filePath,
        file: 'nested/case.mdx',
        source,
        body: '## Body',
        metadata: {title: 'A case', featured: true},
        headings: [{level: 2, text: 'Body', offset: 0}],
      },
    ]);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('finds only real Markdown headings', () => {
  const paddedHeading = '   ### Trimmed   ';
  const source = `---
fake: ## Front matter
---
## Real
## Inline comment <!-- note -->
${paddedHeading}
#### Not collected
> ## Blockquoted
prose ## Not a heading
##Not a heading
\`\`\`md
## Fenced
\`\`\`
<!-- ## Single line -->
<!--
## Commented
-->
~~~md
## Tilde fenced
~~~`;
  const body = extractMarkdownBody(source);
  assert.deepEqual(findMarkdownHeadings(body), [
    {level: 2, text: 'Real', offset: body.indexOf('## Real')},
    {level: 2, text: 'Inline comment', offset: body.indexOf('## Inline comment')},
    {level: 3, text: 'Trimmed', offset: body.indexOf('### Trimmed')},
  ]);
});

test('returns ordered heading tokens without collapsing duplicates', () => {
  const source = '## First\n\n### Child\n\n## First';

  assert.deepEqual(findMarkdownHeadings(source), [
    {level: 2, text: 'First', offset: source.indexOf('## First')},
    {level: 3, text: 'Child', offset: source.indexOf('### Child')},
    {level: 2, text: 'First', offset: source.lastIndexOf('## First')},
  ]);
});

test('ignores a heading suffix after an inline HTML comment that owns the line', () => {
  assert.deepEqual(findMarkdownHeadings('<!-- note --> ## Hidden'), []);
});

test('ignores a heading suffix on a multiline HTML comment closing line', () => {
  const source = `<!--
note
--> ## Hidden`;

  assert.deepEqual(findMarkdownHeadings(source), []);
});
