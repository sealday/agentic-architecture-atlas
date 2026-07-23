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

test('styles evidence details as responsive themed cards', async () => {
  const css = await readFile(new URL('../src/css/custom.css', import.meta.url), 'utf8');
  const declarations = declarationsFor(css, '.theme-doc-markdown details.evidence-card');

  assert.ok(declarations, 'evidence details need a card boundary in rendered Markdown');
  assert.equal(declarations.get('border'), '1px solid var(--atlas-line)');
  assert.equal(declarations.get('background'), 'var(--atlas-paper-muted)');
  assert.equal(declarations.get('margin'), '1.25rem 0');
  assert.equal(declarations.get('padding'), '0.85rem 1rem');
});

test('makes evidence summaries interactive and keyboard-visible', async () => {
  const css = await readFile(new URL('../src/css/custom.css', import.meta.url), 'utf8');
  const declarations = declarationsFor(
    css,
    '.theme-doc-markdown details.evidence-card > summary',
  );
  const focusDeclarations = declarationsFor(
    css,
    '.theme-doc-markdown details.evidence-card > summary:focus-visible',
  );

  assert.ok(declarations, 'evidence summaries need an explicit interactive treatment');
  assert.equal(declarations.get('cursor'), 'pointer');
  assert.equal(declarations.get('font-weight'), '650');
  assert.equal(declarations.get('color'), 'var(--atlas-ink-soft)');
  assert.ok(focusDeclarations, 'keyboard focus must remain visible on evidence summaries');
  assert.equal(focusDeclarations.get('outline'), '3px solid var(--atlas-focus)');
  assert.equal(focusDeclarations.get('outline-offset'), '3px');
});
