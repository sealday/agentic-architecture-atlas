import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLinkTargets,
  checkLiveLinkBatch,
  checkLiveLinks,
  checkSourceLink,
  evaluateLinkHealthVerdict,
  mergePublicLedgerHealth,
  mergeLinkHealthCaches,
  validateLinkHealthCacheStructure,
} from '../scripts/source-link-health.mjs';

const at = '2026-07-24T00:00:00.000Z';
const now = new Date(at);

function source(id, locator, policy = 'stable', extra = {}) {
  const transport = new URL(locator);
  transport.hash = '';
  return {
    id,
    canonical_locator: locator,
    transport_locator: transport.href,
    query_insensitive: false,
    locator_aliases: [],
    tombstone:
      policy === 'retired'
        ? {retired_at: '2026-07-01', replacement_source_id: null, reason: 'gone'}
        : null,
    link_policy: policy,
    expected_final_transport_locator: transport.href,
    expected_final_approved_at: '2026-07-23',
    expected_final_approval_note: 'Reviewed',
    ...extra,
  };
}

function ledger(sources) {
  return {schema_version: 1, sources, documents: {}};
}

function attempt({
  outcome = 'healthy',
  status = 200,
  final = 'https://example.com/a',
  when = at,
  login = false,
} = {}) {
  return {
    at: when,
    outcome,
    final_transport_locator: final,
    http_status: status,
    login_wall_detected: login,
    redirects: [],
  };
}

function result(target, lastAttempt = attempt({final: target.transport_locator})) {
  const accepted = ['healthy', 'auth-required', 'retired'].includes(
    lastAttempt.outcome,
  );
  return {
    transport_locator: target.transport_locator,
    source_ids: target.source_ids,
    last_attempt: lastAttempt,
    last_success: accepted ? {...lastAttempt} : null,
    attempt_history: [{...lastAttempt}],
    review_status: accepted ? lastAttempt.outcome : 'stale',
  };
}

function cacheFor(governed, mutate = (value) => value) {
  const targets = buildLinkTargets(governed);
  return {
    schema_version: 1,
    generated_at: at,
    results: targets.map((target) => mutate(result(target), target)),
  };
}

test('validates complete transport-deduplicated link-health cache coverage', () => {
  const governed = ledger([
    source('fragment-a', 'https://example.com/file#L1'),
    source('fragment-b', 'https://example.com/file#L2'),
    source('plain', 'https://example.com/file?plain=1', 'stable', {
      query_insensitive: true,
      transport_locator: 'https://example.com/file',
      expected_final_transport_locator: 'https://example.com/file',
    }),
    source('version-1', 'https://example.com/file?version=1'),
    source('version-2', 'https://example.com/file?version=2'),
    source('auth', 'https://auth.example.com/', 'auth-required'),
    source('retired', 'https://old.example.com/', 'retired'),
    {
      ...source('local', 'https://unused.example.com/'),
      canonical_locator: '/img/local.png',
      transport_locator: '/img/local.png',
      link_policy: null,
      expected_final_transport_locator: null,
      expected_final_approved_at: null,
      expected_final_approval_note: null,
    },
  ]);
  const targets = buildLinkTargets(governed);
  assert.deepEqual(
    targets.map(({transport_locator, source_ids}) => [
      transport_locator,
      source_ids,
    ]),
    [
      ['https://auth.example.com/', ['auth']],
      ['https://example.com/file', ['fragment-a', 'fragment-b', 'plain']],
      ['https://example.com/file?version=1', ['version-1']],
      ['https://example.com/file?version=2', ['version-2']],
      ['https://old.example.com/', ['retired']],
    ],
  );
  assert.deepEqual(
    validateLinkHealthCacheStructure(governed, cacheFor(governed)).errors,
    [],
  );
});

test('checks cited aliases but excludes uncited superseded aliases', () => {
  const governedSource = source('migrated', 'https://example.com/current', 'stable', {
    locator_aliases: [
      {
        locator: 'https://example.com/old#section',
        transport_locator: 'https://example.com/old',
        expected_final_transport_locator: 'https://example.com/old',
        expected_final_approved_at: '2026-07-23',
        expected_final_approval_note: 'Historical baseline',
        superseded_at: '2026-07-24',
      },
    ],
  });
  const uncited = ledger([governedSource]);
  assert.deepEqual(
    buildLinkTargets(uncited).map(({transport_locator}) => transport_locator),
    ['https://example.com/current'],
  );

  const cited = {
    ...uncited,
    documents: {
      'content/example.mdx': {
        citations: [
          {
            source_id: governedSource.id,
            citation_url: 'https://example.com/old#section',
          },
        ],
      },
    },
  };
  assert.deepEqual(
    buildLinkTargets(cited).map(({transport_locator}) => transport_locator),
    ['https://example.com/current', 'https://example.com/old'],
  );
});

test('separates last attempt last success and stale review status', () => {
  const governed = ledger([source('a', 'https://example.com/a')]);
  const cached = cacheFor(governed, (entry) => {
    const failedAttempt = attempt({
      outcome: 'error',
      status: 503,
      final: 'https://example.com/a',
    });
    return {
      ...entry,
      last_attempt: failedAttempt,
      attempt_history: [entry.last_success, failedAttempt],
      review_status: 'stale',
    };
  });
  assert.deepEqual(validateLinkHealthCacheStructure(governed, cached).errors, []);
  assert.match(
    evaluateLinkHealthVerdict(governed, cached, {now}).failures.join('\n'),
    /stale/,
  );
});

test('rejects missing duplicate stale and policy-incompatible cache results', () => {
  const governed = ledger([
    source('a', 'https://example.com/a'),
    source('auth', 'https://example.com/auth', 'auth-required'),
  ]);
  const valid = cacheFor(governed, (entry, target) =>
    target.link_policy === 'auth-required'
      ? result(
          target,
          attempt({
            outcome: 'auth-required',
            status: 401,
            final: target.transport_locator,
          }),
        )
      : entry,
  );
  const malformed = structuredClone(valid);
  malformed.results.push(structuredClone(malformed.results[0]));
  malformed.results[0].source_ids = ['orphan'];
  assert.match(
    validateLinkHealthCacheStructure(governed, malformed).errors.join('\n'),
    /duplicate|source_ids/,
  );

  const incompatible = structuredClone(valid);
  incompatible.results.find((entry) => entry.source_ids.includes('auth')).last_attempt =
    attempt({
      outcome: 'healthy',
      status: 200,
      final: 'https://example.com/auth',
    });
  incompatible.results.find((entry) => entry.source_ids.includes('auth')).last_success =
    incompatible.results.find((entry) => entry.source_ids.includes('auth')).last_attempt;
  incompatible.results.find((entry) => entry.source_ids.includes('auth')).review_status =
    'healthy';
  assert.match(
    evaluateLinkHealthVerdict(governed, incompatible, {now}).failures.join('\n'),
    /auth-required/,
  );
});

test('follows bounded HTTPS redirects and records every hop', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({url, options});
    const path = new URL(url).pathname;
    if (path === '/a') {
      return new Response(null, {
        status: 301,
        headers: {location: '/b'},
      });
    }
    return new Response(null, {status: 200});
  };
  const target = buildLinkTargets(
    ledger([
      source('a', 'https://example.com/a', 'stable', {
        expected_final_transport_locator: 'https://example.com/b',
      }),
    ]),
  )[0];
  const checked = await checkSourceLink(target, {fetchImpl, now});
  assert.equal(checked.last_attempt.outcome, 'healthy');
  assert.deepEqual(checked.last_attempt.redirects, [
    {
      status: 301,
      from: 'https://example.com/a',
      to: 'https://example.com/b',
    },
  ]);
  assert.ok(calls.every(({options}) => options.redirect === 'manual'));
  assert.ok(calls.every(({options}) => options.signal instanceof AbortSignal));
});

test('falls back from unsupported HEAD to ranged GET', async () => {
  for (const headStatus of [403, 405, 501]) {
    const calls = [];
    const checked = await checkSourceLink(
      buildLinkTargets(ledger([source('a', 'https://example.com/a')]))[0],
      {
        now,
        fetchImpl: async (_url, options) => {
          calls.push(options);
          return options.method === 'HEAD'
            ? new Response(null, {status: headStatus})
            : new Response('ok', {status: 200});
        },
      },
    );
    assert.equal(checked.last_attempt.outcome, 'healthy');
    assert.deepEqual(
      calls.map(({method}) => method),
      ['HEAD', 'GET'],
    );
    assert.equal(calls[1].headers.Range, 'bytes=0-65535');
  }
});

test('retries bounded Retry-After responses and recovers from 429', async () => {
  const waits = [];
  let calls = 0;
  const checked = await checkSourceLink(
    buildLinkTargets(ledger([source('a', 'https://example.com/a')]))[0],
    {
      now,
      sleep: async (ms) => waits.push(ms),
      fetchImpl: async () => {
        calls += 1;
        return calls < 3
          ? new Response(null, {
              status: calls === 1 ? 429 : 503,
              headers: {
                'retry-after':
                  calls === 1 ? '20' : 'Fri, 24 Jul 2026 00:00:03 GMT',
              },
            })
          : new Response(null, {status: 200});
      },
    },
  );
  assert.equal(checked.last_attempt.outcome, 'healthy');
  assert.deepEqual(waits, [5000, 3000]);
});

test('detects a 200 HTML login wall instead of reporting healthy', async () => {
  const checked = await checkSourceLink(
    buildLinkTargets(
      ledger([source('auth', 'https://example.com/docs', 'auth-required')]),
    )[0],
    {
      now,
      fetchImpl: async (_url, options) =>
        options.method === 'HEAD'
          ? new Response(null, {
              status: 200,
              headers: {'content-type': 'text/html'},
            })
          : new Response('<form><input type="password">Sign in</form>', {
              status: 200,
              headers: {'content-type': 'text/html'},
            }),
    },
  );
  assert.equal(checked.last_attempt.outcome, 'auth-required');
  assert.equal(checked.last_attempt.login_wall_detected, true);
});

test('probes missing HEAD content type and detects a 206 login wall', async () => {
  const calls = [];
  const governed = ledger([
    source('auth', 'https://example.com/docs', 'auth-required'),
  ]);
  const checked = await checkSourceLink(
    buildLinkTargets(governed)[0],
    {
      now,
      fetchImpl: async (_url, options) => {
        calls.push(options);
        return options.method === 'HEAD'
          ? new Response(null, {status: 200})
          : new Response('<form><input type="password"></form>', {
              status: 206,
              headers: {'content-type': 'text/html'},
            });
      },
    },
  );
  assert.deepEqual(
    calls.map(({method}) => method),
    ['HEAD', 'GET'],
  );
  assert.equal(calls[1].headers.Range, 'bytes=0-65535');
  assert.equal(checked.last_attempt.outcome, 'auth-required');
  assert.equal(checked.last_attempt.http_status, 206);
  assert.equal(checked.last_attempt.login_wall_detected, true);
  assert.equal(checked.review_status, 'auth-required');
  assert.ok(checked.last_success);
  const cache = {
    schema_version: 1,
    generated_at: at,
    results: [checked],
  };
  assert.deepEqual(
    evaluateLinkHealthVerdict(governed, cache, {now}).failures,
    [],
  );
});

test('does not accept a successful response without a login wall for auth-required policy', async () => {
  const governed = ledger([
    source('auth', 'https://example.com/docs', 'auth-required'),
  ]);
  const checked = await checkSourceLink(buildLinkTargets(governed)[0], {
    now,
    fetchImpl: async (_url, options) =>
      options.method === 'HEAD'
        ? new Response(null, {status: 200})
        : new Response('<html><main>Public documentation</main></html>', {
            status: 206,
            headers: {'content-type': 'text/html'},
          }),
  });
  assert.equal(checked.last_attempt.outcome, 'healthy');
  assert.equal(checked.review_status, 'stale');
  assert.equal(checked.last_success, null);
  assert.match(
    evaluateLinkHealthVerdict(
      governed,
      {schema_version: 1, generated_at: at, results: [checked]},
      {now},
    ).failures.join('\n'),
    /auth-required/,
  );
});

test('probes ambiguous or incorrect HEAD content types on page URLs', async () => {
  for (const headType of ['text/plain', 'application/octet-stream']) {
    const calls = [];
    const checked = await checkSourceLink(
      buildLinkTargets(
        ledger([source('auth', 'https://example.com/docs', 'auth-required')]),
      )[0],
      {
        now,
        fetchImpl: async (_url, options) => {
          calls.push(options);
          return options.method === 'HEAD'
            ? new Response(null, {
                status: 200,
                headers: {'content-type': headType},
              })
            : new Response(
                '<html><form action="/signin"><button>Continue</button></form></html>',
                {
                  status: 206,
                  headers: {'content-type': 'text/plain'},
                },
              );
        },
      },
    );
    assert.deepEqual(
      calls.map(({method}) => method),
      ['HEAD', 'GET'],
    );
    assert.equal(checked.last_attempt.outcome, 'auth-required');
    assert.equal(checked.last_attempt.login_wall_detected, true);
  }
});

test('skips body probes only for clearly typed non-HTML assets', async () => {
  const calls = [];
  const checked = await checkSourceLink(
    buildLinkTargets(
      ledger([source('pdf', 'https://example.com/manual.pdf')]),
    )[0],
    {
      now,
      fetchImpl: async (_url, options) => {
        calls.push(options);
        return new Response(null, {
          status: 200,
          headers: {'content-type': 'application/pdf'},
        });
      },
    },
  );
  assert.deepEqual(
    calls.map(({method}) => method),
    ['HEAD'],
  );
  assert.equal(checked.last_attempt.outcome, 'healthy');
});

test('caps successful ranged response inspection at 64 KiB', async () => {
  const prefix = 'x'.repeat(65536);
  const calls = [];
  const checked = await checkSourceLink(
    buildLinkTargets(ledger([source('docs', 'https://example.com/docs')]))[0],
    {
      now,
      fetchImpl: async (_url, options) => {
        calls.push(options);
        return options.method === 'HEAD'
          ? new Response(null, {status: 200})
          : new Response(`${prefix}<input type="password">`, {
              status: 206,
              headers: {'content-type': 'text/html'},
            });
      },
    },
  );
  assert.deepEqual(
    calls.map(({method}) => method),
    ['HEAD', 'GET'],
  );
  assert.equal(checked.last_attempt.outcome, 'healthy');
  assert.equal(checked.last_attempt.login_wall_detected, false);
});

test('does not mistake incidental sign-in prose for a login wall', async () => {
  const checked = await checkSourceLink(
    buildLinkTargets(ledger([source('docs', 'https://example.com/docs')]))[0],
    {
      now,
      fetchImpl: async (_url, options) =>
        options.method === 'HEAD'
          ? new Response(null, {
              status: 200,
              headers: {'content-type': 'text/html'},
            })
          : new Response(
              '<main>Read the docs. You may sign in for personalization.</main>',
              {
                status: 200,
                headers: {'content-type': 'text/html'},
              },
            ),
    },
  );
  assert.equal(checked.last_attempt.outcome, 'healthy');
  assert.equal(checked.last_attempt.login_wall_detected, false);
});

test('does not classify source files inside auth directories as login walls', async () => {
  const checked = await checkSourceLink(
    buildLinkTargets(
      ledger([
        source(
          'code',
          'https://github.com/example/repo/blob/commit/src/auth/checks.py',
        ),
      ]),
    )[0],
    {
      now,
      fetchImpl: async (_url, options) =>
        options.method === 'HEAD'
          ? new Response(null, {
              status: 200,
              headers: {'content-type': 'text/html'},
            })
          : new Response(
              [
                '<html><body>',
                '<header><a href="/login">Sign in</a></header>',
                '<main data-testid="blob">Source code in src/auth/checks.py</main>',
                '</body></html>',
              ].join(''),
              {
                status: 206,
                headers: {'content-type': 'text/html'},
              },
            ),
    },
  );
  assert.equal(checked.last_attempt.outcome, 'healthy');
  assert.equal(checked.last_attempt.login_wall_detected, false);
});

test('accepts an approved expected-final change without previous-success veto', async () => {
  const governed = ledger([
    source('a', 'https://example.com/a', 'stable', {
      expected_final_transport_locator: 'https://example.com/new',
    }),
  ]);
  const target = buildLinkTargets(governed)[0];
  const previousResult = result(target);
  const checked = await checkSourceLink(target, {
    previousResult,
    now,
    fetchImpl: async (url) =>
      new URL(url).pathname === '/a'
        ? new Response(null, {
            status: 301,
            headers: {location: '/new'},
          })
        : new Response(null, {status: 200}),
  });
  assert.equal(checked.last_attempt.outcome, 'healthy');
  assert.match(checked.change_note, /previous success/);
});

test('classifies auth retired timeout server and redirect failures', async () => {
  const cases = [
    ['auth-required', 401, 'auth-required'],
    ['retired', 410, 'retired'],
    ['stable', 500, 'error'],
  ];
  for (const [policy, status, outcome] of cases) {
    const checked = await checkSourceLink(
      buildLinkTargets(
        ledger([source(policy, `https://example.com/${policy}`, policy)]),
      )[0],
      {now, fetchImpl: async () => new Response(null, {status})},
    );
    assert.equal(checked.last_attempt.outcome, outcome);
  }
  const timeout = await checkSourceLink(
    buildLinkTargets(ledger([source('timeout', 'https://example.com/t')]))[0],
    {
      now,
      fetchImpl: async () => {
        throw new DOMException('timed out', 'TimeoutError');
      },
    },
  );
  assert.equal(timeout.last_attempt.outcome, 'error');
  assert.match(timeout.last_attempt.error, /timed out/);
});

test('does not reuse an old healthy result when the live request fails', async () => {
  const governed = ledger([source('a', 'https://example.com/a')]);
  const target = buildLinkTargets(governed)[0];
  const previousCache = cacheFor(governed);
  const {cache, errors} = await checkLiveLinks(governed, {
    previousCache,
    now,
    fetchImpl: async () => new Response(null, {status: 500}),
  });
  assert.equal(cache.results[0].last_attempt.outcome, 'error');
  assert.equal(cache.results[0].last_success.outcome, 'healthy');
  assert.equal(cache.results[0].review_status, 'stale');
  assert.equal(cache.results[0].attempt_history.length, 2);
  assert.ok(errors.length > 0);
  assert.deepEqual(target.source_ids, cache.results[0].source_ids);
});

test('reports live cache structure failures alongside verdict failures', async () => {
  const governed = ledger([
    source('stable', 'https://example.com/shared'),
    source('auth', 'https://example.com/shared', 'auth-required'),
  ]);
  const checked = await checkLiveLinks(governed, {
    now,
    fetchImpl: async (_url, options) =>
      options.method === 'HEAD'
        ? new Response(null, {
            status: 200,
            headers: {'content-type': 'application/pdf'},
          })
        : new Response(null, {status: 200}),
  });
  assert.match(checked.errors.join('\n'), /ledger sources conflict/);
});

test('limits global and per-origin concurrency', async () => {
  const sources = Array.from({length: 12}, (_, index) =>
    source(
      `s-${index}`,
      `https://${index < 8 ? 'one.example.com' : 'two.example.com'}/${index}`,
    ),
  );
  let active = 0;
  let globalPeak = 0;
  const activeByOrigin = new Map();
  let originPeak = 0;
  await checkLiveLinks(ledger(sources), {
    now,
    globalConcurrency: 6,
    perOriginConcurrency: 2,
    fetchImpl: async (url) => {
      const origin = new URL(url).origin;
      active += 1;
      activeByOrigin.set(origin, (activeByOrigin.get(origin) ?? 0) + 1);
      globalPeak = Math.max(globalPeak, active);
      originPeak = Math.max(originPeak, activeByOrigin.get(origin));
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;
      activeByOrigin.set(origin, activeByOrigin.get(origin) - 1);
      return new Response(null, {status: 200});
    },
  });
  assert.ok(globalPeak <= 6);
  assert.ok(originPeak <= 2);
});

test('resumes deterministic live batches and merges actual attempts', async () => {
  const governed = ledger([
    source('c', 'https://three.example.com/c'),
    source('a', 'https://one.example.com/a'),
    source('b', 'https://two.example.com/b'),
  ]);
  const fetchImpl = async () => new Response(null, {status: 200});
  const first = await checkLiveLinkBatch(governed, {
    batchIndex: 0,
    batchSize: 2,
    fetchImpl,
    now,
  });
  assert.deepEqual(
    first.cache.results.map(({transport_locator}) => transport_locator),
    ['https://one.example.com/a', 'https://three.example.com/c'],
  );
  assert.equal(first.complete, false);
  assert.equal(first.nextBatchIndex, 1);

  const second = await checkLiveLinkBatch(governed, {
    batchIndex: first.nextBatchIndex,
    batchSize: 2,
    fetchImpl,
    now,
  });
  assert.equal(second.complete, true);
  const merged = mergeLinkHealthCaches(governed, [first.cache, second.cache], {
    now,
  });
  assert.equal(merged.cache.results.length, 3);
  assert.deepEqual(merged.errors, []);
  assert.deepEqual(
    merged.cache.results.map(({transport_locator}) => transport_locator),
    [
      'https://one.example.com/a',
      'https://three.example.com/c',
      'https://two.example.com/b',
    ],
  );
});

test('preserves earlier failed attempts when merging a successful recheck', async () => {
  const governed = ledger([source('a', 'https://example.com/a')]);
  const target = buildLinkTargets(governed)[0];
  const failed = await checkSourceLink(target, {
    now: new Date('2026-07-23T23:00:00.000Z'),
    fetchImpl: async () => new Response(null, {status: 500}),
  });
  const recovered = await checkSourceLink(target, {
    now,
    fetchImpl: async () => new Response(null, {status: 200}),
  });
  const merged = mergeLinkHealthCaches(
    governed,
    [
      {schema_version: 1, generated_at: failed.last_attempt.at, results: [failed]},
      {
        schema_version: 1,
        generated_at: recovered.last_attempt.at,
        results: [recovered],
      },
    ],
    {now},
  );
  assert.deepEqual(merged.errors, []);
  assert.deepEqual(
    merged.cache.results[0].attempt_history.map(({outcome}) => outcome),
    ['error', 'healthy'],
  );
  assert.equal(merged.cache.results[0].last_success.outcome, 'healthy');
});

test('merges healthy auth retired and stale health into the public ledger', () => {
  const governed = ledger([
    source('healthy', 'https://example.com/healthy'),
    source('auth', 'https://example.com/auth', 'auth-required'),
    source('retired', 'https://example.com/retired', 'retired'),
    source('stale', 'https://example.com/stale'),
  ]);
  const cached = cacheFor(governed, (entry, target) => {
    if (target.link_policy === 'auth-required') {
      return result(
        target,
        attempt({
          outcome: 'auth-required',
          status: 403,
          final: target.transport_locator,
        }),
      );
    }
    if (target.link_policy === 'retired') {
      return result(
        target,
        attempt({
          outcome: 'retired',
          status: 404,
          final: target.transport_locator,
        }),
      );
    }
    if (target.source_ids.includes('stale')) {
      return {
        ...entry,
        last_attempt: attempt({
          outcome: 'error',
          status: 500,
          final: target.transport_locator,
        }),
        review_status: 'stale',
      };
    }
    return entry;
  });
  const merged = mergePublicLedgerHealth(governed, cached);
  assert.deepEqual(
    Object.fromEntries(
      merged.sources.map(({id, health_summary}) => [id, health_summary]),
    ),
    {
      healthy: 'healthy',
      auth: 'auth-required',
      retired: 'retired',
      stale: 'stale',
    },
  );
  assert.ok(
    merged.sources.every(
      ({health_checks}) =>
        Array.isArray(health_checks) && health_checks.length === 1,
    ),
  );
});
