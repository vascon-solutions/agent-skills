const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { rewriteImagePaths } = require('../common/markdown-rewrite.js');

function assertCredentialsOutside(credPath, workspacePath, scriptDir) {
  if (!credPath) return;
  const abs = path.resolve(credPath);
  const checks = [workspacePath];
  if (scriptDir) {
    const skillDir = path.dirname(scriptDir);
    const skillsDir = path.dirname(skillDir);
    checks.push(scriptDir, skillDir, skillsDir, path.dirname(skillsDir));
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
  const result = await runner('gcloud', ['auth', 'application-default', 'print-access-token'], { env });
  if (result.status !== 0) {
    throw new Error(`gcloud ADC token fetch failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(unsigned, privateKey) {
  return crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createServiceAccountAssertion(creds, now, signer = signJwt) {
  if (creds.type !== 'service_account' || !creds.client_email || !creds.private_key) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS must point to a service-account JSON with client_email and private_key');
  }
  const tokenUri = creds.token_uri || 'https://oauth2.googleapis.com/token';
  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: tokenUri,
    exp: issuedAt + 3600,
    iat: issuedAt,
  }));
  const unsigned = `${header}.${claims}`;
  return { assertion: `${unsigned}.${signer(unsigned, creds.private_key)}`, tokenUri };
}

async function serviceAccountAccessToken(env, httpClient, now, signer) {
  const credPath = path.resolve(env.GOOGLE_APPLICATION_CREDENTIALS);
  const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
  const { assertion, tokenUri } = createServiceAccountAssertion(creds, now, signer);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  }).toString();
  const res = await httpClient.request(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Google service-account token response did not include access_token');
  return data.access_token;
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
        : ctx.env.GOOGLE_APPLICATION_CREDENTIALS
          ? await serviceAccountAccessToken(ctx.env, ctx.httpClient, ctx.now || new Date(), ctx.signJwt)
          : await defaultAccessToken(ctx.env, ctx.runner);
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
