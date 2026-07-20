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
