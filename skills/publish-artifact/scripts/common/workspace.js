const fs = require('fs');
const path = require('path');

const SLUG_PATTERN = /^[A-Za-z0-9._-]+$/;

function expandHome(value, homeDir = process.env.HOME) {
  if (value === '~') return homeDir;
  if (value && value.startsWith('~/')) return path.join(homeDir, value.slice(2));
  return value;
}

function normalizeRelative(filePath) {
  return filePath.split(path.sep).join('/');
}

function resolveWorkspace(slug, options = {}) {
  const homeDir = options.homeDir || process.env.HOME;
  const workspaceRoot = path.resolve(expandHome(options.workspaceRoot || path.join(homeDir, 'agent-artifacts'), homeDir));
  const expanded = expandHome(slug, homeDir);
  if (!path.isAbsolute(expanded) && expanded.includes(path.sep)) {
    throw new Error(`Invalid slug: ${slug}`);
  }
  const isPath = path.isAbsolute(expanded);
  const workspacePath = isPath ? path.resolve(expanded) : path.join(workspaceRoot, expanded);

  if (!isPath && !SLUG_PATTERN.test(expanded)) {
    throw new Error(`Invalid slug: ${slug}`);
  }

  if (!fs.existsSync(workspacePath) || !fs.statSync(workspacePath).isDirectory()) {
    throw new Error(`Workspace not found: ${workspacePath}`);
  }
  const realRoot = fs.existsSync(workspaceRoot) ? fs.realpathSync(workspaceRoot) : workspaceRoot;
  const realWorkspace = fs.realpathSync(workspacePath);
  if (realWorkspace !== realRoot && !realWorkspace.startsWith(realRoot + path.sep)) {
    throw new Error(`Workspace outside workspace root: ${workspacePath}`);
  }

  const hasMetadata = fs.existsSync(path.join(workspacePath, 'metadata.md'));
  const hasArtifactDir = ['markdown', 'html', 'images', 'assets'].some((dir) => {
    const dirPath = path.join(workspacePath, dir);
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  });
  if (!hasMetadata && !hasArtifactDir) {
    throw new Error(`Workspace does not look like an artifact workspace: ${workspacePath}`);
  }

  return { workspacePath, slug: path.basename(workspacePath) };
}

function listUploadFiles(workspacePath) {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      const relativePath = normalizeRelative(path.relative(workspacePath, fullPath));
      if (relativePath === 'metadata.md') continue;
      if (relativePath.split('/').includes('node_modules') || relativePath.split('/').includes('dist')) continue;
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push({ fullPath, relativePath, size: fs.statSync(fullPath).size });
      }
    }
  }
  walk(workspacePath);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

module.exports = { expandHome, normalizeRelative, resolveWorkspace, listUploadFiles, SLUG_PATTERN };
