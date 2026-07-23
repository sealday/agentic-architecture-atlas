import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  extractMarkdownBody,
  parseFrontMatter,
} from '../scripts/content-metadata.mjs';
import {requiredCaseSlugs} from '../scripts/content-schema.mjs';

const learningPathFile = fileURLToPath(
  new URL('../content/paths/index.mdx', import.meta.url),
);
const pathDirectory = fileURLToPath(
  new URL('../content/paths/', import.meta.url),
);
const referencesFile = fileURLToPath(
  new URL('../content/references/index.mdx', import.meta.url),
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

function assertHeadingsInOrder(source, headings, label) {
  let previousOffset = -1;
  for (const heading of headings) {
    const offset = source.indexOf(heading);
    assert.ok(
      offset > previousOffset,
      `${heading} is missing or out of order in ${label}`,
    );
    previousOffset = offset;
  }
}

function assertLinksTo(body, slug, label) {
  assert.ok(body.includes(`](${slug})`), `${label} does not link to ${slug}`);
}

async function readRoadmapDocuments() {
  return Promise.all(
    roadmapDocuments.map(async ([filename, slug]) => {
      const source = await readFile(path.join(pathDirectory, filename), 'utf8');
      return {
        body: extractMarkdownBody(source),
        filename,
        metadata: parseFrontMatter(source),
        slug,
        source,
      };
    }),
  );
}

test('defines ordered slugs and article structure for every roadmap document', async () => {
  const documents = await readRoadmapDocuments();

  for (const [index, document] of documents.entries()) {
    assert.equal(document.metadata.slug, document.slug);
    assert.equal(document.metadata.sidebar_position, index + 2);
    assertHeadingsInOrder(
      document.body,
      commonArticleHeadings,
      document.filename,
    );
  }

  for (const document of documents.slice(mainStages.length)) {
    assert.ok(
      document.body.includes('## 当前已覆盖'),
      `## 当前已覆盖 is missing in ${document.filename}`,
    );
    assert.ok(
      document.body.includes('## 后续待补'),
      `## 后续待补 is missing in ${document.filename}`,
    );
  }
});

test('defines the roadmap overview visual contract', async () => {
  const source = await readFile(learningPathFile, 'utf8');
  const metadata = parseFrontMatter(source);
  const body = extractMarkdownBody(source);

  assert.equal(metadata.sidebar_position, 1);
  assert.ok(
    body.includes('/img/paths/software-architecture-learning-roadmap.png'),
    'Overview does not reference the generated roadmap image',
  );
  assert.match(body, /```mermaid(?:\r?\n|[ \t])/);
});

test('registers every learning-path source and covers every canonical case', async () => {
  const [overviewSource, referencesSource, documents] = await Promise.all([
    readFile(learningPathFile, 'utf8'),
    readFile(referencesFile, 'utf8'),
    readRoadmapDocuments(),
  ]);
  const referencesBody = extractMarkdownBody(referencesSource);
  const pathBodies = [
    extractMarkdownBody(overviewSource),
    ...documents.map(({body}) => body),
  ];

  for (const [index, body] of pathBodies.entries()) {
    const externalLinks = [
      ...body.matchAll(/\[[^\]]+\]\((https:\/\/[^)\s]+)\)/g),
    ].map(([, href]) => href);

    for (const href of externalLinks) {
      assert.ok(
        referencesBody.includes(href),
        `${href} from roadmap document ${index + 1} is not registered`,
      );
    }
  }

  const combinedBodies = pathBodies.join('\n');
  for (const slug of requiredCaseSlugs) {
    assert.ok(
      combinedBodies.includes(slug),
      `Canonical case is not covered by the roadmap: ${slug}`,
    );
  }
});

test('keeps third-party indexes and tutorials out of main-stage starting lists', async () => {
  const documents = (await readRoadmapDocuments()).slice(0, mainStages.length);

  for (const document of documents) {
    const start = document.body.indexOf('## 必读起点');
    const end = document.body.indexOf('## 查漏补缺', start);

    assert.ok(
      start !== -1 && end > start,
      `Invalid 必读起点 section in ${document.filename}`,
    );
    const requiredStartingPoints = document.body.slice(start, end);
    assert.doesNotMatch(
      requiredStartingPoints,
      /^\s*[-*+]\s+.*(?:GitHub 索引|第三方教程).*$/m,
      `Disallowed starting-point label in ${document.filename}`,
    );
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

test('ships a generated roadmap image larger than 50 KB', async () => {
  const image = await stat(roadmapImageFile);

  assert.ok(
    image.size > 50 * 1024,
    `Roadmap image is only ${image.size} bytes`,
  );
});
