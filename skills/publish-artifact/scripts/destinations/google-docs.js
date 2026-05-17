const fs = require('fs');
const path = require('path');

const { rewriteImagePaths } = require('../common/markdown-rewrite.js');

function assertCredentialsOutside(credPath, workspacePath, scriptDir) {
  if (!credPath) return;
  const abs = path.resolve(credPath);
  const checks = [workspacePath];
  if (scriptDir) {
    checks.push(scriptDir);
    checks.push(path.dirname(path.dirname(scriptDir)));
  }
  for (const root of checks) {
    if (!root) continue;
    const absRoot = path.resolve(root);
    if (abs === absRoot || abs.startsWith(absRoot + path.sep)) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS must live outside the repo and workspace');
    }
  }
}

async function defaultAccessToken(env, runner) {
  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Service-account JSON support without ADC is not implemented in v1; activate the account via `gcloud auth application-default login --impersonate-service-account` or set ADC directly.');
  }
  const result = await runner('gcloud', ['auth', 'application-default', 'print-access-token'], { env });
  if (result.status !== 0) {
    throw new Error(`gcloud ADC token fetch failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

const driver = {
  name: 'google-docs',
  needsPresignedImages: true,

  requiredEnv() { return []; },

  validateFlags(flags) {
    if (!flags.googleFolder) {
      throw new Error('google-docs destination requires --google-folder <drive-folder-id> (or GOOGLE_DRIVE_PARENT_ID)');
    }
  },

  async publish({ workspace, files, flags, ctx }) {
    assertCredentialsOutside(ctx.env.GOOGLE_APPLICATION_CREDENTIALS, workspace.workspacePath, ctx.scriptDir);

    const token = ctx.fetchAccessToken
      ? await ctx.fetchAccessToken()
      : await defaultAccessToken(ctx.env, ctx.runner);
    const authHeader = { Authorization: `Bearer ${token}` };

    const mdFiles = files.filter((f) => f.relativePath.startsWith('markdown/') && f.relativePath.endsWith('.md'));
    const rewriteEnabled = (flags.to || []).includes('s3') && ctx.presignedByFile;
    const created = [];
    const updated = [];
    const skipped = [];
    const warnings = [];

    for (const file of mdFiles) {
      const raw = fs.readFileSync(file.fullPath, 'utf8');
      let bodyContent = raw;
      if (rewriteEnabled) {
        const r = rewriteImagePaths(raw, { relativeMap: ctx.presignedByFile, sourceRelative: file.relativePath });
        bodyContent = r.content;
        warnings.push(...r.warnings);
      } else if (/!\[[^\]]*\]\([^)\s]+\)|<img\b/.test(raw)) {
        warnings.push(`Image references in ${file.relativePath} are not rewritten (add --to s3 to mint presigned URLs).`);
      }

      const docName = flags.googleDoc || path.basename(file.relativePath, '.md');
      if (flags.dryRun) {
        created.push({ relativePath: file.relativePath, dryRun: true, docName });
        continue;
      }

      const q = encodeURIComponent(`name='${docName.replace(/'/g, "\\'")}' and '${flags.googleFolder}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`);
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&supportsAllDrives=true&includeItemsFromAllDrives=true`;
      const searchRes = await ctx.httpClient.request(searchUrl, { method: 'GET', headers: authHeader });
      const searchData = await searchRes.json();
      const match = (searchData.files || [])[0];

      if (match) {
        if (!flags.force) {
          skipped.push({ relativePath: file.relativePath, docName, reason: 'Doc exists; pass --force to update' });
          continue;
        }
        const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(match.id)}?uploadType=media&supportsAllDrives=true`;
        await ctx.httpClient.request(updateUrl, {
          method: 'PATCH',
          headers: { ...authHeader, 'Content-Type': 'text/markdown' },
          body: bodyContent,
        });
        updated.push({ relativePath: file.relativePath, docName, url: `https://docs.google.com/document/d/${match.id}/edit` });
      } else {
        const boundary = 'publish_artifact_boundary_' + Math.random().toString(16).slice(2);
        const metadata = { name: docName, parents: [flags.googleFolder], mimeType: 'application/vnd.google-apps.document' };
        const body =
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
          JSON.stringify(metadata) + `\r\n--${boundary}\r\nContent-Type: text/markdown\r\n\r\n` +
          bodyContent + `\r\n--${boundary}--`;
        const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true';
        const res = await ctx.httpClient.request(uploadUrl, {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': `multipart/related; boundary=${boundary}` },
          body,
        });
        const data = await res.json();
        created.push({ relativePath: file.relativePath, docName, url: `https://docs.google.com/document/d/${data.id}/edit` });
      }
    }

    return { created, updated, skipped, warnings };
  },

  formatReport(result) {
    const lines = [];
    if (result.created.length > 0) {
      lines.push('Google Docs created:');
      for (const c of result.created) {
        if (c.dryRun) lines.push(`[dry-run] - ${c.relativePath} would create doc "${c.docName}"`);
        else lines.push(`- ${c.relativePath} — ${c.url}`);
      }
    }
    if (result.updated.length > 0) {
      lines.push('Google Docs updated:');
      for (const u of result.updated) lines.push(`- ${u.relativePath} — ${u.url}`);
    }
    if (result.skipped.length > 0) {
      lines.push('Google Docs skipped:');
      for (const s of result.skipped) lines.push(`- ${s.relativePath} (${s.reason})`);
    }
    for (const w of result.warnings) lines.push(`Warning: ${w}`);
    return lines;
  },
};

module.exports = driver;
