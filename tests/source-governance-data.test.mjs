import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {
  validateInventoryLedgerConsistency,
  validateSourceLicenseInventory,
} from '../scripts/validate-source-license-inventory.mjs';

const inventoryPath = new URL('../docs/source-license-inventory.md', import.meta.url);
const ledgerPath = new URL('../data/source-ledger.json', import.meta.url);

async function governedData() {
  const [inventoryMarkdown, ledgerText, microFrontendsBody] = await Promise.all([
    readFile(inventoryPath, 'utf8'),
    readFile(ledgerPath, 'utf8'),
    readFile(
      new URL('../content/cases/micro-frontends-single-spa.mdx', import.meta.url),
      'utf8',
    ),
  ]);
  return {
    inventory: validateSourceLicenseInventory(inventoryMarkdown, []),
    ledger: JSON.parse(ledgerText),
    microFrontendsBody,
  };
}

test('records all Kubernetes documentation families as CC-BY-4.0 from official footer evidence', async () => {
  const {inventory, ledger} = await governedData();
  const inventoryRows = inventory.entries.filter((entry) =>
    entry.source_family.startsWith('https://kubernetes.io/'));
  const ledgerSources = ledger.sources.filter((source) =>
    source.license_family_id.startsWith('https://kubernetes.io/'));

  assert.equal(inventoryRows.length, 8);
  assert.equal(ledgerSources.length, 8);
  for (const item of [...inventoryRows, ...ledgerSources]) {
    assert.equal(item.exact_license ?? item.license, 'CC-BY-4.0');
    assert.match(item.license_evidence_note, /official.*footer.*CC BY 4\.0/i);
  }
});

test('records every official-license family found by the systematic ARR audit', async () => {
  const {inventory} = await governedData();
  const expectedLicense = (family) => {
    if (family === 'github:cncf/curriculum') return 'CC-BY-4.0';
    if (family === 'https://arc42.org/') return 'CC-BY-SA-4.0';
    if (family === 'https://c4model.com/') return 'CC-BY-4.0';
    if (family === 'https://sre.google/workbook/table-of-contents/') {
      return 'CC-BY-NC-ND-4.0';
    }
    if (family === 'https://www.cosmicpython.com/book/preface.html') {
      return 'LicenseRef-CC-BY-NC-ND-Unversioned';
    }
    if (family === 'https://modelcontextprotocol.io/specification/2025-06-18/architecture') {
      return 'LicenseRef-MCP-Specification-Transition';
    }
    if (family === 'https://modelcontextprotocol.io/docs/getting-started/intro') {
      return 'CC-BY-4.0';
    }
    if (family.startsWith('https://learn.microsoft.com/')) return 'CC-BY-4.0';
    if (family === 'https://google.github.io/adk-docs/agents/multi-agents/') {
      return 'Apache-2.0';
    }
    const host = family.startsWith('https://') ? new URL(family).hostname : '';
    if (host === 'developers.cloudflare.com' || host === 'docs.ros.org') {
      return 'CC-BY-4.0';
    }
    if (
      [
        'a2a-protocol.org',
        'adk.dev',
        'aigateway.envoyproxy.io',
        'design.ros2.org',
        'kafka.apache.org',
        'kubeedge.io',
        'release-1-20.docs.kubeedge.io',
        'www.erlang.org',
      ].includes(host)
    ) {
      return 'Apache-2.0';
    }
    if (
      [
        'developer.konghq.com',
        'docs.langchain.com',
        'docs.temporal.io',
        'openai.github.io',
      ].includes(host)
    ) {
      return 'MIT';
    }
    if (host === 'kubernetes.io') return 'CC-BY-4.0';
    return null;
  };

  const corrected = inventory.entries
    .map((entry) => [entry, expectedLicense(entry.source_family)])
    .filter(([, expected]) => expected !== null);
  assert.equal(corrected.length, 117);
  for (const [entry, expected] of corrected) {
    assert.equal(entry.exact_license, expected, entry.source_family);
  }
});

test('records the known Micro Frontends author and publication date consistently', async () => {
  const {inventory, ledger, microFrontendsBody} = await governedData();
  const family = 'https://martinfowler.com/articles/micro-frontends.html';
  const inventoryRow = inventory.entries.find((entry) => entry.source_family === family);
  const source = ledger.sources.find((entry) => entry.license_family_id === family);

  assert.equal(inventoryRow.author_or_org, 'Cam Jackson');
  assert.equal(source.author_or_org, 'Cam Jackson');
  assert.equal(source.published_at, '2019-06-19');
  assert.match(
    microFrontendsBody,
    /Cam Jackson, Micro Frontends.*发布于 2019-06-19/s,
  );
});

test('records both Microsoft Learn families as CC-BY-4.0 from their official source repositories', async () => {
  const {inventory, ledger} = await governedData();
  const rows = inventory.entries.filter((entry) =>
    entry.source_family.startsWith('https://learn.microsoft.com/'));
  const sources = ledger.sources.filter((source) =>
    source.license_family_id.startsWith('https://learn.microsoft.com/'));

  assert.equal(rows.length, 2);
  assert.equal(sources.length, 2);
  for (const item of [...rows, ...sources]) {
    assert.equal(item.exact_license ?? item.license, 'CC-BY-4.0');
    assert.match(item.license_evidence_url, /^https:\/\/github\.com\/(?:microsoftdocs\/architecture-center|dotnet\/docs)\/blob\/main\/LICENSE$/i);
  }
});

test('keeps Yjs documentation conservative because license.md only licenses Yjs software', async () => {
  const {inventory, ledger} = await governedData();
  const rows = inventory.entries.filter((entry) =>
    entry.source_family.startsWith('https://docs.yjs.dev'));
  const sources = ledger.sources.filter((source) =>
    source.license_family_id.startsWith('https://docs.yjs.dev'));

  assert.equal(rows.length, 8);
  assert.equal(sources.length, 8);
  for (const item of [...rows, ...sources]) {
    assert.equal(
      item.exact_license ?? item.license,
      'LicenseRef-All-Rights-Reserved',
    );
    assert.equal(
      item.license_evidence_url,
      'https://github.com/yjs/docs/blob/main/license.md',
    );
    assert.match(
      item.license_evidence_note,
      /license\.md.*Yjs software.*does not clearly license.*documentation text/i,
    );
    assert.doesNotMatch(item.license_evidence_note, /no reusable license notice.*found/i);
  }
});

test('keeps the migration inventory snapshot aligned with runtime ledger authority', async () => {
  const {inventory, ledger} = await governedData();
  const consistency = validateInventoryLedgerConsistency(inventory.entries, ledger.sources);
  assert.deepEqual(consistency.errors, []);
});
