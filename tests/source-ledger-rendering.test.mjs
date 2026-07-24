import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

async function generatedLedger() {
  return JSON.parse(await source('src/generated/source-ledger.json'));
}

test('renders the generated source ledger instead of a hand-maintained catalog', async () => {
  const [component, plugin, references, styles] = await Promise.all([
    source('src/components/SourceLedger/index.tsx'),
    source('plugins/source-ledger-pages/index.mjs'),
    source('content/references/index.mdx'),
    source('src/components/SourceLedger/styles.module.css'),
  ]);

  assert.match(
    plugin,
    /src\/generated\/source-ledger\.json/u,
  );
  assert.match(
    plugin,
    /JSON\.parse\(await readFile\(ledgerPath,\s*['"]utf8['"]\)\)/u,
  );
  assert.match(
    component,
    /usePluginData\s*\(\s*['"]source-ledger-pages['"]\s*,?\s*\)/su,
  );
  assert.doesNotMatch(
    component,
    /generated\/source-ledger|buildSourceLedgerSections/u,
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

test('describes link health as a reviewed committed cache rather than real-time status', async () => {
  const references = await source('content/references/index.mdx');

  assert.doesNotMatch(references, /Task 6|当前占位/);
  assert.match(references, /随仓库提交的最近一次链接核查缓存/);
  assert.match(references, /不是实时探测/);
  assert.match(references, /120 天/);
  assert.match(references, /每月定时与手工触发的在线检查/);
  assert.match(references, /人工复核后提交.*页面才会更新/);
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

  const component = await source(
    'src/components/SourceLedger/SourceLedgerCards.tsx',
  );
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
  ]) {
    assert.match(component, new RegExp(label));
  }
  assert.match(component, /<article\b/);
  assert.match(component, /<dl\b/);
  assert.match(component, /<Link to=\{document\.slug\}>/);
});

test('renders healthy auth-required retired and stale source health', async () => {
  const component = await source(
    'src/components/SourceLedger/SourceLedgerCards.tsx',
  );
  for (const value of ['healthy', 'auth-required', 'retired', 'stale']) {
    assert.match(component, new RegExp(value));
  }
  for (const label of ['最近尝试', '最近成功']) {
    assert.match(component, new RegExp(label));
  }

  const {buildSourceLedgerSections} = await import(
    '../src/components/SourceLedger/sourceLedgerModel.ts'
  );
  const governed = await generatedLedger();
  const fixture = structuredClone(governed);
  fixture.sources[0].health_summary = 'stale';
  fixture.sources[0].health_checks = [
    {
      transport_locator: fixture.sources[0].transport_locator,
      status: 'stale',
      last_attempt_at: '2026-07-24T00:00:00.000Z',
      last_success_at: '2026-07-23T00:00:00.000Z',
      http_status: 503,
      final_transport_locator: fixture.sources[0].transport_locator,
    },
  ];
  const card = buildSourceLedgerSections(fixture)
    .flatMap(({sources}) => sources)
    .find(({id}) => id === fixture.sources[0].id);
  assert.equal(card.healthSummary, 'stale');
  assert.equal(card.healthChecks[0].httpStatus, 503);
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

  const [cardsComponent, overview] = await Promise.all([
    source('src/components/SourceLedger/SourceLedgerCards.tsx'),
    source('src/components/SourceLedger/index.tsx'),
  ]);
  assert.match(overview, /选题\/学习导航，不是事实证据/);
  assert.match(
    cardsComponent,
    /source\.externalHref \? \([\s\S]*?<a href=\{source\.externalHref\}>/,
  );
});

test('keeps every source and evidence field in the complete sorted model', async () => {
  const {buildSourceLedgerSections} = await import(
    '../src/components/SourceLedger/sourceLedgerModel.ts'
  );
  const ledger = await generatedLedger();
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
  const cards = buildSourceLedgerSections(ledger).flatMap(
    ({sources}) => sources,
  );

  assert.equal(cards.length, 394);
  assert.deepEqual(
    cards.map(({id}) => id),
    expectedSources.map(({id}) => id),
  );
  assert.deepEqual(
    tierOrder.map((tier) => [
      tier,
      cards.filter((card) => card.tier === tier).length,
    ]),
    [
      ['primary', 360],
      ['first-party', 23],
      ['secondary', 4],
      ['discovery', 7],
    ],
  );
  for (const card of cards) {
    for (const field of [
      'id',
      'canonicalLocator',
      'externalHref',
      'title',
      'authorOrOrg',
      'checkedAt',
      'version',
      'sourceKind',
      'kindLabel',
      'tier',
      'tierLabel',
      'evidenceRoleLabels',
      'license',
      'copyrightPolicyLabel',
      'usageBoundary',
      'attributionNotes',
      'usedBy',
      'healthSummary',
      'healthChecks',
    ]) {
      assert.ok(Object.hasOwn(card, field), `${card.id} lost ${field}`);
    }
    assert.ok(
      card.evidenceRoleLabels.length > 0,
      `${card.id} lost evidence roles`,
    );
    assert.ok(card.license, `${card.id} lost license evidence`);
    assert.ok(card.usageBoundary, `${card.id} lost its usage boundary`);
  }
});
