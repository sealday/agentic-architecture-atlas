export const sourceTiers = [
  'primary',
  'first-party',
  'secondary',
  'discovery',
] as const;

export type SourceTier = (typeof sourceTiers)[number];

type RawCitation = {
  source_id: string;
  roles: string[];
  attribution_note: string;
};

type RawDocument = {
  title: string;
  slug: string;
  reviewed_at: string;
  citations: RawCitation[];
};

type RawSource = {
  id: string;
  canonical_locator: string;
  title: string;
  author_or_org: string;
  checked_at: string;
  version: string;
  source_kind: string;
  tier: SourceTier;
  allowed_evidence_roles: string[];
  license: string;
  copyright_policy: string;
  usage_boundary: string;
};

type SourceLedgerData = {
  sources: RawSource[];
  documents: Record<string, RawDocument>;
};

export type SourceLedgerProps = {
  tier?: SourceTier;
};

export type SourceLedgerDocument = {
  title: string;
  slug: string;
  reviewedAt: string;
};

export type SourceLedgerCard = {
  id: string;
  canonicalLocator: string;
  externalHref: string | null;
  title: string;
  authorOrOrg: string;
  checkedAt: string;
  version: string;
  sourceKind: string;
  kindLabel: string;
  tier: SourceTier;
  tierLabel: string;
  evidenceRoleLabels: string[];
  license: string;
  copyrightPolicyLabel: string;
  usageBoundary: string;
  attributionNotes: string[];
  usedBy: SourceLedgerDocument[];
};

export type SourceLedgerSection = {
  tier: SourceTier;
  label: string;
  warning: string | null;
  sources: SourceLedgerCard[];
};

const tierLabels: Record<SourceTier, string> = {
  primary: '一手来源',
  'first-party': '第一方工程资料',
  secondary: '可信二手来源',
  discovery: '发现与导航',
};

const kindLabels: Record<string, string> = {
  standard: '标准',
  paper: '论文',
  'official-docs': '官方文档',
  'official-repository': '官方仓库',
  'source-code': '源码',
  'engineering-blog': '工程团队博客',
  'incident-report': '事故报告',
  'vendor-reference-architecture': '厂商参考架构',
  textbook: '教材',
  'independent-blog': '独立博客',
  'community-index': '社区索引',
  'original-illustration': '本站原创插图',
};

const kindOrder = Object.keys(kindLabels);

const evidenceRoleLabels: Record<string, string> = {
  definition: '定义',
  method: '方法',
  'runtime-fact': '运行事实',
  'case-evidence': '案例证据',
  implementation: '实现',
  'historical-context': '历史背景',
  comparison: '比较',
  learning: '学习',
  discovery: '发现',
  illustration: '插图',
};

const copyrightPolicyLabels: Record<string, string> = {
  'facts-and-short-quotation': '仅提炼事实与短引文',
  'adapt-with-attribution': '允许改编，必须署名',
  'adapt-sharealike-review': '改编须署名、相同方式共享并复核',
  'vendor-claims-separated': '厂商主张与本站判断分开',
  'original-atlas': '本站原创',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isTier(value: unknown): value is SourceTier {
  return sourceTiers.some((tier) => tier === value);
}

function parseLedger(value: unknown): SourceLedgerData {
  if (
    !isRecord(value) ||
    !Array.isArray(value.sources) ||
    !isRecord(value.documents)
  ) {
    throw new Error('source ledger must contain sources and documents');
  }

  const sources = value.sources.map((source) => {
    if (
      !isRecord(source) ||
      typeof source.id !== 'string' ||
      typeof source.canonical_locator !== 'string' ||
      typeof source.title !== 'string' ||
      typeof source.author_or_org !== 'string' ||
      typeof source.checked_at !== 'string' ||
      typeof source.version !== 'string' ||
      typeof source.source_kind !== 'string' ||
      !isTier(source.tier) ||
      !isStringArray(source.allowed_evidence_roles) ||
      typeof source.license !== 'string' ||
      typeof source.copyright_policy !== 'string' ||
      typeof source.usage_boundary !== 'string'
    ) {
      throw new Error('source ledger contains an invalid source');
    }
    return source as RawSource;
  });

  const documents = Object.fromEntries(
    Object.entries(value.documents).map(([path, document]) => {
      if (
        !isRecord(document) ||
        typeof document.title !== 'string' ||
        typeof document.slug !== 'string' ||
        typeof document.reviewed_at !== 'string' ||
        !Array.isArray(document.citations)
      ) {
        throw new Error(`source ledger contains an invalid document: ${path}`);
      }
      const citations = document.citations.map((citation) => {
        if (
          !isRecord(citation) ||
          typeof citation.source_id !== 'string' ||
          !isStringArray(citation.roles) ||
          typeof citation.attribution_note !== 'string'
        ) {
          throw new Error(`source ledger contains an invalid citation: ${path}`);
        }
        return citation as RawCitation;
      });
      return [path, {...document, citations} as RawDocument];
    }),
  );

  return {sources, documents};
}

function sourceKindPosition(kind: string) {
  const index = kindOrder.indexOf(kind);
  return index === -1 ? kindOrder.length : index;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

export function buildSourceLedgerSections(
  value: unknown,
  selectedTier?: SourceTier,
): SourceLedgerSection[] {
  const ledger = parseLedger(value);
  const citationsBySource = new Map<
    string,
    {documents: SourceLedgerDocument[]; attributionNotes: string[]}
  >();

  for (const document of Object.values(ledger.documents)) {
    for (const citation of document.citations) {
      const current = citationsBySource.get(citation.source_id) ?? {
        documents: [],
        attributionNotes: [],
      };
      if (!current.documents.some(({slug}) => slug === document.slug)) {
        current.documents.push({
          title: document.title,
          slug: document.slug,
          reviewedAt: document.reviewed_at,
        });
      }
      current.attributionNotes.push(citation.attribution_note);
      citationsBySource.set(citation.source_id, current);
    }
  }

  const tiers = selectedTier ? [selectedTier] : [...sourceTiers];
  return tiers.map((tier) => {
    const sources = ledger.sources
      .filter((source) => source.tier === tier)
      .sort(
        (left, right) =>
          sourceKindPosition(left.source_kind) -
            sourceKindPosition(right.source_kind) ||
          left.title.localeCompare(right.title, 'en'),
      )
      .map((source): SourceLedgerCard => {
        const usage = citationsBySource.get(source.id);
        return {
          id: source.id,
          canonicalLocator: source.canonical_locator,
          externalHref: source.canonical_locator.startsWith('https://')
            ? source.canonical_locator
            : null,
          title: source.title,
          authorOrOrg: source.author_or_org,
          checkedAt: source.checked_at,
          version: source.version,
          sourceKind: source.source_kind,
          kindLabel: kindLabels[source.source_kind] ?? source.source_kind,
          tier: source.tier,
          tierLabel: tierLabels[source.tier],
          evidenceRoleLabels: source.allowed_evidence_roles.map(
            (role) => evidenceRoleLabels[role] ?? role,
          ),
          license: source.license,
          copyrightPolicyLabel:
            copyrightPolicyLabels[source.copyright_policy] ??
            source.copyright_policy,
          usageBoundary: source.usage_boundary,
          attributionNotes: unique(usage?.attributionNotes ?? []),
          usedBy: (usage?.documents ?? []).sort((left, right) =>
            left.title.localeCompare(right.title, 'zh-CN'),
          ),
        };
      });

    return {
      tier,
      label: tierLabels[tier],
      warning:
        tier === 'discovery' ? '选题/学习导航，不是事实证据' : null,
      sources,
    };
  });
}
