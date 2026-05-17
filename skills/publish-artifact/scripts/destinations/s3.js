const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { IMAGE_EXTENSIONS } = require('../common/secret-scan.js');
const { normalizeRelative } = require('../common/workspace.js');
const {
  readMetadata,
  replacePublishedSection,
  redactPublishedSection,
  extractPublishedSection,
  findExistingGist,
} = require('../common/metadata.js');

const MAX_TTL_SECONDS = 604800;

function parseTtl(value) {
  const match = /^(\d+)([smhd])$/.exec(String(value || ''));
  if (!match) throw new Error(`Invalid --ttl: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit];
  return Math.min(amount * multiplier, MAX_TTL_SECONDS);
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

function shareInfo(relativePath, fullPath) {
  const ext = path.extname(relativePath).toLowerCase();
  const kind = ext === '.md' ? 'markdown' : ext === '.html' ? 'html' : IMAGE_EXTENSIONS.has(ext) || ext === '.svg' ? 'image' : 'file';
  return { relativePath, fullPath, extension: ext, kind, gistEligible: ext === '.md' || ext === '.html' };
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

function buildGistCreateArgs(localFile, slug, type, visibility) {
  const args = ['gist', 'create', localFile, '--desc', `${slug}: ${type}`];
  if (visibility === 'public') args.push('--public');
  return args;
}

function buildGistUpdateArgs(gistId, gistFilename, localFile) {
  return ['gist', 'edit', gistId, '--filename', gistFilename, localFile];
}

async function runAws(runner, args, env, attemptedCommands, options = {}) {
  attemptedCommands.push(['aws', args]);
  return runner('aws', args, { ...options, env: { ...env, AWS_REGION: env.ARTIFACTS_S3_REGION } });
}

async function runGh(runner, args, env, attemptedCommands) {
  attemptedCommands.push(['gh', args]);
  return runner('gh', args, { env });
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

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
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

const driver = {
  name: 's3',

  requiredEnv() {
    return ['ARTIFACTS_S3_BUCKET', 'ARTIFACTS_S3_REGION'];
  },

  validateFlags(flags) {
    if (flags.shares && flags.shares.includes('images')) {
      throw new Error('--share images is not supported; pass an explicit image filename');
    }
  },

  async publish({ workspace, files, flags, ctx }) {
    const env = ctx.env;
    const runner = ctx.runner;
    env.AWS_REGION = env.ARTIFACTS_S3_REGION;

    const prefix = env.ARTIFACTS_S3_PREFIX || '';
    const ttlSeconds = parseTtl(flags.ttl);
    const ttlLabel = flags.ttl;
    const archive = `s3://${env.ARTIFACTS_S3_BUCKET}/${[prefix, workspace.slug].filter(Boolean).join('/')}/`;
    const shareTargets = (flags.shares || []).map((target) => ({
      requested: target,
      ...resolveShareTarget(workspace.workspacePath, target),
    }));
    const attemptedCommands = [];

    if (flags.dryRun) {
      const text = dryRunOutput({
        workspace,
        archive,
        region: env.ARTIFACTS_S3_REGION,
        files,
        shareTargets,
      });
      return {
        dryRun: true,
        archive,
        text,
        presignedByFile: {},
      };
    }

    let uploaded = 0;
    let skipped = 0;
    for (const file of files) {
      const result = await syncFile({ file, workspace, prefix, env, runner, attemptedCommands });
      if (result === 'uploaded') uploaded += 1;
      if (result === 'skipped') skipped += 1;
    }

    const shareLinks = [];
    const gistLinks = [];
    let ghAuthed = true;
    if (shareTargets.some((target) => target.gistEligible) && !flags.noGist) {
      const auth = await runGh(runner, ['auth', 'status'], env, attemptedCommands);
      ghAuthed = auth.status === 0;
    }

    for (const target of shareTargets) {
      const key = s3Key(prefix, workspace.slug, target.relativePath);
      const presign = await runAws(runner, ['s3', 'presign', `s3://${env.ARTIFACTS_S3_BUCKET}/${key}`, '--expires-in', String(ttlSeconds)], env, attemptedCommands);
      if (presign.status !== 0) throw new Error(`Presign failed for ${target.relativePath}: ${presign.stderr || presign.stdout}`);
      const url = presign.stdout.trim();
      if (!url) throw new Error(`Presign failed for ${target.relativePath}: empty URL`);
      shareLinks.push({ ...target, url, expiresAt: new Date(ctx.now.getTime() + ttlSeconds * 1000) });

      if (target.gistEligible && !flags.noGist && ghAuthed) {
        const existing = findExistingGist(readMetadata(workspace.workspacePath), target.relativePath);
        const gistResult = existing && flags.force
          ? await runGh(runner, buildGistUpdateArgs(existing.id, path.basename(target.relativePath), target.fullPath), env, attemptedCommands)
          : await runGh(runner, buildGistCreateArgs(target.fullPath, workspace.slug, target.kind, flags.gistVisibility), env, attemptedCommands);
        if (gistResult.status !== 0) throw new Error(`Gist failed for ${target.relativePath}: ${gistResult.stderr || gistResult.stdout}`);
        const gistUrl = gistResult.stdout.trim() || (existing && existing.url);
        if (gistUrl) gistLinks.push({ ...target, url: gistUrl });
      }
    }

    const presignedByFile = {};
    if (ctx.imageRefsNeeded) {
      for (const file of files) {
        if (!file.relativePath.startsWith('images/')) continue;
        const key = s3Key(prefix, workspace.slug, file.relativePath);
        const presign = await runAws(runner, ['s3', 'presign', `s3://${env.ARTIFACTS_S3_BUCKET}/${key}`, '--expires-in', String(ttlSeconds)], env, attemptedCommands);
        if (presign.status !== 0) continue;
        const url = presign.stdout.trim();
        if (url) presignedByFile[file.relativePath] = url;
      }
    }

    const metadata = buildMetadata({ workspace, archive, uploaded, skipped, shareLinks, gistLinks, now: ctx.now });
    const metadataPath = path.join(workspace.workspacePath, 'metadata.md');
    fs.writeFileSync(metadataPath, metadata);
    const redacted = redactPublishedSection(metadata);
    validateRedactedMetadata(redacted);
    const metadataUpload = await putObject({
      localContent: redacted,
      relativePath: 'metadata.md',
      key: s3Key(prefix, workspace.slug, 'metadata.md'),
      contentType: 'text/markdown; charset=utf-8',
      env,
      runner,
      attemptedCommands,
    });
    if (metadataUpload.status !== 0) {
      throw new Error(`Upload failed for metadata.md: ${metadataUpload.stderr || metadataUpload.stdout}`);
    }
    uploaded += 1;

    validateAttemptedCommands(attemptedCommands);
    const text = finalOutput({ workspace, archive, uploaded, skipped, shareLinks, gistLinks, ttlLabel, ghAuthed, noGist: flags.noGist });
    validateNoCredentialLeak(text + metadata, env);

    return {
      archive,
      uploaded,
      skipped,
      shareLinks,
      gistLinks,
      ttlLabel,
      ghAuthed,
      noGist: flags.noGist,
      text,
      presignedByFile,
    };
  },

  formatReport(result) {
    return (result && result.text) ? [result.text.replace(/\n$/, '')] : [];
  },
};

driver.helpers = {
  buildGistCreateArgs,
  buildGistUpdateArgs,
  contentTypeFor,
  dryRunOutput,
  resolveShareTarget,
  parseTtl,
};

module.exports = driver;
