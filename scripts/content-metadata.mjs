import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';

export async function findContentFiles(root) {
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

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  if (/^[1-9]\d*$/.test(value)) {
    return Number(value);
  }

  return value;
}

export function parseFrontMatter(source) {
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

export function extractMarkdownBody(source) {
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    return lines.join('\n');
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  return closingIndex === -1 ? '' : lines.slice(closingIndex + 1).join('\n');
}

export function findMarkdownHeadings(source) {
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

    const htmlCommentOwnsLine = inHtmlComment || /^ {0,3}<!--/.test(line);
    let content = '';
    let cursor = 0;

    while (cursor < line.length) {
      if (inHtmlComment) {
        const commentEnd = line.indexOf('-->', cursor);
        if (commentEnd === -1) {
          cursor = line.length;
          continue;
        }

        content += ' ';
        inHtmlComment = false;
        cursor = commentEnd + 3;
        continue;
      }

      const commentStart = line.indexOf('<!--', cursor);
      if (commentStart === -1) {
        content += line.slice(cursor);
        break;
      }

      content += `${line.slice(cursor, commentStart)} `;
      const commentEnd = line.indexOf('-->', commentStart + 4);
      if (commentEnd === -1) {
        inHtmlComment = true;
        break;
      }

      cursor = commentEnd + 3;
    }

    if (htmlCommentOwnsLine) {
      continue;
    }

    const openingFence = content.match(/^ {0,3}([`~]{3,})(?:[^\r\n]*)$/);
    if (openingFence) {
      fence = {marker: openingFence[1][0], length: openingFence[1].length};
      continue;
    }

    if (/^ {0,3}#{2,3}(?!#)(?:[ \t]+.*)?$/.test(content)) {
      headings.add(content.trim());
    }
  }

  return headings;
}

function displayPath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

export async function readContentDocuments(root) {
  const files = await findContentFiles(root);

  return Promise.all(
    files.map(async (filePath) => {
      const file = displayPath(root, filePath);
      const source = await readFile(filePath, 'utf8');
      const body = extractMarkdownBody(source);

      return {
        filePath,
        file,
        source,
        body,
        metadata: parseFrontMatter(source),
        headings: findMarkdownHeadings(body),
      };
    }),
  );
}
