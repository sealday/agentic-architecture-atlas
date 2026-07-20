export type FeaturedCase = {
  number: string;
  title: string;
  subtitle: string;
  href: string;
  patterns: readonly string[];
  evidenceLabel: string;
};

export const featuredCases = [
  {
    number: '01',
    title: 'Microsoft 多智能体参考架构',
    subtitle: '从注册中心、通信、记忆到治理，观察企业级多智能体系统如何划定受控自治的边界。',
    href: '/cases/microsoft-multi-agent-reference-architecture',
    patterns: ['企业治理', 'Agent Registry', '分层团队'],
    evidenceLabel: '官方仓库与参考架构',
  },
  {
    number: '02',
    title: 'OpenAI Agents SDK',
    subtitle: '对照 Manager、Handoff 与代码驱动编排，理解小型多智能体系统的控制权选择。',
    href: '/cases/openai-agents-sdk',
    patterns: ['Manager', 'Handoff', '确定性编排'],
    evidenceLabel: '官方文档与源码',
  },
  {
    number: '03',
    title: 'LangGraph Supervisor',
    subtitle: '沿显式状态图追踪监督者、并行分支与检查点，分析长任务如何恢复和收敛。',
    href: '/cases/langgraph-supervisor',
    patterns: ['Supervisor', 'Fan-out / Fan-in', '持久化运行时'],
    evidenceLabel: '官方文档与源码',
  },
  {
    number: '04',
    title: 'Google ADK + A2A',
    subtitle: '从进程内层级编排走向跨系统协作，分清 Agent、工作流与协议各自承担的职责。',
    href: '/cases/google-adk-a2a',
    patterns: ['层级 Agent', '工作流 Agent', 'A2A'],
    evidenceLabel: '官方规范、文档与源码',
  },
  {
    number: '05',
    title: 'AWS CLI Agent Orchestrator',
    subtitle: '以编码任务为切面，研究 Supervisor–Worker、终端会话、消息传递与 MCP 工具接入。',
    href: '/cases/aws-cli-agent-orchestrator',
    patterns: ['Supervisor–Worker', '进程隔离', 'MCP'],
    evidenceLabel: '官方仓库与协议规范',
  },
] as const satisfies readonly FeaturedCase[];
