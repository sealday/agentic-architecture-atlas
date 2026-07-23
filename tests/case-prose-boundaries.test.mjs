import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

async function readCase(filename) {
  return readFile(new URL(`../content/cases/${filename}`, import.meta.url), 'utf8');
}

function visibleOpening(source) {
  const withoutFrontMatter = source.replace(/^---\n[\s\S]*?\n---\n/u, '');
  return withoutFrontMatter.split(/\n## /u, 1)[0];
}

test('labels the Google ADK cancellation conclusion as an evidence-based inference', async () => {
  const source = await readCase('google-adk-a2a.mdx');
  const opening = visibleOpening(source);

  assert.match(
    opening,
    /\*\*基于证据的推断\*\*：因此超时关闭 HTTP 连接、用户点击“停止”和远端副作用停止是三件不同的事。/,
  );
});

test('keeps the Microsoft opening artifact role separate from its evidence scope', async () => {
  const source = await readCase('microsoft-multi-agent-reference-architecture.mdx');
  const opening = visibleOpening(source);

  assert.match(
    opening,
    /它更像一张企业架构问题清单：Orchestrator、Registry、记忆、通信、评估和治理各自承担什么责任，以及这些责任之间应画出哪些边界。/,
  );
  assert.match(
    opening,
    /本文据此只把职责分工视为已证实事实，框架选择和运行合同仍是项目决策。/,
  );
  assert.equal(
    opening.match(/实施团队/g)?.length ?? 0,
    0,
    'the opening should not repeat the implementation-team formulation',
  );
});
