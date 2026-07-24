import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const baseUrl = '/agentic-architecture-atlas/';
const pluginUrl = new URL(
  '../plugins/source-ledger-pages/index.mjs',
  import.meta.url,
);
const tierCounts = new Map([
  ['primary', 339],
  ['first-party', 22],
  ['secondary', 3],
  ['discovery', 7],
]);
const expectedPageCounts = new Map([
  ['primary', 17],
  ['first-party', 2],
  ['secondary', 1],
  ['discovery', 1],
]);

async function source(relativePath) {
  return readFile(new URL(relativePath, root), 'utf8');
}

async function generatedLedger() {
  return JSON.parse(await source('src/generated/source-ledger.json'));
}

async function importPaginationPlugin() {
  try {
    return await import(pluginUrl);
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      assert.fail(`Missing static source-ledger plugin: ${pluginUrl.pathname}`);
    }
    throw error;
  }
}

function routeFor(tier, pageNumber) {
  return pageNumber === 1
    ? `/references/${tier}`
    : `/references/${tier}/page/${pageNumber}`;
}

function expectedPageRoutes() {
  return [...expectedPageCounts].flatMap(([tier, count]) =>
    Array.from({length: count}, (_, index) => routeFor(tier, index + 1)),
  );
}

function buildFileForRoute(route) {
  return path.join(rootPath, 'build', `${route.slice(1)}.html`);
}

async function readBuiltRoute(route) {
  const file = buildFileForRoute(route);
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      assert.fail(`Missing statically generated route ${route}: ${file}`);
    }
    throw error;
  }
}

function sourceArticles(html) {
  return [...html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(
    ([article]) => article,
  );
}

function assertCompleteSourceCards(articles, route) {
  for (const article of articles) {
    const terms = article.match(/<dt\b[^>]*>/g) ?? [];
    const definitions = article.match(/<dd\b[^>]*>/g) ?? [];
    assert.equal(terms.length, 12, `${route} source card lost dt fields`);
    assert.equal(definitions.length, 12, `${route} source card lost dd fields`);
  }
}

function hrefs(html) {
  return [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map(
    ([, href]) => href,
  );
}

function routeFromBaseHref(href) {
  const prefix = baseUrl.slice(0, -1);
  if (!href.startsWith(prefix)) {
    return null;
  }
  const route = href.slice(prefix.length).split(/[?#]/, 1)[0].replace(/\/+$/, '');
  return route || '/';
}

let productionBuildPromise;

function ensureProductionBuild() {
  productionBuildPromise ??= Promise.resolve().then(() => {
    const build = spawnSync('npm', ['run', 'build'], {
      cwd: rootPath,
      encoding: 'utf8',
    });
    assert.equal(
      build.status,
      0,
      `production build failed:\n${build.stdout}\n${build.stderr}`,
    );
  });
  return productionBuildPromise;
}

async function listSourceFiles(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listSourceFiles(entryPath));
    } else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
}

test('plans complete canonical source pages in deterministic 20-card slices', async () => {
  const pluginModule = await importPaginationPlugin();
  assert.equal(pluginModule.SOURCE_LEDGER_PAGE_SIZE, 20);
  assert.equal(typeof pluginModule.buildSourceLedgerPages, 'function');

  const [ledger, model] = await Promise.all([
    generatedLedger(),
    import('../src/components/SourceLedger/sourceLedgerModel.ts'),
  ]);
  const pages = pluginModule.buildSourceLedgerPages(ledger);
  assert.deepEqual(
    [...expectedPageCounts].map(([tier]) => [
      tier,
      pages.filter((page) => page.tier === tier).length,
    ]),
    [...expectedPageCounts],
  );
  assert.deepEqual(
    [...tierCounts].map(([tier]) => [
      tier,
      pages
        .filter((page) => page.tier === tier)
        .reduce((count, page) => count + page.sources.length, 0),
    ]),
    [...tierCounts],
  );
  assert.ok(
    pages.every(({tier, sources}) =>
      sources.every((source) => source.tier === tier),
    ),
  );
  assert.deepEqual(
    pages.map(({route}) => route),
    expectedPageRoutes(),
  );
  assert.ok(
    pages.every(
      ({sources}) => sources.length > 0 && sources.length <= 20,
    ),
  );

  const pagedIds = pages.flatMap(({sources}) =>
    sources.map(({id}) => id),
  );
  const canonicalIds = model
    .buildSourceLedgerSections(ledger)
    .flatMap(({sources}) => sources.map(({id}) => id));
  assert.equal(pagedIds.length, 371);
  assert.equal(new Set(pagedIds).size, 371);
  assert.deepEqual(pagedIds, canonicalIds);
});

test('registers every static page through Docusaurus content hooks', async () => {
  const pluginModule = await importPaginationPlugin();
  assert.equal(typeof pluginModule.default, 'function');
  const plugin = pluginModule.default({baseUrl, siteDir: rootPath}, {});
  assert.equal(typeof plugin.loadContent, 'function');
  assert.equal(typeof plugin.contentLoaded, 'function');

  const content = await plugin.loadContent();
  const pages = Array.isArray(content) ? content : content.pages;
  assert.deepEqual(
    pages.map(({route}) => route),
    expectedPageRoutes(),
  );

  const created = [];
  const routes = [];
  await plugin.contentLoaded({
    content,
    actions: {
      async createData(name, data) {
        JSON.parse(data);
        const dataPath = `/generated/${name}`;
        created.push({dataPath, name});
        return dataPath;
      },
      addRoute(route) {
        routes.push(route);
      },
    },
  });

  assert.equal(created.length, expectedPageRoutes().length);
  assert.deepEqual(
    routes.map(({path: route}) => route),
    expectedPageRoutes(),
  );
  assert.ok(
    routes.every(
      ({component, modules}) =>
        typeof component === 'string' &&
        component.length > 0 &&
        modules &&
        Object.values(modules).some((value) =>
          created.some(({dataPath}) => dataPath === value),
        ),
    ),
    'Every route must consume data returned by createData',
  );

  const config = await source('docusaurus.config.ts');
  assert.match(config, /plugins\/source-ledger-pages/u);
});

test('renders a card-free overview linked to every tier with baseUrl', async () => {
  await ensureProductionBuild();
  const html = await readBuiltRoute('/references');
  assert.equal(sourceArticles(html).length, 0);
  for (const tier of tierCounts.keys()) {
    assert.ok(
      hrefs(html).includes(`${baseUrl}references/${tier}`),
      `Overview must link the ${tier} tier with baseUrl`,
    );
  }
});

test('renders every static source page below 250 KB with complete cards', async () => {
  await ensureProductionBuild();
  const routes = expectedPageRoutes();

  for (const route of routes) {
    const html = await readBuiltRoute(route);
    const articles = sourceArticles(html);
    assert.ok(articles.length > 0 && articles.length <= 20, route);
    assert.ok(
      Buffer.byteLength(html) < 250_000,
      `${route} exceeds 250 KB: ${Buffer.byteLength(html)} bytes`,
    );
    assertCompleteSourceCards(articles, route);
    const internalHrefs = hrefs(html).filter((href) => href.startsWith('/'));
    assert.ok(internalHrefs.length > 0, `${route} needs SSR navigation`);
    assert.ok(
      internalHrefs.every((href) => href.startsWith(baseUrl)),
      `${route} has an internal link without baseUrl`,
    );
  }
});

test('reaches every static source page from the overview using SSR links', async () => {
  await ensureProductionBuild();
  const expected = new Set(['/references', ...expectedPageRoutes()]);
  const reached = new Set();
  const queue = ['/references'];

  while (queue.length > 0) {
    const route = queue.shift();
    if (reached.has(route)) {
      continue;
    }
    reached.add(route);
    const html = await readBuiltRoute(route);
    for (const href of hrefs(html)) {
      const target = routeFromBaseHref(href);
      if (target && expected.has(target) && !reached.has(target)) {
        queue.push(target);
      }
    }
  }

  assert.deepEqual([...reached].sort(), [...expected].sort());
});

test('uses static routes without client load-more state or handlers', async () => {
  const pluginDirectory = path.join(rootPath, 'plugins/source-ledger-pages');
  let pluginFiles;
  try {
    pluginFiles = await listSourceFiles(pluginDirectory);
  } catch (error) {
    if (error.code === 'ENOENT') {
      assert.fail(`Missing static source-ledger plugin: ${pluginDirectory}`);
    }
    throw error;
  }
  const files = [
    path.join(rootPath, 'src/components/SourceLedger/index.tsx'),
    ...pluginFiles,
  ];
  const combined = (
    await Promise.all(files.map((file) => readFile(file, 'utf8')))
  ).join('\n');

  assert.doesNotMatch(
    combined,
    /\buseState\b|\bonClick\s*=|\bloadMore\b|load-more|继续加载/iu,
  );
});
