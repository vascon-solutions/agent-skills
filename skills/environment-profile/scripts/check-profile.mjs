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

const REQUIRED_FRONT_MATTER = ["env-profile", "project", "environment", "classification", "last-verified", "verified-by"];
const CLASSIFICATIONS = new Set(["test", "staging"]);
const REFERENCE_PREFIX = /^(local-file:|repo-doc:|vault:|ask:|<|\$|~\/|jq\b|\.\.\.|…)/;
const KEY_NAME = /^([a-z][A-Za-z0-9]*(Password|Secret|Token|User|Key)|[A-Z][A-Z0-9_]+)$/;

const LINE_RULES = [
  { name: "jwt", pattern: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
  { name: "bearer-token", pattern: /\bBearer\s+(?![<${])[A-Za-z0-9._~+/-]{16,}/ },
  { name: "url-credentials", pattern: /[a-z][a-z0-9+.-]*:\/\/(?![<$])[^\s/:@`'"]+:(?![<$])[^\s/@`'"]+@/i },
  { name: "query-secret", pattern: /[?&](token|access_token|code|key|signature|sig)=(?![<$])[A-Za-z0-9._-]{8,}/i },
  { name: "private-key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "provider-key", pattern: /\b(AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/ },
];

const QUOTED_ASSIGNMENT =
  /\b(password|passwd|pwd|secret|api[_-]?key|token|basic[- ]auth)\b[^\n`"']{0,40}?(?:[:=]|\bis\b|\buses?\b|\bwith\b)\s*[`"']([^`"'\n]{4,})[`"']/gi;
const BARE_ASSIGNMENT = /\b[A-Z0-9_]*(PASSWORD|PASSWD|SECRET|TOKEN|API_KEY)[A-Z0-9_]*=(?![`"'$<{(\s])([^\s`"';)]{4,})/g;

function isReference(literal) {
  const value = literal.trim();
  return REFERENCE_PREFIX.test(value) || KEY_NAME.test(value) || /^\$\(/.test(value);
}

export function findSecretLike(text) {
  const findings = [];
  text.split("\n").forEach((line, index) => {
    for (const rule of LINE_RULES) {
      if (rule.pattern.test(line)) findings.push({ line: index + 1, rule: rule.name });
    }
    for (const match of line.matchAll(QUOTED_ASSIGNMENT)) {
      if (!isReference(match[2])) findings.push({ line: index + 1, rule: "credential-literal" });
    }
    for (const match of line.matchAll(BARE_ASSIGNMENT)) {
      if (!isReference(match[2])) findings.push({ line: index + 1, rule: "credential-assignment" });
    }
  });
  return findings;
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
    for (const key of REQUIRED_FRONT_MATTER) {
      const value = front[key];
      if (!value) errors.push({ rule: "front-matter", message: `missing ${key}` });
      else if (/^<.*>$|YYYY/.test(value)) errors.push({ rule: "front-matter", message: `${key} is still a placeholder` });
    }
    if (/^prod/i.test(front.environment ?? "") || /^prod/i.test(front.classification ?? "")) {
      errors.push({ rule: "production", message: "production environments are refused" });
    } else if (front.classification && !CLASSIFICATIONS.has(front.classification)) {
      errors.push({ rule: "front-matter", message: "classification must be test or staging" });
    }
    const verified = front["last-verified"];
    if (verified && /^\d{4}-\d{2}-\d{2}$/.test(verified)) {
      const ageDays = Math.floor((today.getTime() - Date.parse(`${verified}T00:00:00Z`)) / 86_400_000);
      if (ageDays > maxAgeDays) warnings.push({ rule: "stale", message: `last-verified is ${ageDays} days old` });
    } else if (verified && !/YYYY/.test(verified)) {
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
    for (const match of line.matchAll(/\bhttp:\/\/([^\s/:)`'"]+)/g)) {
      if (!/^(localhost|127\.0\.0\.1|\[::1\]|<)/.test(match[1])) {
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

export const credentialEntries = (values) =>
  Object.entries(values).filter(([key, value]) => !METADATA_KEYS.has(key) && typeof value === "string" && value.length >= 4);

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
  const needles = [];
  for (const [key, value] of credentialEntries(values)) {
    if (!includeWeak && isWeakValue(value)) {
      skipped.push(key);
      continue;
    }
    const forms = new Set([value, encodeURIComponent(value)]);
    needles.push({ key, buffers: [...forms].map((form) => Buffer.from(form)) });
  }
  for (const file of walk(dir)) {
    const stat = fs.statSync(file);
    if (stat.size > maxBytes) continue;
    const content = fs.readFileSync(file);
    const relative = path.relative(dir, file);
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
  return { findings, skipped };
}

function usage() {
  return [
    "Usage:",
    "  check-profile.mjs profile <profile.md> [--max-age-days N] [--values <credentials.json>]",
    "  check-profile.mjs scan <folder> --values <credentials.json> [--include-weak]",
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
  const values = valuesPath ? JSON.parse(fs.readFileSync(valuesPath, "utf8")) : null;

  if (mode === "profile") {
    const text = fs.readFileSync(target, "utf8");
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
  const { findings, skipped } = scanFolder(target, values, { includeWeak: argv.includes("--include-weak") });
  for (const key of skipped) out.log(`SKIP ${key}: value is a short common word; rerun with --include-weak to count it`);
  for (const finding of findings) out.log(`FOUND ${finding.file} ${finding.key} x${finding.count}`);
  if (!findings.length) out.log(`OK ${target}`);
  return findings.length ? 1 : 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = main();
}
