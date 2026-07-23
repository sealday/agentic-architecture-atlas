import {createHash, randomUUID} from 'node:crypto';
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  buildCaseCatalogFromManifest,
  serializeCaseCatalog,
} from './generate-case-catalog.mjs';
import {
  parseSourceLedger,
  validateSourceGovernance,
} from './source-ledger.mjs';
import {buildTopicManifest} from './topic-manifest.mjs';
import {validateContent} from './validate-content.mjs';

export const generatedPaths = {
  sourceLedger: 'src/generated/source-ledger.json',
  manifest: 'src/generated/topic-manifest.json',
  indexes: 'src/generated/topic-indexes.json',
  caseCatalog: 'src/generated/case-catalog.json',
};

const stageRelativePath = 'src/generated/.content-platform-stage';
const stageManifestName = 'manifest.json';

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function expectedDigests(artifacts) {
  return Object.fromEntries(
    Object.entries(artifacts).map(([relativePath, bytes]) => [
      relativePath,
      digest(Buffer.from(bytes)),
    ]),
  );
}

function stagedPath(root, relativePath) {
  return path.join(root, stageRelativePath, path.basename(relativePath));
}

async function pathExists(filePath) {
  try {
    await lstat(filePath);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function stagingMatches(root, artifacts) {
  const stageRoot = path.join(root, stageRelativePath);
  if (!(await pathExists(stageRoot))) {
    return false;
  }

  try {
    const stagedManifest = JSON.parse(
      await readFile(path.join(stageRoot, stageManifestName), 'utf8'),
    );
    const digests = expectedDigests(artifacts);
    if (
      stagedManifest.schema_version !== 1 ||
      JSON.stringify(stagedManifest.files) !== JSON.stringify(digests)
    ) {
      return false;
    }

    for (const [relativePath, expectedDigest] of Object.entries(digests)) {
      const stagedBytes = await readFile(stagedPath(root, relativePath));
      if (digest(stagedBytes) !== expectedDigest) {
        return false;
      }
    }
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      (error.code === 'ENOENT' || error instanceof SyntaxError)
    ) {
      return false;
    }
    throw error;
  }
}

async function verifyTargets(root, artifacts) {
  for (const [relativePath, expected] of Object.entries(artifacts)) {
    const actual = await readFile(path.join(root, relativePath));
    if (!actual.equals(Buffer.from(expected))) {
      throw new Error(`Generated target verification failed: ${relativePath}`);
    }
  }
}

async function replayStaging(root, artifacts, replaceFile) {
  for (const relativePath of Object.values(generatedPaths)) {
    await replaceFile(
      stagedPath(root, relativePath),
      path.join(root, relativePath),
    );
  }
  await verifyTargets(root, artifacts);
  await rm(path.join(root, stageRelativePath), {recursive: true});
}

async function writeExpectedArtifacts(root, artifacts, replaceFile) {
  const stageRoot = path.join(root, stageRelativePath);
  if (await pathExists(stageRoot)) {
    if (await stagingMatches(root, artifacts)) {
      await replayStaging(root, artifacts, replaceFile);
      return;
    }
    await rm(stageRoot, {recursive: true});
  }

  await mkdir(stageRoot, {recursive: true});
  for (const [relativePath, bytes] of Object.entries(artifacts)) {
    await writeFile(stagedPath(root, relativePath), bytes);
  }
  await writeFile(
    path.join(stageRoot, stageManifestName),
    `${JSON.stringify(
      {schema_version: 1, files: expectedDigests(artifacts)},
      null,
      2,
    )}\n`,
  );

  if (!(await stagingMatches(root, artifacts))) {
    throw new Error(`Generated staging verification failed: ${stageRelativePath}`);
  }
  await replayStaging(root, artifacts, replaceFile);
}

async function checkExpectedArtifacts(root, artifacts) {
  const stale = [];
  if (await pathExists(path.join(root, stageRelativePath))) {
    stale.push(stageRelativePath);
  }

  for (const [relativePath, expected] of Object.entries(artifacts)) {
    try {
      const actual = await readFile(path.join(root, relativePath));
      if (!actual.equals(Buffer.from(expected))) {
        stale.push(relativePath);
      }
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'ENOENT') {
        stale.push(relativePath);
        continue;
      }
      throw error;
    }
  }

  stale.sort((left, right) => left.localeCompare(right, 'en'));
  return {matches: stale.length === 0, stale};
}

export function serializePublicSourceLedger(governedLedger, documents) {
  if (documents === undefined) {
    return `${JSON.stringify(governedLedger, null, 2)}\n`;
  }

  const metadataByLedgerPath = new Map(
    documents.map(({file, metadata}) => [`content/${file}`, metadata]),
  );
  const publicDocuments = Object.fromEntries(
    Object.entries(governedLedger.documents).map(
      ([documentPath, governedDocument]) => {
        const metadata = metadataByLedgerPath.get(documentPath);
        if (
          typeof metadata?.title !== 'string' ||
          typeof metadata.slug !== 'string'
        ) {
          throw new Error(
            `Public source ledger document metadata missing for ${documentPath}`,
          );
        }
        return [
          documentPath,
          {
            title: metadata.title,
            slug: metadata.slug,
            ...governedDocument,
          },
        ];
      },
    ),
  );

  return `${JSON.stringify(
    {
      ...governedLedger,
      documents: publicDocuments,
    },
    null,
    2,
  )}\n`;
}

export async function buildContentArtifacts(
  root,
  {requiredCollection = 'complete'} = {},
) {
  const contentRoot = path.join(root, 'content');
  const backlogSource = await readFile(
    path.join(root, 'docs/content-backlog.md'),
    'utf8',
  );
  const relations = JSON.parse(
    await readFile(path.join(root, 'data/topic-relations.json'), 'utf8'),
  );
  const parsedLedger = parseSourceLedger(
    JSON.parse(
      await readFile(path.join(root, 'data/source-ledger.json'), 'utf8'),
    ),
  );
  if (parsedLedger.errors.length) {
    throw new Error(
      `Source ledger failed:\n${parsedLedger.errors.join('\n')}`,
    );
  }
  const validation =
    requiredCollection === null
      ? await validateContent(contentRoot)
      : await validateContent(contentRoot, {requiredCollection});
  if (validation.errors.length) {
    throw new Error(
      `Content validation failed:\n${validation.errors.join('\n')}`,
    );
  }

  const governance = validateSourceGovernance(
    validation.documents,
    parsedLedger.ledger,
  );
  if (governance.errors.length) {
    throw new Error(
      `Source governance failed:\n${governance.errors.join('\n')}`,
    );
  }

  const built = buildTopicManifest({
    backlogSource,
    documents: validation.documents,
    relations,
    primarySourcesByFile: governance.primarySourcesByFile,
  });
  if (built.errors.length) {
    throw new Error(`Topic manifest failed:\n${built.errors.join('\n')}`);
  }

  const caseCatalog = buildCaseCatalogFromManifest(built.manifest);
  return {
    [generatedPaths.sourceLedger]: serializePublicSourceLedger(
      governance.governedLedger,
      validation.documents,
    ),
    [generatedPaths.manifest]: `${JSON.stringify(built.manifest, null, 2)}\n`,
    [generatedPaths.indexes]: `${JSON.stringify(built.indexes, null, 2)}\n`,
    [generatedPaths.caseCatalog]: serializeCaseCatalog(caseCatalog),
  };
}

export async function replaceGeneratedFile(stagedFile, targetFile) {
  await mkdir(path.dirname(targetFile), {recursive: true});
  const temporaryFile = `${targetFile}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await copyFile(stagedFile, temporaryFile);
    await rename(temporaryFile, targetFile);
  } catch (error) {
    await rm(temporaryFile, {force: true});
    throw error;
  }
}

export async function writeContentArtifacts(
  root,
  {replaceFile = replaceGeneratedFile} = {},
) {
  const artifacts = await buildContentArtifacts(root, {
    requiredCollection: null,
  });
  await writeExpectedArtifacts(root, artifacts, replaceFile);
}

export async function checkContentArtifacts(root) {
  const artifacts = await buildContentArtifacts(root, {
    requiredCollection: null,
  });
  return checkExpectedArtifacts(root, artifacts);
}

function usage() {
  return 'Usage: node scripts/generate-content-platform.mjs (--write | --check)';
}

async function runCli() {
  const args = process.argv.slice(2);
  if (
    args.length !== 1 ||
    (args[0] !== '--write' && args[0] !== '--check')
  ) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  try {
    const artifacts = await buildContentArtifacts(root);
    if (args[0] === '--write') {
      await writeExpectedArtifacts(root, artifacts, replaceGeneratedFile);
      return;
    }

    const result = await checkExpectedArtifacts(root, artifacts);
    if (!result.matches) {
      console.error(`Generated content is stale: ${result.stale.join(', ')}`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runCli();
}
