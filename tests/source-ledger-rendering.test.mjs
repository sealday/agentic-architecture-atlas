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
