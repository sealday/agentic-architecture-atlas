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

export const caseCatalogManifest = [
  {slug: '/cases/microsoft-multi-agent-reference-architecture', catalog_order: 1},
  {slug: '/cases/openai-agents-sdk', catalog_order: 2},
  {slug: '/cases/langgraph-supervisor', catalog_order: 3},
  {slug: '/cases/google-adk-a2a', catalog_order: 4},
  {slug: '/cases/aws-cli-agent-orchestrator', catalog_order: 5},
  {slug: '/cases/erlang-otp-supervision-tree', catalog_order: 6},
  {slug: '/cases/kubernetes-reconciliation-loop', catalog_order: 7},
  {slug: '/cases/temporal-saga-durable-execution', catalog_order: 8},
  {slug: '/cases/apache-kafka-consumer-groups', catalog_order: 9},
  {slug: '/cases/aws-cell-shuffle-sharding', catalog_order: 10},
  {slug: '/cases/micro-frontends-single-spa', catalog_order: 11},
  {slug: '/cases/yjs-crdt-collaboration', catalog_order: 12},
  {slug: '/cases/cloudflare-durable-objects-workerd', catalog_order: 13},
  {slug: '/cases/kubeedge-cloud-edge-autonomy', catalog_order: 14},
  {slug: '/cases/ros2-dds-agent-lifecycle', catalog_order: 15},
];

export const launchCaseSlugs = caseCatalogManifest.slice(0, 5).map(({slug}) => slug);

export const classicCollectionSlugs = caseCatalogManifest.slice(0, 10).map(({slug}) => slug);

export const requiredCaseSlugs = caseCatalogManifest.map(({slug}) => slug);

export const secondCollectionSlugs = new Set(
  caseCatalogManifest.slice(5).map(({slug}) => slug),
);

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
