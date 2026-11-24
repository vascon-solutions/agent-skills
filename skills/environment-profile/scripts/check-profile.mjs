#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_SECTIONS = [
  "Purpose and status",
  "Origins",
  "Build confirmation",
  "Accounts and personas",
  "Credential references",
  "Sessions",
  "Mail sandbox",
  "Data facts",
  "Domain traps",
  "Allowed changes",
  "Playbook",
  "Brief template",
  "Changelog",
];

const PROFILE_VERSION = "1";
const REQUIRED_FRONT_MATTER = ["env-profile", "project", "environment", "classification", "last-verified", "verified-by"];
const CLASSIFICATIONS = new Set(["test", "staging"]);
const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const BENIGN_PREFIX = /^(local-file:|repo-doc:|vault:|ask:|https?:\/\/|[<${(.\/~-]|…)/;
const LOCAL_HOST = /^(localhost|[\w-]+\.localhost|127(\.\d{1,3}){3}|\[::1\])$/;
const KEY_NAME =
  /^([a-z][A-Za-z0-9]*(Password|Secret|Token|User|Key)|[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*[_-](password|secret|token|user|key)|[A-Z][A-Z0-9_]+)$/;

const LINE_RULES = [
  { name: "jwt", pattern: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
  { name: "bearer-token", pattern: /\bBearer\s+(?![<${])[A-Za-z0-9._~+/-]{16,}/ },
  { name: "url-credentials", pattern: /[a-z][a-z0-9+.-]*:\/\/(?![<$])[^\s/:@`'"]+:(?![<$])[^\s/@`'"]+@/i },
  { name: "query-secret", pattern: /[?&](token|access_token|code|key|signature|sig)=(?![<$])[A-Za-z0-9._-]{8,}/i },
  { name: "private-key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "provider-key", pattern: /\b(AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/ },
];

const QUOTED_ASSIGNMENT =
  /\b(password|passwd|pwd|secret|api[_ -]?key|token|basic[- ]auth)\b[`"']?[^\n`"':=]{0,40}?(?:[:=]|\bis\b|\buses?\b|\bwith\b)\s*[`"']([^`"'\n]{4,})[`"']/gi;
const PLAIN_ASSIGNMENT =
  /\b(password|passwd|pwd|secret|api[_ -]?key|token)\b[`"'*]{0,3}\s*(?:[:=|]|\bis\b)\s*\**([^\s`"'|*]{6,})/gi;
const ENV_ASSIGNMENT = /\b([A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|API_KEY)[A-Z0-9_]*)=[`"']?([^\s`"';)]{4,})/g;
const NON_SECRET_SUFFIX = /_(TTL|EXPIRY|EXPIRES|EXPIRES_IN|EXPIRATION|LIFETIME|MAX_AGE|LENGTH|ALGORITHM|HEADER|NAME|FILE|PATH|URL|URI|ENDPOINT)$/;
const SECRET_COLUMN = /(^|\s)(password|passwd|pwd|secret|token|api[_ -]?key)s?$/i;

function isBenign(literal) {
  const value = literal.trim();
  return /\s/.test(value) || BENIGN_PREFIX.test(value) || KEY_NAME.test(value);
}

const looksGenerated = (value) => value.length >= 6 && /[A-Za-z]/.test(value) && /[\d!@#%^&*]/.test(value);
const isPlainSecret = (value) => looksGenerated(value) && !isBenign(value);
const tableCells = (line) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim().replace(/^[*`_]+|[*`_]+$/g, ""));

export function findSecretLike(text) {
  const found = new Map();
  const add = (line, rule) => found.set(`${line}:${rule}`, { line, rule });
  let secretColumns = null;
  text.split("\n").forEach((line, index) => {
    const number = index + 1;
    for (const rule of LINE_RULES) {
      if (rule.pattern.test(line)) add(number, rule.name);
    }
    for (const match of line.matchAll(QUOTED_ASSIGNMENT)) {
      if (!isBenign(match[2])) add(number, "credential-literal");
    }
    for (const match of line.matchAll(PLAIN_ASSIGNMENT)) {
      if (isPlainSecret(match[2].replace(/[.,;)]+$/, ""))) add(number, "credential-plain");
    }
    for (const match of line.matchAll(ENV_ASSIGNMENT)) {
      if (!NON_SECRET_SUFFIX.test(match[1]) && !isBenign(match[2])) add(number, "credential-assignment");
    }
    if (!/^\s*\|/.test(line)) {
      secretColumns = null;
    } else if (secretColumns === null) {
      secretColumns = tableCells(line).flatMap((cell, column) => (SECRET_COLUMN.test(cell) ? [column] : []));
    } else {
      const cells = tableCells(line);
      if (secretColumns.some((column) => isPlainSecret(cells[column] ?? ""))) add(number, "credential-column");
    }
  });
  return [...found.values()];
}

export function parseFrontMatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split("\n")) {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*(#.*)?$/);
    if (pair) fields[pair[1]] = pair[2].replace(/^["']|["']$/g, "");
  }
  return fields;
}

const normalizeHeading = (heading) =>
  heading
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export function checkProfile(text, { today = new Date(), maxAgeDays = 30 } = {}) {
  const errors = [];
  const warnings = [];

  const front = parseFrontMatter(text);
  if (!front) {
    errors.push({ rule: "front-matter", message: "missing front matter block at the top of the file" });
  } else {
    const isPlaceholder = (value) => /^<.*>$|YYYY/.test(value);
    for (const key of REQUIRED_FRONT_MATTER) {
      const value = front[key];
      if (!value) errors.push({ rule: "front-matter", message: `missing ${key}` });
      else if (isPlaceholder(value)) errors.push({ rule: "front-matter", message: `${key} is still a placeholder` });
    }
    const filled = (key) => front[key] && !isPlaceholder(front[key]);
    if (filled("env-profile") && front["env-profile"] !== PROFILE_VERSION) {
      errors.push({ rule: "front-matter", message: `env-profile must be ${PROFILE_VERSION}` });
    }
    for (const key of ["project", "environment"]) {
      if (filled(key) && !SLUG.test(front[key])) {
        errors.push({ rule: "front-matter", message: `${key} must be a slug of letters, digits, dots, dashes or underscores` });
      }
    }
    if (/^prod/i.test(front.environment ?? "") || /^prod/i.test(front.classification ?? "")) {
      errors.push({ rule: "production", message: "production environments are refused" });
    } else if (filled("classification") && !CLASSIFICATIONS.has(front.classification)) {
      errors.push({ rule: "front-matter", message: "classification must be test or staging" });
    }
    const verified = front["last-verified"];
    if (verified && /^\d{4}-\d{2}-\d{2}$/.test(verified)) {
      const ageDays = Math.floor((today.getTime() - Date.parse(`${verified}T00:00:00Z`)) / 86_400_000);
      if (Number.isNaN(ageDays)) errors.push({ rule: "front-matter", message: "last-verified is not a real date" });
      else if (ageDays < -1) errors.push({ rule: "front-matter", message: "last-verified is in the future" });
      else if (ageDays > maxAgeDays) warnings.push({ rule: "stale", message: `last-verified is ${ageDays} days old` });
    } else if (verified && !isPlaceholder(verified)) {
      errors.push({ rule: "front-matter", message: "last-verified must be YYYY-MM-DD" });
    }
  }

  const body = text.replace(/```[\s\S]*?```/g, (block) => block.replace(/^#/gm, " "));
  const headings = [...body.matchAll(/^## (.+)$/gm)].map((match) => normalizeHeading(match[1]));
  let cursor = 0;
  for (const section of REQUIRED_SECTIONS) {
    const position = headings.indexOf(section.toLowerCase());
    if (position === -1) errors.push({ rule: "section", message: `missing section "## ${section}"` });
    else if (position < cursor) errors.push({ rule: "section", message: `section "## ${section}" is out of order` });
    else cursor = position;
  }

  text.split("\n").forEach((line, index) => {
    for (const match of line.matchAll(/\bhttp:\/\/(\[[^\]\s]*\]|[^\s/:)`'"]+)/g)) {
      const host = match[1].replace(/[.,;]+$/, "");
      if (!LOCAL_HOST.test(host) && !/^[<${]/.test(host)) {
        errors.push({ rule: "https", line: index + 1, message: "deployed origins must use https" });
      }
    }
  });

  for (const finding of findSecretLike(text)) {
    errors.push({ rule: finding.rule, line: finding.line, message: "looks like a secret value; use a credential reference" });
  }

  return { errors, warnings };
}

const isWeakValue = (value) => /^[a-z]+$/.test(value) && value.length < 12;
const METADATA_KEYS = new Set(["note", "sources", "project", "environment", "created", "updated"]);
const isCredentialValue = (value) => typeof value === "string" && value.length >= 4;

export const credentialEntries = (values) =>
  Object.entries(values).filter(([key, value]) => !METADATA_KEYS.has(key) && isCredentialValue(value));

const uncheckedKeys = (values) =>
  Object.keys(values).filter((key) => !METADATA_KEYS.has(key) && !isCredentialValue(values[key]));

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

export function scanFolder(dir, values, { includeWeak = false, maxBytes = 50 * 1024 * 1024 } = {}) {
  const findings = [];
  const skipped = [];
  const oversized = [];
  const needles = [];
  const entries = credentialEntries(values);
  for (const [key, value] of entries) {
    if (!includeWeak && isWeakValue(value)) {
      skipped.push(key);
      continue;
    }
    const forms = new Set([value, encodeURIComponent(value)]);
    needles.push({ key, buffers: [...forms].map((form) => Buffer.from(form)) });
  }
  for (const [userKey, user] of entries) {
    for (const [passwordKey, password] of entries) {
      if (userKey === passwordKey) continue;
      const header = Buffer.from(`${user}:${password}`).toString("base64");
      needles.push({ key: `basic-auth:${userKey}+${passwordKey}`, buffers: [Buffer.from(header)] });
    }
  }
  for (const file of walk(dir)) {
    const relative = path.relative(dir, file);
    if (fs.statSync(file).size > maxBytes) {
      oversized.push(relative);
      continue;
    }
    const content = fs.readFileSync(file);
    for (const { key, buffers } of needles) {
      let count = 0;
      for (const buffer of buffers) {
        for (let at = content.indexOf(buffer); at !== -1; at = content.indexOf(buffer, at + 1)) count += 1;
      }
      if (count) findings.push({ file: relative, key, count });
    }
    const text = content.toString("latin1");
    for (const rule of LINE_RULES.filter((candidate) => ["jwt", "url-credentials"].includes(candidate.name))) {
      const count = (text.match(new RegExp(rule.pattern.source, `${rule.pattern.flags.replace("g", "")}g`)) ?? []).length;
      if (count) findings.push({ file: relative, key: `pattern:${rule.name}`, count });
    }
  }
  return { findings, skipped, oversized };
}

function readValues(file) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(error.code === "ENOENT" ? `--values file not found: ${file}` : `--values file is not readable JSON: ${file}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`--values file must hold one JSON object: ${file}`);
  }
  return parsed;
}

function usage() {
  return [
    "Usage:",
    "  check-profile.mjs profile <profile.md> [--max-age-days N] [--values <credentials.json>]",
    "  check-profile.mjs scan <folder> --values <credentials.json> [--include-weak]",
    "Exit codes: 0 clean, 1 finding, 2 usage or read error.",
  ].join("\n");
}

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

export function main(argv = process.argv.slice(2), out = console) {
  const [mode, target] = argv;
  if (!mode || !target || !["profile", "scan"].includes(mode)) {
    out.error(usage());
    return 2;
  }
  const valuesPath = option(argv, "--values");
  if (argv.includes("--values") && !valuesPath) {
    out.error("--values needs a path");
    return 2;
  }
  let values = null;
  if (valuesPath) {
    try {
      values = readValues(valuesPath);
    } catch (error) {
      out.error(error.message);
      return 2;
    }
    for (const key of uncheckedKeys(values)) out.log(`SKIP ${key}: not a string of 4 or more characters, so it is not checked`);
  }

  if (mode === "profile") {
    let text;
    try {
      text = fs.readFileSync(target, "utf8");
    } catch {
      out.error(`cannot read profile: ${target}`);
      return 2;
    }
    const maxAgeDays = Number(option(argv, "--max-age-days") ?? 30);
    const { errors, warnings } = checkProfile(text, { maxAgeDays });
    if (values) {
      for (const [key, value] of credentialEntries(values)) {
        if (!isWeakValue(value) && text.includes(value)) {
          errors.push({ rule: "credential-value", message: `contains the value of key ${key}` });
        }
      }
    }
    for (const warning of warnings) out.log(`WARN ${target} ${warning.rule}: ${warning.message}`);
    for (const error of errors) {
      out.log(`ERROR ${target}${error.line ? `:${error.line}` : ""} ${error.rule}: ${error.message}`);
    }
    if (!errors.length) out.log(`OK ${target}`);
    return errors.length ? 1 : 0;
  }

  if (!values) {
    out.error("scan needs --values <credentials.json>");
    return 2;
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    out.error(`scan target is not a folder: ${target}`);
    return 2;
  }
  const { findings, skipped, oversized } = scanFolder(target, values, { includeWeak: argv.includes("--include-weak") });
  for (const key of skipped) out.log(`SKIP ${key}: value is a short common word; rerun with --include-weak to count it`);
  for (const file of oversized) out.log(`SKIP ${file}: larger than 50 MB, so it was not scanned`);
  for (const finding of findings) out.log(`FOUND ${finding.file} ${finding.key} x${finding.count}`);
  if (!findings.length) out.log(`OK ${target}`);
  return findings.length ? 1 : 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = main();
}
