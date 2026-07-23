import {parseBacklogTopics} from './backlog-topics.mjs';

export const indexedTopicTypes = [
  'concept',
  'principle',
  'quality-attribute',
  'method',
  'modeling',
  'style',
  'pattern',
  'case',
  'question',
  'path',
];

const allowedRelationKeys = new Set(['dependencies', 'related_cases']);
const catalogFields = [
  'title',
  'slug',
  'summary',
  'difficulty',
  'series',
  'catalog_order',
  'featured',
  'source_kinds',
  'migration_targets',
  'tags',
];
const priorityOrder = new Map([
  ['P0', 0],
  ['P1', 1],
  ['P2', 2],
  ['P3', 3],
  [null, 4],
]);

function legacyDocumentId(type, slug) {
  const leaf = slug.split('/').filter(Boolean).at(-1);
  return `DOC-${type}-${leaf}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function backlogStatus(complete) {
  return {
    scope: 'backlog-projection',
    value: complete ? 'complete' : 'pending',
    source: 'docs/content-backlog.md',
  };
}

function contentStatus(file, value) {
  return {
    scope: 'content-lifecycle',
    value,
    source: `content/${file}`,
  };
}

function copyArray(value) {
  return Array.isArray(value) ? [...value] : value;
}

function normalizedStrings(value) {
  return [...value].sort((left, right) => left.localeCompare(right, 'en'));
}

function sameStrings(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function dependencyDepth(topic, topicsById, memo = new Map()) {
  if (memo.has(topic.id)) return memo.get(topic.id);
  const depth =
    topic.dependencies.length === 0
      ? 0
      : 1 +
        Math.max(
          ...topic.dependencies.map((id) =>
            dependencyDepth(topicsById.get(id), topicsById, memo),
          ),
        );
  memo.set(topic.id, depth);
  return depth;
}

function makeTopicComparator(topicsById) {
  const depthMemo = new Map();
  return (left, right) =>
    priorityOrder.get(left.priority) - priorityOrder.get(right.priority) ||
    dependencyDepth(left, topicsById, depthMemo) -
      dependencyDepth(right, topicsById, depthMemo) ||
    left.id.localeCompare(right.id, 'en');
}

function projectBacklogTopic(topic) {
  return {
    id: topic.id,
    type: topic.type,
    title: topic.title,
    slug: topic.slug,
    priority: topic.priority,
    status: backlogStatus(topic.complete),
    dependencies: [],
    primary_sources: [],
    related_cases: [],
    reviewed_at: null,
    published: false,
  };
}

function projectDocument(id, file, metadata, existing) {
  const caseCatalog =
    metadata.content_type === 'case'
      ? Object.fromEntries(
          catalogFields.map((field) => [field, copyArray(metadata[field])]),
        )
      : undefined;
  const presentation = caseCatalog ? {case_catalog: caseCatalog} : {};

  return {
    id,
    type: metadata.content_type,
    title: metadata.title,
    slug: metadata.slug,
    priority: existing?.priority ?? metadata.priority ?? null,
    status: existing?.status ?? contentStatus(file, metadata.status),
    dependencies: copyArray(metadata.depends_on ?? []),
    primary_sources: copyArray(metadata.official_sources ?? []),
    related_cases: copyArray(metadata.related_cases ?? []),
    reviewed_at: metadata.analyzed_at,
    published: true,
    presentation,
  };
}

function validateRelationArray(topicId, field, value, errors) {
  if (!Array.isArray(value)) {
    errors.push(
      `data/topic-relations.json: relation "${topicId}" field "${field}" must be an array`,
    );
    return undefined;
  }
  if (value.some((entry) => typeof entry !== 'string' || entry === '')) {
    errors.push(
      `data/topic-relations.json: relation "${topicId}" field "${field}" must contain non-empty strings`,
    );
    return undefined;
  }
  return normalizedStrings(value);
}

function edgeKey(topicId, target) {
  return `${topicId}\0${target}`;
}

function findDependencyCycles(topicsById, dependencySources, errors) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function visit(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      const cycleStart = stack.indexOf(id);
      const path = [...stack.slice(cycleStart), id];
      const edges = path
        .slice(0, -1)
        .map((from, index) => {
          const to = path[index + 1];
          return `${from} -> ${to} (${dependencySources.get(edgeKey(from, to))})`;
        });
      errors.push(
        `manifest: dependency cycle ${path.join(' -> ')}; edges: ${edges.join(', ')}`,
      );
      return;
    }

    visiting.add(id);
    stack.push(id);
    for (const dependency of topicsById.get(id).dependencies) {
      if (topicsById.has(dependency) && dependency !== id) {
        visit(dependency);
      }
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  }

  for (const id of topicsById.keys()) {
    visit(id);
  }
}

export function buildTopicManifest({
  backlogSource,
  documents,
  relations = {},
}) {
  const parsed = parseBacklogTopics(
    backlogSource,
    'docs/content-backlog.md',
  );
  const errors = [...parsed.errors];
  const topicsById = new Map(
    parsed.topics.map((topic) => [topic.id, projectBacklogTopic(topic)]),
  );
  const topicSources = new Map(
    parsed.topics.map((topic) => [
      topic.id,
      `docs/content-backlog.md:${topic.line}`,
    ]),
  );
  const documentIds = new Map();
  const publishedRelations = new Map();
  const dependencySources = new Map();
  const relatedCaseSources = new Map();

  for (const {file, metadata} of documents) {
    if (file === 'index.mdx' || file.endsWith('/index.mdx')) {
      continue;
    }
    if (metadata.content_type === 'reference') {
      continue;
    }

    const id =
      metadata.topic_id ??
      legacyDocumentId(metadata.content_type, metadata.slug);
    const duplicateFile = documentIds.get(id);
    if (duplicateFile) {
      errors.push(
        `content/${file}: duplicate topic_id "${id}" conflicts with content/${duplicateFile}`,
      );
      continue;
    }
    documentIds.set(id, file);

    const existing = topicsById.get(id);
    if (existing && metadata.content_type !== existing.type) {
      errors.push(
        `content/${file}: topic_id "${id}" has type "${metadata.content_type}"; expected "${existing.type}"`,
      );
    }
    if (
      existing &&
      metadata.priority !== undefined &&
      metadata.priority !== existing.priority
    ) {
      errors.push(
        `content/${file}: topic_id "${id}" has priority "${metadata.priority}"; expected "${existing.priority}"`,
      );
    }

    const projected = projectDocument(id, file, metadata, existing);
    topicsById.set(id, projected);
    topicSources.set(id, `content/${file}`);
    publishedRelations.set(id, {
      file,
      dependencies: normalizedStrings(projected.dependencies),
      related_cases: normalizedStrings(projected.related_cases),
    });
    for (const dependency of projected.dependencies) {
      dependencySources.set(edgeKey(id, dependency), `content/${file}`);
    }
    for (const relatedCase of projected.related_cases) {
      relatedCaseSources.set(edgeKey(id, relatedCase), `content/${file}`);
    }

    if (
      !Array.isArray(projected.primary_sources) ||
      projected.primary_sources.length === 0
    ) {
      errors.push(
        `content/${file}: published topic "${id}" must have at least one primary source`,
      );
    }
    if (!isCalendarDate(projected.reviewed_at)) {
      errors.push(
        `content/${file}: published topic "${id}" has invalid reviewed_at "${projected.reviewed_at}"`,
      );
    }
  }

  for (const [id, relation] of Object.entries(relations)) {
    if (!topicsById.has(id)) {
      errors.push(
        `data/topic-relations.json: relation topic "${id}" does not exist`,
      );
      continue;
    }
    if (
      relation === null ||
      typeof relation !== 'object' ||
      Array.isArray(relation)
    ) {
      errors.push(
        `data/topic-relations.json: relation "${id}" must be an object`,
      );
      continue;
    }

    for (const key of Object.keys(relation)) {
      if (!allowedRelationKeys.has(key)) {
        errors.push(
          `data/topic-relations.json: relation "${id}" has unknown key "${key}"`,
        );
      }
    }

    const normalized = {};
    for (const field of allowedRelationKeys) {
      if (field in relation) {
        const value = validateRelationArray(id, field, relation[field], errors);
        if (value) normalized[field] = value;
      }
    }

    const published = publishedRelations.get(id);
    if (published) {
      for (const field of allowedRelationKeys) {
        if (
          normalized[field] &&
          !sameStrings(published[field], normalized[field])
        ) {
          errors.push(
            `content/${published.file}: topic "${id}" ${field} conflict with data/topic-relations.json`,
          );
        }
      }
    }

    const topic = topicsById.get(id);
    if (normalized.dependencies) {
      topic.dependencies = normalized.dependencies;
      for (const dependency of normalized.dependencies) {
        dependencySources.set(
          edgeKey(id, dependency),
          'data/topic-relations.json',
        );
      }
    }
    if (normalized.related_cases) {
      topic.related_cases = normalized.related_cases;
      for (const relatedCase of normalized.related_cases) {
        relatedCaseSources.set(
          edgeKey(id, relatedCase),
          'data/topic-relations.json',
        );
      }
    }
  }

  const slugOwners = new Map();
  for (const topic of topicsById.values()) {
    const owner = slugOwners.get(topic.slug);
    if (owner) {
      errors.push(
        `manifest: duplicate slug "${topic.slug}" for topic "${owner.id}" (${topicSources.get(owner.id)}) and topic "${topic.id}" (${topicSources.get(topic.id)})`,
      );
    } else {
      slugOwners.set(topic.slug, topic);
    }
  }

  const publishedCaseSlugs = new Set(
    [...topicsById.values()]
      .filter(({type, published}) => type === 'case' && published)
      .map(({slug}) => slug),
  );
  let graphIsValid = true;

  for (const topic of topicsById.values()) {
    topic.dependencies = normalizedStrings(topic.dependencies);
    topic.related_cases = normalizedStrings(topic.related_cases);

    for (const dependency of topic.dependencies) {
      const source =
        dependencySources.get(edgeKey(topic.id, dependency)) ??
        topicSources.get(topic.id);
      if (!topicsById.has(dependency)) {
        errors.push(
          `${source}: dependency "${dependency}" for "${topic.id}" does not exist`,
        );
        graphIsValid = false;
      } else if (dependency === topic.id) {
        errors.push(
          `${source}: topic "${topic.id}" cannot depend on itself`,
        );
        graphIsValid = false;
      }
    }

    for (const relatedCase of topic.related_cases) {
      if (!publishedCaseSlugs.has(relatedCase)) {
        const source =
          relatedCaseSources.get(edgeKey(topic.id, relatedCase)) ??
          topicSources.get(topic.id);
        errors.push(
          `${source}: related case "${relatedCase}" for "${topic.id}" is not a published case`,
        );
      }
    }
  }

  const cycleErrorCount = errors.length;
  findDependencyCycles(topicsById, dependencySources, errors);
  if (errors.length !== cycleErrorCount) {
    graphIsValid = false;
  }

  const topics = [...topicsById.values()];
  if (graphIsValid) {
    const comparator = makeTopicComparator(topicsById);
    topics.sort(comparator);
    for (const topic of topics) {
      if (topic.published) {
        topic.primary_sources = normalizedStrings(topic.primary_sources);
      }
    }

    const indexes = Object.fromEntries(
      indexedTopicTypes.map((type) => [
        type,
        topics.filter((topic) => topic.type === type).sort(comparator),
      ]),
    );
    return {
      manifest: {schema_version: 1, topics},
      indexes,
      errors,
    };
  }

  topics.sort((left, right) => left.id.localeCompare(right.id, 'en'));
  return {
    manifest: {schema_version: 1, topics},
    indexes: Object.fromEntries(
      indexedTopicTypes.map((type) => [
        type,
        topics.filter((topic) => topic.type === type),
      ]),
    ),
    errors,
  };
}
