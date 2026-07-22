export const requiredFields = [
  'title',
  'slug',
  'content_type',
  'status',
  'difficulty',
  'analyzed_at',
  'source_cutoff',
  'confidence',
  'domains',
  'agent_patterns',
  'protocols',
  'quality_attributes',
  'tags',
  'official_sources',
];

export const allowedValues = {
  content_type: ['case', 'pattern', 'question', 'path', 'reference'],
  status: ['draft', 'reviewed', 'revisited'],
  difficulty: ['beginner', 'intermediate', 'advanced'],
  confidence: ['low', 'medium', 'high'],
};

export const caseRequiredFields = [
  'summary',
  'series',
  'catalog_order',
  'featured',
  'source_kinds',
  'migration_targets',
];

export const allowedSeries = [
  'ai-native',
  'classic-distributed',
  'frontend-architecture',
  'edge-physical',
];

export const allowedSourceKinds = [
  'official-docs',
  'open-source-project',
  'classic-paper',
  'engineering-blog',
  'reference-architecture',
];

export const requiredMigrationHeadings = [
  '### 可直接复用的机制',
  '### 只能有限类比的部分',
  '### 不应照搬的部分',
];

export const launchCaseSlugs = [
  '/cases/microsoft-multi-agent-reference-architecture',
  '/cases/openai-agents-sdk',
  '/cases/langgraph-supervisor',
  '/cases/google-adk-a2a',
  '/cases/aws-cli-agent-orchestrator',
];

export const classicCollectionSlugs = [
  ...launchCaseSlugs,
  '/cases/erlang-otp-supervision-tree',
  '/cases/kubernetes-reconciliation-loop',
  '/cases/temporal-saga-durable-execution',
  '/cases/apache-kafka-consumer-groups',
  '/cases/aws-cell-shuffle-sharding',
];

export const requiredCaseSlugs = [
  ...classicCollectionSlugs,
  '/cases/micro-frontends-single-spa',
  '/cases/yjs-crdt-collaboration',
  '/cases/cloudflare-durable-objects-workerd',
  '/cases/kubeedge-cloud-edge-autonomy',
  '/cases/ros2-dds-agent-lifecycle',
];

export const secondCollectionSlugs = new Set(requiredCaseSlugs.slice(5));

export const requiredCaseHeadings = [
  '## 学习问题',
  '## 一页摘要',
  '## 事实边界',
  '## 架构图',
  '## 控制权与任务流',
  '## 关键源码导读',
  '## 架构决策与权衡',
  '## 生产化分析',
  '## 可迁移经验',
  '## 来源',
];
