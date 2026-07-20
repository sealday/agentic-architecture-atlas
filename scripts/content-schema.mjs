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

export const requiredCaseSlugs = [
  '/cases/microsoft-multi-agent-reference-architecture',
  '/cases/openai-agents-sdk',
  '/cases/langgraph-supervisor',
  '/cases/google-adk-a2a',
  '/cases/aws-cli-agent-orchestrator',
];

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
