const fs = require('fs');
const path = require('path');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico']);

const SECRET_PATTERNS = [
  ['AWS access key ID', /AKIA[0-9A-Z]{16}/g],
  ['AWS secret access key assignment', /aws_secret_access_key\s*=\s*['"]?[A-Za-z0-9/+=]{40}['"]?/gi],
  ['GitHub personal access token', /ghp_[A-Za-z0-9]{36}/g],
  ['GitHub fine-grained personal access token', /github_pat_[A-Za-z0-9_]{82}/g],
  ['GitHub server-to-server token', /ghs_[A-Za-z0-9]{36}/g],
  ['GitHub OAuth token', /gho_[A-Za-z0-9]{36}/g],
  ['GitHub user-to-server token', /ghu_[A-Za-z0-9]{36}/g],
  ['Anthropic API key', /sk-ant-[A-Za-z0-9_-]{32,}/g],
  ['OpenAI-style API key', /sk-[A-Za-z0-9]{32,}/g],
  ['Slack token', /xox[abpr]-[A-Za-z0-9-]+/g],
  ['JWT', /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g],
  ['private key', /-----BEGIN (RSA |EC |DSA |OPENSSH |ENCRYPTED |)PRIVATE KEY-----/g],
  ['ClickUp personal API token', /pk_\d+_[A-Z0-9]{32}/g],
  ['Google API key', /AIza[0-9A-Za-z\-_]{35}/g],
  ['Service account JSON', /"type"\s*:\s*"service_account"/g],
];

function scanSecrets(files, workspacePath) {
  const matches = [];
  for (const file of files) {
    const ext = path.extname(file.relativePath).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) continue;
    const content = fs.readFileSync(path.join(workspacePath, file.relativePath), 'utf8');
    for (const [patternName, pattern] of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        matches.push({ relativePath: file.relativePath, pattern: patternName });
      }
    }
  }
  return matches;
}

module.exports = { IMAGE_EXTENSIONS, SECRET_PATTERNS, scanSecrets };
