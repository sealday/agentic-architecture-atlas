import Link from '@docusaurus/Link';
import topicIndexes from '@site/src/generated/topic-indexes.json';
import styles from './styles.module.css';
import {
  parseTopicIndexes,
  selectTopics,
  type TopicIndexProps,
} from './topicIndexModel';

const topicIndexData = parseTopicIndexes(topicIndexes);

export default function TopicIndex({
  type,
  plannedOnly = false,
}: TopicIndexProps) {
  const topics = selectTopics(topicIndexData[type], plannedOnly);

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
