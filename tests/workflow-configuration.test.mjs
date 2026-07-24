import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const deployUrl = new URL('../.github/workflows/deploy.yml', import.meta.url);
const linkHealthUrl = new URL(
  '../.github/workflows/link-health.yml',
  import.meta.url,
);

async function readWorkflow(url) {
  try {
    return await readFile(url, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

function topLevelKeys(source) {
  return [...source.matchAll(/^([A-Za-z][A-Za-z0-9_-]*):(?:[ \t]|$)/gm)].map(
    ([, key]) => key,
  );
}

test('keeps deploy verification offline and live links in a read-only scheduled workflow', async () => {
  const [deploy, linkHealth] = await Promise.all([
    readWorkflow(deployUrl),
    readWorkflow(linkHealthUrl),
  ]);

  assert.match(
    deploy,
    /# npm run verify uses the committed link-health cache and does not access external sites\.\n[ ]*- name: Verify site\n[ ]+run: npm run verify/,
  );
  assert.doesNotMatch(deploy, /check:links:live|refresh:links/);

  assert.match(linkHealth, /^on:\n[ ]{2}schedule:\n/m);
  assert.match(linkHealth, /^[ ]{2}workflow_dispatch:\s*$/m);
  assert.match(linkHealth, /^permissions:\n[ ]{2}contents: read$/m);
  assert.match(linkHealth, /^[ ]{4}timeout-minutes: 30$/m);
  assert.match(
    linkHealth,
    /run: npm run check:links:live -- --output \/tmp\/source-link-health-live\.json/,
  );
  assert.doesNotMatch(
    linkHealth,
    /git push|pull[_ -]?request|contents:\s*write|pull-requests:\s*write/i,
  );
});

test('pins every GitHub action and uploads the live report even on failure', async () => {
  const [deploy, linkHealth] = await Promise.all([
    readWorkflow(deployUrl),
    readWorkflow(linkHealthUrl),
  ]);
  const uses = [...`${deploy}\n${linkHealth}`.matchAll(/^[ ]+uses: ([^\s#]+)/gm)].map(
    ([, action]) => action,
  );

  assert.ok(uses.length > 0);
  for (const action of uses) {
    assert.match(action, /@[0-9a-f]{40}$/);
  }
  assert.match(
    linkHealth,
    /- name: Upload live link report\n[ ]+if: always\(\)\n[ ]+uses: actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/,
  );
  assert.match(linkHealth, /name: source-link-health-live/);
  assert.match(linkHealth, /path: \/tmp\/source-link-health-live\.json/);
  assert.match(linkHealth, /if-no-files-found: error/);
});

test('always builds and uploads the monthly content review reports', async () => {
  const linkHealth = await readWorkflow(linkHealthUrl);

  assert.match(
    linkHealth,
    /run: npm run report:reviews -- --as-of "\$\(date -u \+%F\)" --json \/tmp\/content-review-health\.json --markdown \/tmp\/content-review-health\.md/,
  );
  assert.match(
    linkHealth,
    /- name: Build content review report\n[ ]+if: always\(\)\n[ ]+run: npm run report:reviews/,
  );
  assert.match(
    linkHealth,
    /- name: Upload content review report\n[ ]+if: always\(\)\n[ ]+uses: actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/,
  );
  assert.match(linkHealth, /name: content-review-health/);
  assert.match(
    linkHealth,
    /path: \|\n[ ]+\/tmp\/content-review-health\.json\n[ ]+\/tmp\/content-review-health\.md/,
  );
});

test('keeps workflow YAML indentation and top-level keys unambiguous', async () => {
  for (const [name, source] of [
    ['deploy.yml', await readWorkflow(deployUrl)],
    ['link-health.yml', await readWorkflow(linkHealthUrl)],
  ]) {
    assert.notEqual(source, '', `${name} must exist`);
    assert.doesNotMatch(source, /\t/, `${name} must not contain tabs`);
    assert.doesNotMatch(source, /[ \t]+$/m, `${name} must not contain trailing whitespace`);
    const keys = topLevelKeys(source);
    for (const required of ['name', 'on', 'permissions', 'jobs']) {
      assert.equal(
        keys.filter((key) => key === required).length,
        1,
        `${name} must have one unambiguous ${required} top-level key`,
      );
    }
  }
});
