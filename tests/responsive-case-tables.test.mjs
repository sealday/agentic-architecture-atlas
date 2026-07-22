import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

function declarationsFor(css, targetSelector) {
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1]
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean);

    if (!selectors.includes(targetSelector)) continue;

    return new Map(
      match[2]
        .split(';')
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .map((declaration) => {
          const colon = declaration.indexOf(':');
          return [
            declaration.slice(0, colon).trim(),
            declaration.slice(colon + 1).trim(),
          ];
        }),
    );
  }

  return undefined;
}

test('gives direct-child Markdown tables a local horizontal scroll boundary', async () => {
  const css = await readFile(new URL('../src/css/custom.css', import.meta.url), 'utf8');
  const declarations = declarationsFor(css, '.theme-doc-markdown > table');

  assert.ok(
    declarations,
    'production MDX renders tables as direct children, so overflow cannot depend on a wrapper selector',
  );
  assert.equal(declarations.get('display'), 'block');
  assert.equal(declarations.get('width'), 'max-content');
  assert.equal(declarations.get('max-width'), '100%');
  assert.equal(declarations.get('min-width'), '0');
  assert.equal(declarations.get('overflow-x'), 'auto');
  assert.equal(declarations.get('-webkit-overflow-scrolling'), 'touch');
  assert.doesNotMatch(css, /body\s*\{[^}]*overflow-x\s*:\s*hidden/s);
});
