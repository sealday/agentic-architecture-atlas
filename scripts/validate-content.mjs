import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  allowedValues,
  requiredCaseHeadings,
  requiredCaseSlugs,
  requiredFields,
} from './content-schema.mjs';

async function findContentFiles(root) {
  const files = [];

  async function visit(directory) {
    const entries = await readdir(directory, {withFileTypes: true});

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
        files.push(entryPath);
      }
    }
  }

  await visit(root);
  return files.sort();
}

function parseScalar(rawValue) {
  const value = rawValue.trim();

  if (value === '[]') {
    return [];
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseFrontMatter(source) {
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);

  if (lines[0]?.trim() !== '---') {
    return {};
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (closingIndex === -1) {
    return {};
  }

  const metadata = {};
  let arrayField;

  for (const line of lines.slice(1, closingIndex)) {
    const arrayItem = line.match(/^\s+-\s+(.+)\s*$/);
    if (arrayItem && arrayField) {
      metadata[arrayField].push(parseScalar(arrayItem[1]));
      continue;
    }

    const field = line.match(/^([A-Za-z_][\w-]*):(?:\s*(.*))?$/);
    if (!field) {
      arrayField = undefined;
      continue;
    }

    const [, name, rawValue = ''] = field;
    if (rawValue.trim() === '') {
      metadata[name] = [];
      arrayField = name;
    } else {
      metadata[name] = parseScalar(rawValue);
      arrayField = undefined;
    }
  }

  return metadata;
}

function displayPath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function findCaseHeadings(source) {
  const headings = new Set();
  let fence;
  let inHtmlComment = false;

  for (const line of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (fence) {
      const closingFence = line.match(/^ {0,3}([`~]{3,})[ \t]*$/);
      if (
        closingFence &&
        closingFence[1][0] === fence.marker &&
        closingFence[1].length >= fence.length
      ) {
        fence = undefined;
      }
      continue;
    }

    if (inHtmlComment) {
      if (line.includes('-->')) {
        inHtmlComment = false;
      }
      continue;
    }

    const commentStart = line.indexOf('<!--');
    if (commentStart !== -1) {
      if (line.indexOf('-->', commentStart + 4) === -1) {
        inHtmlComment = true;
      }
      continue;
    }

    const openingFence = line.match(/^ {0,3}([`~]{3,})(?:[^\r\n]*)$/);
    if (openingFence) {
      fence = {marker: openingFence[1][0], length: openingFence[1].length};
      continue;
    }

    if (requiredCaseHeadings.includes(line)) {
      headings.add(line);
    }
  }

  return headings;
}

export async function validateContent(root, {requireLaunchCases = false} = {}) {
  const documents = [];
  const errors = [];
  const files = await findContentFiles(root);

  for (const filePath of files) {
    const file = displayPath(root, filePath);
    const source = await readFile(filePath, 'utf8');
    const metadata = parseFrontMatter(source);
    documents.push({file, metadata});

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
      const headings = findCaseHeadings(source);
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

  return {documents, errors};
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
