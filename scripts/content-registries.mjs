import {readFile} from 'node:fs/promises';
import path from 'node:path';

const publicPatternGroupIds = [
  'general-design',
  'integration',
  'reliability',
  'data',
  'migration',
];
const patternGroupIds = new Set([
  ...publicPatternGroupIds,
  'agent-control',
]);

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return (
    isRecord(value) &&
    Object.keys(value).sort().join('\0') === [...keys].sort().join('\0')
  );
}

function emptyPatternGroupResult(errors) {
  return {
    registry: {schema_version: 1, groups: []},
    groupByTopicId: new Map(),
    errors: [...errors].sort((left, right) => left.localeCompare(right, 'en')),
  };
}

export function parsePatternGroupRegistry(
  value,
  topics,
  file = 'data/pattern-groups.json',
) {
  const errors = [];
  const groups = [];
  const topicList = Array.isArray(topics) ? topics : [];
  const topicById = new Map(topicList.map((topic) => [topic.id, topic]));
  const groupByTopicId = new Map();
  const groupIds = new Set();
  const orders = new Set();

  if (!Array.isArray(topics)) {
    errors.push(`${file}: topics must be an array`);
  }
  if (!exactKeys(value, ['schema_version', 'groups'])) {
    return emptyPatternGroupResult([
      ...errors,
      `${file}: expected exactly schema_version and groups`,
    ]);
  }
  if (value.schema_version !== 1 || !Array.isArray(value.groups)) {
    return emptyPatternGroupResult([
      ...errors,
      `${file}: schema_version must equal 1 and groups must be an array`,
    ]);
  }

  for (const [index, group] of value.groups.entries()) {
    const label = `${file}: group ${index + 1}`;
    if (!exactKeys(group, ['id', 'label', 'description', 'order', 'topic_ids'])) {
      errors.push(`${label} has unknown or missing fields`);
      continue;
    }
    if (
      typeof group.id !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(group.id)
    ) {
      errors.push(`${label} id must be kebab-case`);
    } else if (!patternGroupIds.has(group.id)) {
      errors.push(`${label} id "${group.id}" is not a registered Pattern group`);
    }
    if (groupIds.has(group.id)) {
      errors.push(`${label} duplicates id "${group.id}"`);
    }
    if (orders.has(group.order)) {
      errors.push(`${label} duplicates order "${group.order}"`);
    }
    groupIds.add(group.id);
    orders.add(group.order);
    if (
      typeof group.label !== 'string' ||
      group.label.trim() === '' ||
      typeof group.description !== 'string' ||
      group.description.trim() === '' ||
      !Number.isInteger(group.order) ||
      group.order <= 0 ||
      !Array.isArray(group.topic_ids)
    ) {
      errors.push(`${label} has an invalid label, description, order, or topic_ids`);
      continue;
    }
    for (const topicId of group.topic_ids) {
      const topic = topicById.get(topicId);
      if (!topic) {
        errors.push(`${label} topic "${topicId}" does not exist`);
      } else if (topic.type !== 'pattern') {
        errors.push(`${label} topic "${topicId}" is not type "pattern"`);
      } else if (groupByTopicId.has(topicId)) {
        errors.push(`Pattern topic "${topicId}" is assigned to multiple groups`);
      } else {
        groupByTopicId.set(topicId, group.id);
      }
    }
    groups.push({...group, topic_ids: [...group.topic_ids]});
  }

  for (const groupId of patternGroupIds) {
    if (!groupIds.has(groupId)) {
      errors.push(`${file}: required Pattern group "${groupId}" is missing`);
    }
  }
  for (const groupId of publicPatternGroupIds) {
    const group = groups.find(({id}) => id === groupId);
    if (!group || group.topic_ids.length === 0) {
      errors.push(`${file}: public group "${groupId}" must contain a topic`);
    }
  }
  for (const topic of topicList.filter(({type}) => type === 'pattern')) {
    if (!groupByTopicId.has(topic.id)) {
      errors.push(`Pattern topic "${topic.id}" is not assigned to a group`);
    }
  }

  groups.sort((left, right) => left.order - right.order);
  errors.sort((left, right) => left.localeCompare(right, 'en'));
  return {registry: {schema_version: 1, groups}, groupByTopicId, errors};
}

export async function loadPatternGroupRegistry(projectRoot, topics) {
  const file = path.join(projectRoot, 'data/pattern-groups.json');

  try {
    const value = JSON.parse(await readFile(file, 'utf8'));
    return parsePatternGroupRegistry(value, topics, file);
  } catch (error) {
    return emptyPatternGroupResult([
      error instanceof SyntaxError
        ? `${file}: invalid JSON: ${error.message}`
        : `${file}: ${error instanceof Error ? error.message : String(error)}`,
    ]);
  }
}
