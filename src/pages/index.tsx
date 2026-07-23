import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import CaseCard from '@site/src/components/CaseCard';
import {groupCasesBySeries} from '@site/src/components/CaseCatalog/filterCases';
import {
  featuredCases,
  secondCollectionCases,
  seriesLabels,
} from '@site/src/data/caseCatalog';
import styles from './index.module.css';

const migrationSeries = [
  'classic-distributed',
  'frontend-architecture',
  'edge-physical',
] as const;

const migrationGroups = groupCasesBySeries(secondCollectionCases).filter(({series}) =>
  migrationSeries.some((migrationSeriesName) => migrationSeriesName === series),
);

const learningSteps = [
  ['先问边界', '确认谁在做决策、谁持有状态，以及哪些能力其实属于框架之外。'],
  ['再追控制权', '沿一次任务流观察路由、委派、工具调用、并行和汇合发生在哪里。'],
  ['进入关键源码', '从入口类型、状态结构和调度函数开始，不用仓库体量代替理解。'],
  ['检查生产约束', '逐项审视恢复、安全、观测、评测、成本与并发写入风险。'],
  ['完成迁移判断', '记录适用条件、失效条件和仍未被证据回答的问题。'],
] as const;

const expansionPorts = [
  {
    index: 'A',
    title: '架构模式',
    description: '把 Supervisor、Handoff、Fan-out / Fan-in 等做法放回多个案例交叉验证。',
    href: '/patterns',
    linkLabel: '查看模式索引',
  },
  {
    index: 'B',
    title: '设计题与思考题',
    description: '从真实约束出发练习边界划分、协议选择、故障恢复和治理决策。',
    href: '/questions',
    linkLabel: '进入设计题库',
  },
  {
    index: 'C',
    title: '来源与证据',
    description: '保存官方仓库、规范、文档和访问时间，让结论能够回到一手资料核对。',
    href: '/references',
    linkLabel: '浏览资料库',
  },
] as const;

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
}): ReactNode {
  return (
    <div className={styles.sectionHeading}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <Heading id={id} as="h2">
        {title}
      </Heading>
      <p>{description}</p>
    </div>
  );
}

function Hero(): ReactNode {
  return (
    <header className={styles.hero}>
      <div className="container">
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>AI 多智能体 · 架构研究档案</p>
            <Heading as="h1">从真实项目中，读懂智能体如何协作。</Heading>
            <p className={styles.lede}>
              用统一问题拆解控制权、上下文、状态与生产边界。这里不是框架榜单，而是一册持续生长、可回到源码核验的中文架构笔记。
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryAction} to="/cases">
                浏览首发案例 <span aria-hidden="true">→</span>
              </Link>
              <Link className={styles.secondaryAction} to="/paths">
                按学习路径开始
              </Link>
            </div>
          </div>

          <aside className={styles.fieldNote} aria-label="本期研究范围">
            <p className={styles.fieldNoteLabel}>FIELD NOTE · 001</p>
            <Heading as="h2">首期问题</Heading>
            <blockquote>当多个 Agent 一起工作时，控制权究竟在哪里？</blockquote>
            <dl>
              <div>
                <dt>样本</dt>
                <dd>16 个跨生态案例</dd>
              </div>
              <div>
                <dt>观察轴</dt>
                <dd>控制 · 状态 · 协议 · 生产化</dd>
              </div>
              <div>
                <dt>证据</dt>
                <dd>官方源码、规范与文档</dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="AI 多智能体架构案例图谱"
      description="从真实开源项目与官方资料中学习 AI 多智能体系统的控制权、状态、协议与生产化设计。">
      <Hero />
      <main>
        <section className={styles.featuredSection} aria-labelledby="featured-cases-title">
          <div className="container">
            <div className={styles.featuredHeader}>
              <div className={styles.sectionHeading}>
                <p className={styles.eyebrow}>LAUNCH COLLECTION · 2026</p>
                <Heading id="featured-cases-title" as="h2">
                  五份首发研究档案
                </Heading>
                <p>五个案例只是起点：分别代表企业参考架构、轻量编排、持久化运行时、跨系统协议与编码 Agent 协作。</p>
              </div>
              <Link className={styles.textLink} to="/cases">
                查看案例库与方法 <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.caseGrid}>
              {featuredCases.map((caseStudy) => (
                <CaseCard key={caseStudy.slug} caseStudy={caseStudy} />
              ))}
            </div>
          </div>
        </section>

        {migrationGroups.length > 0 && (
          <section
            className={styles.migrationSection}
            aria-labelledby="migration-map-title">
            <div className="container">
              <SectionHeading
                id="migration-map-title"
                eyebrow="MIGRATION MAP"
                title="经典架构迁移地图"
                description="这不是 AI 框架排名，而是从经典分布式、前端协同与边缘系统中研究可迁移的架构机制。"
              />
              <div className={styles.migrationGroups}>
                {migrationGroups.map((group) => (
                  <section className={styles.migrationGroup} key={group.series}>
                    <Heading as="h3">{seriesLabels[group.series]}</Heading>
                    <ul>
                      {group.cases.map((caseStudy) => (
                        <li className={styles.migrationItem} key={caseStudy.slug}>
                          <Heading as="h4">{caseStudy.title}</Heading>
                          <ul aria-label="迁移目标">
                            {caseStudy.migration_targets.slice(0, 2).map((migrationTarget) => (
                              <li key={migrationTarget}>{migrationTarget}</li>
                            ))}
                          </ul>
                          <Link to={caseStudy.slug} aria-label={`阅读案例：${caseStudy.title}`}>
                            阅读案例 <span aria-hidden="true">→</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className={styles.pathSection} aria-labelledby="learning-path-title">
          <div className="container">
            <SectionHeading
              id="learning-path-title"
              eyebrow="READING PROTOCOL"
              title="五步读透一个多智能体系统"
              description="不从名词表开始。从一个可以验证的问题出发，沿控制流进入源码，再回到工程决策。"
            />
            <ol className={styles.learningSteps}>
              {learningSteps.map(([title, description], index) => (
                <li key={title}>
                  <span className={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <Heading as="h3">{title}</Heading>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link className={styles.textLink} to="/paths">
              沿软件架构主干开始 <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <section className={styles.expansionSection} aria-labelledby="expansion-title">
          <div className="container">
            <SectionHeading
              id="expansion-title"
              eyebrow="OPEN ENDS"
              title="为上百个案例留下稳定入口"
              description="案例正文持续增加，顶层结构保持稳定。新的知识通过类型、关系和学习目标进入图谱，而不是挤进导航栏。"
            />
            <div className={styles.portGrid}>
              {expansionPorts.map((port) => (
                <article className={styles.portCard} key={port.href}>
                  <span className={styles.portIndex} aria-hidden="true">
                    {port.index}
                  </span>
                  <Heading as="h3">{port.title}</Heading>
                  <p>{port.description}</p>
                  <Link to={port.href}>
                    {port.linkLabel} <span aria-hidden="true">→</span>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.contributionSection} aria-labelledby="contribution-title">
          <div className="container">
            <div className={styles.contributionBox}>
              <div>
                <p className={styles.eyebrow}>AN OPEN RESEARCH NOTEBOOK</p>
                <Heading id="contribution-title" as="h2">
                  一起把结论钉在证据上
                </Heading>
                <p>
                  每份档案区分已证实事实、基于证据的推断与个人分析。欢迎补充案例、纠正来源，或带着一道设计题加入讨论。
                </p>
              </div>
              <div className={styles.contributionActions}>
                <Link
                  className={styles.primaryAction}
                  href="https://github.com/sealday/agentic-architecture-atlas">
                  在 GitHub 参与 <span aria-hidden="true">↗</span>
                </Link>
                <Link className={styles.secondaryAction} to="/intro">
                  阅读研究方法
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
