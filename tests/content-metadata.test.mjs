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

test('finds only real Markdown headings', () => {
  const paddedHeading = '   ### Trimmed   ';
  const source = `---
fake: ## Front matter
---
## Real
${paddedHeading}
#### Not collected
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
  assert.deepEqual([...findMarkdownHeadings(extractMarkdownBody(source))], [
    '## Real',
    '### Trimmed',
  ]);
});
