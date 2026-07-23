import Link from '@docusaurus/Link';
import topicIndexes from '@site/src/generated/topic-indexes.json';
import styles from './styles.module.css';

type TopicType =
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

type TopicPriority = 'P0' | 'P1' | null;

type TopicStatus = {
  scope: 'backlog-projection' | 'content-lifecycle';
  value: string;
  source: string;
};

type TopicIndexEntry = {
  id: string;
  type: TopicType;
  title: string;
  slug: string;
  priority: TopicPriority;
  status: TopicStatus;
  dependencies: string[];
  primary_sources: string[];
  related_cases: string[];
  reviewed_at: string | null;
  published: boolean;
};

type TopicIndexes = Record<TopicType, TopicIndexEntry[]>;

type TopicIndexProps = {
  type: TopicType;
  plannedOnly?: boolean;
};

const topicIndexData = topicIndexes as TopicIndexes;

export default function TopicIndex({
  type,
  plannedOnly = false,
}: TopicIndexProps) {
  const topics = topicIndexData[type].filter(
    (topic) => !plannedOnly || !topic.published,
  );

  if (topics.length === 0) {
    return <p>当前没有符合条件的主题。</p>;
  }

  return (
    <ul className={styles.grid}>
      {topics.map((topic) => {
        const firstSource = topic.primary_sources.find((source) =>
          source.startsWith('https://'),
        );

        return (
          <li className={styles.card} key={topic.id}>
            <div className={styles.heading}>
              {topic.published ? (
                <Link to={topic.slug}>{topic.title}</Link>
              ) : (
                <span>{topic.title}</span>
              )}
              {topic.priority && (
                <span className={styles.priority}>{topic.priority}</span>
              )}
            </div>
            <p>
              {topic.status.scope === 'backlog-projection'
                ? topic.status.value === 'complete'
                  ? '任务已完成'
                  : '计划主题'
                : `内容状态：${topic.status.value}`}
            </p>
            {topic.dependencies.length > 0 && (
              <p>前置主题：{topic.dependencies.join('、')}</p>
            )}
            {topic.published && topic.reviewed_at && (
              <p>最近复核：{topic.reviewed_at}</p>
            )}
            {!topic.published && firstSource && (
              <p>
                <a href={firstSource}>外部学习起点</a>
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
