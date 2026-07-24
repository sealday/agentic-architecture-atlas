import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {parseBacklogTopics} from './backlog-topics.mjs';
import {
  loadCaseSeriesRegistry,
  loadPatternGroupRegistry,
  loadReviewPolicyRegistry,
} from './content-registries.mjs';
import {validateContent} from './validate-content.mjs';
import {projectPublishedDocuments} from './topic-manifest.mjs';

export const catalogFields = [
  'title',
  'slug',
  'summary',
  'difficulty',
  'series',
  'catalog_order',
  'featured',
  'source_kinds',
  'migration_targets',
  'tags',
];

/**
 * @typedef {object} GeneratedCaseCatalogEntry
 * @property {string} title
 * @property {string} slug
 * @property {string} summary
 * @property {string} difficulty
 * @property {string} series
 * @property {number} catalog_order
 * @property {boolean} featured
 * @property {string[]} source_kinds
 * @property {string[]} migration_targets
 * @property {string[]} tags
 */

/**
 * @param {string} root
 * @returns {Promise<GeneratedCaseCatalogEntry[]>}
 */
export async function buildCaseCatalog(
  root,
  {patternGroupRegistry, caseSeriesById, reviewPolicyById} = {},
) {
  if (!(caseSeriesById instanceof Map)) {
    throw new TypeError('buildCaseCatalog requires caseSeriesById');
  }
  const validation = await validateContent(root, {
    patternGroupRegistry,
    caseSeriesById,
    reviewPolicyById,
  });
  if (validation.errors.length > 0) {
    throw new Error(`Content validation failed:\n${validation.errors.join('\n')}`);
  }

  return buildCaseCatalogFromManifest({
    schema_version: 1,
    topics: projectPublishedDocuments(validation.documents),
  });
}

export function buildCaseCatalogFromManifest(manifest) {
  return manifest.topics
    .filter((topic) => topic.type === 'case' && topic.published)
    .map((topic) => topic.presentation.case_catalog)
    .sort((left, right) => left.catalog_order - right.catalog_order);
}

/**
 * @param {GeneratedCaseCatalogEntry[]} entries
 * @returns {string}
 */
export function serializeCaseCatalog(entries) {
  return `${JSON.stringify(entries, null, 2)}\n`;
}

/**
 * @param {{contentRoot: string, outputPath: string}} options
 * @returns {Promise<void>}
 */
export async function writeCaseCatalog({
  contentRoot,
  outputPath,
  patternGroupRegistry,
  caseSeriesById,
  reviewPolicyById,
}) {
  const serialized = serializeCaseCatalog(
    await buildCaseCatalog(contentRoot, {
      patternGroupRegistry,
      caseSeriesById,
      reviewPolicyById,
    }),
  );
  await mkdir(path.dirname(outputPath), {recursive: true});
  await writeFile(outputPath, serialized);
}

/**
 * @param {{contentRoot: string, outputPath: string}} options
 * @returns {Promise<{matches: boolean}>}
 */
export async function checkCaseCatalog({
  contentRoot,
  outputPath,
  patternGroupRegistry,
  caseSeriesById,
  reviewPolicyById,
}) {
  const expected = Buffer.from(
    serializeCaseCatalog(
      await buildCaseCatalog(contentRoot, {
        patternGroupRegistry,
        caseSeriesById,
        reviewPolicyById,
      }),
    ),
  );

  try {
    const actual = await readFile(outputPath);
    return {matches: actual.equals(expected)};
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return {matches: false};
    }
    throw error;
  }
}

async function runCli() {
  const [contentRoot, outputPath, ...flags] = process.argv.slice(2);
  const check = flags.includes('--check');

  if (!contentRoot || !outputPath || flags.some((flag) => flag !== '--check')) {
    console.error(
      'Usage: node scripts/generate-case-catalog.mjs <content-root> <output-path> [--check]',
    );
    process.exitCode = 1;
    return;
  }

  try {
    const projectRoot = path.dirname(path.resolve(contentRoot));
    const backlogSource = await readFile(
      path.join(projectRoot, 'docs/content-backlog.md'),
      'utf8',
    );
    const parsedBacklog = parseBacklogTopics(
      backlogSource,
      'docs/content-backlog.md',
    );
    const patternGroupRegistry = await loadPatternGroupRegistry(
      projectRoot,
      parsedBacklog.topics,
    );
    const caseSeriesRegistry = await loadCaseSeriesRegistry(projectRoot);
    const reviewPolicyRegistry =
      await loadReviewPolicyRegistry(projectRoot);
    const inputErrors = [
      ...parsedBacklog.errors,
      ...patternGroupRegistry.errors,
      ...caseSeriesRegistry.errors,
      ...reviewPolicyRegistry.errors,
    ];
    if (inputErrors.length) {
      throw new Error(`Registry input failed:\n${inputErrors.join('\n')}`);
    }

    if (check) {
      const {matches} = await checkCaseCatalog({
        contentRoot,
        outputPath,
        patternGroupRegistry,
        caseSeriesById: caseSeriesRegistry.byId,
        reviewPolicyById: reviewPolicyRegistry.byId,
      });
      if (!matches) {
        console.error('Catalog is stale. Run npm run generate:catalog.');
        process.exitCode = 1;
      }
      return;
    }

    await writeCaseCatalog({
      contentRoot,
      outputPath,
      patternGroupRegistry,
      caseSeriesById: caseSeriesRegistry.byId,
      reviewPolicyById: reviewPolicyRegistry.byId,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli();
}
