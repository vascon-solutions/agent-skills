#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const { expandHome, normalizeRelative, resolveWorkspace, listUploadFiles } = require('./common/workspace.js');
const { scanSecrets, IMAGE_EXTENSIONS } = require('./common/secret-scan.js');
const {
  readMetadata,
  replacePublishedSection,
  replaceDestinationSections,
  redactPublishedSection,
  extractPublishedSection,
  findExistingGist,
} = require('./common/metadata.js');
const { createHttpClient } = require('./common/http.js');

const s3 = require('./destinations/s3.js');
const wiki = require('./destinations/wiki.js');
const clickup = require('./destinations/clickup.js');
const googleDocs = require('./destinations/google-docs.js');
const googleDrive = require('./destinations/google-drive.js');

const VALID_TO = new Set(['s3', 'wiki', 'clickup', 'google-docs', 'google-drive']);

function usage(exitCode = 0) {
  const out = exitCode === 0 ? process.stdout : process.stderr;
  out.write(`Usage: publish-artifact.js <slug-or-path> [--to <s3|wiki|clickup|google-docs|google-drive>]... [--share <target>] [--ttl <duration>] [--force] [--dry-run] [--gist-visibility <secret|public>] [--no-gist] [--wiki-repo <owner/repo>] [--clickup-parent <type:id>] [--clickup-doc <name>] [--google-folder <id>] [--google-doc <name>] [--workspace-root <path>]\n`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const options = {
    slug: null,
    to: [],
    shares: [],
    ttl: '7d',
    force: false,
    dryRun: false,
    gistVisibility: 'secret',
    noGist: false,
    workspaceRoot: null,
    wikiRepo: null,
    clickupParent: null,
    clickupDoc: null,
    googleFolder: null,
    googleDoc: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg === '--share') {
      const value = argv[++i];
      if (!value) throw new Error('--share requires a value');
      if (value === 'images') throw new Error('--share images is not supported; pass an explicit image filename');
      options.shares.push(value);
    } else if (arg === '--to') {
      const value = requireValue(argv, ++i, '--to');
      if (!VALID_TO.has(value)) throw new Error(`Unknown --to value: ${value}`);
      options.to.push(value);
    } else if (arg === '--ttl') {
      options.ttl = requireValue(argv, ++i, '--ttl');
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--gist-visibility') {
      options.gistVisibility = requireValue(argv, ++i, '--gist-visibility');
      if (!['secret', 'public'].includes(options.gistVisibility)) {
        throw new Error('--gist-visibility must be secret or public');
      }
    } else if (arg === '--no-gist') {
      options.noGist = true;
    } else if (arg === '--workspace-root') {
      options.workspaceRoot = expandHome(requireValue(argv, ++i, '--workspace-root'), process.env.HOME);
    } else if (arg === '--wiki-repo') {
      options.wikiRepo = requireValue(argv, ++i, '--wiki-repo');
    } else if (arg === '--clickup-parent') {
      options.clickupParent = requireValue(argv, ++i, '--clickup-parent');
    } else if (arg === '--clickup-doc') {
      options.clickupDoc = requireValue(argv, ++i, '--clickup-doc');
    } else if (arg === '--google-folder') {
      options.googleFolder = requireValue(argv, ++i, '--google-folder');
    } else if (arg === '--google-doc') {
      options.googleDoc = requireValue(argv, ++i, '--google-doc');
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!options.slug) {
      options.slug = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!options.slug) throw new Error('Missing <slug>');
  s3.helpers.parseTtl(options.ttl);

  if (options.shares.length > 0 && options.to.length > 0 && !options.to.includes('s3')) {
    throw new Error('--share requires --to s3 (or no --to flag for default behavior)');
  }

  return options;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

function loadEnvFiles(baseEnv = process.env, scriptDir = __dirname) {
  const env = { ...baseEnv };
  const canonicalScriptDir = fs.realpathSync(scriptDir);
  const skillDir = path.dirname(canonicalScriptDir);
  const repoRoot = path.dirname(path.dirname(skillDir));
  for (const envFile of [path.join(skillDir, '.env'), path.join(repoRoot, '.env.local')]) {
    if (!fs.existsSync(envFile)) continue;
    const parsed = parseEnvFile(fs.readFileSync(envFile, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (env[key] === undefined || env[key] === '') env[key] = value;
    }
  }
  applyEnvMappings(env);
  return env;
}

function applyEnvMappings(env) {
  const mappings = [
    ['S3_BUCKET_NAME', 'ARTIFACTS_S3_BUCKET'],
    ['S3_REGION', 'ARTIFACTS_S3_REGION'],
    ['S3_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID'],
    ['S3_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY'],
  ];
  for (const [source, target] of mappings) {
    if ((env[target] === undefined || env[target] === '') && env[source]) {
      env[target] = env[source];
    }
  }
  return env;
}

function parseEnvFile(content) {
  const values = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function defaultRunner(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env: options.env || process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    if (options.input !== undefined) {
      child.stdin.end(options.input);
    } else {
      child.stdin.end();
    }
    child.on('error', (error) => {
      resolve({ stdout, stderr: stderr || error.message, status: error.code === 'ENOENT' ? 127 : 1 });
    });
    child.on('close', (status) => resolve({ stdout, stderr, status }));
  });
}

function selectDrivers(names) {
  const byName = { s3, wiki, clickup, 'google-docs': googleDocs, 'google-drive': googleDrive };
  const list = names.length > 0 ? names : ['s3'];
  return list.map((n) => {
    const d = byName[n];
    if (!d) throw new Error(`Unknown destination: ${n}`);
    return d;
  });
}

function markdownFilesHaveImageRefs(files) {
  return files.some((file) => {
    if (!file.relativePath.startsWith('markdown/') || !file.relativePath.endsWith('.md')) return false;
    const content = fs.readFileSync(file.fullPath, 'utf8');
    return /!\[[^\]]*\]\([^)\s]+\)|<img\b/.test(content);
  });
}

async function runPublish({ argv, env = process.env, runner = defaultRunner, now = new Date(), scriptDir = __dirname, httpClient } = {}) {
  const options = parseArgs(argv || process.argv.slice(2));
  const loadedEnv = loadEnvFiles(env, scriptDir);

  if (!options.clickupParent && loadedEnv.CLICKUP_PARENT_TYPE && loadedEnv.CLICKUP_PARENT_ID) {
    options.clickupParent = `${loadedEnv.CLICKUP_PARENT_TYPE}:${loadedEnv.CLICKUP_PARENT_ID}`;
  }
  if (!options.googleFolder && loadedEnv.GOOGLE_DRIVE_PARENT_ID) {
    options.googleFolder = loadedEnv.GOOGLE_DRIVE_PARENT_ID;
  }

  const drivers = selectDrivers(options.to);
  for (const driver of drivers) {
    for (const key of driver.requiredEnv()) {
      if (!loadedEnv[key]) throw new Error(`Missing ${key}`);
    }
    driver.validateFlags(options);
  }

  const workspaceRoot = options.workspaceRoot || path.join(loadedEnv.HOME || process.env.HOME, 'agent-artifacts');
  const workspace = resolveWorkspace(options.slug, { workspaceRoot, homeDir: loadedEnv.HOME || process.env.HOME });
  const uploadFiles = listUploadFiles(workspace.workspacePath);
  const secretMatches = scanSecrets(uploadFiles, workspace.workspacePath);
  if (secretMatches.length > 0 && !options.force) {
    const files = [...new Set(secretMatches.map((m) => m.relativePath))].join(', ');
    throw new Error(`Secret scan: ${secretMatches.length} matches in ${files}\nPublish blocked. Use --force to override.`);
  }

  const ctx = {
    env: loadedEnv,
    runner,
    httpClient: httpClient || createHttpClient({ env: loadedEnv }),
    now,
    scriptDir,
    dryRun: options.dryRun,
    force: options.force,
    presignedByFile: {},
    imageRefsNeeded: drivers.some((d) => d.needsPresignedImages === true) && markdownFilesHaveImageRefs(uploadFiles),
  };

  const outputs = [];
  const results = [];
  const prepublished = new Map();
  const s3Index = drivers.findIndex((d) => d.name === 's3');
  const firstImageConsumerIndex = drivers.findIndex((d) => d.needsPresignedImages === true);
  if (!options.dryRun && ctx.imageRefsNeeded && s3Index !== -1 && firstImageConsumerIndex !== -1 && firstImageConsumerIndex < s3Index) {
    const result = await drivers[s3Index].publish({ workspace, files: uploadFiles, flags: options, ctx });
    if (result && result.presignedByFile) Object.assign(ctx.presignedByFile, result.presignedByFile);
    prepublished.set(s3Index, result);
  }

  for (const [index, driver] of drivers.entries()) {
    const result = prepublished.has(index)
      ? prepublished.get(index)
      : await driver.publish({ workspace, files: uploadFiles, flags: options, ctx });
    if (result && result.presignedByFile) Object.assign(ctx.presignedByFile, result.presignedByFile);
    results.push({ driver, result });
    outputs.push(...driver.formatReport(result));
  }

  const destinationSections = results
    .filter(({ result }) => result && result.metadataLines && result.metadataLines.length > 0)
    .map(({ driver, result }) => ({ destination: driver.name, lines: result.metadataLines }));
  const shouldWriteDestinationMetadata = !options.dryRun
    && destinationSections.length > 0
    && options.to.length > 0
    && !(drivers.length === 1 && drivers[0].name === 's3');
  if (shouldWriteDestinationMetadata) {
    const metadataPath = path.join(workspace.workspacePath, 'metadata.md');
    const metadata = replaceDestinationSections(readMetadata(workspace.workspacePath), workspace.slug, destinationSections);
    fs.writeFileSync(metadataPath, metadata);
    if (drivers.some((driver) => driver.name === 's3')) {
      await s3.uploadRedactedMetadata({ workspace, ctx });
    }
  }
  return { output: outputs.join('\n') + '\n' };
}

if (require.main === module) {
  runPublish()
    .then((result) => process.stdout.write(result.output))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    });
}

module.exports = {
  buildGistCreateArgs: s3.helpers.buildGistCreateArgs,
  buildGistUpdateArgs: s3.helpers.buildGistUpdateArgs,
  contentTypeFor: s3.helpers.contentTypeFor,
  defaultRunner,
  dryRunOutput: s3.helpers.dryRunOutput,
  listUploadFiles,
  loadEnvFiles,
  parseArgs,
  parseTtl: s3.helpers.parseTtl,
  redactPublishedSection,
  replacePublishedSection,
  resolveShareTarget: s3.helpers.resolveShareTarget,
  resolveWorkspace,
  runPublish,
  scanSecrets,
};
