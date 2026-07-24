import Link from '@docusaurus/Link';
import patternGroups from '@site/src/generated/pattern-groups.json';
import topicIndexes from '@site/src/generated/topic-indexes.json';
import styles from './styles.module.css';
import {
  selectPatternGroups,
  type PatternGroup,
} from './patternTopicIndexModel';
import {parseTopicIndexes} from '../TopicIndex/topicIndexModel';

const topics = parseTopicIndexes(topicIndexes).pattern;
const groups = selectPatternGroups(
  patternGroups.groups as PatternGroup[],
  topics,
);

export default function PatternTopicIndex() {
  return (
    <div className={styles.groups}>
      {groups.map((group) => (
        <section className={styles.group} key={group.id}>
          <h3>{group.label}</h3>
          <p>{group.description}</p>
          {group.topics.length === 0 ? (
            <p>该分组尚无已登记主题。</p>
          ) : (
            <ul className={styles.topics}>
              {group.topics.map((topic) => (
                <li className={styles.topic} key={topic.id}>
                  <div className={styles.heading}>
                    {topic.internalHref ? (
                      <Link to={topic.internalHref}>{topic.title}</Link>
                    ) : (
                      <span>{topic.title}</span>
                    )}
                    {topic.priority && (
                      <span className={styles.priority}>{topic.priority}</span>
                    )}
                  </div>
                  <p>
                    {topic.published
                      ? `内容状态：${topic.status.value}`
                      : '计划主题'}
                  </p>
                  {!topic.published &&
                    topic.primary_sources.find((source) =>
                      source.startsWith('https://'),
                    ) && (
                      <p>
                        <a
                          href={topic.primary_sources.find((source) =>
                            source.startsWith('https://'),
                          )}>
                          外部学习起点
                        </a>
                      </p>
                    )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
