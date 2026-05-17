const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const WIKI_REPO_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

function isWikiNotInitialized(stderr) {
  return /repository not found/i.test(stderr) || /not found/i.test(stderr);
}

async function detectRepo(runner, env) {
  const result = await runner('gh', ['repo', 'view', '--json', 'nameWithOwner'], { env });
  if (result.status !== 0) {
    throw new Error('Unable to detect repo via `gh repo view`. Pass --wiki-repo <owner/repo>.');
  }
  const parsed = JSON.parse(result.stdout.trim() || '{}');
  if (!parsed.nameWithOwner) throw new Error('gh repo view did not return nameWithOwner.');
  return parsed.nameWithOwner;
}

function copyTree(src, dest) {
  if (!fs.existsSync(src)) return [];
  const copied = [];
  function walk(currentSrc, currentDest) {
    fs.mkdirSync(currentDest, { recursive: true });
    for (const entry of fs.readdirSync(currentSrc, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const s = path.join(currentSrc, entry.name);
      const d = path.join(currentDest, entry.name);
      if (entry.isDirectory()) walk(s, d);
      else if (entry.isFile()) {
        fs.copyFileSync(s, d);
        copied.push(path.relative(dest, d));
      }
    }
  }
  walk(src, dest);
  return copied;
}

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), `publish-artifact-wiki-${crypto.randomBytes(4).toString('hex')}-`));
}

function cleanupTmp(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

const driver = {
  name: 'wiki',

  requiredEnv() { return []; },

  validateFlags(flags) {
    if (flags.wikiRepo && !WIKI_REPO_PATTERN.test(flags.wikiRepo)) {
      throw new Error('--wiki-repo must be in owner/repo format');
    }
  },

  async publish({ workspace, files, flags, ctx }) {
    const ownerRepo = flags.wikiRepo || await detectRepo(ctx.runner, ctx.env);
    const [owner, repo] = ownerRepo.split('/');
    const url = `git@github.com:${owner}/${repo}.wiki.git`;
    const tmp = (ctx.makeTmpDir || makeTmpDir)();

    if (flags.dryRun) {
      const sources = ['markdown', 'html', 'images', 'assets'].filter((d) => fs.existsSync(path.join(workspace.workspacePath, d)));
      cleanupTmp(tmp);
      return { dryRun: true, owner, repo, url, sources };
    }

    const clone = await ctx.runner('git', ['clone', '--depth', '1', url, tmp], { env: ctx.env });
    if (clone.status !== 0) {
      cleanupTmp(tmp);
      if (isWikiNotInitialized(clone.stderr || clone.stdout)) {
        throw new Error(`wiki not initialized — create the first page at https://github.com/${owner}/${repo}/wiki and retry`);
      }
      throw new Error(`git clone failed for ${url}: ${(clone.stderr || clone.stdout).trim()}`);
    }

    let copiedAny = false;
    for (const dir of ['markdown', 'html', 'images', 'assets']) {
      const src = path.join(workspace.workspacePath, dir);
      if (!fs.existsSync(src)) continue;
      const copied = copyTree(src, path.join(tmp, dir));
      if (copied.length > 0) copiedAny = true;
    }

    if (!copiedAny) {
      cleanupTmp(tmp);
      return { owner, repo, url, pushed: false, reason: 'no source files to publish' };
    }

    const add = await ctx.runner('git', ['-C', tmp, 'add', '-A'], { env: ctx.env });
    if (add.status !== 0) {
      cleanupTmp(tmp);
      throw new Error(`git add failed: ${(add.stderr || add.stdout).trim()}`);
    }

    const status = await ctx.runner('git', ['-C', tmp, 'status', '--porcelain'], { env: ctx.env });
    if (status.status === 0 && status.stdout.trim() === '') {
      cleanupTmp(tmp);
      return { owner, repo, url, pushed: false, reason: 'wiki already up to date' };
    }

    const message = `publish-artifact: ${workspace.slug} @ ${ctx.now.toISOString()}`;
    const commit = await ctx.runner('git', ['-C', tmp, 'commit', '-m', message], { env: ctx.env });
    if (commit.status !== 0) {
      cleanupTmp(tmp);
      throw new Error(`git commit failed: ${(commit.stderr || commit.stdout).trim()}`);
    }

    const push = await ctx.runner('git', ['-C', tmp, 'push'], { env: ctx.env });
    cleanupTmp(tmp);
    if (push.status !== 0) {
      throw new Error(`git push failed for ${url}: ${(push.stderr || push.stdout).trim()}`);
    }

    const pageUrls = files
      .filter((f) => f.relativePath.startsWith('markdown/') && f.relativePath.endsWith('.md'))
      .map((f) => {
        const page = path.basename(f.relativePath, '.md');
        return { relativePath: f.relativePath, url: `https://github.com/${owner}/${repo}/wiki/${encodeURIComponent(page)}` };
      });

    return { owner, repo, url, pushed: true, pageUrls };
  },

  formatReport(result) {
    if (result.dryRun) {
      const lines = [`[dry-run] Wiki: ${result.url}`];
      for (const src of result.sources) lines.push(`[dry-run]   would mirror ${src}/`);
      lines.push('[dry-run] Would run git add -A, git commit, git push');
      return lines;
    }
    if (!result.pushed) {
      return [`Wiki: ${result.url} — ${result.reason}`];
    }
    const lines = [`Wiki: ${result.url} (pushed)`];
    for (const page of result.pageUrls || []) {
      lines.push(`- ${page.relativePath} — ${page.url}`);
    }
    return lines;
  },
};

module.exports = driver;
