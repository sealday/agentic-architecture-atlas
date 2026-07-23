#!/usr/bin/env node

import {readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const DEFAULT_SENTENCE_LIMIT = 90;
const DEFAULT_PARAGRAPH_LIMIT = 240;
const DEFAULT_CONSECUTIVE_DENSE_LIMIT = 2;

function measuredLength(value) {
  return Array.from(value.replace(/\s+/gu, '')).length;
}

function normalizedLimit(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function frontMatterLines(lines) {
  const ignored = new Set();
  if (lines[0]?.trim() !== '---') return ignored;

  ignored.add(0);
  for (let index = 1; index < lines.length; index += 1) {
    ignored.add(index);
    if (lines[index].trim() === '---') break;
  }

  return ignored;
}

function evidenceCardWarnings(source) {
  const warnings = [];
  const evidenceCard =
    /<details\b(?=[^>]*\bclassName=["'][^"']*\bevidence-card\b[^"']*["'])[^>]*>([\s\S]*?)<\/details>/giu;

  for (const match of source.matchAll(evidenceCard)) {
    const content = match[1]
      .replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/giu, '')
      .replace(/<!--[\s\S]*?-->/gu, '')
      .replace(/<[^>]+>/gu, '')
      .trim();

    if (content) continue;

    const line = source.slice(0, match.index).split('\n').length;
    warnings.push({
      kind: 'empty-evidence-card',
      line,
      message: 'Evidence card has no content beyond its summary.',
    });
  }

  return warnings;
}

function isMarkdownTableLine(line) {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;

  return (
    trimmed.startsWith('|') ||
    trimmed.endsWith('|') ||
    /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/u.test(trimmed)
  );
}

function isNonProseLine(line) {
  const trimmed = line.trim();

  return (
    /^#{1,6}\s/u.test(trimmed) ||
    /^(?:import|export)\s/u.test(trimmed) ||
    /^(?:-{3,}|\*{3,}|_{3,})$/u.test(trimmed) ||
    (/^<[^>]+>$/u.test(trimmed) && !/[^\s<>][^<>]*<\//u.test(trimmed))
  );
}

function collectParagraphs(source) {
  const lines = source.replace(/\r\n?/gu, '\n').split('\n');
  const ignoredFrontMatter = frontMatterLines(lines);
  const paragraphs = [];
  let paragraph;
  let fence;

  function flushParagraph() {
    if (!paragraph) return;
    paragraph.text = paragraph.parts.join(' ').trim();
    delete paragraph.parts;
    if (paragraph.text) paragraphs.push(paragraph);
    paragraph = undefined;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/u);

    if (ignoredFrontMatter.has(index)) {
      flushParagraph();
      continue;
    }

    if (fenceMatch) {
      flushParagraph();
      const marker = fenceMatch[1][0];
      if (!fence) fence = marker;
      else if (fence === marker) fence = undefined;
      continue;
    }

    if (fence) continue;

    if (!trimmed || isMarkdownTableLine(line) || isNonProseLine(line)) {
      flushParagraph();
      continue;
    }

    if (!paragraph) paragraph = {line: index + 1, parts: []};
    paragraph.parts.push(trimmed);
  }

  flushParagraph();
  return paragraphs;
}

function sentenceWarnings(paragraph, sentenceLimit) {
  const warnings = [];
  const sentencePattern = /[^。！？!?；;.]+[。！？!?；;.]?|[.]+/gu;

  for (const match of paragraph.text.matchAll(sentencePattern)) {
    const sentence = match[0].trim();
    const length = measuredLength(sentence);
    if (length <= sentenceLimit) continue;

    warnings.push({
      kind: 'long-sentence',
      line: paragraph.line,
      message: `Sentence has ${length} characters (limit ${sentenceLimit}).`,
    });
  }

  return warnings;
}

/**
 * Analyze prose density without blocking publication.
 *
 * @param {string} source
 * @param {{
 *   sentenceLimit?: number;
 *   paragraphLimit?: number;
 *   consecutiveDenseLimit?: number;
 * }} [options]
 */
export function analyzeCaseText(source, options = {}) {
  const sentenceLimit = normalizedLimit(
    options.sentenceLimit,
    DEFAULT_SENTENCE_LIMIT,
  );
  const paragraphLimit = normalizedLimit(
    options.paragraphLimit,
    DEFAULT_PARAGRAPH_LIMIT,
  );
  const consecutiveDenseLimit = normalizedLimit(
    options.consecutiveDenseLimit,
    DEFAULT_CONSECUTIVE_DENSE_LIMIT,
  );
  const paragraphs = collectParagraphs(source);
  const warnings = evidenceCardWarnings(source);
  const denseParagraphs = [];

  for (const paragraph of paragraphs) {
    warnings.push(...sentenceWarnings(paragraph, sentenceLimit));

    const length = measuredLength(paragraph.text);
    if (length > paragraphLimit) {
      warnings.push({
        kind: 'long-paragraph',
        line: paragraph.line,
        message: `Paragraph has ${length} characters (limit ${paragraphLimit}).`,
      });
      denseParagraphs.push(paragraph);
    } else {
      denseParagraphs.push(undefined);
    }
  }

  for (let index = 0; index < denseParagraphs.length; ) {
    if (!denseParagraphs[index]) {
      index += 1;
      continue;
    }

    const start = index;
    while (denseParagraphs[index]) index += 1;
    const count = index - start;

    if (count >= consecutiveDenseLimit) {
      warnings.push({
        kind: 'dense-run',
        line: denseParagraphs[start].line,
        message: `${count} consecutive paragraphs exceed the paragraph limit.`,
      });
    }
  }

  warnings.sort((left, right) => left.line - right.line);
  return {paragraphs: paragraphs.length, warnings};
}

async function collectMdxFiles(inputPath) {
  const inputStat = await stat(inputPath);

  if (inputStat.isFile()) {
    if (!/\.mdx?$/iu.test(inputPath)) {
      throw new Error(`Expected an MDX file or directory: ${inputPath}`);
    }
    return [inputPath];
  }

  if (!inputStat.isDirectory()) {
    throw new Error(`Expected an MDX file or directory: ${inputPath}`);
  }

  const files = [];
  const entries = await readdir(inputPath, {withFileTypes: true});
  for (const entry of entries) {
    const entryPath = path.join(inputPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMdxFiles(entryPath)));
    } else if (entry.isFile() && /\.mdx?$/iu.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

async function runCli(args) {
  if (args.length !== 1) {
    throw new Error('Usage: analyze_case_density.mjs <file-or-directory>');
  }

  const files = await collectMdxFiles(args[0]);
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const result = analyzeCaseText(source);
    for (const warning of result.warnings) {
      console.log(`${file}:${warning.line} [${warning.kind}] ${warning.message}`);
    }
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  runCli(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
