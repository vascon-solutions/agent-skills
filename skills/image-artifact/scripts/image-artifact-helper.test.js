const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const helper = path.join(__dirname, 'image-artifact-helper.js');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'image-artifact-helper-test-'));
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function run(args, options = {}) {
  return childProcess.execFileSync(process.execPath, [helper, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...(options.env || {}) },
  });
}

test('validate recognizes deterministic SVG dimensions', () => {
  const root = tempDir();
  const svgPath = path.join(root, 'diagram.svg');
  write(svgPath, '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><text x="10" y="20">GET /api/items</text></svg>\n');

  const output = run(['validate', svgPath]);

  assert.match(output, /image\/svg\+xml/);
  assert.match(output, /320x180/);
});

test('validate reads deterministic SVG dimensions from viewBox', () => {
  const root = tempDir();
  const svgPath = path.join(root, 'diagram.svg');
  write(svgPath, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><text x="10" y="20">GET /api/items</text></svg>\n');

  const output = run(['validate', svgPath]);

  assert.match(output, /image\/svg\+xml/);
  assert.match(output, /640x360/);
});

test('prompt-plan can suggest svg output for exact-text static image work', () => {
  const root = tempDir();
  const sourcePath = path.join(root, 'routes.md');
  const outPath = path.join(root, 'routes-prompt-plan.md');
  write(sourcePath, '# Routes\n\n- `GET /api/items`\n- `POST /api/items`\n');

  run(['prompt-plan', sourcePath, '--out', outPath, '--kind', 'api-flow', '--format', 'svg']);

  const plan = fs.readFileSync(outPath, 'utf8');
  assert.match(plan, /Suggested Filenames/);
  assert.match(plan, /routes-api-flow\.svg/);
  assert.doesNotMatch(plan, /routes-api-flow\.png/);
});

test('prompt-plan defaults repo sources to repo-aware agent-artifacts workspace', () => {
  const root = tempDir();
  const repo = path.join(root, 'ncdmb-procurement-ui');
  write(path.join(repo, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  const sourcePath = path.join(repo, 'docs', 'architecture.md');
  write(sourcePath, '# Architecture\n\n- Frontend talks to API routes\n');

  const output = run(['prompt-plan', sourcePath, '--kind', 'architecture-diagram'], { env: { HOME: root } });
  const expectedPath = path.join(root, 'agent-artifacts', 'ncdmb-procurement-ui-architecture', 'images', 'architecture-prompt-plan.md');

  assert.match(output, new RegExp(`Written: ${expectedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.equal(fs.existsSync(expectedPath), true);
});

test('prompt-plan honors explicit repo-local workspace path', () => {
  const root = tempDir();
  const repo = path.join(root, 'ncdmb-procurement-ui');
  write(path.join(repo, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  const sourcePath = path.join(repo, 'docs', 'architecture.md');
  const workspacePath = path.join(repo, 'artifacts', 'architecture');
  write(sourcePath, '# Architecture\n\n- Frontend talks to API routes\n');

  const output = run(['prompt-plan', sourcePath, '--workspace', workspacePath, '--kind', 'architecture-diagram'], { env: { HOME: root } });
  const expectedPath = path.join(workspacePath, 'images', 'architecture-prompt-plan.md');

  assert.match(output, new RegExp(`Written: ${expectedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.equal(fs.existsSync(expectedPath), true);
});

test('prompt-plan honors explicit out path inside repo', () => {
  const root = tempDir();
  const repo = path.join(root, 'ncdmb-procurement-ui');
  write(path.join(repo, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  const sourcePath = path.join(repo, 'docs', 'architecture.md');
  const outPath = path.join(repo, 'artifacts', 'architecture', 'images', 'custom-plan.md');
  write(sourcePath, '# Architecture\n\n- Frontend talks to API routes\n');

  const output = run(['prompt-plan', sourcePath, '--out', outPath, '--kind', 'architecture-diagram'], { env: { HOME: root } });

  assert.match(output, new RegExp(`Written: ${outPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.equal(fs.existsSync(outPath), true);
});

test('prompt-plan preserves existing agent-artifacts workspace precedence', () => {
  const root = tempDir();
  write(path.join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  const sourcePath = path.join(root, 'agent-artifacts', 'my-slug', 'markdown', 'source.md');
  write(sourcePath, '# Source\n\n- Existing artifact workspace source\n');

  const output = run(['prompt-plan', sourcePath, '--kind', 'summary-card'], { env: { HOME: root } });
  const expectedPath = path.join(root, 'agent-artifacts', 'my-slug', 'images', 'source-prompt-plan.md');

  assert.match(output, new RegExp(`Written: ${expectedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.equal(fs.existsSync(expectedPath), true);
});
