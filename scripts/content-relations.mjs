import {visibleMdxLines} from './source-ledger.mjs';

const parentByType = new Map([
  ['concept', '/concepts'],
  ['principle', '/principles'],
  ['quality-attribute', '/quality-attributes'],
  ['method', '/methods'],
  ['modeling', '/modeling'],
  ['style', '/styles'],
  ['pattern', '/patterns'],
]);

function normalizeInternalPath(value) {
  const internalPath = value.split(/[?#]/, 1)[0].replace(/\/+$/, '');
  return internalPath === '' ? '/' : internalPath;
}

function contentPath(file) {
  const normalized = String(file ?? '').replaceAll('\\', '/');
  return normalized.startsWith('content/') ? normalized : `content/${normalized}`;
}

export function extractInternalLinks(document) {
  const links = new Set();
  for (const line of visibleMdxLines(document)) {
    const withoutInlineCode = line.replace(
      /(`+)(?:(?!\1)[\s\S])*\1/gu,
      '',
    );
    for (const pattern of [
      /(?<!!)\[(?:\\.|[^\]\\])*\]\((\/[^)\s]+)(?:\s+["'][^"']*["'])?\)/g,
      /\bhref=(?:["'])(\/[^"']+)(?:["'])/g,
      /\bto=(?:["'])(\/[^"']+)(?:["'])/g,
    ]) {
      for (const match of withoutInlineCode.matchAll(pattern)) {
        links.add(normalizeInternalPath(match[1]));
      }
    }
  }
  return [...links].sort((left, right) => left.localeCompare(right, 'en'));
}

export function validateContentRelations({documents, manifest}) {
  const errors = [];
  const topicById = new Map(manifest.topics.map((topic) => [topic.id, topic]));

  for (const document of documents) {
    const type = document.metadata?.content_type;
    const topicId = document.metadata?.topic_id;
    if (!parentByType.has(type) || typeof topicId !== 'string') {
      continue;
    }

    const topic = topicById.get(topicId);
    if (!topic?.published) {
      continue;
    }

    const visible = new Set(extractInternalLinks(document));
    const parent = parentByType.get(type);
    if (!visible.has(parent)) {
      errors.push(
        `${contentPath(document.file)}: missing visible parent link "${parent}"`,
      );
    }

    const adjacentSlugs = (topic.adjacent_topics ?? [])
      .map((id) => topicById.get(id))
      .filter((target) => target?.published)
      .map(({slug}) => slug);
    for (const slug of adjacentSlugs) {
      if (!visible.has(slug)) {
        errors.push(
          `${contentPath(document.file)}: missing visible adjacent topic link "${slug}"`,
        );
      }
    }

    const terminal = [
      ...(topic.related_cases ?? []),
      ...(topic.related_questions ?? []),
    ];
    if (!terminal.some((slug) => visible.has(slug))) {
      errors.push(
        `${contentPath(document.file)}: missing visible related case or question link ` +
          `(expected one of: ${terminal.map((slug) => JSON.stringify(slug)).join(', ')})`,
      );
    }
  }

  return {
    errors: errors.sort((left, right) => left.localeCompare(right, 'en')),
  };
}
