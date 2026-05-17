const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const wiki = require('./wiki.js');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-test-'));
}

function recordingRunner(responses = {}) {
  const calls = [];
  return {
    calls,
    run: async (cmd, args, options = {}) => {
      calls.push({ cmd, args, options });
      const key = `${cmd} ${args[0] || ''}`;
      const sub = `${cmd} ${args[0] || ''} ${args[1] || ''}`;
      if (responses[sub]) return responses[sub];
      if (responses[key]) return responses[key];
      return { stdout: '', stderr: '', status: 0 };
    },
  };
}

test('wiki driver requires no environment variables', () => {
  assert.deepEqual(wiki.requiredEnv(), []);
});

test('wiki driver validateFlags requires owner/repo format', () => {
  assert.throws(() => wiki.validateFlags({ wikiRepo: 'bad-format' }), /owner\/repo/);
  assert.doesNotThrow(() => wiki.validateFlags({ wikiRepo: 'user/repo' }));
  assert.doesNotThrow(() => wiki.validateFlags({}));
});

test('wiki driver auto-detects repo via gh repo view when --wiki-repo is absent', async () => {
  const workspace = tempDir();
  fs.mkdirSync(path.join(workspace, 'markdown'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');
  const tmp = tempDir();
  const { run, calls } = recordingRunner({
    'gh repo': { stdout: JSON.stringify({ nameWithOwner: 'me/proj' }) + '\n', stderr: '', status: 0 },
  });
  const result = await wiki.publish({
    workspace: { workspacePath: workspace, slug: 'demo' },
    files: [{ fullPath: path.join(workspace, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 6 }],
    flags: { wikiRepo: null, dryRun: false, force: false },
    ctx: { env: {}, runner: run, now: new Date('2026-05-17T12:00:00Z'), makeTmpDir: () => tmp },
  });
  assert.equal(result.owner, 'me');
  assert.equal(result.repo, 'proj');
  assert.ok(calls.some((c) => c.cmd === 'gh' && c.args[0] === 'repo'));
});

test('wiki driver returns clear error when clone fails because wiki has no pages', async () => {
  const workspace = tempDir();
  fs.mkdirSync(path.join(workspace, 'markdown'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');
  const tmp = tempDir();
  const { run } = recordingRunner({
    'gh repo': { stdout: JSON.stringify({ nameWithOwner: 'me/proj' }) + '\n', stderr: '', status: 0 },
    'git clone': { stdout: '', stderr: 'fatal: repository not found', status: 128 },
  });
  await assert.rejects(
    wiki.publish({
      workspace: { workspacePath: workspace, slug: 'demo' },
      files: [{ fullPath: path.join(workspace, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 6 }],
      flags: { wikiRepo: null, dryRun: false, force: false },
      ctx: { env: {}, runner: run, now: new Date('2026-05-17T12:00:00Z'), makeTmpDir: () => tmp },
    }),
    /wiki not initialized/,
  );
});

test('wiki driver dry-run reports planned actions without running git push', async () => {
  const workspace = tempDir();
  fs.mkdirSync(path.join(workspace, 'markdown'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');
  const { run, calls } = recordingRunner();
  const result = await wiki.publish({
    workspace: { workspacePath: workspace, slug: 'demo' },
    files: [{ fullPath: path.join(workspace, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 6 }],
    flags: { wikiRepo: 'me/proj', dryRun: true, force: false },
    ctx: { env: {}, runner: run, now: new Date('2026-05-17T12:00:00Z'), makeTmpDir: () => tempDir() },
  });
  assert.ok(result.dryRun);
  assert.ok(!calls.some((c) => c.cmd === 'git' && c.args[0] === 'push'));
  const report = wiki.formatReport(result);
  assert.ok(report.every((line) => line.startsWith('[dry-run]')));
});
