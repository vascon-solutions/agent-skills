const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const publish = require('./publish-artifact.js');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'publish-artifact-test-'));
}

function write(file, content = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

test('parseTtl converts supported units and caps at seven days', () => {
  assert.equal(publish.parseTtl('30m'), 1800);
  assert.equal(publish.parseTtl('1h'), 3600);
  assert.equal(publish.parseTtl('8d'), 604800);
  assert.throws(() => publish.parseTtl('1w'), /Invalid --ttl/);
});

test('parseArgs rejects bare image share keyword', () => {
  assert.throws(() => publish.parseArgs(['artifact', '--share', 'images']), /explicit image filename/);
});

test('resolveWorkspace supports slug, absolute path, and workspace-root validation', () => {
  const root = tempDir();
  const workspace = path.join(root, 'artifact-one');
  write(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');

  const bySlug = publish.resolveWorkspace('artifact-one', { workspaceRoot: root, homeDir: root });
  assert.equal(bySlug.workspacePath, workspace);
  assert.equal(bySlug.slug, 'artifact-one');

  const byPath = publish.resolveWorkspace(workspace, { workspaceRoot: root, homeDir: root });
  assert.equal(byPath.workspacePath, workspace);
  assert.equal(byPath.slug, 'artifact-one');

  assert.throws(() => publish.resolveWorkspace('missing', { workspaceRoot: root, homeDir: root }), /Workspace not found/);
});

test('loadEnv fills missing values from canonical skill and repo env files without overriding shell env', () => {
  const repoRoot = tempDir();
  const skillDir = path.join(repoRoot, 'skills', 'publish-artifact');
  const scriptDir = path.join(skillDir, 'scripts');
  write(path.join(scriptDir, '.keep'));
  write(path.join(skillDir, '.env'), [
    'S3_BUCKET_NAME=legacy-skill-bucket',
    'S3_REGION=us-east-1',
    'S3_ACCESS_KEY_ID=legacy-access-key',
    'S3_SECRET_ACCESS_KEY=legacy-secret-key',
    'S3_BASE_URL=https://example.invalid/not-used',
    '',
  ].join('\n'));
  write(path.join(repoRoot, '.env.local'), 'ARTIFACTS_S3_BUCKET=from-root\nARTIFACTS_S3_PREFIX=reports\n');

  const env = publish.loadEnvFiles({
    ARTIFACTS_S3_BUCKET: 'from-shell',
    AWS_ACCESS_KEY_ID: 'canonical-access-key',
  }, scriptDir);
  assert.equal(env.ARTIFACTS_S3_BUCKET, 'from-shell');
  assert.equal(env.ARTIFACTS_S3_REGION, 'us-east-1');
  assert.equal(env.ARTIFACTS_S3_PREFIX, 'reports');
  assert.equal(env.AWS_ACCESS_KEY_ID, 'canonical-access-key');
  assert.equal(env.AWS_SECRET_ACCESS_KEY, 'legacy-secret-key');
  assert.equal(env.S3_BASE_URL, 'https://example.invalid/not-used');
});

test('listUploadFiles excludes metadata, hidden paths, node_modules, and dist', () => {
  const workspace = tempDir();
  write(path.join(workspace, 'metadata.md'), '# Metadata\n');
  write(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');
  write(path.join(workspace, 'html', 'doc.html'), '<h1>Doc</h1>\n');
  write(path.join(workspace, 'images', 'pic.png'), 'png');
  write(path.join(workspace, '.hidden', 'secret.txt'), 'hidden');
  write(path.join(workspace, 'node_modules', 'pkg', 'index.js'), 'module');
  write(path.join(workspace, 'dist', 'out.txt'), 'dist');

  const files = publish.listUploadFiles(workspace).map((file) => file.relativePath).sort();
  assert.deepEqual(files, ['html/doc.html', 'images/pic.png', 'markdown/doc.md']);
});

test('scanSecrets blocks non-image secrets and reports pattern names', () => {
  const workspace = tempDir();
  write(path.join(workspace, 'markdown', 'doc.md'), 'token ghp_123456789012345678901234567890123456\n');
  write(path.join(workspace, 'images', 'pic.png'), 'ghp_123456789012345678901234567890123456');

  const files = publish.listUploadFiles(workspace);
  const matches = publish.scanSecrets(files, workspace);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].relativePath, 'markdown/doc.md');
  assert.equal(matches[0].pattern, 'GitHub personal access token');
});

test('replacePublishedSection creates metadata or replaces only the Published section', () => {
  const created = publish.replacePublishedSection(null, 'demo', ['- S3 archive: `s3://bucket/demo/`']);
  assert.match(created, /^# demo Metadata\n\n## Published\n\n- S3 archive/m);

  const existing = '# Title\n\nIntro\n\n## Published\n\nold\n\n## Notes\n\nkeep\n';
  const replaced = publish.replacePublishedSection(existing, 'demo', ['- Last published: `now`']);
  assert.equal(replaced, '# Title\n\nIntro\n\n## Published\n\n- Last published: `now`\n\n## Notes\n\nkeep\n');
});

test('redactPublishedSection only redacts URLs in Published section', () => {
  const metadata = [
    '# Meta',
    '',
    'outside https://example.com/keep',
    '',
    '## Published',
    '',
    '- `markdown/doc.md` — https://bucket.s3.amazonaws.com/a?token=secret (expires tomorrow)',
    '- `markdown/doc.md` — https://gist.github.com/user/id',
    '',
    '## Notes',
    '',
    'https://example.com/still-keep',
    '',
  ].join('\n');

  const redacted = publish.redactPublishedSection(metadata);
  assert.match(redacted, /<presigned URL — see local metadata>/);
  assert.match(redacted, /<gist URL — see local metadata>/);
  assert.match(redacted, /outside https:\/\/example.com\/keep/);
  assert.match(redacted, /https:\/\/example.com\/still-keep/);
});

test('resolveShareTarget handles keywords, explicit files, images, and multiple markdown ambiguity', () => {
  const workspace = tempDir();
  write(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');
  write(path.join(workspace, 'html', 'doc.html'), '<h1>Doc</h1>\n');
  write(path.join(workspace, 'images', 'pic.png'), 'png');

  assert.equal(publish.resolveShareTarget(workspace, 'markdown').relativePath, 'markdown/doc.md');
  assert.equal(publish.resolveShareTarget(workspace, 'html').relativePath, 'html/doc.html');
  assert.equal(publish.resolveShareTarget(workspace, 'images/pic.png').kind, 'image');

  write(path.join(workspace, 'markdown', 'other.md'), '# Other\n');
  assert.throws(() => publish.resolveShareTarget(workspace, 'markdown'), /Multiple markdown files/);
});

test('gist command builders handle public create and forced update', () => {
  assert.deepEqual(
    publish.buildGistCreateArgs('/tmp/doc.md', 'demo', 'markdown', 'public'),
    ['gist', 'create', '/tmp/doc.md', '--desc', 'demo: markdown', '--public'],
  );
  assert.deepEqual(
    publish.buildGistUpdateArgs('abc123', 'doc.md', '/tmp/doc.md'),
    ['gist', 'edit', 'abc123', '--filename', 'doc.md', '/tmp/doc.md'],
  );
});

test('runPublish dry-run prints stable output without mutating metadata or running commands', async () => {
  const root = tempDir();
  const workspace = path.join(root, 'demo');
  write(path.join(workspace, 'metadata.md'), '# Demo Metadata\n');
  write(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');
  write(path.join(workspace, 'html', 'doc.html'), '<h1>Doc</h1>\n');
  write(path.join(workspace, 'images', 'pic.png'), 'png');

  const calls = [];
  const result = await publish.runPublish({
    argv: ['demo', '--workspace-root', root, '--share', 'markdown', '--share', 'images/pic.png', '--dry-run'],
    env: { ARTIFACTS_S3_BUCKET: 'bucket', ARTIFACTS_S3_REGION: 'us-east-1' },
    runner: async (cmd, args) => {
      calls.push([cmd, args]);
      return { stdout: '', stderr: '', status: 0 };
    },
    now: new Date('2026-05-17T12:00:00Z'),
  });

  assert.equal(calls.length, 0);
  assert.ok(result.output.split('\n').filter(Boolean).every((line) => line.startsWith('[dry-run]')));
  assert.match(result.output, /Would resolve --share images\/pic\.png to: images\/pic\.png \(S3 only; no gist\)/);
  assert.equal(fs.readFileSync(path.join(workspace, 'metadata.md'), 'utf8'), '# Demo Metadata\n');
});

test('runPublish stops and reports the failed upload file', async () => {
  const root = tempDir();
  const workspace = path.join(root, 'demo');
  write(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');

  await assert.rejects(
    publish.runPublish({
      argv: ['demo', '--workspace-root', root],
      env: { ARTIFACTS_S3_BUCKET: 'bucket', ARTIFACTS_S3_REGION: 'us-east-1' },
      runner: async (cmd, args) => {
        if (args.includes('head-object')) return { stdout: '', stderr: 'not found', status: 254 };
        if (args.includes('put-object')) return { stdout: '', stderr: 'denied', status: 1 };
        return { stdout: '', stderr: '', status: 0 };
      },
      now: new Date('2026-05-17T12:00:00Z'),
    }),
    /Upload failed for markdown\/doc.md/,
  );
});

test('runPublish with --force proceeds past secret matches and uploads', async () => {
  const root = tempDir();
  const workspace = path.join(root, 'demo');
  write(path.join(workspace, 'markdown', 'doc.md'), 'token ghp_123456789012345678901234567890123456\n');

  const calls = [];
  const result = await publish.runPublish({
    argv: ['demo', '--workspace-root', root, '--force'],
    env: { ARTIFACTS_S3_BUCKET: 'bucket', ARTIFACTS_S3_REGION: 'us-east-1' },
    runner: async (cmd, args) => {
      calls.push([cmd, args]);
      if (args.includes('head-object')) return { stdout: '', stderr: 'not found', status: 254 };
      return { stdout: '', stderr: '', status: 0 };
    },
    now: new Date('2026-05-17T12:00:00Z'),
  });

  assert.match(result.output, /Files uploaded: 2 \(skipped 0 unchanged\)/);
  assert.ok(calls.some(([, args]) => args.includes('put-object')));
});

test('runPublish skips upload when head-object reports matching size and md5', async () => {
  const root = tempDir();
  const workspace = path.join(root, 'demo');
  const docPath = path.join(workspace, 'markdown', 'doc.md');
  write(docPath, '# Doc\n');
  const size = fs.statSync(docPath).size;
  const crypto = require('crypto');
  const md5 = crypto.createHash('md5').update(fs.readFileSync(docPath)).digest('hex');

  const calls = [];
  const result = await publish.runPublish({
    argv: ['demo', '--workspace-root', root],
    env: { ARTIFACTS_S3_BUCKET: 'bucket', ARTIFACTS_S3_REGION: 'us-east-1' },
    runner: async (cmd, args) => {
      calls.push([cmd, args]);
      if (args.includes('head-object') && args.some((arg) => String(arg).endsWith('markdown/doc.md'))) {
        return { stdout: JSON.stringify({ ContentLength: size, Metadata: { 'content-md5': md5 } }), stderr: '', status: 0 };
      }
      if (args.includes('head-object')) return { stdout: '', stderr: 'not found', status: 254 };
      return { stdout: '', stderr: '', status: 0 };
    },
    now: new Date('2026-05-17T12:00:00Z'),
  });

  assert.match(result.output, /Files uploaded: 1 \(skipped 1 unchanged\)/);
  const putCalls = calls.filter(([, args]) => args.includes('put-object'));
  assert.equal(putCalls.length, 0);
});

test('runPublish reports gist skip when gh auth status fails', async () => {
  const root = tempDir();
  const workspace = path.join(root, 'demo');
  write(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');

  const result = await publish.runPublish({
    argv: ['demo', '--workspace-root', root, '--share', 'markdown'],
    env: { ARTIFACTS_S3_BUCKET: 'bucket', ARTIFACTS_S3_REGION: 'us-east-1' },
    runner: async (cmd, args) => {
      if (cmd === 'gh' && args[0] === 'auth') return { stdout: '', stderr: 'not authed', status: 1 };
      if (cmd === 'gh' && args[0] === 'gist') throw new Error('gist should not run when auth fails');
      if (args.includes('head-object')) return { stdout: '', stderr: 'not found', status: 254 };
      if (args.includes('presign')) return { stdout: 'https://signed.example/doc\n', stderr: '', status: 0 };
      return { stdout: '', stderr: '', status: 0 };
    },
    now: new Date('2026-05-17T12:00:00Z'),
  });

  assert.match(result.output, /Gists: skipped \(gh auth status failed\)/);
});

test('runPublish with --force updates an existing gist via gh gist edit', async () => {
  const root = tempDir();
  const workspace = path.join(root, 'demo');
  write(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');
  write(path.join(workspace, 'metadata.md'), [
    '# demo Metadata',
    '',
    '## Published',
    '',
    '### Gist share links',
    '',
    '- `markdown/doc.md` — https://gist.github.com/user/abc123',
    '',
  ].join('\n'));

  const ghCalls = [];
  await publish.runPublish({
    argv: ['demo', '--workspace-root', root, '--share', 'markdown', '--force'],
    env: { ARTIFACTS_S3_BUCKET: 'bucket', ARTIFACTS_S3_REGION: 'us-east-1' },
    runner: async (cmd, args) => {
      if (cmd === 'gh') ghCalls.push(args);
      if (cmd === 'gh' && args[0] === 'auth') return { stdout: '', stderr: '', status: 0 };
      if (cmd === 'gh' && args[0] === 'gist' && args[1] === 'edit') return { stdout: 'https://gist.github.com/user/abc123\n', stderr: '', status: 0 };
      if (args.includes('head-object')) return { stdout: '', stderr: 'not found', status: 254 };
      if (args.includes('presign')) return { stdout: 'https://signed.example/doc\n', stderr: '', status: 0 };
      return { stdout: '', stderr: '', status: 0 };
    },
    now: new Date('2026-05-17T12:00:00Z'),
  });

  const gistOps = ghCalls.filter((args) => args[0] === 'gist');
  assert.equal(gistOps.length, 1);
  assert.deepEqual(gistOps[0].slice(0, 5), ['gist', 'edit', 'abc123', '--filename', 'doc.md']);
});

test('runPublish uploads redacted metadata through stdin while local metadata keeps URLs', async () => {
  const root = tempDir();
  const workspace = path.join(root, 'demo');
  write(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');

  const calls = [];
  const result = await publish.runPublish({
    argv: ['demo', '--workspace-root', root, '--share', 'markdown', '--no-gist'],
    env: { ARTIFACTS_S3_BUCKET: 'bucket', ARTIFACTS_S3_REGION: 'us-east-1' },
    runner: async (cmd, args, options = {}) => {
      calls.push({ cmd, args, input: options.input || '' });
      if (args.includes('head-object')) return { stdout: '', stderr: 'not found', status: 254 };
      if (args.includes('presign')) return { stdout: 'https://signed.example/doc\n', stderr: '', status: 0 };
      return { stdout: '', stderr: '', status: 0 };
    },
    now: new Date('2026-05-17T12:00:00Z'),
  });

  const metadata = fs.readFileSync(path.join(workspace, 'metadata.md'), 'utf8');
  assert.match(metadata, /https:\/\/signed\.example\/doc/);
  assert.match(result.output, /https:\/\/signed\.example\/doc/);

  const metadataUpload = calls.find((call) => call.args.some((arg) => String(arg).endsWith('/metadata.md')));
  assert.ok(metadataUpload);
  assert.equal(metadataUpload.cmd, 'aws');
  assert.deepEqual(metadataUpload.args.slice(0, 3), ['s3', 'cp', '-']);
  assert.match(metadataUpload.input, /<presigned URL — see local metadata>/);
  assert.doesNotMatch(metadataUpload.input, /https:\/\/signed\.example\/doc/);
});

test('runPublish with --to s3 matches default behavior byte-for-byte for dry-run', async () => {
  const root = tempDir();
  const workspace = path.join(root, 'demo');
  write(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');

  const base = {
    env: { ARTIFACTS_S3_BUCKET: 'bucket', ARTIFACTS_S3_REGION: 'us-east-1' },
    runner: async () => ({ stdout: '', stderr: '', status: 0 }),
    now: new Date('2026-05-17T12:00:00Z'),
  };
  const defaultOut = (await publish.runPublish({ ...base, argv: ['demo', '--workspace-root', root, '--dry-run'] })).output;
  const explicitOut = (await publish.runPublish({ ...base, argv: ['demo', '--workspace-root', root, '--to', 's3', '--dry-run'] })).output;
  assert.equal(defaultOut, explicitOut);
});

test('parseArgs rejects --share when --to excludes s3', () => {
  assert.throws(() => publish.parseArgs(['demo', '--to', 'wiki', '--share', 'markdown']), /--share requires --to s3/);
  assert.doesNotThrow(() => publish.parseArgs(['demo', '--share', 'markdown']));
});

test('runPublish accepts google-drive destination and env parent default in dry-run', async () => {
  const root = tempDir();
  const workspace = path.join(root, 'demo');
  write(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');
  write(path.join(workspace, 'images', 'pic.png'), 'png');

  const result = await publish.runPublish({
    argv: ['demo', '--workspace-root', root, '--to', 'google-drive', '--dry-run'],
    env: { GOOGLE_DRIVE_PARENT_ID: 'parent-folder' },
    runner: async () => { throw new Error('dry-run should not fetch auth'); },
    now: new Date('2026-05-17T12:00:00Z'),
  });

  assert.match(result.output, /\[dry-run\] Google Drive folder: demo under parent-folder/);
  assert.match(result.output, /would upload raw file markdown\/doc.md/);
  assert.match(result.output, /would upload raw file images\/pic.png/);
});

test('runPublish applies ClickUp and Google env defaults before validation', async () => {
  const root = tempDir();
  const workspace = path.join(root, 'demo');
  write(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');

  const clickup = await publish.runPublish({
    argv: ['demo', '--workspace-root', root, '--to', 'clickup', '--dry-run'],
    env: {
      CLICKUP_API_TOKEN: 'pk_1_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
      CLICKUP_PARENT_TYPE: 'workspace',
      CLICKUP_PARENT_ID: 'wid',
    },
    runner: async () => ({ stdout: '', stderr: '', status: 0 }),
    now: new Date('2026-05-17T12:00:00Z'),
  });
  assert.match(clickup.output, /would create doc "demo"/);

  const google = await publish.runPublish({
    argv: ['demo', '--workspace-root', root, '--to', 'google-docs', '--dry-run'],
    env: { GOOGLE_DRIVE_PARENT_ID: 'folder-abc' },
    runner: async () => { throw new Error('dry-run should not fetch ADC token'); },
    now: new Date('2026-05-17T12:00:00Z'),
  });
  assert.match(google.output, /would create doc "demo"/);
});

test('runPublish writes destination metadata for wiki-only publishes', async () => {
  const root = tempDir();
  const workspace = path.join(root, 'demo');
  write(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');

  await publish.runPublish({
    argv: ['demo', '--workspace-root', root, '--to', 'wiki', '--wiki-repo', 'me/proj'],
    env: {},
    runner: async (cmd, args) => {
      if (cmd === 'git' && args.includes('status')) return { stdout: 'A  markdown/doc.md\n', stderr: '', status: 0 };
      return { stdout: '', stderr: '', status: 0 };
    },
    now: new Date('2026-05-17T12:00:00Z'),
  });

  const metadata = fs.readFileSync(path.join(workspace, 'metadata.md'), 'utf8');
  assert.match(metadata, /## Published — wiki/);
  assert.match(metadata, /https:\/\/github\.com\/me\/proj\/wiki\/doc/);
});

test('runPublish rewrites image refs when s3 is selected after ClickUp', async () => {
  const root = tempDir();
  const workspace = path.join(root, 'demo');
  write(path.join(workspace, 'markdown', 'doc.md'), '![alt](../images/pic.png)\n');
  write(path.join(workspace, 'images', 'pic.png'), 'png');
  let clickupBody = '';
  const httpClient = {
    request: async (url, init = {}) => {
      if (init.method === 'GET') return { json: async () => ({ docs: [] }) };
      if (init.method === 'POST') {
        clickupBody = init.body;
        return { json: async () => ({ url: 'https://app.clickup.com/doc/1' }) };
      }
      throw new Error(`unexpected request: ${url}`);
    },
  };

  await publish.runPublish({
    argv: ['demo', '--workspace-root', root, '--to', 'clickup', '--to', 's3', '--clickup-parent', 'workspace:wid'],
    env: {
      CLICKUP_API_TOKEN: 'pk_1_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
      ARTIFACTS_S3_BUCKET: 'bucket',
      ARTIFACTS_S3_REGION: 'us-east-1',
    },
    httpClient,
    runner: async (cmd, args) => {
      if (args.includes('head-object')) return { stdout: '', stderr: 'not found', status: 254 };
      if (args.includes('presign')) return { stdout: 'https://signed.example/pic.png\n', stderr: '', status: 0 };
      return { stdout: '', stderr: '', status: 0 };
    },
    now: new Date('2026-05-17T12:00:00Z'),
  });

  assert.match(JSON.parse(clickupBody).content, /https:\/\/signed\.example\/pic\.png/);
});
