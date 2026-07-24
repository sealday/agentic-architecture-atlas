#!/usr/bin/env node

import {readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const DEFAULT_SENTENCE_LIMIT = 80;
const DEFAULT_PARAGRAPH_LIMIT = 200;
const DEFAULT_CONSECUTIVE_DENSE_LIMIT = 2;
const DEFAULT_IDENTIFIER_LIMIT = 3;
const DEFAULT_VISUAL_BALANCE_THRESHOLD = 90;
const DEFAULT_VISUAL_MINIMUM_PROSE_CHARACTERS = 800;

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

function isTableDelimiter(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/u.test(line);
}

function excludedLineIndexes(lines) {
  const excluded = frontMatterLines(lines);
  let fence;

  for (let index = 0; index < lines.length; index += 1) {
    if (excluded.has(index)) continue;

    const fenceMatch = lines[index].trim().match(/^(`{3,}|~{3,})/u);
    if (fenceMatch) {
      excluded.add(index);
      const marker = fenceMatch[1][0];
      if (!fence) fence = marker;
      else if (fence === marker) fence = undefined;
      continue;
    }

    if (fence) excluded.add(index);
  }

  for (let index = 1; index < lines.length; index += 1) {
    if (excluded.has(index) || !isTableDelimiter(lines[index])) continue;

    const header = index - 1;
    if (
      excluded.has(header) ||
      !lines[header].trim() ||
      !lines[header].includes('|')
    ) {
      continue;
    }

    excluded.add(header);
    excluded.add(index);

    for (let row = index + 1; row < lines.length; row += 1) {
      if (excluded.has(row) || !lines[row].trim() || !lines[row].includes('|')) break;
      excluded.add(row);
    }
  }

  return excluded;
}

function scanSource(source) {
  const lines = source.replace(/\r\n?/gu, '\n').split('\n');
  const excluded = excludedLineIndexes(lines);
  const maskedSource = lines
    .map((line, index) => (excluded.has(index) ? ' '.repeat(line.length) : line))
    .join('\n');

  return {excluded, lines, maskedSource};
}

function evidenceCardLineIndexes(maskedSource) {
  const indexes = new Set();
  const evidenceCard =
    /<details\b(?=[^>]*\bclassName=["'][^"']*\bevidence-card\b[^"']*["'])[^>]*>[\s\S]*?<\/details>/giu;

  for (const match of maskedSource.matchAll(evidenceCard)) {
    const startLine = maskedSource.slice(0, match.index).split('\n').length - 1;
    const lineCount = match[0].split('\n').length;
    for (let offset = 0; offset < lineCount; offset += 1) {
      indexes.add(startLine + offset);
    }
  }

  return indexes;
}

function evidenceAnchorExists(content) {
  return (
    /https?:\/\/\S+/iu.test(content) ||
    /\[[^\]\n]+\]\((?:https?:\/\/|\/|\.{1,2}\/)[^)\n]+\)/iu.test(content) ||
    /`[^`\n]+`/u.test(content) ||
    /\b[0-9a-f]{7,40}\b/iu.test(content) ||
    /\bv?\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?\b/iu.test(content) ||
    /\*\*(?:来源|源码|文件|符号|版本|提交|路径|锚点|文档|仓库|接口|固定[^：*]*)：\*\*\s*\S+/iu.test(
      content,
    )
  );
}

function evidenceCardWarnings(maskedSource) {
  const warnings = [];
  const seenSummaries = new Set();
  const evidenceCard =
    /<details\b(?=[^>]*\bclassName=["'][^"']*\bevidence-card\b[^"']*["'])[^>]*>([\s\S]*?)<\/details>/giu;

  for (const match of maskedSource.matchAll(evidenceCard)) {
    const line = maskedSource.slice(0, match.index).split('\n').length;
    const summaryMatch = match[1].match(
      /<summary\b[^>]*>([\s\S]*?)<\/summary>/iu,
    );
    const summary = summaryMatch?.[1]
      .replace(/<[^>]+>/gu, '')
      .replace(/\s+/gu, ' ')
      .trim();

    if (summary) {
      if (seenSummaries.has(summary)) {
        warnings.push({
          kind: 'duplicate-evidence-summary',
          line,
          message: `Evidence summary is repeated: ${summary}`,
        });
      } else {
        seenSummaries.add(summary);
      }
    }

    const anchoredContent = match[1].replace(
      /<summary\b[^>]*>[\s\S]*?<\/summary>/giu,
      '',
    );
    const visibleContent = anchoredContent
      .replace(/<!--[\s\S]*?-->/gu, '')
      .replace(/<[^>]+>/gu, '')
      .trim();

    if (!visibleContent) {
      warnings.push({
        kind: 'empty-evidence-card',
        line,
        message: 'Evidence card has no content beyond its summary.',
      });
    } else if (!evidenceAnchorExists(anchoredContent)) {
      warnings.push({
        kind: 'unanchored-evidence-card',
        line,
        message:
          'Evidence card has content but no source, file, symbol, version, or concrete evidence anchor.',
      });
    }
  }

  return warnings;
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

function isListLine(line) {
  return /^\s*(?:[-+*]\s+|\d+[.)]\s+)/u.test(line);
}

function collectParagraphs(lines, excluded, evidenceLines) {
  const paragraphs = [];
  let paragraph;
  let segment = 0;
  let inList = false;

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

    if (!trimmed) {
      flushParagraph();
      inList = false;
      continue;
    }

    if (
      excluded.has(index) ||
      evidenceLines.has(index) ||
      isNonProseLine(line) ||
      isListLine(line) ||
      (inList && /^\s{2,}\S/u.test(line))
    ) {
      flushParagraph();
      segment += 1;
      inList = isListLine(line) || (inList && /^\s{2,}\S/u.test(line));
      continue;
    }

    inList = false;
    if (!paragraph) paragraph = {line: index + 1, parts: [], segment};
    paragraph.parts.push(trimmed);
  }

  flushParagraph();
  return paragraphs;
}

function maskInlineTechnicalSyntax(value) {
  return value
    .replace(/(`+)[^\n]*?\1/gu, '')
    .replace(/(!?\[[^\]\n]*\])\((?:\\.|[^)\n])*\)/gu, (_match, label) =>
      label.startsWith('!') ? '' : label.slice(1, -1),
    );
}

function visualFormCounts(lines, excluded, evidenceLines) {
  let rasterCount = 0;
  let mermaidCount = 0;
  let tableCount = 0;
  let codeCount = 0;
  const frontMatter = frontMatterLines(lines);

  for (let index = 0; index < lines.length; index += 1) {
    if (!excluded.has(index) && !evidenceLines.has(index)) {
      for (const match of lines[index].matchAll(
        /!\[[^\]\n]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/gu,
      )) {
        if (/\.(?:png|jpe?g|webp)(?:\?[^)\s]*)?$/iu.test(match[1])) {
          rasterCount += 1;
        }
      }
    }

    if (frontMatter.has(index)) continue;
    if (
      isTableDelimiter(lines[index]) &&
      index > 0 &&
      lines[index - 1].trim() &&
      lines[index - 1].includes('|')
    ) {
      tableCount += 1;
      continue;
    }

    const opening = lines[index].match(/^\s*(`{3,}|~{3,})(.*)$/u);
    if (!opening) continue;

    const marker = opening[1];
    const language = opening[2].trim().split(/\s+/u)[0].toLowerCase();
    if (language === 'mermaid') mermaidCount += 1;
    else codeCount += 1;

    for (index += 1; index < lines.length; index += 1) {
      const closing = lines[index].match(/^\s*(`{3,}|~{3,})\s*$/u);
      if (
        closing &&
        closing[1][0] === marker[0] &&
        closing[1].length >= marker.length
      ) {
        break;
      }
    }
  }

  return {rasterCount, mermaidCount, tableCount, codeCount};
}

function visualBalanceResult(paragraphs, lines, excluded, evidenceLines) {
  const eligibleProseCharacters = paragraphs.reduce(
    (total, paragraph) =>
      total + measuredLength(maskInlineTechnicalSyntax(paragraph.text)),
    0,
  );
  const counts = visualFormCounts(lines, excluded, evidenceLines);
  const visualUnits =
    counts.rasterCount * 3 +
    counts.mermaidCount * 1.5 +
    counts.tableCount * 0.75 +
    counts.codeCount * 0.25;
  const targetVisualUnits = Math.max(
    2,
    (eligibleProseCharacters / 1000) * 2,
  );
  const score = Math.min(
    100,
    Math.round((visualUnits / targetVisualUnits) * 100),
  );

  return {
    eligibleProseCharacters,
    ...counts,
    visualUnits,
    targetVisualUnits,
    score,
  };
}

function inlineIdentifiers(value) {
  const identifiers = new Set();

  for (const match of value.matchAll(/(`+)([^\n]*?)\1/gu)) {
    const identifier = match[2].trim();
    if (!identifier || !/[A-Za-z0-9_./:()[\]{}=+*-]/u.test(identifier)) continue;
    identifiers.add(identifier);
  }

  return identifiers;
}

function evidenceLabel(paragraph) {
  return paragraph.text.match(
    /^\*\*(已证实事实|基于证据的推断|个人分析)\*\*[：:]/u,
  )?.[1];
}

function repeatedEvidenceLabelWarnings(paragraphs) {
  const warnings = [];

  for (let index = 1; index < paragraphs.length; index += 1) {
    const previous = paragraphs[index - 1];
    const current = paragraphs[index];
    const label = evidenceLabel(current);

    if (
      current.segment === previous.segment &&
      label &&
      label === evidenceLabel(previous)
    ) {
      warnings.push({
        kind: 'repeated-evidence-label',
        line: current.line,
        message: `Consecutive prose paragraphs repeat the evidence label: ${label}`,
      });
    }
  }

  return warnings;
}

function missingIllustrativeLabelWarnings(lines) {
  const sectionStarts = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^##\s+(.+?)\s*$/u);
    if (match) sectionStarts.push({heading: match[1], index});
  }

  const relevant = sectionStarts.filter(({heading}) =>
    ['控制权与任务流', '生产化分析'].includes(heading),
  );
  if (relevant.length === 0) return [];

  const hasLabel = relevant.some(({index}) => {
    const nextHeading = sectionStarts.find(({index: candidate}) => candidate > index);
    const end = nextHeading?.index ?? lines.length;
    return lines.slice(index + 1, end).some((line) =>
      /说明性(?:场景|演练)/u.test(line),
    );
  });

  if (hasLabel) return [];

  return [
    {
      kind: 'missing-illustrative-label',
      line: relevant[0].index + 1,
      message:
        'Control-flow and production sections have no explicit 说明性场景 or 说明性演练 label.',
    },
  ];
}

function sentenceWarnings(paragraph, analysisText, sentenceLimit) {
  const warnings = [];
  const sentencePattern = /[^。！？!?；;.]+[。！？!?；;.]?|[.]+/gu;

  for (const match of analysisText.matchAll(sentencePattern)) {
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
 *   identifierLimit?: number;
 *   visualBalanceThreshold?: number;
 *   visualMinimumProseCharacters?: number;
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
  const identifierLimit = normalizedLimit(
    options.identifierLimit,
    DEFAULT_IDENTIFIER_LIMIT,
  );
  const visualBalanceThreshold = normalizedLimit(
    options.visualBalanceThreshold,
    DEFAULT_VISUAL_BALANCE_THRESHOLD,
  );
  const visualMinimumProseCharacters = normalizedLimit(
    options.visualMinimumProseCharacters,
    DEFAULT_VISUAL_MINIMUM_PROSE_CHARACTERS,
  );
  const {excluded, lines, maskedSource} = scanSource(source);
  const evidenceLines = evidenceCardLineIndexes(maskedSource);
  const paragraphs = collectParagraphs(lines, excluded, evidenceLines);
  const visualBalance = visualBalanceResult(
    paragraphs,
    lines,
    excluded,
    evidenceLines,
  );
  const warnings = [
    ...evidenceCardWarnings(maskedSource),
    ...missingIllustrativeLabelWarnings(lines),
    ...repeatedEvidenceLabelWarnings(paragraphs),
  ];
  const denseParagraphs = [];

  for (const paragraph of paragraphs) {
    const analysisText = maskInlineTechnicalSyntax(paragraph.text);
    warnings.push(...sentenceWarnings(paragraph, analysisText, sentenceLimit));
    const identifiers = inlineIdentifiers(paragraph.text);
    if (identifiers.size > identifierLimit) {
      warnings.push({
        kind: 'identifier-density',
        line: paragraph.line,
        message: `Paragraph introduces ${identifiers.size} unique inline identifiers (limit ${identifierLimit}).`,
      });
    }

    const length = measuredLength(analysisText);
    if (length > paragraphLimit) {
      warnings.push({
        kind: 'long-paragraph',
        line: paragraph.line,
        message: `Paragraph has ${length} characters (limit ${paragraphLimit}).`,
      });
      denseParagraphs.push({paragraph, segment: paragraph.segment});
    } else {
      denseParagraphs.push({paragraph: undefined, segment: paragraph.segment});
    }
  }

  for (let index = 0; index < denseParagraphs.length; ) {
    if (!denseParagraphs[index].paragraph) {
      index += 1;
      continue;
    }

    const start = index;
    const segment = denseParagraphs[start].segment;
    while (
      denseParagraphs[index]?.paragraph &&
      denseParagraphs[index].segment === segment
    ) {
      index += 1;
    }
    const count = index - start;

    if (count >= consecutiveDenseLimit) {
      warnings.push({
        kind: 'dense-run',
        line: denseParagraphs[start].paragraph.line,
        message: `${count} consecutive paragraphs exceed the paragraph limit.`,
      });
    }
  }

  if (
    visualBalance.eligibleProseCharacters >= visualMinimumProseCharacters
  ) {
    const {
      rasterCount,
      mermaidCount,
      tableCount,
      codeCount,
      score,
      visualUnits,
    } = visualBalance;
    const hasVisualContent =
      rasterCount + mermaidCount + tableCount + codeCount > 0;

    if (!hasVisualContent) {
      warnings.push({
        kind: 'missing-visual-content',
        line: 1,
        message:
          'Case has enough eligible prose to require explanatory visual content, but none was counted.',
      });
    }

    if (score <= visualBalanceThreshold) {
      warnings.push({
        kind: 'low-visual-balance',
        line: 1,
        message: `Visual-balance score ${score} must be greater than ${visualBalanceThreshold}; raster=${rasterCount}, mermaid=${mermaidCount}, table=${tableCount}, code=${codeCount}, weighted units=${visualUnits}.`,
      });
    }
  }

  warnings.sort((left, right) => left.line - right.line);
  return {paragraphs: paragraphs.length, visualBalance, warnings};
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
