import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

import {readContentDocuments} from './content-metadata.mjs';
import {parseBacklogTopics} from './backlog-topics.mjs';
import {
  loadCaseSeriesRegistry,
  loadPatternGroupRegistry,
  loadReviewPolicyRegistry,
} from './content-registries.mjs';
import {
  parseSourceLedger,
  validateSourceGovernance,
} from './source-ledger.mjs';
import {
  allowedPriorities,
  allowedSourceKinds,
  allowedValues,
  caseRequiredFields,
  knowledgeContentTypes,
  knowledgeRequiredFields,
  knowledgeTypeContracts,
  qualityAttributeScenarioHeadings,
  requiredCaseHeadings,
  requiredMigrationHeadings,
  requiredFields,
} from './content-schema.mjs';

function headingText(heading) {
  return heading.replace(/^#{2,3}[ \t]+/, '');
}

function formatHeading({level, text}) {
  return `${'#'.repeat(level)} ${text}`;
}

function validateOrderedH2Contract(file, headings, required, errors) {
  const actual = headings.filter(({level}) => level === 2);
  const expected = required.map(headingText);

  if (actual.length !== expected.length) {
    errors.push(
      `${file}: expected exactly ${expected.length} ${required[0]}-contract H2 headings; found ${actual.length}`,
    );
  }

  expected.forEach((text, index) => {
    if (actual[index]?.text !== text) {
      errors.push(
        `${file}: invalid ${required[0]}-contract H2 sequence at position ${index + 1}; expected "## ${text}", actual "${actual[index] ? formatHeading(actual[index]) : 'missing'}"`,
      );
    }
  });
}

function validateStringArray(file, type, field, value, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${file}: ${type} field "${field}" must be an array`);
    return;
  }
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') {
      errors.push(
        `${file}: ${type} field "${field}" contains a non-string or empty value`,
      );
      continue;
    }
    if (seen.has(item)) {
      errors.push(`${file}: ${type} field "${field}" contains duplicate value "${item}"`);
    } else {
      seen.add(item);
    }
  }
}

function validateSectionH3Contract(file, headings, section, required, errors) {
  const sectionText = headingText(section);
  const sectionIndex = headings.findIndex(
    ({level, text}) => level === 2 && text === sectionText,
  );
  const nextH2Index = headings.findIndex(
    ({level}, index) => index > sectionIndex && level === 2,
  );
  const sectionEnd = nextH2Index === -1 ? headings.length : nextH2Index;
  const actual =
    sectionIndex === -1
      ? []
      : headings
          .slice(sectionIndex + 1, sectionEnd)
          .filter(({level}) => level === 3);
  const expected = required.map(headingText);

  if (actual.length !== expected.length) {
    errors.push(
      `${file}: expected exactly ${expected.length} H3 headings under "${section}"; found ${actual.length}`,
    );
  }

  expected.forEach((text, index) => {
    if (actual[index]?.text !== text) {
      errors.push(
        `${file}: invalid H3 sequence under "${section}" at position ${index + 1}; expected "### ${text}", actual "${actual[index] ? formatHeading(actual[index]) : 'missing'}"`,
      );
    }
  });
}

function validateCaseHeadingContract(file, headings, errors) {
  const caseH2Headings = headings.filter(({level}) => level === 2);

  for (const requiredHeading of requiredCaseHeadings) {
    if (!caseH2Headings.some(({text}) => text === headingText(requiredHeading))) {
      errors.push(`${file}: missing required case heading "${requiredHeading}"`);
    }
  }

  if (caseH2Headings.length !== requiredCaseHeadings.length) {
    errors.push(
      `${file}: expected exactly ${requiredCaseHeadings.length} case H2 headings; found ${caseH2Headings.length}`,
    );
  }

  for (const [index, expectedHeading] of requiredCaseHeadings.entries()) {
    const actualHeading = caseH2Headings[index];
    if (actualHeading && actualHeading.text !== headingText(expectedHeading)) {
      errors.push(
        `${file}: invalid case H2 sequence at position ${index + 1}; expected "${expectedHeading}", actual "${formatHeading(actualHeading)}"`,
      );
    }
  }
}

function validateMigrationHeadingContract(file, headings, errors) {
  const migrationH2Index = headings.findIndex(
    ({level, text}) => level === 2 && text === headingText('## 可迁移经验'),
  );
  const nextH2Index = headings.findIndex(
    ({level}, index) => index > migrationH2Index && level === 2,
  );
  const migrationSectionEnd = nextH2Index === -1 ? headings.length : nextH2Index;
  const migrationSectionH3s =
    migrationH2Index === -1
      ? []
      : headings
          .slice(migrationH2Index + 1, migrationSectionEnd)
          .filter(({level}) => level === 3);

  for (const requiredHeading of requiredMigrationHeadings) {
    if (!headings.some(({level, text}) => level === 3 && text === headingText(requiredHeading))) {
      errors.push(`${file}: missing required migration heading "${requiredHeading}"`);
    }
  }

  if (migrationSectionH3s.length !== requiredMigrationHeadings.length) {
    errors.push(
      `${file}: expected exactly ${requiredMigrationHeadings.length} migration H3 headings under "## 可迁移经验"; found ${migrationSectionH3s.length}`,
    );
  }

  const misplacedRequiredHeading = headings.some(
    ({level, text}, index) =>
      level === 3 &&
      requiredMigrationHeadings.some((heading) => headingText(heading) === text) &&
      (index <= migrationH2Index || index >= migrationSectionEnd),
  );
  if (misplacedRequiredHeading) {
    errors.push(`${file}: migration H3 headings must appear under "## 可迁移经验" before the next H2`);
  }

  for (const [index, expectedHeading] of requiredMigrationHeadings.entries()) {
    const actualHeading = migrationSectionH3s[index];
    if (actualHeading && actualHeading.text !== headingText(expectedHeading)) {
      errors.push(
        `${file}: invalid migration H3 sequence at position ${index + 1}; expected "${expectedHeading}", actual "${formatHeading(actualHeading)}"`,
      );
    }
  }
}

function isKnowledgeArticle(file, metadata) {
  return (
    knowledgeContentTypes.includes(metadata.content_type) &&
    file !== 'index.mdx' &&
    !file.endsWith('/index.mdx')
  );
}

export async function validateContent(
  root,
  {patternGroupRegistry, caseSeriesById, reviewPolicyById} = {},
) {
  if (
    !patternGroupRegistry ||
    !Array.isArray(patternGroupRegistry.registry?.groups) ||
    !(patternGroupRegistry.groupByTopicId instanceof Map) ||
    !Array.isArray(patternGroupRegistry.errors)
  ) {
    throw new TypeError(
      'Pattern group registry is required; call loadPatternGroupRegistry(projectRoot, topics)',
    );
  }
  if (!(caseSeriesById instanceof Map)) {
    throw new TypeError(
      'Case series registry is required; call loadCaseSeriesRegistry(projectRoot)',
    );
  }
  if (!(reviewPolicyById instanceof Map) || reviewPolicyById.size === 0) {
    throw new TypeError(
      'Review policy registry is required; call loadReviewPolicyRegistry(projectRoot)',
    );
  }

  const documents = await readContentDocuments(root);
  const errors = [...patternGroupRegistry.errors];
  const slugFiles = new Map();
  const catalogOrderFiles = new Map();

  for (const {file, metadata, headings} of documents) {
    for (const field of requiredFields) {
      if (!(field in metadata)) {
        errors.push(`${file}: missing required field "${field}"`);
      }
    }

    for (const [field, values] of Object.entries(allowedValues)) {
      const value = metadata[field];
      if (value !== undefined && !values.includes(value)) {
        errors.push(`${file}: invalid ${field} value "${value}"`);
      }
    }

    if ('review_policy' in metadata) {
      if (
        typeof metadata.review_policy !== 'string' ||
        metadata.review_policy.trim() === ''
      ) {
        errors.push(
          `${file}: field "review_policy" must be a registered policy ID`,
        );
      } else if (!reviewPolicyById.has(metadata.review_policy)) {
        errors.push(
          `${file}: unregistered review policy "${metadata.review_policy}"`,
        );
      }
    }

    if (metadata.content_type === 'case') {
      for (const field of caseRequiredFields) {
        if (!(field in metadata)) {
          errors.push(`${file}: missing required case field "${field}"`);
        }
      }

      if (
        'summary' in metadata &&
        (typeof metadata.summary !== 'string' || metadata.summary.trim() === '')
      ) {
        errors.push(`${file}: field "summary" must be a non-empty string`);
      }

      if (
        'series' in metadata &&
        !caseSeriesById.has(metadata.series)
      ) {
        errors.push(`${file}: unregistered case series "${metadata.series}"`);
      }

      if (
        'catalog_order' in metadata &&
        (!Number.isInteger(metadata.catalog_order) || metadata.catalog_order <= 0)
      ) {
        errors.push(`${file}: field "catalog_order" must be a positive integer`);
      }

      if ('featured' in metadata && typeof metadata.featured !== 'boolean') {
        errors.push(`${file}: field "featured" must be a boolean`);
      }

      if ('source_kinds' in metadata) {
        if (!Array.isArray(metadata.source_kinds) || metadata.source_kinds.length === 0) {
          errors.push(`${file}: field "source_kinds" must be a non-empty array`);
        } else {
          for (const value of metadata.source_kinds) {
            if (!allowedSourceKinds.includes(value)) {
              errors.push(`${file}: invalid source_kinds value "${value}"`);
            }
          }
        }
      }

      if ('migration_targets' in metadata) {
        if (!Array.isArray(metadata.migration_targets) || metadata.migration_targets.length === 0) {
          errors.push(`${file}: field "migration_targets" must be a non-empty array`);
        } else {
          for (const value of metadata.migration_targets) {
            if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
              errors.push(
                `${file}: invalid migration_targets value "${value}"; expected kebab-case`,
              );
            }
          }
        }
      }

      validateCaseHeadingContract(file, headings, errors);

      if (metadata.featured === false) {
        validateMigrationHeadingContract(file, headings, errors);
      }

      if (Number.isInteger(metadata.catalog_order) && metadata.catalog_order > 0) {
        const conflictingFile = catalogOrderFiles.get(metadata.catalog_order);
        if (conflictingFile) {
          errors.push(
            `${file}: duplicate catalog_order "${metadata.catalog_order}" conflicts with ${conflictingFile}`,
          );
        } else {
          catalogOrderFiles.set(metadata.catalog_order, file);
        }
      }
    }

    if (isKnowledgeArticle(file, metadata)) {
      const type = metadata.content_type;

      for (const field of knowledgeRequiredFields) {
        if (!(field in metadata)) {
          errors.push(`${file}: missing required ${type} field "${field}"`);
        }
      }

      if (
        'summary' in metadata &&
        (typeof metadata.summary !== 'string' || metadata.summary.trim() === '')
      ) {
        errors.push(`${file}: ${type} field "summary" must be a non-empty string`);
      }

      if (
        'topic_id' in metadata &&
        (typeof metadata.topic_id !== 'string' ||
          !/^[A-Z]+(?:-[A-Z]+)*-\d{2}$/.test(metadata.topic_id))
      ) {
        errors.push(`${file}: ${type} field "topic_id" has an invalid value`);
      }

      if ('priority' in metadata && !allowedPriorities.includes(metadata.priority)) {
        errors.push(
          `${file}: ${type} field "priority" has invalid value "${metadata.priority}"`,
        );
      }

      if ('depends_on' in metadata) {
        validateStringArray(file, type, 'depends_on', metadata.depends_on, errors);
      }

      const adjacentTopics = metadata.adjacent_topics;
      const relatedCases = metadata.related_cases;
      const relatedQuestions = metadata.related_questions ?? [];

      validateStringArray(file, type, 'adjacent_topics', adjacentTopics, errors);
      validateStringArray(file, type, 'related_cases', relatedCases, errors);
      validateStringArray(file, type, 'related_questions', relatedQuestions, errors);

      if (Array.isArray(adjacentTopics)) {
        if (adjacentTopics.length === 0) {
          errors.push(`${file}: ${type} requires at least one adjacent topic`);
        }
        for (const adjacentTopic of adjacentTopics) {
          if (
            typeof adjacentTopic === 'string' &&
            !/^[A-Z]+(?:-[A-Z]+)*-\d{2}$/.test(adjacentTopic)
          ) {
            errors.push(
              `${file}: ${type} field "adjacent_topics" has invalid topic ID "${adjacentTopic}"`,
            );
          }
          if (adjacentTopic === metadata.topic_id) {
            errors.push(
              `${file}: ${type} field "adjacent_topics" cannot reference its own topic "${adjacentTopic}"`,
            );
          }
        }
      }

      if (Array.isArray(relatedCases)) {
        for (const relatedCase of relatedCases) {
          if (
            typeof relatedCase === 'string' &&
            !/^\/cases\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(relatedCase)
          ) {
            errors.push(
              `${file}: ${type} field "related_cases" has invalid case slug "${relatedCase}"`,
            );
          }
        }
      }

      if (Array.isArray(relatedQuestions)) {
        for (const relatedQuestion of relatedQuestions) {
          if (
            typeof relatedQuestion === 'string' &&
            !/^\/questions\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(relatedQuestion)
          ) {
            errors.push(
              `${file}: ${type} field "related_questions" has invalid question slug "${relatedQuestion}"`,
            );
          }
        }
      }

      if (
        Array.isArray(relatedCases) &&
        Array.isArray(relatedQuestions) &&
        relatedCases.length + relatedQuestions.length === 0
      ) {
        errors.push(`${file}: ${type} requires at least one related case or question`);
      }

      validateOrderedH2Contract(
        file,
        headings,
        knowledgeTypeContracts[type],
        errors,
      );

      if (type === 'quality-attribute') {
        validateSectionH3Contract(
          file,
          headings,
          '## 质量属性场景',
          qualityAttributeScenarioHeadings,
          errors,
        );
      }
    }

    if (metadata.slug !== undefined) {
      const conflictingFile = slugFiles.get(metadata.slug);
      if (conflictingFile) {
        errors.push(`${file}: duplicate slug "${metadata.slug}" conflicts with ${conflictingFile}`);
      } else {
        slugFiles.set(metadata.slug, file);
      }
    }
  }

  return {
    documents,
    errors,
  };
}

async function runCli() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0].startsWith('--')) {
    console.error('Usage: node scripts/validate-content.mjs <root>');
    process.exitCode = 1;
    return;
  }

  try {
    const [root] = args;
    const scriptProjectRoot = fileURLToPath(new URL('..', import.meta.url));
    const contentRoot = path.resolve(scriptProjectRoot, root);
    const projectRoot = path.dirname(contentRoot);
    const backlogPath = path.join(projectRoot, 'docs/content-backlog.md');
    const ledgerPath = path.join(
      projectRoot,
      'data/source-ledger.json',
    );
    const inputErrors = [];
    let topics = [];

    try {
      const parsedBacklog = parseBacklogTopics(
        await readFile(backlogPath, 'utf8'),
        backlogPath,
      );
      inputErrors.push(...parsedBacklog.errors);
      topics = parsedBacklog.topics;
    } catch (error) {
      inputErrors.push(
        `${backlogPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const patternGroupRegistry = await loadPatternGroupRegistry(
      projectRoot,
      topics,
    );
    const caseSeriesRegistry = await loadCaseSeriesRegistry(projectRoot);
    const reviewPolicyRegistry =
      await loadReviewPolicyRegistry(projectRoot);
    const {documents, errors: contentErrors} =
      reviewPolicyRegistry.errors.length > 0
        ? {documents: [], errors: []}
        : await validateContent(contentRoot, {
            patternGroupRegistry,
            caseSeriesById: caseSeriesRegistry.byId,
            reviewPolicyById: reviewPolicyRegistry.byId,
          });
    const errors = [
      ...inputErrors,
      ...caseSeriesRegistry.errors,
      ...reviewPolicyRegistry.errors,
      ...contentErrors,
    ];
    let ledger;

    try {
      const ledgerValue = JSON.parse(await readFile(ledgerPath, 'utf8'));
      const parsed = parseSourceLedger(ledgerValue, ledgerPath);
      errors.push(...parsed.errors);
      ledger = parsed.errors.length === 0 ? parsed.ledger : undefined;
    } catch (error) {
      errors.push(
        error instanceof SyntaxError
          ? `${ledgerPath}: invalid JSON: ${error.message}`
          : `${ledgerPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (ledger) {
      errors.push(...validateSourceGovernance(documents, ledger).errors);
    }

    if (errors.length > 0) {
      for (const error of errors.sort((left, right) =>
        left.localeCompare(right, 'en'),
      )) {
        console.error(error);
      }
      process.exitCode = 1;
      return;
    }

    console.log(
      `Validated ${documents.length} content document(s) and ${ledger.sources.length} registered source(s).`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli();
}
