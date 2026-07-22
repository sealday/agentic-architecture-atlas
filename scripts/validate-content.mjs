import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {readContentDocuments} from './content-metadata.mjs';
import {
  allowedValues,
  requiredCaseHeadings,
  requiredCaseSlugs,
  requiredFields,
} from './content-schema.mjs';

export async function validateContent(root, {requireLaunchCases = false} = {}) {
  const documents = await readContentDocuments(root);
  const errors = [];

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
      for (const heading of requiredCaseHeadings) {
        if (!headings.has(heading)) {
          errors.push(`${file}: missing required case heading "${heading}"`);
        }
      }
    }
  }

  if (requireLaunchCases) {
    const documentSlugs = new Set(documents.map(({metadata}) => metadata.slug));
    for (const slug of requiredCaseSlugs) {
      if (!documentSlugs.has(slug)) {
        errors.push(`Missing launch case slug "${slug}"`);
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
  const requireLaunchCases = args.includes('--require-launch-cases');
  const root = args.find((arg) => !arg.startsWith('--'));

  if (!root) {
    console.error('Usage: node scripts/validate-content.mjs <root> [--require-launch-cases]');
    process.exitCode = 1;
    return;
  }

  try {
    const {documents, errors} = await validateContent(root, {requireLaunchCases});

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
