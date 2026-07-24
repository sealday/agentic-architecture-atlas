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
];

export const knowledgeContentTypes = [
  'concept',
  'principle',
  'quality-attribute',
  'method',
  'modeling',
  'style',
  'pattern',
];

export const knowledgeRequiredFields = [
  'summary',
  'topic_id',
  'priority',
  'depends_on',
  'related_cases',
];

export const allowedPriorities = ['P0', 'P1', 'P2', 'P3'];

export const knowledgeTypeContracts = {
  concept: [
    '## 学习问题',
    '## 定义与尺度边界',
    '## 核心机制',
    '## 常见混淆',
    '## 说明性场景',
    '## 相邻主题',
    '## 来源',
  ],
  principle: [
    '## 学习问题',
    '## 要保护的性质',
    '## 冲突与适用上下文',
    '## 机制',
    '## 误用与反原则',
    '## 适用尺度',
    '## 相邻原则',
    '## 说明性场景',
    '## 来源',
  ],
  'quality-attribute': [
    '## 学习问题',
    '## 定义与业务目标',
    '## 质量属性场景',
    '## 架构策略',
    '## 测量信号与阈值',
    '## 权衡与失败模式',
    '## 相邻质量属性',
    '## 说明性场景',
    '## 来源',
  ],
  method: [
    '## 学习问题',
    '## 输入与参与者',
    '## 步骤',
    '## 产物',
    '## 完成判断',
    '## 常见失败',
    '## 与其他方法的衔接',
    '## 完整演练',
    '## 来源',
  ],
  modeling: [
    '## 学习问题',
    '## 建模目标与输入',
    '## 参与者与步骤',
    '## 模型产物',
    '## 完成判断',
    '## 常见失败',
    '## 与其他模型的衔接',
    '## 完整演练',
    '## 来源',
  ],
  style: [
    '## 学习问题',
    '## 组件、连接器与约束',
    '## 边界与控制流',
    '## 数据所有权与一致性',
    '## 部署单元与故障域',
    '## 团队拓扑',
    '## 质量属性收益与成本',
    '## 迁移路径',
    '## 禁用条件',
    '## 对比案例',
    '## 来源',
  ],
  pattern: [
    '## 学习问题',
    '## 问题与适用上下文',
    '## 约束与驱动力',
    '## 结构与协作关系',
    '## 运行机制',
    '## 失败模式与误用',
    '## 质量属性权衡',
    '## 实现与迁移提示',
    '## 相邻模式与反模式',
    '## 说明性场景',
    '## 来源',
  ],
};

export const qualityAttributeScenarioHeadings = [
  '### Source',
  '### Stimulus',
  '### Environment',
  '### Artifact',
  '### Response',
  '### Response measure',
];

export const allowedValues = {
  content_type: [
    'case',
    'question',
    'path',
    'reference',
    ...knowledgeContentTypes,
  ],
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
