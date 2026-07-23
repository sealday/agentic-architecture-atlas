import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

async function generatedLedger() {
  return JSON.parse(await source('src/generated/source-ledger.json'));
}

function attributeValue(tag, name) {
  const match = tag.match(
    new RegExp(`${name}=(?:"([^"]+)"|'([^']+)'|([^\\s>]+))`),
  );
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function sourceArticles(html) {
  return [...html.matchAll(/<article\b[^>]*data-source-id=[^>]+>/g)].map(
    (match) => {
      const end = html.indexOf('</article>', match.index);
      assert.notEqual(end, -1, `source article is not closed: ${match[0]}`);
      return {
        id: attributeValue(match[0], 'data-source-id'),
        tier: attributeValue(match[0], 'data-source-tier'),
        kind: attributeValue(match[0], 'data-source-kind'),
        html: html.slice(match.index, end + '</article>'.length),
      };
    },
  );
}

function fieldMarkup(article, field) {
  const marker = new RegExp(
    `<dd\\b[^>]*data-source-field=(?:"${field}"|'${field}'|${field})[^>]*>`,
  );
  const match = article.match(marker);
  assert.ok(match, `missing rendered field ${field}`);
  const start = match.index + match[0].length;
  const end = article.indexOf('<dt', start);
  return article.slice(start, end === -1 ? article.length : end);
}

test('renders the generated source ledger instead of a hand-maintained catalog', async () => {
  const [component, references, styles] = await Promise.all([
    source('src/components/SourceLedger/index.tsx'),
    source('content/references/index.mdx'),
    source('src/components/SourceLedger/styles.module.css'),
  ]);

  assert.match(
    component,
    /import sourceLedger from '@site\/src\/generated\/source-ledger\.json';/,
  );
  assert.doesNotMatch(component, /data\/source-ledger|content\//);
  assert.match(
    references,
    /import SourceLedger from '@site\/src\/components\/SourceLedger';/,
  );
  assert.match(references, /^## 全站来源清单$/m);
  assert.match(references, /^## 如何使用资料库$/m);
  assert.match(references, /^<SourceLedger \/>$/m);
  assert.doesNotMatch(references, /^### C4 Model$/m);
  assert.doesNotMatch(references, /^### ISO\/IEC 25010:2023$/m);
  assert.doesNotMatch(references, /^### Awesome Software Architecture/m);

  assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(styles, /@media\s*\(min-width:\s*768px\)/);
  assert.match(
    styles,
    /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.doesNotMatch(styles, /\bheight\s*:/);
  assert.doesNotMatch(styles, /overflow\s*:\s*hidden/);
});

test('shows provenance copyright evidence roles and usage boundaries', async () => {
  const {buildSourceLedgerSections} = await import(
    '../src/components/SourceLedger/sourceLedgerModel.ts'
  );
  const ledger = await generatedLedger();
  const sections = buildSourceLedgerSections(ledger);
  const cards = sections.flatMap(({sources}) => sources);
  const c4 = cards.find(({id}) => id === 'src-c4model-f5342a5e8659');

  assert.ok(c4);
  assert.equal(c4.authorOrOrg, 'Simon Brown');
  assert.equal(c4.tierLabel, '一手来源');
  assert.equal(c4.kindLabel, '官方文档');
  assert.match(c4.version, /2026-07-24/);
  assert.equal(c4.checkedAt, '2026-07-24');
  assert.ok(c4.license);
  assert.ok(c4.copyrightPolicyLabel);
  assert.ok(c4.usageBoundary);
  assert.ok(c4.evidenceRoleLabels.includes('学习'));
  assert.ok(c4.evidenceRoleLabels.includes('定义'));
  assert.ok(c4.attributionNotes.includes('C4 Model, Simon Brown'));
  assert.ok(
    c4.usedBy.some(
      ({slug, title, reviewedAt}) =>
        slug === '/references' &&
        title === '资料库' &&
        reviewedAt === '2026-07-24',
    ),
  );
  assert.ok(
    cards.every(({usedBy}) =>
      usedBy.every(
        ({slug, title}) =>
          typeof slug === 'string' &&
          slug.startsWith('/') &&
          typeof title === 'string' &&
          title.length > 0,
      ),
    ),
  );

  const component = await source('src/components/SourceLedger/index.tsx');
  for (const label of [
    '作者或机构',
    '来源层级',
    '来源类型',
    '版本',
    '核查日期',
    '许可证',
    '版权处理',
    '可支持的证据角色',
    '署名说明',
    '使用边界',
    '使用位置',
    '文档复核',
    '链接状态',
    'Task 6 接入后显示',
  ]) {
    assert.match(component, new RegExp(label));
  }
  assert.match(component, /<article\b/);
  assert.match(component, /<dl\b/);
  assert.match(component, /<Link to=\{document\.slug\}>/);
});

test('labels discovery indexes as navigation rather than factual evidence', async () => {
  const {buildSourceLedgerSections} = await import(
    '../src/components/SourceLedger/sourceLedgerModel.ts'
  );
  const ledger = await generatedLedger();
  const sections = buildSourceLedgerSections(ledger);
  const tiers = sections.map(({tier}) => tier);
  const discovery = sections.find(({tier}) => tier === 'discovery');
  const discoveryOnly = buildSourceLedgerSections(ledger, 'discovery');
  const cards = sections.flatMap(({sources}) => sources);
  const localIllustration = cards.find(
    ({sourceKind}) => sourceKind === 'original-illustration',
  );

  assert.deepEqual(tiers, [
    'primary',
    'first-party',
    'secondary',
    'discovery',
  ]);
  assert.deepEqual(discoveryOnly.map(({tier}) => tier), ['discovery']);
  assert.equal(discovery.warning, '选题/学习导航，不是事实证据');
  assert.ok(
    discovery.sources.every(
      ({sourceKind}) => sourceKind === 'community-index',
    ),
  );
  assert.equal(localIllustration.externalHref, null);
  assert.ok(
    cards
      .filter(({canonicalLocator}) => canonicalLocator.startsWith('https://'))
      .every(({externalHref, canonicalLocator}) => externalHref === canonicalLocator),
  );

  const component = await source('src/components/SourceLedger/index.tsx');
  assert.match(component, /选题\/学习导航，不是事实证据/);
  assert.match(
    component,
    /source\.externalHref \? \([\s\S]*?<a href=\{source\.externalHref\}>/,
  );
});

test('renders the complete sorted ledger in production HTML', async () => {
  const build = spawnSync('npm', ['run', 'build'], {
    cwd: fileURLToPath(root),
    encoding: 'utf8',
  });
  assert.equal(
    build.status,
    0,
    `production build failed:\n${build.stdout}\n${build.stderr}`,
  );

  const [html, ledger] = await Promise.all([
    source('build/references.html'),
    generatedLedger(),
  ]);
  const tierOrder = ['primary', 'first-party', 'secondary', 'discovery'];
  const kindOrder = [
    'standard',
    'paper',
    'official-docs',
    'official-repository',
    'source-code',
    'engineering-blog',
    'incident-report',
    'vendor-reference-architecture',
    'textbook',
    'independent-blog',
    'community-index',
    'original-illustration',
  ];
  const expectedSources = [...ledger.sources].sort(
    (left, right) =>
      tierOrder.indexOf(left.tier) - tierOrder.indexOf(right.tier) ||
      kindOrder.indexOf(left.source_kind) -
        kindOrder.indexOf(right.source_kind) ||
      left.title.localeCompare(right.title, 'en'),
  );
  const articles = sourceArticles(html);

  assert.equal(articles.length, 361);
  assert.deepEqual(
    articles.map(({id}) => id),
    expectedSources.map(({id}) => id),
  );
  assert.deepEqual(
    tierOrder.map((tier) => [
      tier,
      articles.filter((article) => article.tier === tier).length,
    ]),
    [
      ['primary', 329],
      ['first-party', 22],
      ['secondary', 3],
      ['discovery', 7],
    ],
  );
  assert.deepEqual(
    [...html.matchAll(/<section\b[^>]*data-source-tier-section=[^>]+>/g)].map(
      (match) => attributeValue(match[0], 'data-source-tier-section'),
    ),
    tierOrder,
  );
  assert.ok(
    articles.every(
      ({html: article}) =>
        [...article.matchAll(/data-source-field=/g)].length === 12,
    ),
  );

  const c4 = articles.find(({id}) => id === 'src-c4model-f5342a5e8659');
  assert.ok(c4);
  assert.match(
    c4.html,
    /<h4><a href=https:\/\/c4model\.com\/>C4 Model<\/a><\/h4>/,
  );
  assert.match(fieldMarkup(c4.html, 'author'), /Simon Brown/);
  assert.match(fieldMarkup(c4.html, 'tier'), /一手来源/);
  assert.match(fieldMarkup(c4.html, 'kind'), /官方文档/);
  assert.match(fieldMarkup(c4.html, 'version'), /2026-07-24/);
  assert.match(fieldMarkup(c4.html, 'checked-at'), /2026-07-24/);
  assert.match(fieldMarkup(c4.html, 'license'), /CC-BY-4.0/);
  assert.match(fieldMarkup(c4.html, 'copyright-policy'), /允许改编，必须署名/);
  assert.match(fieldMarkup(c4.html, 'evidence-roles'), /定义/);
  assert.match(fieldMarkup(c4.html, 'attribution'), /C4 Model, Simon Brown/);
  assert.match(
    fieldMarkup(c4.html, 'usage-boundary'),
    /Supports documented semantics/,
  );
  assert.match(fieldMarkup(c4.html, 'used-by'), /href=.*\/references/);
  assert.match(fieldMarkup(c4.html, 'used-by'), /文档复核：.*2026-07-24/);
  assert.match(fieldMarkup(c4.html, 'health'), /Task 6 接入后显示/);

  const illustration = articles.find(
    ({kind}) => kind === 'original-illustration',
  );
  assert.ok(illustration);
  assert.doesNotMatch(illustration.html.match(/<h4>[\s\S]*?<\/h4>/)[0], /<a\b/);

  const discoverySection = html.slice(
    html.indexOf('data-source-tier-section=discovery'),
  );
  assert.match(discoverySection, /选题\/学习导航，不是事实证据/);
});
