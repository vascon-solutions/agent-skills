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
  const repo = path.join(root, 'example-ui');
  write(path.join(repo, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  const sourcePath = path.join(repo, 'docs', 'architecture.md');
  write(sourcePath, '# Architecture\n\n- Frontend talks to API routes\n');

  const output = run(['prompt-plan', sourcePath, '--kind', 'architecture-diagram'], { env: { HOME: root } });
  const expectedPath = path.join(root, 'agent-artifacts', 'example-ui-architecture', 'images', 'architecture-prompt-plan.md');

  assert.match(output, new RegExp(`Written: ${expectedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.equal(fs.existsSync(expectedPath), true);
});

test('prompt-plan honors explicit repo-local workspace path', () => {
  const root = tempDir();
  const repo = path.join(root, 'example-ui');
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
  const repo = path.join(root, 'example-ui');
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

function runStatus(args, options = {}) {
  const result = childProcess.spawnSync(process.execPath, [helper, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...(options.env || {}) },
  });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

test('explicit ui-variant-board requests hand off to variant-board without writing a prompt pack', () => {
  const root = tempDir();
  const sourcePath = path.join(root, 'checkout.md');
  write(sourcePath, '# Checkout\n\n- Two options for the summary step\n');

  const result = runStatus(['prompt-pack', sourcePath, '--kind', 'ui-variant-board', '--out', path.join(root, 'pack.md')]);

  assert.equal(result.status, 2);
  assert.match(result.out, /--kind ui-variant-board is retired/);
  assert.match(result.out, /Use the `variant-board` skill/);
  assert.match(result.out, /board-snapshot/);
  assert.equal(fs.existsSync(path.join(root, 'pack.md')), false);
});

test('inferred UI-board sources hand off to variant-board; an explicit non-board kind still generates', () => {
  const root = tempDir();
  const sourcePath = path.join(root, 'composer.md');
  write(sourcePath, '# Composer screen\n\n- The component has three states: empty, staged, failed\n- Variant A keeps the file input; variant B adds an accordion\n');

  const inferred = runStatus(['prompt-plan', sourcePath, '--out', path.join(root, 'plan.md')]);
  assert.equal(inferred.status, 2);
  assert.match(inferred.out, /reads as a UI document with variants, options, or states/);
  assert.equal(fs.existsSync(path.join(root, 'plan.md')), false);

  const explicit = runStatus(['prompt-plan', sourcePath, '--kind', 'summary-card', '--out', path.join(root, 'plan.md')]);
  assert.equal(explicit.status, 0, explicit.out);
  const plan = fs.readFileSync(path.join(root, 'plan.md'), 'utf8');
  assert.match(plan, /summary-card/);
  assert.doesNotMatch(plan, /ui-variant-board/);

  const backend = path.join(root, 'backend.md');
  write(backend, '# Reconciler\n\nThe reconciler stores state in Postgres.\n');
  const backendPlan = path.join(root, 'backend-plan.md');
  const stateOnly = runStatus(['prompt-plan', backend, '--out', backendPlan]);
  assert.equal(stateOnly.status, 0, stateOnly.out);
  assert.equal(fs.existsSync(backendPlan), true);
});

test('workflow-map header blocks lossy generic prompt writes before creating output paths', () => {
  const root = tempDir();
  const source = path.join(root, 'workflow.md');
  write(source, '# Equipment checkout\n\n<!--\n```\n## Commented heading\n-->\n\n~~~markdown\n<!--\n## Example heading\n~~~\n\n- Recipe: workflow-map\n\n## Matrix\n\nA before/after state and flow comparison.\n');
  for (const command of ['prompt-plan', 'prompt-pack']) {
    for (const kind of [null, 'comparison-board', 'summary-card', 'prompt-pack', 'ui-variant-board']) {
      const outputDir = path.join(root, `${command}-${kind || 'inferred'}`);
      const result = runStatus([command, source, '--out', path.join(outputDir, 'prompt.md'), ...(kind ? ['--kind', kind] : [])]);
      assert.equal(result.status, 1, result.out);
      assert.match(result.out, /workflow-map/);
      assert.match(result.out, /references\/workflow-map\.md/);
      assert.equal(fs.existsSync(outputDir), false);
    }
  }

  const ordinary = path.join(root, 'ordinary.md');
  write(ordinary, '# Ordinary source\n\n```markdown\n- Recipe: workflow-map\n## Example heading\n```\n\n<!--\n- Recipe: workflow-map\n-->\n\n## Quoted recipe\n\n- Recipe: workflow-map\n');
  for (const command of ['prompt-plan', 'prompt-pack']) {
    const output = path.join(root, `ordinary-${command}.md`);
    const result = runStatus([command, ordinary, '--kind', 'summary-card', '--out', output]);
    assert.equal(result.status, 0, result.out);
    assert.equal(fs.existsSync(output), true, 'examples, comments and body references are not declarations');
  }
});

test('metadata appends versioned outputs to one image-only table without losing existing columns', () => {
  for (const repoDesign of [null, 'neutral vocabulary']) {
    const root = tempDir();
    const source = path.join(root, 'markdown', 'brief.md');
    write(source, '# Synthetic brief\n');
    const first = path.join(root, 'images', 'map.v1.png');
    const second = path.join(root, 'images', 'map.v2.png');
    const base = ['metadata', root, '--source', source, '--kind', 'comparison-board', '--tool', 'example-generator'];
    run([...base, '--output', first, ...(repoDesign ? ['--repo-design', repoDesign] : [])]);
    run([...base, '--output', second]);
    run([...base, '--output', first]);
    const metadata = fs.readFileSync(path.join(root, 'metadata.md'), 'utf8');
    assert.equal((metadata.match(/^## Artifacts$/gm) || []).length, 1);
    const rows = metadata.split('\n').filter(line => line.startsWith('| comparison-board |'));
    assert.equal(rows.length, 2);
    assert.match(rows[0], /map\.v1\.png/);
    assert.match(rows[1], /map\.v2\.png/);
    assert.equal(rows[0].split('|').length, repoDesign ? 7 : 6);
    if (repoDesign) assert.match(rows[0], /neutral vocabulary/);
  }
});

test('board-snapshot accepts only issued frozen boards with a resolvable scenario and plans the capture', () => {
  const root = tempDir();
  const home = path.join(root, 'home');
  const fixtures = require('../../variant-board/scripts/lib/fixtures.js');
  const verify = path.join(__dirname, '..', '..', 'variant-board', 'scripts', 'verify-variant-board.js');
  const ws = path.join(home, 'agent-artifacts', 'northwind-jobs-ux');
  fixtures.writeWorkspace(ws);
  const working = path.join(ws, 'html', 'route-state.html');

  const notFrozen = runStatus(['board-snapshot', working, '--scenario', '#commands?variant=a&route=depot&state=draft&viewer=planner', '--engine', 'none']);
  assert.equal(notFrozen.status, 1);
  assert.match(notFrozen.out, /takes an issued frozen file/);

  const issued = childProcess.spawnSync(process.execPath, [verify, 'issue', working, '--date', '2026-09-24'], { encoding: 'utf8' });
  assert.equal(issued.status, 0, `${issued.stdout}${issued.stderr}`);
  const frozen = path.join(ws, 'html', 'versions', 'route-state.v1.html');

  const bad = runStatus(['board-snapshot', frozen, '--scenario', '#commands?variant=a&route=depot&state=authority-review&viewer=planner', '--engine', 'none']);
  assert.equal(bad.status, 1);
  assert.match(bad.out, /forbidden by the section's dependencies/);

  const partial = runStatus(['board-snapshot', frozen, '--scenario', '#commands', '--engine', 'none']);
  assert.equal(partial.status, 1);
  assert.match(partial.out, /pass the complete scenario/);

  const plan = runStatus(['board-snapshot', frozen, '--scenario', '#commands?variant=a&route=external&state=authority-review&viewer=approver', '--engine', 'none']);
  assert.equal(plan.status, 0, plan.out);
  assert.match(plan.out, /output: .*images\/route-state\.v1\.commands\.variant-a\.route-external\.state-authority-review\.viewer-approver\.png/);
  assert.match(plan.out, /sidecar: .*\.json/);
  assert.equal(fs.existsSync(path.join(ws, 'images')), false, 'planning writes nothing');

  const unissued = fs.readFileSync(frozen, 'utf8').replace('data-board-issued="true"', 'data-board-issued="false"');
  const fake = path.join(ws, 'html', 'versions', 'route-state.v2.html');
  write(fake, unissued);
  const rejected = runStatus(['board-snapshot', fake, '--scenario', '#commands?variant=a&route=external&state=authority-review&viewer=approver', '--engine', 'none']);
  assert.equal(rejected.status, 1);
  assert.match(rejected.out, /not marked issued/);
});

test('board-snapshot rejects altered or unindexed frozen evidence before capture', () => {
  const fixtures = require('../../variant-board/scripts/lib/fixtures');
  const lib = require('../../variant-board/scripts/lib/board');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-integrity-'));
  const ws = path.join(root, 'workspace');
  fixtures.writeWorkspace(ws);
  const working = path.join(ws, 'html', 'route-state.html');
  const verify = path.resolve(__dirname, '../../variant-board/scripts/verify-variant-board.js');
  const issue = childProcess.spawnSync(process.execPath, [verify, 'issue', working], { encoding: 'utf8' });
  assert.equal(issue.status, 0, `${issue.stdout}${issue.stderr}`);
  const paths = lib.boardPaths(working);
  const frozen = paths.frozen(1);
  const bytes = fs.readFileSync(frozen);
  const args = ['board-snapshot', frozen, '--scenario', '#commands?variant=a&route=external&state=authority-review&viewer=approver'];
  assert.equal(runStatus([...args, '--engine', 'none']).status, 0);
  fs.writeFileSync(frozen, bytes.toString().replace('Three placements', 'Changed evidence'));
  for (const engine of ['none', 'chrome']) {
    const rejected = runStatus([...args, '--engine', engine]);
    assert.equal(rejected.status, 1, rejected.out);
    assert.match(rejected.out, /digest/);
    assert.equal(fs.existsSync(path.join(ws, 'images')), false);
  }
  fs.writeFileSync(frozen, bytes);
  const originalIndex = fs.readFileSync(paths.index);
  const index = lib.readIndex(paths);
  index.boards['route-state'].versions = [];
  lib.writeIndex(paths, index);
  const missing = runStatus([...args, '--engine', 'none']);
  assert.equal(missing.status, 1, missing.out);
  assert.match(missing.out, /no issued version record/);
  fs.unlinkSync(paths.index);
  assert.equal(runStatus([...args, '--engine', 'none']).status, 1);
  fs.writeFileSync(paths.index, originalIndex);
  assert.equal(runStatus([...args, '--engine', 'none']).status, 0);
});
