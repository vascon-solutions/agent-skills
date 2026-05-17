const fs = require('fs');
const path = require('path');

const { assertCredentialsOutside, getAccessToken } = require('../common/google-auth.js');
const { rewriteImagePaths } = require('../common/markdown-rewrite.js');

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

    const mdFiles = files.filter((f) => f.relativePath.startsWith('markdown/') && f.relativePath.endsWith('.md'));
    const htmlFiles = files.filter((f) => f.relativePath.startsWith('html/') && f.relativePath.endsWith('.html'));
    const rewriteEnabled = (flags.to || []).includes('s3') && ctx.presignedByFile;
    const created = [];
    const updated = [];
    const skipped = htmlFiles.map((file) => ({
      relativePath: file.relativePath,
      reason: 'google-docs does not ingest HTML',
    }));
    const warnings = [];
    let authHeader = null;
    async function getAuthHeader() {
      if (authHeader) return authHeader;
      const token = ctx.fetchAccessToken
        ? await ctx.fetchAccessToken()
        : await getAccessToken({
          env: ctx.env,
          workspacePath: workspace.workspacePath,
          scriptDir: ctx.scriptDir,
          runner: ctx.runner,
          httpClient: ctx.httpClient,
          now: ctx.now || new Date(),
          signJwt: ctx.signJwt,
        });
      authHeader = { Authorization: `Bearer ${token}` };
      return authHeader;
    }

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

      const docName = flags.googleDoc || workspace.slug;
      if (flags.dryRun) {
        created.push({ relativePath: file.relativePath, dryRun: true, docName });
        continue;
      }

      const q = encodeURIComponent(`name='${docName.replace(/'/g, "\\'")}' and '${flags.googleFolder}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`);
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&supportsAllDrives=true&includeItemsFromAllDrives=true`;
      const headers = await getAuthHeader();
      const searchRes = await ctx.httpClient.request(searchUrl, { method: 'GET', headers });
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
          headers: { ...headers, 'Content-Type': 'text/markdown' },
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
          headers: { ...headers, 'Content-Type': `multipart/related; boundary=${boundary}` },
          body,
        });
        const data = await res.json();
        created.push({ relativePath: file.relativePath, docName, url: `https://docs.google.com/document/d/${data.id}/edit` });
      }
    }

    const metadataLines = [
      `- Google Drive folder: \`${flags.googleFolder}\``,
      `- Last published: \`${(ctx.now || new Date()).toISOString().slice(0, 16).replace('T', ' ')}Z\``,
    ];
    for (const c of created) if (c.url) metadataLines.push(`- Created \`${c.relativePath}\` — ${c.url}`);
    for (const u of updated) metadataLines.push(`- Updated \`${u.relativePath}\` — ${u.url}`);
    for (const s of skipped) metadataLines.push(`- Skipped \`${s.relativePath}\` — ${s.reason}`);

    return { created, updated, skipped, warnings, metadataLines };
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
