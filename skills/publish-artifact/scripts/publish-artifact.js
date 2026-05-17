#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const { expandHome, normalizeRelative, resolveWorkspace, listUploadFiles } = require('./common/workspace.js');
const { scanSecrets, IMAGE_EXTENSIONS } = require('./common/secret-scan.js');
const {
  readMetadata,
  replacePublishedSection,
  redactPublishedSection,
  extractPublishedSection,
  findExistingGist,
} = require('./common/metadata.js');

const MAX_TTL_SECONDS = 604800;

function usage(exitCode = 0) {
  const out = exitCode === 0 ? process.stdout : process.stderr;
  out.write(`Usage: publish-artifact.js <slug-or-path> [--share <target>] [--ttl <duration>] [--force] [--dry-run] [--gist-visibility <secret|public>] [--no-gist] [--workspace-root <path>]\n`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const options = {
    slug: null,
    shares: [],
    ttl: '7d',
    force: false,
    dryRun: false,
    gistVisibility: 'secret',
    noGist: false,
    workspaceRoot: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg === '--share') {
      const value = argv[++i];
      if (!value) throw new Error('--share requires a value');
      if (value === 'images') throw new Error('--share images is not supported; pass an explicit image filename');
      options.shares.push(value);
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
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!options.slug) {
      options.slug = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!options.slug) throw new Error('Missing <slug>');
  parseTtl(options.ttl);
  return options;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

function parseTtl(value) {
  const match = /^(\d+)([smhd])$/.exec(String(value || ''));
  if (!match) throw new Error(`Invalid --ttl: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit];
  return Math.min(amount * multiplier, MAX_TTL_SECONDS);
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

function md5File(filePath) {
  return crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
}

function contentTypeFor(relativePath) {
  const ext = path.extname(relativePath).toLowerCase();
  if (ext === '.md') return 'text/markdown; charset=utf-8';
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml';
  return 'text/plain; charset=utf-8';
}

function s3Key(prefix, slug, relativePath) {
  return [prefix, slug, relativePath].filter(Boolean).join('/').replace(/\/+/g, '/');
}

function resolveShareTarget(workspacePath, target) {
  if (target === 'images') throw new Error('--share images is not supported; pass an explicit image filename');
  if (target === 'markdown' || target === 'html') {
    const dir = path.join(workspacePath, target);
    if (!fs.existsSync(dir)) throw new Error(`No ${target}/ directory found`);
    const ext = target === 'markdown' ? '.md' : '.html';
    const files = fs.readdirSync(dir)
      .filter((entry) => entry.toLowerCase().endsWith(ext))
      .sort();
    if (files.length === 0) throw new Error(`No ${ext} files found under ${target}/`);
    if (files.length > 1) throw new Error(`Multiple ${target} files found; pass an explicit filename`);
    return shareInfo(`${target}/${files[0]}`, path.join(dir, files[0]));
  }
  const relativePath = normalizeRelative(target);
  const fullPath = path.join(workspacePath, relativePath);
  if (!fullPath.startsWith(workspacePath + path.sep)) throw new Error(`Share target escapes workspace: ${target}`);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    throw new Error(`Share target not found: ${relativePath}`);
  }
  return shareInfo(relativePath, fullPath);
}

function shareInfo(relativePath, fullPath) {
  const ext = path.extname(relativePath).toLowerCase();
  const kind = ext === '.md' ? 'markdown' : ext === '.html' ? 'html' : IMAGE_EXTENSIONS.has(ext) || ext === '.svg' ? 'image' : 'file';
  return { relativePath, fullPath, extension: ext, kind, gistEligible: ext === '.md' || ext === '.html' };
}

function buildGistCreateArgs(localFile, slug, type, visibility) {
  const args = ['gist', 'create', localFile, '--desc', `${slug}: ${type}`];
  if (visibility === 'public') args.push('--public');
  return args;
}

function buildGistUpdateArgs(gistId, gistFilename, localFile) {
  return ['gist', 'edit', gistId, '--filename', gistFilename, localFile];
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
    child.on('close', (status) => resolve({ stdout, stderr, status }));
  });
}

async function runAws(runner, args, env, attemptedCommands, options = {}) {
  attemptedCommands.push(['aws', args]);
  return runner('aws', args, { ...options, env: { ...env, AWS_REGION: env.ARTIFACTS_S3_REGION } });
}

async function runGh(runner, args, env, attemptedCommands) {
  attemptedCommands.push(['gh', args]);
  return runner('gh', args, { env });
}

async function runPublish({ argv, env = process.env, runner = defaultRunner, now = new Date(), scriptDir = __dirname } = {}) {
  const options = parseArgs(argv || process.argv.slice(2));
  const loadedEnv = loadEnvFiles(env, scriptDir);
  if (!loadedEnv.ARTIFACTS_S3_BUCKET) throw new Error('Missing ARTIFACTS_S3_BUCKET');
  if (!loadedEnv.ARTIFACTS_S3_REGION) throw new Error('Missing ARTIFACTS_S3_REGION');
  loadedEnv.AWS_REGION = loadedEnv.ARTIFACTS_S3_REGION;

  const workspaceRoot = options.workspaceRoot || path.join(loadedEnv.HOME || process.env.HOME, 'agent-artifacts');
  const workspace = resolveWorkspace(options.slug, { workspaceRoot, homeDir: loadedEnv.HOME || process.env.HOME });
  const prefix = loadedEnv.ARTIFACTS_S3_PREFIX || '';
  const ttlSeconds = parseTtl(options.ttl);
  const ttlLabel = options.ttl;
  const uploadFiles = listUploadFiles(workspace.workspacePath);
  const secretMatches = scanSecrets(uploadFiles, workspace.workspacePath);
  if (secretMatches.length > 0 && !options.force) {
    const files = [...new Set(secretMatches.map((match) => match.relativePath))].join(', ');
    throw new Error(`Secret scan: ${secretMatches.length} matches in ${files}\nPublish blocked. Use --force to override.`);
  }

  const shareTargets = options.shares.map((target) => ({ requested: target, ...resolveShareTarget(workspace.workspacePath, target) }));
  const archive = `s3://${loadedEnv.ARTIFACTS_S3_BUCKET}/${[prefix, workspace.slug].filter(Boolean).join('/')}/`;
  const attemptedCommands = [];

  if (options.dryRun) {
    return {
      output: dryRunOutput({ workspace, archive, region: loadedEnv.ARTIFACTS_S3_REGION, files: uploadFiles, shareTargets }),
    };
  }

  let uploaded = 0;
  let skipped = 0;
  for (const file of uploadFiles) {
    const result = await syncFile({ file, workspace, prefix, env: loadedEnv, runner, attemptedCommands });
    if (result === 'uploaded') uploaded += 1;
    if (result === 'skipped') skipped += 1;
  }

  const shareLinks = [];
  const gistLinks = [];
  let ghAuthed = true;
  if (shareTargets.some((target) => target.gistEligible) && !options.noGist) {
    const auth = await runGh(runner, ['auth', 'status'], loadedEnv, attemptedCommands);
    ghAuthed = auth.status === 0;
  }

  for (const target of shareTargets) {
    const key = s3Key(prefix, workspace.slug, target.relativePath);
    const presign = await runAws(runner, ['s3', 'presign', `s3://${loadedEnv.ARTIFACTS_S3_BUCKET}/${key}`, '--expires-in', String(ttlSeconds)], loadedEnv, attemptedCommands);
    if (presign.status !== 0) throw new Error(`Presign failed for ${target.relativePath}: ${presign.stderr || presign.stdout}`);
    const url = presign.stdout.trim();
    if (!url) throw new Error(`Presign failed for ${target.relativePath}: empty URL`);
    shareLinks.push({ ...target, url, expiresAt: new Date(now.getTime() + ttlSeconds * 1000) });

    if (target.gistEligible && !options.noGist && ghAuthed) {
      const existing = findExistingGist(readMetadata(workspace.workspacePath), target.relativePath);
      const gistResult = existing && options.force
        ? await runGh(runner, buildGistUpdateArgs(existing.id, path.basename(target.relativePath), target.fullPath), loadedEnv, attemptedCommands)
        : await runGh(runner, buildGistCreateArgs(target.fullPath, workspace.slug, target.kind, options.gistVisibility), loadedEnv, attemptedCommands);
      if (gistResult.status !== 0) throw new Error(`Gist failed for ${target.relativePath}: ${gistResult.stderr || gistResult.stdout}`);
      const gistUrl = gistResult.stdout.trim() || (existing && existing.url);
      if (gistUrl) gistLinks.push({ ...target, url: gistUrl });
    }
  }

  const metadata = buildMetadata({ workspace, archive, uploaded, skipped, shareLinks, gistLinks, now });
  const metadataPath = path.join(workspace.workspacePath, 'metadata.md');
  fs.writeFileSync(metadataPath, metadata);
  const redacted = redactPublishedSection(metadata);
  validateRedactedMetadata(redacted);
  const metadataUpload = await putObject({
    localContent: redacted,
    relativePath: 'metadata.md',
    key: s3Key(prefix, workspace.slug, 'metadata.md'),
    contentType: 'text/markdown; charset=utf-8',
    env: loadedEnv,
    runner,
    attemptedCommands,
  });
  if (metadataUpload.status !== 0) {
    throw new Error(`Upload failed for metadata.md: ${metadataUpload.stderr || metadataUpload.stdout}`);
  }
  uploaded += 1;

  validateAttemptedCommands(attemptedCommands);
  const output = finalOutput({ workspace, archive, uploaded, skipped, shareLinks, gistLinks, ttlLabel, ghAuthed, noGist: options.noGist });
  validateNoCredentialLeak(output + metadata, loadedEnv);
  return { output };
}

async function syncFile({ file, workspace, prefix, env, runner, attemptedCommands }) {
  const key = s3Key(prefix, workspace.slug, file.relativePath);
  const localMd5 = md5File(file.fullPath);
  const head = await runAws(runner, ['s3api', 'head-object', '--bucket', env.ARTIFACTS_S3_BUCKET, '--key', key], env, attemptedCommands);
  let shouldUpload = head.status !== 0;
  if (head.status === 0) {
    const parsed = JSON.parse(head.stdout || '{}');
    shouldUpload = parsed.ContentLength !== file.size || !parsed.Metadata || parsed.Metadata['content-md5'] !== localMd5;
  }
  if (!shouldUpload) return 'skipped';
  const result = await putObject({
    localPath: file.fullPath,
    relativePath: file.relativePath,
    key,
    contentType: contentTypeFor(file.relativePath),
    metadataMd5: localMd5,
    env,
    runner,
    attemptedCommands,
  });
  if (result.status !== 0) throw new Error(`Upload failed for ${file.relativePath}: ${result.stderr || result.stdout}`);
  return 'uploaded';
}

async function putObject({ localPath, localContent, key, contentType, metadataMd5, env, runner, attemptedCommands }) {
  if (localContent !== undefined) {
    const md5 = crypto.createHash('md5').update(localContent).digest('hex');
    return runAws(runner, [
      's3',
      'cp',
      '-',
      `s3://${env.ARTIFACTS_S3_BUCKET}/${key}`,
      '--content-type',
      contentType,
      '--metadata',
      `content-md5=${md5}`,
    ], env, attemptedCommands, { input: localContent });
  }

  return runAws(runner, [
    's3api',
    'put-object',
    '--bucket',
    env.ARTIFACTS_S3_BUCKET,
    '--key',
    key,
    '--body',
    localPath,
    '--content-type',
    contentType,
    '--metadata',
    `content-md5=${metadataMd5}`,
  ], env, attemptedCommands);
}

function buildMetadata({ workspace, archive, uploaded, skipped, shareLinks, gistLinks, now }) {
  const lines = [
    `- S3 archive: \`${archive}\``,
    `- Last published: \`${formatUtc(now)}\``,
    `- Files uploaded: ${uploaded} (skipped ${skipped} unchanged)`,
  ];
  if (shareLinks.length > 0) {
    lines.push('', '### Presigned share links', '');
    for (const link of shareLinks) {
      lines.push(`- \`${link.relativePath}\` — ${link.url} (expires ${formatUtc(link.expiresAt)})`);
    }
  }
  if (gistLinks.length > 0) {
    lines.push('', '### Gist share links', '');
    for (const link of gistLinks) {
      lines.push(`- \`${link.relativePath}\` — ${link.url}`);
    }
  }
  return replacePublishedSection(readMetadata(workspace.workspacePath), workspace.slug, lines);
}

function formatUtc(date) {
  return date.toISOString().slice(0, 16).replace('T', ' ') + 'Z';
}

function dryRunOutput({ workspace, archive, region, files, shareTargets }) {
  const lines = [
    `[dry-run] Workspace: ~/agent-artifacts/${workspace.slug}/`,
    `[dry-run] S3 archive: ${archive} (region: ${region})`,
    '[dry-run] Would upload (changed or new):',
  ];
  for (const file of files) {
    lines.push(`[dry-run]   ${file.relativePath} (${formatSize(file.size)})`);
  }
  lines.push('[dry-run] Would skip (unchanged): 0 files');
  for (const target of shareTargets) {
    const gistNote = target.gistEligible ? 'would create gist' : 'S3 only; no gist';
    lines.push(`[dry-run] Would resolve --share ${target.requested} to: ${target.relativePath} (${gistNote})`);
  }
  lines.push('[dry-run] metadata.md would be uploaded after state tracking (redacted variant)');
  lines.push('[dry-run] No state will be written. No URLs minted.');
  return lines.join('\n') + '\n';
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}

function finalOutput({ workspace, archive, uploaded, skipped, shareLinks, gistLinks, ttlLabel, ghAuthed, noGist }) {
  const lines = [
    `Workspace: ~/agent-artifacts/${workspace.slug}/`,
    `S3 archive: ${archive}`,
    `Files uploaded: ${uploaded} (skipped ${skipped} unchanged)`,
  ];
  if (shareLinks.length > 0) {
    lines.push('', `Share links (TTL: ${ttlLabel}):`);
    for (const link of shareLinks) {
      const suffix = link.gistEligible ? '' : ' (S3 only; no gist)';
      lines.push(`- ${link.relativePath} — ${link.url}${suffix}`);
    }
  }
  if (gistLinks.length > 0) {
    lines.push('', 'Gists:');
    for (const link of gistLinks) lines.push(`- ${link.relativePath} — ${link.url}`);
  } else if (!ghAuthed && !noGist) {
    lines.push('', 'Gists: skipped (gh auth status failed)');
  }
  lines.push('', `Metadata updated: ~/agent-artifacts/${workspace.slug}/metadata.md`);
  return lines.join('\n') + '\n';
}

function validateRedactedMetadata(metadata) {
  const published = extractPublishedSection(metadata);
  if (/https?:\/\/\S+/.test(published)) throw new Error('Redacted metadata still contains a URL in Published section');
}

function validateAttemptedCommands(commands) {
  for (const [, args] of commands) {
    const joined = args.join(' ');
    if (joined.includes('put-bucket-acl') || joined.includes('put-bucket-policy') || joined.includes('put-public-access-block')) {
      throw new Error(`Forbidden AWS command invoked: ${joined}`);
    }
    if (args.includes('--acl')) throw new Error(`Forbidden ACL flag invoked: ${joined}`);
  }
}

function validateNoCredentialLeak(text, env) {
  for (const key of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN']) {
    if (env[key] && text.includes(env[key])) throw new Error(`Output or metadata contains ${key}`);
  }
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
  buildGistCreateArgs,
  buildGistUpdateArgs,
  contentTypeFor,
  dryRunOutput,
  listUploadFiles,
  loadEnvFiles,
  parseArgs,
  parseTtl,
  redactPublishedSection,
  replacePublishedSection,
  resolveShareTarget,
  resolveWorkspace,
  runPublish,
  scanSecrets,
};
