export const topicPrefixTypes = new Map([
  ['FND', ['concept', 'concepts']],
  ['DST', ['concept', 'concepts']],
  ['PR', ['principle', 'principles']],
  ['QA', ['quality-attribute', 'quality-attributes']],
  ['MTH', ['method', 'methods']],
  ['MOD', ['modeling', 'modeling']],
  ['STY', ['style', 'styles']],
  ['DDD', ['pattern', 'patterns']],
  ['APP', ['pattern', 'patterns']],
  ['DP', ['pattern', 'patterns']],
  ['PAT-DC', ['pattern', 'patterns']],
  ['PAT-IN', ['pattern', 'patterns']],
  ['REL', ['pattern', 'patterns']],
  ['OPS', ['pattern', 'patterns']],
  ['SEC', ['pattern', 'patterns']],
  ['ANTI', ['pattern', 'patterns']],
  ['CASE', ['case', 'cases']],
  ['QST', ['question', 'questions']],
  ['CLD', ['path', 'paths']],
  ['FE', ['path', 'paths']],
  ['EDGE', ['path', 'paths']],
  ['AGT', ['path', 'paths']],
]);

const allowedPriorities = new Set(['P0', 'P1', 'P2', 'P3']);
const orderedPrefixes = [...topicPrefixTypes.keys()].sort(
  (left, right) => right.length - left.length,
);

export function findBacklogTopicCandidates(source) {
  const candidates = [];
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const match = line.match(
      /^-\s+\[[ xX]\]\s+(?:\*\*)?([A-Z][A-Z0-9-]*)\b/,
    );
    if (match && !match[1].startsWith('E0-')) {
      candidates.push({id: match[1], line: index + 1, source: line});
    }
  }
  return candidates;
}

function location(file, line) {
  return `${file ?? 'backlog'}:${line}`;
}

function addById(collection, id, value) {
  const entries = collection.get(id) ?? [];
  entries.push(value);
  collection.set(id, entries);
}

export function parseBacklogTopics(source, file) {
  const candidates = findBacklogTopicCandidates(source);
  const topics = [];
  const errors = [];

  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const task = line.match(
      /^-\s+\[([ xX])\]\s+\*\*([A-Z]+(?:-[A-Z]+)*-\d{2})\s+(P\d)｜(.+?)\*\*(?:[：:.。]|$)/,
    );
    if (!task) {
      continue;
    }

    const [, checked, id, priority, rawTitle] = task;
    if (id.startsWith('E0-')) {
      continue;
    }

    const prefix = orderedPrefixes.find((candidate) =>
      id.startsWith(`${candidate}-`),
    );
    if (!prefix) {
      errors.push(`${location(file, index + 1)}: unknown topic ID ${id}`);
      continue;
    }
    if (!allowedPriorities.has(priority)) {
      errors.push(
        `${location(file, index + 1)}: invalid priority ${priority} for ${id}`,
      );
      continue;
    }

    const [type, route] = topicPrefixTypes.get(prefix);
    topics.push({
      id,
      type,
      title: rawTitle.trim().replace(/[。.]\s*$/, ''),
      slug: `/${route}/${id.toLowerCase()}`,
      priority,
      complete: checked.toLowerCase() === 'x',
      line: index + 1,
    });
  }

  const candidatesById = new Map();
  const topicsById = new Map();
  for (const candidate of candidates) {
    addById(candidatesById, candidate.id, candidate);
  }
  for (const topic of topics) {
    addById(topicsById, topic.id, topic);
  }

  for (const [id, entries] of candidatesById) {
    if (entries.length > 1) {
      const lines = entries.map(({line}) => line).join(', ');
      errors.push(
        `${location(file, entries[0].line)}: duplicate topic ID ${id} on lines ${lines}`,
      );
    }
    if (!topicsById.has(id)) {
      for (const candidate of entries) {
        errors.push(
          `${location(file, candidate.line)}: topic candidate ${id} was not parsed: ${candidate.source}`,
        );
      }
    }
  }

  for (const [id, entries] of topicsById) {
    if (!candidatesById.has(id)) {
      for (const topic of entries) {
        errors.push(
          `${location(file, topic.line)}: parsed topic ${id} was not detected as a candidate`,
        );
      }
    }
  }

  return {topics, errors};
}
