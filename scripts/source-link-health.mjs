import {randomUUID} from 'node:crypto';
import {mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const maxSuccessAgeMs = 120 * 24 * 60 * 60 * 1000;

const acceptedOutcomes = new Set(['healthy', 'auth-required', 'retired']);
const outcomes = new Set([
  ...acceptedOutcomes,
  'redirect-changed',
  'error',
]);
const reviewStatuses = new Set([
  'healthy',
  'auth-required',
  'retired',
  'stale',
]);
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const transientResponseStatuses = new Set([429, 502, 503, 504]);
const transientRetryDelayMs = 250;
const userAgent =
  'Mozilla/5.0 (compatible; AgenticArchitectureAtlasLinkCheck/1.0; +https://github.com/sealday/agentic-architecture-atlas)';

function transportLocator(locator) {
  const value = new URL(locator);
  value.hash = '';
  return value.href;
}

function sortedStrings(values) {
  return [...values].sort((left, right) => left.localeCompare(right, 'en'));
}

function formatDiagnostic(locator, sourceIds, message) {
  return `data/source-link-health.json: transport ${JSON.stringify(
    locator,
  )} sources ${JSON.stringify(sortedStrings(sourceIds))}: ${message}`;
}

function sourceTransports(source, citedUrls = []) {
  if (!source.canonical_locator.startsWith('https://')) {
    return [];
  }
  const values = [
    {
      transport_locator:
        source.query_insensitive === true
          ? source.transport_locator
          : transportLocator(source.transport_locator ?? source.canonical_locator),
      expected_final_transport_locator:
        source.expected_final_transport_locator,
      expected_final_approved_at: source.expected_final_approved_at,
      expected_final_approval_note: source.expected_final_approval_note,
    },
  ];
  for (const alias of source.locator_aliases ?? []) {
    const aliasTransport = transportLocator(
      alias.transport_locator ?? alias.locator,
    );
    const cited = citedUrls.some((citationUrl) => {
      if (!citationUrl.startsWith('https://')) return false;
      if (source.query_insensitive === true) {
        const citation = new URL(citationUrl);
        citation.hash = '';
        citation.search = '';
        const aliasUrl = new URL(aliasTransport);
        aliasUrl.search = '';
        return citation.href === aliasUrl.href;
      }
      return transportLocator(citationUrl) === aliasTransport;
    });
    if (!cited) continue;
    values.push({
      transport_locator:
        source.query_insensitive === true
          ? alias.transport_locator
          : transportLocator(alias.transport_locator ?? alias.locator),
      expected_final_transport_locator:
        alias.expected_final_transport_locator,
      expected_final_approved_at: alias.expected_final_approved_at,
      expected_final_approval_note: alias.expected_final_approval_note,
    });
  }
  return values.filter(
    ({transport_locator}) =>
      typeof transport_locator === 'string' &&
      transport_locator.startsWith('https://'),
  );
}

function collectTargets(ledger) {
  const groups = new Map();
  const citationsBySource = new Map();
  for (const document of Object.values(ledger.documents ?? {})) {
    for (const citation of document.citations ?? []) {
      const values = citationsBySource.get(citation.source_id) ?? [];
      values.push(citation.citation_url);
      citationsBySource.set(citation.source_id, values);
    }
  }
  for (const source of ledger.sources ?? []) {
    for (const transport of sourceTransports(
      source,
      citationsBySource.get(source.id) ?? [],
    )) {
      const locator = transportLocator(transport.transport_locator);
      const current = groups.get(locator) ?? {
        transport_locator: locator,
        expected_final_transport_locator:
          transport.expected_final_transport_locator,
        expected_final_approved_at: transport.expected_final_approved_at,
        expected_final_approval_note: transport.expected_final_approval_note,
        source_ids: [],
        link_policy: source.link_policy,
        conflicts: [],
      };
      const fields = [
        'link_policy',
        'expected_final_transport_locator',
        'expected_final_approved_at',
        'expected_final_approval_note',
      ];
      for (const field of fields) {
        const incoming =
          field === 'link_policy' ? source.link_policy : transport[field];
        if (current[field] !== incoming) {
          current.conflicts.push(field);
        }
      }
      current.source_ids.push(source.id);
      groups.set(locator, current);
    }
  }
  return [...groups.values()]
    .map((target) => ({
      ...target,
      source_ids: sortedStrings(new Set(target.source_ids)),
      conflicts: sortedStrings(new Set(target.conflicts)),
    }))
    .sort((left, right) =>
      left.transport_locator.localeCompare(right.transport_locator, 'en'),
    );
}

export function buildLinkTargets(ledger) {
  return collectTargets(ledger).map(({conflicts: _conflicts, ...target}) => target);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validAttempt(value, {success = false, full = false} = {}) {
  if (
    !isRecord(value) ||
    typeof value.at !== 'string' ||
    Number.isNaN(Date.parse(value.at)) ||
    typeof value.outcome !== 'string' ||
    !outcomes.has(value.outcome) ||
    (success && !acceptedOutcomes.has(value.outcome)) ||
    !(
      value.final_transport_locator === null ||
      (typeof value.final_transport_locator === 'string' &&
        value.final_transport_locator.startsWith('https://'))
    ) ||
    !(
      value.http_status === null ||
      (Number.isInteger(value.http_status) &&
        value.http_status >= 100 &&
        value.http_status <= 599)
    )
  ) {
    return false;
  }
  if (
    full &&
    (typeof value.login_wall_detected !== 'boolean' ||
      !Array.isArray(value.redirects) ||
      !value.redirects.every(
        (redirect) =>
          isRecord(redirect) &&
          redirectStatuses.has(redirect.status) &&
          typeof redirect.from === 'string' &&
          redirect.from.startsWith('https://') &&
          typeof redirect.to === 'string' &&
          redirect.to.startsWith('https://'),
      ) ||
      !(
        value.error === undefined ||
        (typeof value.error === 'string' && value.error.length > 0)
      ))
  ) {
    return false;
  }
  return true;
}

function sameObservation(left, right) {
  return ['at', 'outcome', 'final_transport_locator', 'http_status'].every(
    (field) => left?.[field] === right?.[field],
  );
}

export function validateLinkHealthCacheStructure(ledger, cache) {
  const targets = collectTargets(ledger);
  const errors = [];
  for (const target of targets) {
    if (target.conflicts.length > 0) {
      errors.push(
        formatDiagnostic(
          target.transport_locator,
          target.source_ids,
          `ledger sources conflict on ${target.conflicts.join(', ')}`,
        ),
      );
    }
  }
  if (
    !isRecord(cache) ||
    cache.schema_version !== 1 ||
    typeof cache.generated_at !== 'string' ||
    Number.isNaN(Date.parse(cache.generated_at)) ||
    !Array.isArray(cache.results)
  ) {
    return {
      errors: [
        ...errors,
        'data/source-link-health.json: expected schema_version 1, generated_at, and results[]',
      ].sort(),
    };
  }

  const expected = new Map(
    targets.map((target) => [target.transport_locator, target]),
  );
  const byTransport = new Map();
  for (const entry of cache.results) {
    const locator =
      isRecord(entry) && typeof entry.transport_locator === 'string'
        ? entry.transport_locator
        : '<invalid>';
    const sourceIds =
      isRecord(entry) && Array.isArray(entry.source_ids)
        ? entry.source_ids.filter((value) => typeof value === 'string')
        : [];
    const prefix = (message) =>
      errors.push(formatDiagnostic(locator, sourceIds, message));
    if (
      !isRecord(entry) ||
      typeof entry.transport_locator !== 'string' ||
      !entry.transport_locator.startsWith('https://')
    ) {
      prefix('result must have an HTTPS transport_locator');
      continue;
    }
    const canonical = transportLocator(entry.transport_locator);
    if (canonical !== entry.transport_locator) {
      prefix('transport_locator must omit fragments');
    }
    const count = byTransport.get(entry.transport_locator) ?? 0;
    byTransport.set(entry.transport_locator, count + 1);
    if (count > 0) {
      prefix('duplicate result');
    }
    const target = expected.get(entry.transport_locator);
    if (!target) {
      prefix('orphan result');
    }
    if (
      !Array.isArray(entry.source_ids) ||
      !entry.source_ids.every((value) => typeof value === 'string') ||
      new Set(entry.source_ids).size !== entry.source_ids.length ||
      JSON.stringify(entry.source_ids) !==
        JSON.stringify(sortedStrings(entry.source_ids))
    ) {
      prefix('source_ids must be unique sorted strings');
    } else if (
      target &&
      JSON.stringify(entry.source_ids) !== JSON.stringify(target.source_ids)
    ) {
      prefix(
        `source_ids do not match ledger grouping ${JSON.stringify(
          target.source_ids,
        )}`,
      );
    }
    if (!validAttempt(entry.last_attempt, {full: true})) {
      prefix('last_attempt is invalid');
    }
    if (
      entry.last_success !== null &&
      !validAttempt(entry.last_success, {success: true})
    ) {
      prefix('last_success is invalid');
    }
    if (
      validAttempt(entry.last_attempt, {full: true}) &&
      validAttempt(entry.last_success, {success: true}) &&
      Date.parse(entry.last_success.at) > Date.parse(entry.last_attempt.at)
    ) {
      prefix('last_success cannot be newer than last_attempt');
    }
    if (
      target &&
      validAttempt(entry.last_success, {success: true}) &&
      !acceptedForPolicy(target.link_policy, entry.last_success)
    ) {
      prefix(
        `last_success outcome ${JSON.stringify(
          entry.last_success.outcome,
        )} is incompatible with ${target.link_policy} policy`,
      );
    }
    if (
      target &&
      validAttempt(entry.last_attempt, {full: true}) &&
      acceptedForPolicy(target.link_policy, entry.last_attempt) &&
      !sameObservation(entry.last_attempt, entry.last_success)
    ) {
      prefix('policy-accepted last_attempt must equal last_success');
    }
    if (
      !Array.isArray(entry.attempt_history) ||
      entry.attempt_history.length === 0 ||
      !entry.attempt_history.every((item) => validAttempt(item))
    ) {
      prefix('attempt_history must contain valid attempts');
    } else if (
      validAttempt(entry.last_attempt, {full: true}) &&
      !sameObservation(entry.attempt_history.at(-1), entry.last_attempt)
    ) {
      prefix('attempt_history must end with last_attempt');
    }
    if (
      Array.isArray(entry.attempt_history) &&
      entry.attempt_history.every((item) => validAttempt(item)) &&
      entry.attempt_history.some(
        (item, index, values) =>
          index > 0 && Date.parse(item.at) < Date.parse(values[index - 1].at),
      )
    ) {
      prefix('attempt_history must be chronological');
    }
    if (
      validAttempt(entry.last_success, {success: true}) &&
      Array.isArray(entry.attempt_history) &&
      !entry.attempt_history.some((item) =>
        sameObservation(item, entry.last_success),
      )
    ) {
      prefix('last_success must be preserved in attempt_history');
    }
    if (!reviewStatuses.has(entry.review_status)) {
      prefix('review_status is invalid');
    }
  }
  for (const target of targets) {
    if (!byTransport.has(target.transport_locator)) {
      errors.push(
        formatDiagnostic(
          target.transport_locator,
          target.source_ids,
          'missing result',
        ),
      );
    }
  }
  return {errors: errors.sort((left, right) => left.localeCompare(right, 'en'))};
}

function acceptedForPolicy(policy, attempt) {
  if (policy === 'auth-required') {
    return (
      attempt.outcome === 'auth-required' &&
      ((attempt.http_status === 401 || attempt.http_status === 403) ||
        (attempt.http_status >= 200 &&
          attempt.http_status <= 299 &&
          attempt.login_wall_detected === true))
    );
  }
  if (policy === 'retired') {
    return (
      attempt.outcome === 'retired' &&
      (attempt.http_status === 404 || attempt.http_status === 410)
    );
  }
  return (
    attempt.outcome === 'healthy' &&
    Number.isInteger(attempt.http_status) &&
    attempt.http_status >= 200 &&
    attempt.http_status <= 299
  );
}

export function evaluateLinkHealthVerdict(
  ledger,
  cache,
  {now = new Date()} = {},
) {
  const failures = [];
  const results = new Map(
    Array.isArray(cache?.results)
      ? cache.results.map((entry) => [entry.transport_locator, entry])
      : [],
  );
  for (const target of collectTargets(ledger)) {
    const entry = results.get(target.transport_locator);
    if (!entry || !validAttempt(entry.last_attempt)) {
      continue;
    }
    const fail = (message) =>
      failures.push(
        formatDiagnostic(target.transport_locator, target.source_ids, message),
      );
    if (entry.review_status === 'stale') {
      fail('review status is stale');
    }
    const expectedReviewStatus = acceptedForPolicy(
      target.link_policy,
      entry.last_attempt,
    )
      ? entry.last_attempt.outcome
      : 'stale';
    if (entry.review_status !== expectedReviewStatus) {
      fail(
        `review status ${JSON.stringify(
          entry.review_status,
        )} must be ${JSON.stringify(expectedReviewStatus)}`,
      );
    }
    if (!acceptedForPolicy(target.link_policy, entry.last_attempt)) {
      fail(
        `outcome ${JSON.stringify(
          entry.last_attempt.outcome,
        )} is incompatible with ${target.link_policy} policy`,
      );
    }
    if (
      entry.last_attempt.final_transport_locator &&
      transportLocator(entry.last_attempt.final_transport_locator) !==
        transportLocator(target.expected_final_transport_locator)
    ) {
      fail(
        `unapproved redirect to ${JSON.stringify(
          entry.last_attempt.final_transport_locator,
        )}`,
      );
    }
    if (
      !entry.last_success ||
      now.getTime() - Date.parse(entry.last_success.at) > maxSuccessAgeMs
    ) {
      fail('last success is missing or stale beyond 120 days');
    }
  }
  return {
    failures: failures.sort((left, right) => left.localeCompare(right, 'en')),
  };
}

function retryDelay(response, now) {
  const value = response.headers.get('retry-after');
  if (!value) return transientRetryDelayMs;
  const seconds = Number(value);
  const milliseconds = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(value) - now.getTime();
  if (!Number.isFinite(milliseconds)) return transientRetryDelayMs;
  return Math.min(5000, Math.max(0, milliseconds));
}

function isTransientRequestError(error) {
  if (!(error instanceof Error)) return false;
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return true;
  const cause =
    error.cause instanceof Error ||
    (typeof error.cause === 'object' && error.cause !== null)
      ? error.cause
      : null;
  const detail = [
    error.message,
    cause?.message,
    cause?.code,
  ].filter(Boolean).join(' ');
  return /fetch failed|network|timed? ?out|socket|econnreset|econnrefused|etimedout|eai_again/i.test(
    detail,
  );
}

async function requestWithRetries(url, method, options) {
  let response;
  for (let retry = 0; retry <= 2; retry += 1) {
    try {
      response = await options.fetchImpl(url, {
        method,
        redirect: 'manual',
        headers:
          method === 'GET'
            ? {'Range': 'bytes=0-65535', 'User-Agent': userAgent}
            : {'User-Agent': userAgent},
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      if (
        retry === 2 ||
        !transientResponseStatuses.has(response.status)
      ) {
        return response;
      }
      await options.sleep(retryDelay(response, options.now));
    } catch (error) {
      if (retry === 2 || !isTransientRequestError(error)) {
        throw error;
      }
      await options.sleep(transientRetryDelayMs);
    }
  }
  return response;
}

async function requestFollowingRedirects(startUrl, method, options) {
  let current = transportLocator(startUrl);
  const redirects = [];
  const visited = new Set([current]);
  for (let hop = 0; ; hop += 1) {
    const response = await requestWithRetries(current, method, options);
    if (!redirectStatuses.has(response.status)) {
      return {response, finalUrl: current, redirects};
    }
    const location = response.headers.get('location');
    if (!location) {
      throw new Error(`redirect ${response.status} has no Location`);
    }
    if (hop >= 5) {
      throw new Error('redirect limit exceeded');
    }
    const next = transportLocator(new URL(location, current).href);
    if (!next.startsWith('https://')) {
      throw new Error(`HTTPS downgrade rejected: ${next}`);
    }
    if (visited.has(next)) {
      throw new Error(`redirect loop detected: ${next}`);
    }
    redirects.push({status: response.status, from: current, to: next});
    visited.add(next);
    current = next;
  }
}

function loginWall(url, html) {
  const path = new URL(url).pathname.toLowerCase();
  const sourceOrAssetPath =
    /\.(?:c|cc|cpp|cs|css|go|h|hpp|java|js|jsx|json|kt|md|mjs|php|py|rb|rs|sh|swift|ts|tsx|txt|xml|ya?ml)$/i.test(
      path,
    );
  return (
    (!sourceOrAssetPath &&
      /(?:^|[/_-])(login|signin|sign-in|auth)(?:[/_.-]|$)/.test(path)) ||
    /<input\b[^>]*\btype\s*=\s*["']?password\b/i.test(html) ||
    /<form\b[^>]*(?:action|id|class|name)\s*=\s*["'][^"']*(?:login|signin|sign-in|auth)[^"']*["']/i.test(
      html,
    ) ||
    /<(?:h1|h2|title)\b[^>]*>\s*(?:sign[\s-]*in|log[\s-]*in)\b/i.test(
      html,
    ) ||
    /(?:access denied|authentication required)[\s\S]{0,300}(?:sign[\s-]*in|required login)/i.test(
      html,
    )
  );
}

async function readBodyPrefix(response, maximumBytes = 65536) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (size < maximumBytes) {
      const {done, value} = await reader.read();
      if (done) break;
      const remaining = maximumBytes - size;
      chunks.push(value.subarray(0, remaining));
      size += Math.min(value.byteLength, remaining);
      if (value.byteLength > remaining) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function clearlyNonHtmlAsset(url, contentType) {
  if (!contentType) return false;
  const type = contentType.split(';', 1)[0].trim().toLowerCase();
  const pathname = new URL(url).pathname.toLowerCase();
  const extension = pathname.match(/\.([a-z0-9]+)$/)?.[1];
  if (!extension) return false;
  const expectedTypes = {
    pdf: ['application/pdf'],
    json: ['application/json', 'application/ld+json'],
    png: ['image/png'],
    jpg: ['image/jpeg'],
    jpeg: ['image/jpeg'],
    gif: ['image/gif'],
    svg: ['image/svg+xml'],
    webp: ['image/webp'],
    ico: ['image/x-icon', 'image/vnd.microsoft.icon'],
    mp3: ['audio/mpeg'],
    mp4: ['video/mp4'],
    webm: ['audio/webm', 'video/webm'],
    wasm: ['application/wasm'],
    zip: ['application/zip'],
    gz: ['application/gzip'],
    tgz: ['application/gzip'],
  };
  return expectedTypes[extension]?.includes(type) ?? false;
}

function compactAttempt(attempt) {
  const copy = {...attempt};
  delete copy.redirects;
  delete copy.error;
  return copy;
}

export async function checkSourceLink(
  target,
  {
    previousResult,
    fetchImpl = fetch,
    sleep = async (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    now = new Date(),
    timeoutMs = 10000,
  } = {},
) {
  const requestOptions = {fetchImpl, sleep, now, timeoutMs};
  let observation;
  let usedGet = false;
  try {
    observation = await requestFollowingRedirects(
      target.transport_locator,
      'HEAD',
      requestOptions,
    );
    const headStatus = observation.response.status;
    const activeHeadFailure =
      target.link_policy !== 'retired' &&
      (headStatus === 404 || (headStatus >= 500 && headStatus <= 599));
    if ([403, 405].includes(headStatus) || activeHeadFailure) {
      usedGet = true;
      observation = await requestFollowingRedirects(
        target.transport_locator,
        'GET',
        requestOptions,
      );
    } else {
      const type = observation.response.headers
        .get('content-type')
        ?.toLowerCase();
      if (
        observation.response.status >= 200 &&
        observation.response.status <= 299 &&
        !clearlyNonHtmlAsset(observation.finalUrl, type)
      ) {
        usedGet = true;
        observation = await requestFollowingRedirects(
          target.transport_locator,
          'GET',
          requestOptions,
        );
      }
    }
    const {response, finalUrl, redirects} = observation;
    let html = '';
    if (
      usedGet &&
      response.status >= 200 &&
      response.status <= 299
    ) {
      html = await readBodyPrefix(response);
    }
    const login_wall_detected =
      usedGet &&
      response.status >= 200 &&
      response.status <= 299 &&
      loginWall(finalUrl, html);
    let outcome;
    let error = null;
    if (
      target.link_policy === 'auth-required' &&
      ([401, 403].includes(response.status) || login_wall_detected)
    ) {
      outcome = 'auth-required';
    } else if (
      target.link_policy === 'retired' &&
      [404, 410].includes(response.status)
    ) {
      outcome = 'retired';
    } else if (
      response.status >= 200 &&
      response.status <= 299 &&
      !login_wall_detected
    ) {
      outcome =
        transportLocator(finalUrl) ===
        transportLocator(target.expected_final_transport_locator)
          ? 'healthy'
          : 'redirect-changed';
      if (outcome === 'redirect-changed') {
        error = `final transport changed to ${finalUrl}`;
      }
    } else {
      outcome = 'error';
      error = login_wall_detected
        ? 'unexpected login wall'
        : `unexpected HTTP ${response.status}`;
    }
    const last_attempt = {
      at: now.toISOString(),
      outcome,
      final_transport_locator: finalUrl,
      http_status: response.status,
      login_wall_detected,
      redirects,
      ...(error ? {error} : {}),
    };
    return combineResult(target, previousResult, last_attempt);
  } catch (error) {
    return combineResult(target, previousResult, {
      at: now.toISOString(),
      outcome: 'error',
      final_transport_locator: null,
      http_status: null,
      login_wall_detected: false,
      redirects: observation?.redirects ?? [],
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function combineResult(target, previousResult, lastAttempt) {
  const success = acceptedForPolicy(target.link_policy, lastAttempt);
  const previousSuccess = previousResult?.last_success ?? null;
  const last_success = success ? compactAttempt(lastAttempt) : previousSuccess;
  const attempt_history = [
    ...(previousResult?.attempt_history ?? []),
    compactAttempt(lastAttempt),
  ];
  const result = {
    transport_locator: target.transport_locator,
    source_ids: target.source_ids,
    last_attempt: lastAttempt,
    last_success,
    attempt_history,
    review_status: success ? lastAttempt.outcome : 'stale',
  };
  if (
    previousSuccess?.final_transport_locator &&
    lastAttempt.final_transport_locator &&
    transportLocator(previousSuccess.final_transport_locator) !==
      transportLocator(lastAttempt.final_transport_locator)
  ) {
    result.change_note = `final transport differs from previous success ${previousSuccess.final_transport_locator}`;
  }
  return result;
}

async function runScheduled(items, globalLimit, perOriginLimit, operation) {
  const pending = [...items];
  const activeByOrigin = new Map();
  let active = 0;
  return new Promise((resolve, reject) => {
    const results = [];
    const schedule = () => {
      if (pending.length === 0 && active === 0) {
        resolve(results);
        return;
      }
      let advanced = true;
      while (active < globalLimit && advanced) {
        advanced = false;
        const index = pending.findIndex((item) => {
          const origin = new URL(item.transport_locator).origin;
          return (activeByOrigin.get(origin) ?? 0) < perOriginLimit;
        });
        if (index === -1) break;
        const [item] = pending.splice(index, 1);
        const origin = new URL(item.transport_locator).origin;
        active += 1;
        activeByOrigin.set(origin, (activeByOrigin.get(origin) ?? 0) + 1);
        advanced = true;
        operation(item)
          .then((value) => results.push(value), reject)
          .finally(() => {
            active -= 1;
            activeByOrigin.set(origin, activeByOrigin.get(origin) - 1);
            schedule();
          });
      }
    };
    schedule();
  });
}

export async function checkLiveLinks(
  ledger,
  {
    previousCache,
    fetchImpl = fetch,
    sleep,
    now = new Date(),
    timeoutMs = 10000,
    globalConcurrency = 6,
    perOriginConcurrency = 2,
  } = {},
) {
  const targets = buildLinkTargets(ledger);
  const checked = await checkTargets(ledger, targets, {
    previousCache,
    fetchImpl,
    sleep,
    now,
    timeoutMs,
    globalConcurrency,
    perOriginConcurrency,
  });
  const structure = validateLinkHealthCacheStructure(ledger, checked.cache);
  return {
    cache: checked.cache,
    errors: [...structure.errors, ...checked.errors].sort((left, right) =>
      left.localeCompare(right, 'en'),
    ),
  };
}

async function checkTargets(
  ledger,
  targets,
  {
    previousCache,
    fetchImpl,
    sleep,
    now,
    timeoutMs,
    globalConcurrency,
    perOriginConcurrency,
  },
) {
  const previous = new Map(
    (previousCache?.results ?? []).map((entry) => [
      entry.transport_locator,
      entry,
    ]),
  );
  const results = await runScheduled(
    targets,
    globalConcurrency,
    perOriginConcurrency,
    (target) =>
      checkSourceLink(target, {
        previousResult: previous.get(target.transport_locator),
        fetchImpl,
        sleep,
        now,
        timeoutMs,
      }),
  );
  results.sort((left, right) =>
    left.transport_locator.localeCompare(right.transport_locator, 'en'),
  );
  const cache = {
    schema_version: 1,
    generated_at: now.toISOString(),
    results,
  };
  return {
    cache,
    errors: evaluateLinkHealthVerdict(ledger, cache, {now}).failures,
  };
}

export async function checkLiveLinkBatch(
  ledger,
  {
    batchIndex = 0,
    batchSize = 30,
    previousCache,
    fetchImpl = fetch,
    sleep,
    now = new Date(),
    timeoutMs = 10000,
    globalConcurrency = 6,
    perOriginConcurrency = 2,
  } = {},
) {
  if (
    !Number.isInteger(batchIndex) ||
    batchIndex < 0 ||
    !Number.isInteger(batchSize) ||
    batchSize < 1
  ) {
    throw new TypeError('batchIndex must be >= 0 and batchSize must be >= 1');
  }
  const allTargets = buildLinkTargets(ledger);
  const start = batchIndex * batchSize;
  const targets = allTargets.slice(start, start + batchSize);
  const checked = await checkTargets(ledger, targets, {
    previousCache,
    fetchImpl,
    sleep,
    now,
    timeoutMs,
    globalConcurrency,
    perOriginConcurrency,
  });
  const complete = start + targets.length >= allTargets.length;
  return {
    ...checked,
    batchIndex,
    batchSize,
    nextBatchIndex: complete ? null : batchIndex + 1,
    complete,
    totalTargets: allTargets.length,
  };
}

export function mergeLinkHealthCaches(
  ledger,
  caches,
  {now = new Date()} = {},
) {
  if (!Array.isArray(caches) || caches.length === 0) {
    throw new TypeError('at least one link-health cache is required');
  }
  const expectedTransports = new Set(
    buildLinkTargets(ledger).map(({transport_locator}) => transport_locator),
  );
  const latest = new Map();
  for (const cache of caches) {
    for (const result of cache?.results ?? []) {
      if (!expectedTransports.has(result.transport_locator)) continue;
      const current = latest.get(result.transport_locator);
      if (!current) {
        latest.set(result.transport_locator, structuredClone(result));
        continue;
      }
      const newer =
        Date.parse(result.last_attempt.at) >= Date.parse(current.last_attempt.at)
          ? result
          : current;
      const successCandidates = [current.last_success, result.last_success]
        .filter(Boolean)
        .sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
      const historyByObservation = new Map();
      for (const attempt of [
        ...current.attempt_history,
        ...result.attempt_history,
      ]) {
        const key = JSON.stringify([
          attempt.at,
          attempt.outcome,
          attempt.final_transport_locator,
          attempt.http_status,
        ]);
        historyByObservation.set(key, attempt);
      }
      latest.set(result.transport_locator, {
        ...structuredClone(newer),
        last_success: successCandidates.at(-1) ?? null,
        attempt_history: [...historyByObservation.values()].sort(
          (left, right) => Date.parse(left.at) - Date.parse(right.at),
        ),
      });
    }
  }
  const cache = {
    schema_version: 1,
    generated_at: now.toISOString(),
    results: [...latest.values()].sort((left, right) =>
      left.transport_locator.localeCompare(right.transport_locator, 'en'),
    ),
  };
  const structure = validateLinkHealthCacheStructure(ledger, cache);
  const verdict =
    structure.errors.length === 0
      ? evaluateLinkHealthVerdict(ledger, cache, {now})
      : {failures: []};
  return {cache, errors: [...structure.errors, ...verdict.failures]};
}

export function mergePublicLedgerHealth(governedLedger, cache) {
  const targets = buildLinkTargets(governedLedger);
  const results = new Map(
    cache.results.map((entry) => [entry.transport_locator, entry]),
  );
  const checksBySource = new Map();
  for (const target of targets) {
    const result = results.get(target.transport_locator);
    if (!result) continue;
    const check = {
      transport_locator: target.transport_locator,
      status: result.review_status,
      last_attempt_at: result.last_attempt.at,
      last_success_at: result.last_success?.at ?? null,
      http_status: result.last_attempt.http_status,
      final_transport_locator: result.last_attempt.final_transport_locator,
    };
    for (const id of target.source_ids) {
      const current = checksBySource.get(id) ?? [];
      current.push(check);
      checksBySource.set(id, current);
    }
  }
  const priority = {
    healthy: 0,
    retired: 1,
    'auth-required': 2,
    stale: 3,
  };
  return {
    ...governedLedger,
    sources: governedLedger.sources.map((source) => {
      const health_checks = checksBySource.get(source.id) ?? [];
      const health_summary =
        health_checks
          .map(({status}) => status)
          .sort((left, right) => priority[right] - priority[left])[0] ??
        'healthy';
      return {...source, health_summary, health_checks};
    }),
  };
}

async function atomicWrite(filePath, value) {
  await mkdir(path.dirname(filePath), {recursive: true});
  const temporary = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
    await rename(temporary, filePath);
  } catch (error) {
    await rm(temporary, {force: true});
    throw error;
  }
}

function usage() {
  return 'Usage: node scripts/source-link-health.mjs (--check-cache | --live [--output <path>] | --refresh)';
}

function parseArgs(args) {
  const modes = args.filter((arg) =>
    ['--check-cache', '--live', '--refresh'].includes(arg),
  );
  const outputIndex = args.indexOf('--output');
  if (
    modes.length !== 1 ||
    args.some(
      (arg, index) =>
        !['--check-cache', '--live', '--refresh', '--output'].includes(arg) &&
        index !== outputIndex + 1,
    ) ||
    (outputIndex !== -1 &&
      (modes[0] !== '--live' ||
        outputIndex + 1 >= args.length ||
        args[outputIndex + 1].startsWith('--'))) ||
    (outputIndex === -1 && args.length !== 1) ||
    (outputIndex !== -1 && args.length !== 3)
  ) {
    throw new Error(usage());
  }
  return {
    mode: modes[0],
    output: outputIndex === -1 ? null : args[outputIndex + 1],
  };
}

async function runCli() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  const ledger = JSON.parse(
    await readFile(path.join(root, 'data/source-ledger.json'), 'utf8'),
  );
  const cachePath = path.join(root, 'data/source-link-health.json');
  const previousCache = JSON.parse(await readFile(cachePath, 'utf8'));
  if (parsed.mode === '--check-cache') {
    const structure = validateLinkHealthCacheStructure(ledger, previousCache);
    const verdict =
      structure.errors.length === 0
        ? evaluateLinkHealthVerdict(ledger, previousCache)
        : {failures: []};
    const errors = [...structure.errors, ...verdict.failures];
    if (errors.length > 0) {
      console.error(errors.join('\n'));
      process.exitCode = 1;
    }
    return;
  }
  const checked = await checkLiveLinks(ledger, {previousCache});
  if (parsed.mode === '--refresh') {
    await atomicWrite(cachePath, checked.cache);
  } else if (parsed.output) {
    await atomicWrite(path.resolve(parsed.output), checked.cache);
  }
  if (checked.errors.length > 0) {
    console.error(checked.errors.join('\n'));
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runCli();
}
