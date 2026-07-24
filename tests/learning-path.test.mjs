import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  extractMarkdownBody,
  findMarkdownHeadings,
  parseFrontMatter,
} from '../scripts/content-metadata.mjs';
const requiredCaseSlugs = JSON.parse(
  await readFile(new URL('./fixtures/legacy-case-order.json', import.meta.url), 'utf8'),
).map(({slug}) => slug);

const learningPathFile = fileURLToPath(
  new URL('../content/paths/index.mdx', import.meta.url),
);
const pathDirectory = fileURLToPath(
  new URL('../content/paths/', import.meta.url),
);
const sourceLedgerFile = fileURLToPath(
  new URL('../src/generated/source-ledger.json', import.meta.url),
);
const roadmapImageDirectory = fileURLToPath(
  new URL('../static/img/paths/', import.meta.url),
);
const roadmapImageFile = fileURLToPath(
  new URL(
    '../static/img/paths/software-architecture-learning-roadmap.png',
    import.meta.url,
  ),
);

const mainStages = [
  ['01-architecture-thinking.mdx', '/paths/architecture-thinking'],
  ['02-module-boundaries.mdx', '/paths/module-boundaries'],
  ['03-distributed-systems.mdx', '/paths/distributed-systems'],
  ['04-reliability-state.mdx', '/paths/reliability-state'],
  ['05-production-governance.mdx', '/paths/production-governance'],
  ['06-agentic-architecture.mdx', '/paths/agentic-architecture'],
];

const topicPaths = [
  ['07-cloud-native-platform.mdx', '/paths/cloud-native-platform'],
  ['08-collaborative-state-frontend.mdx', '/paths/collaborative-state-frontend'],
  ['09-edge-physical-agents.mdx', '/paths/edge-physical-agents'],
  ['10-agent-platform-gateway.mdx', '/paths/agent-platform-gateway'],
];

const roadmapDocuments = [...mainStages, ...topicPaths];

const commonArticleHeadings = [
  '## 为什么学',
  '## 前置能力与跳过条件',
  '## 核心问题',
  '## 推荐学习顺序',
  '## 必读起点',
  '## 查漏补缺',
  '## 深入拓展',
  '## 用本站案例深化',
  '## 实践产出',
  '## 检查点',
  '## 继续学习',
];

const expectedMermaidFlowchart = [
  'flowchart LR',
  'S1["1 架构表达"] --> S2["2 模块边界"]',
  'S2 --> S3["3 分布式基础"]',
  'S3 --> S4["4 可靠性与状态"]',
  'S4 --> S5["5 生产治理"]',
  'S5 --> S6["6 Agentic 架构"]',
  'S5 -.按职责选择.-> T1["云原生与平台"]',
  'S5 -.按职责选择.-> T2["协作状态与前端"]',
  'S5 -.按职责选择.-> T3["边缘与物理智能体"]',
  'S6 -.按职责选择.-> T4["Agent 平台与模型网关"]',
];

const allowedRequiredSourceKinds = new Set([
  'standard',
  'paper',
  'official-docs',
  'official-repository',
  'source-code',
  'engineering-blog',
  'vendor-reference-architecture',
  'textbook',
]);

const commonSectionMinimums = new Map([
  ['为什么学', 30],
  ['前置能力与跳过条件', 30],
  ['核心问题', 24],
  ['推荐学习顺序', 24],
  ['必读起点', 12],
  ['查漏补缺', 20],
  ['深入拓展', 20],
  ['用本站案例深化', 20],
  ['实践产出', 20],
  ['检查点', 20],
  ['继续学习', 12],
]);

const canonicalCaseSlugs = new Set(requiredCaseSlugs);

const topicStageLinks = new Map([
  ['/paths/cloud-native-platform', '/paths/production-governance'],
  ['/paths/collaborative-state-frontend', '/paths/module-boundaries'],
  ['/paths/edge-physical-agents', '/paths/production-governance'],
  ['/paths/agent-platform-gateway', '/paths/agentic-architecture'],
]);

function stripIgnoredMarkdown(source) {
  const withoutComments = source.replace(/<!--[\s\S]*?-->/g, '');
  const lines = withoutComments.split(/\r?\n/);
  const visibleLines = [];
  let fence;

  for (const line of lines) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) {
        fence = marker[1][0];
      } else if (marker[1][0] === fence) {
        fence = undefined;
      }
      continue;
    }
    if (!fence) {
      visibleLines.push(line);
    }
  }

  return visibleLines.join('\n').replace(/(`+)[\s\S]*?\1/g, '');
}

function referenceDefinitions(source) {
  const definitions = new Map();
  const pattern = /^ {0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?(?:\s+.*)?$/gm;

  for (const [, identifier, href] of source.matchAll(pattern)) {
    definitions.set(identifier.trim().replace(/\s+/g, ' ').toLowerCase(), href);
  }

  return definitions;
}

function extractMarkdownLinks(source) {
  const visible = stripIgnoredMarkdown(source);
  const definitions = referenceDefinitions(visible);
  const links = new Set();

  const inlinePattern =
    /(?<!!)\[[^\]]+\]\(\s*(?:<([^>\s]+)>|([^)\s]+))(?:\s+["'][^"']*["'])?\s*\)/g;
  for (const match of visible.matchAll(inlinePattern)) {
    links.add(match[1] ?? match[2]);
  }

  for (const [, label, identifier] of visible.matchAll(
    /(?<!!)\[([^\]]+)\]\[([^\]]*)\]/g,
  )) {
    const key = (identifier || label).trim().replace(/\s+/g, ' ').toLowerCase();
    const href = definitions.get(key);
    if (href) {
      links.add(href);
    }
  }

  for (const [, label] of visible.matchAll(
    /(?<!!)\[([^\]]+)\](?![\[(:])/g,
  )) {
    const key = label.trim().replace(/\s+/g, ' ').toLowerCase();
    const href = definitions.get(key);
    if (href) {
      links.add(href);
    }
  }

  return links;
}

function extractExternalLinks(source) {
  const visible = stripIgnoredMarkdown(source);
  const links = new Set(
    [...extractMarkdownLinks(visible)].filter((href) =>
      href.startsWith('https://'),
    ),
  );

  for (const [, href] of visible.matchAll(/<((?:https:\/\/)[^>\s]+)>/g)) {
    links.add(href);
  }

  const hrefPattern =
    /\bhref\s*=\s*(?:["'](https:\/\/[^"']+)["']|\{\s*["'](https:\/\/[^"']+)["']\s*\}|(https:\/\/[^\s>]+))/g;
  for (const match of visible.matchAll(hrefPattern)) {
    links.add(match[1] ?? match[2] ?? match[3]);
  }

  return links;
}

function extractFencedBlocks(source, language) {
  const visible = source.replace(/<!--[\s\S]*?-->/g, '');
  const blocks = [];
  const pattern = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)\r?\n([\s\S]*?)^ {0,3}\1\s*$/gm;

  for (const [, , info, content] of visible.matchAll(pattern)) {
    if (info.trim().split(/\s+/)[0] === language) {
      blocks.push(content);
    }
  }

  return blocks;
}

function visibleMarkdownText(source) {
  return stripIgnoredMarkdown(source)
    .replace(/^ *(?:import|export)\b.*$/gm, '')
    .replace(/^ {0,3}\[[^\]]+\]:.*$/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_~|[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function substantiveCharacterCount(source) {
  return visibleMarkdownText(source).match(/[\p{L}\p{N}]/gu)?.length ?? 0;
}

function sectionForHeading(source, headingText) {
  const headings = findMarkdownHeadings(source).filter(
    ({level}) => level === 2,
  );
  const index = headings.findIndex(({text}) => text === headingText);
  assert.notEqual(index, -1, `Missing real heading: ## ${headingText}`);

  const start = source.indexOf('\n', headings[index].offset);
  const end = headings[index + 1]?.offset ?? source.length;
  return source.slice(start === -1 ? end : start + 1, end);
}

function assertSectionHasVisibleContent(
  source,
  headingText,
  label,
  minimumCharacters = 1,
) {
  const section = sectionForHeading(source, headingText);
  const count = substantiveCharacterCount(section);

  assert.ok(
    count >= minimumCharacters,
    `## ${headingText} in ${label} must contain at least ${minimumCharacters} substantive characters, found ${count}`,
  );
}

function assertArticleSubstance(body, label, {topic = false} = {}) {
  const visible = visibleMarkdownText(body);
  assert.doesNotMatch(
    visible,
    /(?:\bTODO\b|\bTBD\b|\bPLACEHOLDER\b|占位(?:符|内容)?|待填(?:写|充)?)/iu,
    `${label} contains a placeholder marker`,
  );

  for (const [heading, minimum] of commonSectionMinimums) {
    assertSectionHasVisibleContent(body, heading, label, minimum);
  }

  const sequence = sectionForHeading(body, '推荐学习顺序');
  const orderedItems = sequence
    .split(/\r?\n/)
    .filter((line) => /^ {0,3}\d+[.)]\s+/.test(line));
  assert.ok(
    orderedItems.length >= 3,
    `${label} ## 推荐学习顺序 must contain at least 3 ordered items`,
  );
  for (const item of orderedItems) {
    assert.ok(
      substantiveCharacterCount(item) >= 8,
      `${label} has a non-substantive recommended step: ${item}`,
    );
  }

  const startingPoint = sectionForHeading(body, '必读起点');
  assert.ok(
    extractExternalLinks(startingPoint).size > 0,
    `${label} ## 必读起点 must contain a real external link`,
  );

  const caseStudySection = sectionForHeading(body, '用本站案例深化');
  const caseLinks = [...extractMarkdownLinks(caseStudySection)].filter((href) =>
    canonicalCaseSlugs.has(href),
  );
  assert.ok(
    caseLinks.length > 0,
    `${label} ## 用本站案例深化 must contain a canonical case link`,
  );

  assertSectionHasVisibleContent(body, '实践产出', label, 20);
  assertSectionHasVisibleContent(body, '检查点', label, 20);

  if (topic) {
    const coverage = sectionForHeading(body, '当前已覆盖');
    assert.ok(
      substantiveCharacterCount(coverage) >= 30,
      `${label} ## 当前已覆盖 must contain substantive coverage text`,
    );
    const coverageCaseLinks = [...extractMarkdownLinks(coverage)].filter(
      (href) => canonicalCaseSlugs.has(href),
    );
    assert.ok(
      coverageCaseLinks.length > 0,
      `${label} ## 当前已覆盖 must contain a canonical case link`,
    );
  }
}

function assertHeadingsInOrder(source, headings, label) {
  const actualHeadings = findMarkdownHeadings(source).filter(
    ({level}) => level === 2,
  );
  let previousOffset = -1;

  for (const heading of headings) {
    const text = heading.replace(/^## /, '');
    const matches = actualHeadings.filter((candidate) => candidate.text === text);
    assert.equal(matches.length, 1, `${heading} must occur exactly once in ${label}`);
    assert.ok(
      matches[0].offset > previousOffset,
      `${heading} is out of order in ${label}`,
    );
    assertSectionHasVisibleContent(source, text, label);
    previousOffset = matches[0].offset;
  }
}

function isValidIsoDate(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return false;
  }
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseGeneratedSourceRegistry(ledger) {
  assert.equal(ledger.schema_version, 1);
  assert.ok(Array.isArray(ledger.sources) && ledger.sources.length > 0);
  assert.ok(ledger.documents && typeof ledger.documents === 'object');

  const sourcesById = new Map();
  for (const source of ledger.sources) {
    for (const field of [
      'id',
      'title',
      'author_or_org',
      'source_kind',
      'tier',
      'checked_at',
      'license',
      'copyright_policy',
      'usage_boundary',
    ]) {
      assert.equal(
        typeof source[field],
        'string',
        `${source.id ?? 'unknown source'} has invalid ${field}`,
      );
      assert.ok(source[field], `${source.id ?? 'unknown source'} has empty ${field}`);
    }
    assert.ok(
      isValidIsoDate(source.checked_at),
      `${source.id} has invalid checked_at: ${source.checked_at}`,
    );
    if (source.source_kind === 'community-index') {
      assert.equal(
        source.tier,
        'discovery',
        `${source.id} community index must use discovery tier`,
      );
    }
    sourcesById.set(source.id, source);
  }

  const byUrl = new Map();
  for (const [documentPath, document] of Object.entries(ledger.documents)) {
    assert.ok(document.title, `${documentPath} has no public title`);
    assert.ok(document.slug?.startsWith('/'), `${documentPath} has no public slug`);
    for (const citation of document.citations) {
      const source = sourcesById.get(citation.source_id);
      assert.ok(source, `${documentPath} cites missing source ${citation.source_id}`);
      const existing = byUrl.get(citation.citation_url);
      assert.ok(
        !existing || existing.id === source.id,
        `${citation.citation_url} resolves to multiple sources`,
      );
      byUrl.set(citation.citation_url, {
        id: source.id,
        sourceKind: source.source_kind,
        tier: source.tier,
        title: source.title,
      });
    }
  }

  return byUrl;
}

async function listFilesRecursively(root, predicate) {
  const files = [];

  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, {withFileTypes: true});
    } catch (error) {
      if (error.code === 'ENOENT') {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile() && predicate(entry.name)) {
        files.push(path.relative(root, entryPath).split(path.sep).join('/'));
      }
    }
  }

  await visit(root);
  return files.sort();
}

function parsePngChunks(buffer) {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  assert.ok(buffer.length >= 33, 'Roadmap PNG is too short to contain IHDR');
  assert.deepEqual(
    buffer.subarray(0, signature.length),
    signature,
    'Roadmap asset does not have a PNG signature',
  );

  const chunks = [];
  let offset = signature.length;
  while (offset < buffer.length) {
    assert.ok(
      offset + 12 <= buffer.length,
      `Truncated PNG chunk header at byte ${offset}`,
    );
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const end = offset + 12 + length;
    assert.ok(end <= buffer.length, `Truncated PNG ${type} chunk`);
    chunks.push({dataOffset: offset + 8, length, type});
    offset = end;
  }

  assert.equal(offset, buffer.length, 'PNG has trailing partial chunk data');
  return chunks;
}

function assertLinksTo(body, slug, label) {
  assert.ok(
    extractMarkdownLinks(body).has(slug),
    `${label} does not contain a real Markdown link to ${slug}`,
  );
}

async function readRequiredFile(filename, label) {
  try {
    return await readFile(filename, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      assert.fail(`Missing ${label}: ${filename}`);
    }
    throw error;
  }
}

async function readRoadmapDocuments() {
  const documents = [];

  for (const [filename, slug] of roadmapDocuments) {
    const documentPath = path.join(pathDirectory, filename);
    const source = await readRequiredFile(
      documentPath,
      `roadmap document ${filename}`,
    );
    documents.push({
      body: extractMarkdownBody(source),
      filename,
      metadata: parseFrontMatter(source),
      slug,
    });
  }

  return documents;
}

test('extracts real links across Markdown and MDX syntax', () => {
  const fixture = `
[inline](https://example.com/inline)
[angle](<https://example.com/angle>)
[reference][source]
[source]: https://example.com/reference
<https://example.com/autolink>
<a href="https://example.com/html">HTML</a>
<Link href={'https://example.com/mdx'}>MDX</Link>
<a href=https://example.com/unquoted>unquoted</a>

<!-- [comment](https://example.com/comment) -->
\`[inline code](https://example.com/inline-code)\`
\`\`\`md
[fence](https://example.com/fence)
\`\`\`
`;

  assert.deepEqual(
    [...extractExternalLinks(fixture)].sort(),
    [
      'https://example.com/angle',
      'https://example.com/autolink',
      'https://example.com/html',
      'https://example.com/inline',
      'https://example.com/mdx',
      'https://example.com/reference',
      'https://example.com/unquoted',
    ],
  );
  assert.deepEqual(
    [
      ...extractMarkdownLinks(`
![image is not a link](/cases/not-a-link)
[unused]: /cases/not-a-link-either
`),
    ],
    [],
  );
});

test('contains exactly the overview and ten declared roadmap documents', async () => {
  const actual = await listFilesRecursively(
    pathDirectory,
    (filename) => /\.mdx?$/i.test(filename),
  );
  const expected = [
    'index.mdx',
    ...roadmapDocuments.map(([filename]) => filename),
  ].sort();

  assert.deepEqual(actual, expected);
});

test('defines ordered slugs and non-empty article sections', async () => {
  const documents = await readRoadmapDocuments();

  for (const [index, document] of documents.entries()) {
    assert.equal(document.metadata.slug, document.slug);
    assert.equal(document.metadata.sidebar_position, index + 6);
    assertHeadingsInOrder(
      document.body,
      commonArticleHeadings,
      document.filename,
    );
    assertArticleSubstance(document.body, document.filename, {
      topic: index >= mainStages.length,
    });
  }

  for (const document of documents.slice(mainStages.length)) {
    const topicHeadings = ['## 当前已覆盖', '## 后续待补'];
    assertHeadingsInOrder(document.body, topicHeadings, document.filename);
  }
});

test('rejects placeholder markers and below-threshold roadmap sections', () => {
  assert.throws(
    () => assertArticleSubstance('TODO: fill this article', 'fixture.mdx'),
    /placeholder marker/,
  );
  assert.throws(
    () =>
      assertSectionHasVisibleContent(
        '## 实践产出\n短句',
        '实践产出',
        'fixture.mdx',
        20,
      ),
    /at least 20 substantive characters/,
  );
});

test('stops automatic pagination after the final main stage', async () => {
  const finalStageFile = path.join(pathDirectory, mainStages.at(-1)[0]);
  const source = await readRequiredFile(finalStageFile, 'final main stage');
  const metadata = parseFrontMatter(source);

  assert.equal(
    metadata.pagination_next,
    'null',
    'Final main stage must declare pagination_next: null',
  );
});

test('bounds topic gaps and links each topic to its prerequisite stage', async () => {
  const topics = (await readRoadmapDocuments()).slice(mainStages.length);

  for (const topic of topics) {
    const gapSection = stripIgnoredMarkdown(
      sectionForHeading(topic.body, '后续待补'),
    );
    const gapItems = gapSection
      .split(/\r?\n/)
      .filter((line) => /^ {0,3}[-*+]\s+/.test(line));
    assert.ok(
      gapItems.length >= 3 && gapItems.length <= 6,
      `${topic.filename} must list 3–6 gaps, found ${gapItems.length}`,
    );
    for (const item of gapItems) {
      const substantiveCharacters =
        visibleMarkdownText(item).match(/[\p{L}\p{N}]/gu)?.length ?? 0;
      assert.ok(
        substantiveCharacters >= 8,
        `Gap item is not substantive in ${topic.filename}: ${item}`,
      );
    }

    const continuation = sectionForHeading(topic.body, '继续学习');
    assertLinksTo(continuation, '/paths', `${topic.filename} ## 继续学习`);
    assertLinksTo(
      continuation,
      topicStageLinks.get(topic.slug),
      `${topic.filename} ## 继续学习`,
    );
  }
});

test('defines the overview metadata, links, image, and exact Mermaid flowchart', async () => {
  const source = await readRequiredFile(learningPathFile, 'roadmap overview');
  const metadata = parseFrontMatter(source);
  const body = extractMarkdownBody(source);

  assert.equal(metadata.slug, '/paths');
  assert.equal(metadata.sidebar_position, 11);
  for (const [, slug] of roadmapDocuments) {
    assertLinksTo(body, slug, 'roadmap overview');
  }
  assert.match(
    stripIgnoredMarkdown(body),
    /!\[[^\]]*\]\(\/img\/paths\/software-architecture-learning-roadmap\.png\)/,
    'Overview does not contain a real Markdown image for the roadmap asset',
  );

  const mermaidBlocks = extractFencedBlocks(body, 'mermaid');
  assert.equal(mermaidBlocks.length, 1, 'Overview must contain one Mermaid block');
  const normalizedFlowchart = mermaidBlocks[0]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  assert.deepEqual(normalizedFlowchart, expectedMermaidFlowchart);
});

test('structures every generated source registry entry with public metadata', async () => {
  const ledger = JSON.parse(
    await readRequiredFile(sourceLedgerFile, 'generated source registry'),
  );

  parseGeneratedSourceRegistry(ledger);
});

test('rejects incomplete invalid-date and misclassified generated entries', () => {
  const source = {
    id: 'source',
    title: 'Source',
    author_or_org: 'Author',
    source_kind: 'official-docs',
    tier: 'primary',
    checked_at: '2026-07-23',
    license: 'MIT',
    copyright_policy: 'facts-and-short-quotation',
    usage_boundary: 'Test boundary.',
  };
  const document = {
    title: 'Document',
    slug: '/document',
    citations: [
      {
        source_id: 'source',
        citation_url: 'https://example.com/source',
      },
    ],
  };
  const ledger = (sourceOverrides = {}, documentOverrides = {}) => ({
    schema_version: 1,
    sources: [{...source, ...sourceOverrides}],
    documents: {
      'content/document.mdx': {...document, ...documentOverrides},
    },
  });

  assert.throws(
    () => parseGeneratedSourceRegistry(ledger({author_or_org: ''})),
    /empty author_or_org/,
  );
  assert.throws(
    () => parseGeneratedSourceRegistry(ledger({checked_at: '2026-02-30'})),
    /invalid checked_at/,
  );
  assert.throws(
    () =>
      parseGeneratedSourceRegistry(
        ledger({source_kind: 'community-index', tier: 'primary'}),
      ),
    /community index must use discovery tier/,
  );
  assert.throws(
    () =>
      parseGeneratedSourceRegistry(
        ledger({}, {citations: [{...document.citations[0], source_id: 'missing'}]}),
      ),
    /cites missing source/,
  );
});

test('registers every real external learning-path link exactly', async () => {
  const [overviewSource, ledgerSource, documents] = await Promise.all([
    readRequiredFile(learningPathFile, 'roadmap overview'),
    readRequiredFile(sourceLedgerFile, 'generated source registry'),
    readRoadmapDocuments(),
  ]);
  const registryEntries = parseGeneratedSourceRegistry(JSON.parse(ledgerSource));
  const pathBodies = [
    extractMarkdownBody(overviewSource),
    ...documents.map(({body}) => body),
  ];

  for (const [index, body] of pathBodies.entries()) {
    for (const href of extractExternalLinks(body)) {
      assert.ok(
        registryEntries.has(href),
        `${href} from roadmap document ${index + 1} is not an exact real registry link`,
      );
    }
  }
});

test('covers every canonical case with a real Markdown link', async () => {
  const [overviewSource, documents] = await Promise.all([
    readRequiredFile(learningPathFile, 'roadmap overview'),
    readRoadmapDocuments(),
  ]);
  const links = new Set([
    ...extractMarkdownLinks(extractMarkdownBody(overviewSource)),
    ...documents.flatMap(({body}) => [...extractMarkdownLinks(body)]),
  ]);

  for (const slug of requiredCaseSlugs) {
    assert.ok(links.has(slug), `Canonical case is not linked: ${slug}`);
  }
});

test('requires every main-stage starting link to resolve to an allowed registry type', async () => {
  const [ledgerSource, allDocuments] = await Promise.all([
    readRequiredFile(sourceLedgerFile, 'generated source registry'),
    readRoadmapDocuments(),
  ]);
  const registryEntries = parseGeneratedSourceRegistry(JSON.parse(ledgerSource));
  const documents = allDocuments.slice(0, mainStages.length);

  for (const document of documents) {
    const section = sectionForHeading(document.body, '必读起点');
    const requiredLinks = [...extractExternalLinks(section)];
    assert.ok(
      requiredLinks.length > 0,
      `${document.filename} has no external links in ## 必读起点`,
    );

    for (const href of requiredLinks) {
      const registryEntry = registryEntries.get(href);
      assert.ok(
        registryEntry,
        `${href} from ${document.filename} has no exact generated registry entry`,
      );
      assert.ok(
        registryEntry.sourceKind !== 'community-index' &&
          registryEntry.tier !== 'discovery',
        `${href} from ${document.filename} resolves to disallowed discovery source ${registryEntry.sourceKind}`,
      );
      assert.ok(
        allowedRequiredSourceKinds.has(registryEntry.sourceKind),
        `${href} from ${document.filename} resolves to disallowed type ${registryEntry.sourceKind}`,
      );
    }
  }
});

test('links the main stages in sequence and every topic back to the overview', async () => {
  const documents = await readRoadmapDocuments();
  const stages = documents.slice(0, mainStages.length);
  const topics = documents.slice(mainStages.length);

  assertLinksTo(stages[0].body, mainStages[1][1], mainStages[0][0]);

  for (let index = 1; index < stages.length - 1; index += 1) {
    assertLinksTo(
      stages[index].body,
      mainStages[index - 1][1],
      mainStages[index][0],
    );
    assertLinksTo(
      stages[index].body,
      mainStages[index + 1][1],
      mainStages[index][0],
    );
  }

  assertLinksTo(
    stages.at(-1).body,
    mainStages.at(-2)[1],
    mainStages.at(-1)[0],
  );
  assertLinksTo(stages.at(-1).body, '/paths', mainStages.at(-1)[0]);

  for (const topic of topics) {
    assertLinksTo(topic.body, '/paths', topic.filename);
  }
});

test('ships exactly one valid generated roadmap PNG larger than 50 KB', async () => {
  const rasterFiles = await listFilesRecursively(
    roadmapImageDirectory,
    (filename) => /\.(?:png|jpe?g|webp|gif)$/i.test(filename),
  );
  assert.deepEqual(rasterFiles, [
    'software-architecture-learning-roadmap.png',
  ]);

  const imageBuffer = await readFile(roadmapImageFile);
  const chunks = parsePngChunks(imageBuffer);
  assert.equal(
    chunks.filter(({type}) => type === 'IHDR').length,
    1,
    'PNG must contain exactly one IHDR chunk',
  );
  assert.equal(chunks[0].type, 'IHDR', 'PNG first chunk must be IHDR');
  assert.equal(chunks[0].length, 13, 'PNG IHDR chunk must be 13 bytes');
  const width = imageBuffer.readUInt32BE(chunks[0].dataOffset);
  const height = imageBuffer.readUInt32BE(chunks[0].dataOffset + 4);
  assert.ok(width > 0 && height > 0, `PNG dimensions are ${width}×${height}`);
  assert.equal(
    chunks.filter(({type}) => type === 'IEND').length,
    1,
    'PNG must contain exactly one IEND chunk',
  );
  assert.deepEqual(
    chunks.at(-1),
    {
      dataOffset: imageBuffer.length - 4,
      length: 0,
      type: 'IEND',
    },
    'PNG must terminate with an empty IEND chunk',
  );
  assert.ok(
    imageBuffer.length > 50 * 1024,
    `Roadmap image is only ${imageBuffer.length} bytes`,
  );
});
