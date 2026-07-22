import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {readContentDocuments} from './content-metadata.mjs';
import {
  allowedSeries,
  allowedSourceKinds,
  allowedValues,
  caseCatalogManifest,
  caseRequiredFields,
  classicCollectionSlugs,
  launchCaseSlugs,
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

    if ('official_sources' in metadata) {
      if (!Array.isArray(metadata.official_sources)) {
        errors.push(`${file}: field "official_sources" must be an array`);
      } else if (metadata.official_sources.length === 0) {
        errors.push(`${file}: field "official_sources" must be a non-empty array`);
      } else {
        for (const value of metadata.official_sources) {
          if (typeof value !== 'string' || !value.startsWith('https://')) {
            errors.push(`${file}: invalid official_sources value "${value}"; expected HTTPS URL`);
          }
        }
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

      for (const heading of requiredCaseHeadings) {
        if (!headings.has(heading)) {
          errors.push(`${file}: missing required case heading "${heading}"`);
        }
      }

      if (secondCollectionSlugs.has(metadata.slug)) {
        for (const heading of requiredMigrationHeadings) {
          if (!headings.has(heading)) {
            errors.push(`${file}: missing required migration heading "${heading}"`);
          }
        }
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
    documents: documents.map(({file, metadata}) => ({file, metadata})),
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
