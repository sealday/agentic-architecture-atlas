import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {readContentDocuments} from './content-metadata.mjs';
import {
  allowedPriorities,
  allowedSeries,
  allowedSourceKinds,
  allowedValues,
  caseCatalogManifest,
  caseRequiredFields,
  classicCollectionSlugs,
  knowledgeContentTypes,
  knowledgeRequiredFields,
  knowledgeTypeContracts,
  launchCaseSlugs,
  qualityAttributeScenarioHeadings,
  requiredCaseHeadings,
  requiredMigrationHeadings,
  requiredCaseSlugs,
  requiredFields,
  secondCollectionSlugs,
} from './content-schema.mjs';

const collectionRequirements = {
  launch: {
    slugs: launchCaseSlugs,
    missingLabel: 'launch case',
  },
  classic: {
    slugs: classicCollectionSlugs,
    missingLabel: 'classic collection case',
  },
  complete: {
    slugs: requiredCaseSlugs,
    missingLabel: 'complete catalog case',
  },
};

const approvedCatalogOrders = new Map(
  caseCatalogManifest.map(({slug, catalog_order}) => [slug, catalog_order]),
);

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
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') {
      errors.push(
        `${file}: ${type} field "${field}" contains a non-string or empty value`,
      );
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

export async function validateContent(root, {requiredCollection} = {}) {
  if (
    requiredCollection !== undefined &&
    !Object.hasOwn(collectionRequirements, requiredCollection)
  ) {
    throw new TypeError(`Unknown required collection "${requiredCollection}"`);
  }

  const documents = await readContentDocuments(root);
  const errors = [];
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

      if ('series' in metadata && !allowedSeries.includes(metadata.series)) {
        errors.push(`${file}: invalid series value "${metadata.series}"`);
      }

      if (
        'catalog_order' in metadata &&
        (!Number.isInteger(metadata.catalog_order) || metadata.catalog_order <= 0)
      ) {
        errors.push(`${file}: field "catalog_order" must be a positive integer`);
      }

      const approvedCatalogOrder = approvedCatalogOrders.get(metadata.slug);
      if (
        approvedCatalogOrder !== undefined &&
        metadata.catalog_order !== approvedCatalogOrder
      ) {
        errors.push(
          `${file}: slug "${metadata.slug}" has invalid approved catalog_order; expected ${approvedCatalogOrder}, actual ${metadata.catalog_order}`,
        );
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

      if (secondCollectionSlugs.has(metadata.slug)) {
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

    if (knowledgeContentTypes.includes(metadata.content_type)) {
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

      if ('related_cases' in metadata) {
        validateStringArray(file, type, 'related_cases', metadata.related_cases, errors);
        if (Array.isArray(metadata.related_cases)) {
          for (const relatedCase of metadata.related_cases) {
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

  if (requiredCollection) {
    const {slugs, missingLabel} = collectionRequirements[requiredCollection];
    const caseSlugs = new Set(
      documents
        .filter(({metadata}) => metadata.content_type === 'case')
        .map(({metadata}) => metadata.slug),
    );
    for (const slug of slugs) {
      if (!caseSlugs.has(slug)) {
        errors.push(`Missing ${missingLabel} slug "${slug}"`);
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
  const collectionFlags = new Map([
    ['--require-launch-cases', 'launch'],
    ['--require-classic-collection', 'classic'],
    ['--require-complete-catalog', 'complete'],
  ]);
  const requestedCollections = new Set(
    args.filter((arg) => collectionFlags.has(arg)).map((arg) => collectionFlags.get(arg)),
  );
  const root = args.find((arg) => !arg.startsWith('--'));

  if (requestedCollections.size > 1) {
    console.error('Conflicting coverage flags: choose exactly one catalog coverage flag.');
    process.exitCode = 1;
    return;
  }

  if (!root) {
    console.error(
      'Usage: node scripts/validate-content.mjs <root> [--require-launch-cases | --require-classic-collection | --require-complete-catalog]',
    );
    process.exitCode = 1;
    return;
  }

  try {
    const [requiredCollection] = requestedCollections;
    const {documents, errors} = await validateContent(root, {requiredCollection});

    if (errors.length > 0) {
      for (const error of errors) {
        console.error(error);
      }
      process.exitCode = 1;
      return;
    }

    console.log(`Validated ${documents.length} content document(s).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli();
}
