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

let productionReferenceArtifactPromise;

function productionReferenceArtifact() {
  productionReferenceArtifactPromise ??= (async () => {
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
    return {html, ledger};
  })();

  return productionReferenceArtifactPromise;
}

function attributeValue(tag, name) {
  const match = tag.match(
    new RegExp(`${name}=(?:"([^"]+)"|'([^']+)'|([^\\s>]+))`),
  );
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function decodeHtml(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    quot: '"',
  };
  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi,
    (entity, decimal, hexadecimal, name) => {
      if (decimal) {
        return String.fromCodePoint(Number(decimal));
      }
      if (hexadecimal) {
        return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      }
      return named[name.toLowerCase()] ?? entity;
    },
  );
}

function textContent(markup) {
  return decodeHtml(
    markup
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function parseDefinitionList(article) {
  const start = article.indexOf('<dl');
  const openEnd = article.indexOf('>', start);
  const end = article.indexOf('</dl>', openEnd);
  assert.ok(start !== -1 && openEnd !== -1 && end !== -1);
  const markup = article.slice(openEnd + 1, end);
  const tokens = [...markup.matchAll(/<(dt|dd)\b[^>]*>/g)];
  assert.equal(tokens.length, 24);

  const fields = new Map();
  for (let index = 0; index < tokens.length; index += 2) {
    const term = tokens[index];
    const definition = tokens[index + 1];
    assert.equal(term[1], 'dt');
    assert.equal(definition[1], 'dd');
    const termEnd = term.index + term[0].length;
    const definitionEnd = definition.index + definition[0].length;
    const next = tokens[index + 2]?.index ?? markup.length;
    fields.set(textContent(markup.slice(termEnd, definition.index)), {
      html: markup.slice(definitionEnd, next),
      text: textContent(markup.slice(definitionEnd, next)),
    });
  }
  return fields;
}

function parseArticles(section) {
  return [...section.matchAll(/<article\b[^>]*>/g)].map((match) => {
    const end = section.indexOf('</article>', match.index);
    assert.notEqual(end, -1, `source article is not closed: ${match[0]}`);
    const html = section.slice(match.index, end + '</article>'.length);
    const heading = html.match(/<h4>([\s\S]*?)<\/h4>/);
    assert.ok(heading, 'source article has no H4');
    const anchor = heading[1].match(/<a\b[^>]*>/);
    return {
      fields: parseDefinitionList(html),
      headingHref: anchor ? attributeValue(anchor[0], 'href') : null,
      html,
      title: textContent(heading[1]),
    };
  });
}

function parseLedgerSections(html) {
  return [...html.matchAll(/<section\b[^>]*>/g)]
    .map((match) => ({
      headingId: attributeValue(match[0], 'aria-labelledby'),
      index: match.index,
    }))
    .filter(({headingId}) => headingId?.startsWith('source-ledger-'))
    .map(({headingId, index}) => {
      const end = html.indexOf('</section>', index);
      assert.notEqual(end, -1, `ledger section is not closed: ${headingId}`);
      const section = html.slice(index, end + '</section>'.length);
      const heading = section.match(
        new RegExp(`<h3 id=${headingId}>([\\s\\S]*?)<\\/h3>`),
      );
      assert.ok(heading, `ledger section has no matching heading: ${headingId}`);
      return {
        articles: parseArticles(section),
        heading: textContent(heading[1]),
        html: section,
        tier: headingId.replace('source-ledger-', ''),
      };
    });
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
  ]) {
    assert.match(component, new RegExp(label));
  }
  assert.match(component, /<article\b/);
  assert.match(component, /<dl\b/);
  assert.match(component, /<Link to=\{document\.slug\}>/);
});

test('renders healthy auth-required retired and stale source health', async () => {
  const component = await source('src/components/SourceLedger/index.tsx');
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

  const component = await source('src/components/SourceLedger/index.tsx');
  assert.match(component, /选题\/学习导航，不是事实证据/);
  assert.match(
    component,
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

  assert.equal(cards.length, 370);
  assert.deepEqual(
    cards.map(({id}) => id),
    expectedSources.map(({id}) => id),
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

test('progressively exposes all sources in exact 24-card increments', async () => {
  const model = await import(
    '../src/components/SourceLedger/sourceLedgerModel.ts'
  );
  assert.equal(
    typeof model.nextSourceLedgerVisibleCount,
    'function',
    'sourceLedgerModel must export nextSourceLedgerVisibleCount',
  );
  assert.equal(
    model.sourceLedgerPageSize,
    24,
    'sourceLedgerModel must export a 24-card page size',
  );
  const ledger = await generatedLedger();
  const sections = model.buildSourceLedgerSections(ledger);
  const reachedIds = [];

  for (const section of sections) {
    let visibleCount = Math.min(
      model.sourceLedgerPageSize,
      section.sources.length,
    );
    let previousCount = 0;

    while (true) {
      const visible = section.sources.slice(0, visibleCount);
      assert.equal(
        visible.length - previousCount,
        Math.min(
          model.sourceLedgerPageSize,
          section.sources.length - previousCount,
        ),
        `${section.tier} did not advance by one page`,
      );
      reachedIds.push(...visible.slice(previousCount).map(({id}) => id));
      if (visibleCount === section.sources.length) {
        break;
      }
      previousCount = visibleCount;
      visibleCount = model.nextSourceLedgerVisibleCount(
        visibleCount,
        section.sources.length,
      );
    }
  }

  assert.equal(reachedIds.length, 370);
  assert.equal(new Set(reachedIds).size, 370);
  assert.deepEqual(
    reachedIds,
    sections.flatMap(({sources}) => sources.map(({id}) => id)),
  );
});

test('SSR renders at most the first 24 complete cards per tier', async () => {
  const {buildSourceLedgerSections} = await import(
    '../src/components/SourceLedger/sourceLedgerModel.ts'
  );
  const {html, ledger} = await productionReferenceArtifact();
  const expectedSections = buildSourceLedgerSections(ledger);
  const sections = parseLedgerSections(html);

  assert.deepEqual(
    sections.map(({tier}) => tier),
    expectedSections.map(({tier}) => tier),
  );
  for (const [index, section] of sections.entries()) {
    const expected = expectedSections[index];
    assert.equal(
      section.articles.length,
      Math.min(24, expected.sources.length),
      `${section.tier} SSR card count`,
    );
    assert.deepEqual(
      section.articles.map(({title}) => title),
      expected.sources.slice(0, 24).map(({title}) => title),
      `${section.tier} SSR order`,
    );
    assert.ok(
      section.articles.every(({fields}) => fields.size === 12),
      `${section.tier} SSR cards must retain all 12 fields and 24 dt/dd nodes`,
    );
  }
});

test('keeps the initial source-ledger SSR payload below 250 KB', async () => {
  const {html} = await productionReferenceArtifact();
  assert.ok(
    Buffer.byteLength(html) < 250_000,
    `references HTML exceeds 250 KB: ${Buffer.byteLength(html)} bytes`,
  );
});

test('associates continuation controls with truncated tier sections', async () => {
  const {buildSourceLedgerSections} = await import(
    '../src/components/SourceLedger/sourceLedgerModel.ts'
  );
  const {html, ledger} = await productionReferenceArtifact();
  const expectedSections = buildSourceLedgerSections(ledger);
  const sections = parseLedgerSections(html);

  for (const [index, section] of sections.entries()) {
    const total = expectedSections[index].sources.length;
    const control = section.html.match(
      /<button\b[^>]*>[\s\S]*?继续加载[\s\S]*?<\/button>/,
    );
    if (total <= 24) {
      assert.equal(control, null, `${section.tier} must not show a load control`);
      continue;
    }

    assert.ok(control, `${section.tier} needs a continuation control`);
    const controlledId = attributeValue(control[0], 'aria-controls');
    assert.ok(controlledId, `${section.tier} control needs aria-controls`);
    assert.match(
      section.html,
      new RegExp(`<ul\\b[^>]*\\bid=(?:"${controlledId}"|'${controlledId}')`),
      `${section.tier} control must identify its source list`,
    );
    assert.match(
      textContent(section.html),
      new RegExp(`已显示\\s*24\\s*[/／]\\s*${total}`),
      `${section.tier} must expose shown and total counts`,
    );
  }
});
