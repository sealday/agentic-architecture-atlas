import type {TopicIndexEntry} from '../TopicIndex/topicIndexModel';

export type PatternGroup = {
  id: string;
  label: string;
  description: string;
  order: number;
};

export type PatternTopicView = TopicIndexEntry & {
  internalHref: string | null;
};

export type PatternGroupView = PatternGroup & {topics: PatternTopicView[]};

export function selectPatternGroups(
  groups: PatternGroup[],
  topics: TopicIndexEntry[],
): PatternGroupView[] {
  return [...groups]
    .filter(({id}) => id !== 'agent-control')
    .sort((left, right) => left.order - right.order)
    .map((group) => ({
      ...group,
      topics: topics
        .filter((topic) => topic.pattern_group === group.id)
        .map((topic) => ({
          ...topic,
          internalHref: topic.published ? topic.slug : null,
        })),
    }));
}
