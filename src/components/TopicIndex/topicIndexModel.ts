export type TopicType =
  | 'concept'
  | 'principle'
  | 'quality-attribute'
  | 'method'
  | 'modeling'
  | 'style'
  | 'pattern'
  | 'case'
  | 'question'
  | 'path';

export type TopicPriority = 'P0' | 'P1' | 'P2' | 'P3' | null;

type TopicStatus = {
  scope: 'backlog-projection' | 'content-lifecycle';
  value: string;
  source: string;
};

export type TopicIndexEntry = {
  id: string;
  type: TopicType;
  title: string;
  slug: string;
  priority: TopicPriority;
  status: TopicStatus;
  dependencies: string[];
  adjacent_topics: string[];
  primary_sources: string[];
  related_cases: string[];
  related_questions: string[];
  reviewed_at: string | null;
  published: boolean;
  pattern_group: string | null;
};

export type TopicIndexes = Record<TopicType, TopicIndexEntry[]>;

export type TopicIndexProps = {
  type: TopicType;
  plannedOnly?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isTopicPriority(value: unknown): value is TopicPriority {
  return (
    value === null ||
    value === 'P0' ||
    value === 'P1' ||
    value === 'P2' ||
    value === 'P3'
  );
}

function isTopicStatus(value: unknown): value is TopicStatus {
  return (
    isRecord(value) &&
    (value.scope === 'backlog-projection' ||
      value.scope === 'content-lifecycle') &&
    typeof value.value === 'string' &&
    typeof value.source === 'string'
  );
}

function isTopicIndexEntry(
  value: unknown,
  expectedType: TopicType,
): value is TopicIndexEntry {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.type === expectedType &&
    typeof value.title === 'string' &&
    typeof value.slug === 'string' &&
    isTopicPriority(value.priority) &&
    isTopicStatus(value.status) &&
    isStringArray(value.dependencies) &&
    isStringArray(value.adjacent_topics) &&
    isStringArray(value.primary_sources) &&
    isStringArray(value.related_cases) &&
    isStringArray(value.related_questions) &&
    (value.reviewed_at === null || typeof value.reviewed_at === 'string') &&
    typeof value.published === 'boolean' &&
    (value.pattern_group === null || typeof value.pattern_group === 'string')
  );
}

function parseTopicList(value: unknown, type: TopicType): TopicIndexEntry[] {
  if (!Array.isArray(value)) {
    throw new Error(`topic index "${type}" must be an array`);
  }

  for (const topic of value) {
    if (
      isRecord(topic) &&
      'priority' in topic &&
      !isTopicPriority(topic.priority)
    ) {
      throw new Error(
        `topic index "${type}" has invalid priority ${JSON.stringify(topic.priority)}`,
      );
    }
    if (!isTopicIndexEntry(topic, type)) {
      throw new Error(`topic index "${type}" contains an invalid topic`);
    }
  }

  return value;
}

export function parseTopicIndexes(value: unknown): TopicIndexes {
  if (!isRecord(value)) {
    throw new Error('topic indexes must be an object');
  }

  return {
    concept: parseTopicList(value.concept, 'concept'),
    principle: parseTopicList(value.principle, 'principle'),
    'quality-attribute': parseTopicList(
      value['quality-attribute'],
      'quality-attribute',
    ),
    method: parseTopicList(value.method, 'method'),
    modeling: parseTopicList(value.modeling, 'modeling'),
    style: parseTopicList(value.style, 'style'),
    pattern: parseTopicList(value.pattern, 'pattern'),
    case: parseTopicList(value.case, 'case'),
    question: parseTopicList(value.question, 'question'),
    path: parseTopicList(value.path, 'path'),
  };
}

export function selectTopics(
  topics: TopicIndexEntry[],
  plannedOnly: boolean,
): TopicIndexEntry[] {
  return topics.filter((topic) => !plannedOnly || !topic.published);
}
