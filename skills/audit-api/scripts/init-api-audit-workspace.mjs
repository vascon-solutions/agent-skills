#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

class UsageError extends Error {}
const modes = new Set(["focused", "journey", "rollout"]);
const timestampPattern = /^\d{8}T\d{6}Z$/;

export function parseArgs(argv, homeDir = os.homedir()) {
  const values = { artifactRoot: path.join(homeDir, "agent-artifacts", "api-audits") };
  const keys = { "--feature": "feature", "--mode": "mode", "--artifact-root": "artifactRoot", "--tested-repo": "testedRepo", "--timestamp": "timestamp" };
  const supplied = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]; const key = keys[flag]; const value = argv[index + 1];
    if (!key || !value) throw new UsageError("Unknown workspace initializer argument.");
    if (supplied.has(key)) throw new UsageError(`${flag} may be supplied only once.`);
    supplied.add(key); values[key] = value; index += 1;
  }
  if (!values.feature?.trim()) throw new UsageError("--feature is required.");
  if (!modes.has(values.mode)) throw new UsageError("--mode must be focused, journey, or rollout.");
  if (values.timestamp && !isValidTimestamp(values.timestamp)) throw new UsageError("--timestamp must be a valid UTC YYYYMMDDTHHMMSSZ value.");
  return values;
}

export function slugify(value, fallback = "api-audit") {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

export function isValidTimestamp(value) {
  if (!timestampPattern.test(value)) return false;
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`;
  const date = new Date(iso);
  return !Number.isNaN(date.valueOf()) && date.toISOString().replace(/[-:]/g, "").replace(".000", "") === value;
}
const utcTimestamp = (date = new Date()) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function nearestExistingAncestor(target) {
  let current = path.resolve(target);
  while (!fs.existsSync(current)) { const parent = path.dirname(current); if (parent === current) throw new Error("No existing ancestor."); current = parent; }
  return current;
}
export function canonicalFuturePath(target) {
  const absolute = path.resolve(target); const ancestor = nearestExistingAncestor(absolute);
  return path.resolve(fs.realpathSync(ancestor), path.relative(ancestor, absolute));
}
const containsPath = (parent, child) => { const relative = path.relative(parent, child); return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)); };
export function assertWorkspaceSafe(workspace, testedRepo) {
  if (!testedRepo) return;
  if (!fs.existsSync(testedRepo)) throw new UsageError("--tested-repo must exist.");
  const repo = fs.realpathSync(testedRepo); const future = canonicalFuturePath(workspace);
  if (containsPath(repo, future) || containsPath(future, repo)) throw new UsageError("Unsafe artifact workspace overlaps the tested repository.");
}
function collisionSafePath(base) { if (!fs.existsSync(base)) return base; for (let suffix = 2; ; suffix += 1) if (!fs.existsSync(`${base}-${suffix}`)) return `${base}-${suffix}`; }
const templatePath = (name) => fileURLToPath(new URL(`../assets/templates/${name}`, import.meta.url));

export function initializeWorkspace(config) {
  const featureSlug = slugify(config.feature); const timestamp = config.timestamp ?? utcTimestamp();
  const workspace = collisionSafePath(path.resolve(config.artifactRoot, featureSlug, timestamp));
  assertWorkspaceSafe(workspace, config.testedRepo);
  try {
    fs.mkdirSync(path.dirname(workspace), { recursive: true }); fs.mkdirSync(workspace);
    for (const directory of ["contracts", "scenarios", "evidence", "logs"]) fs.mkdirSync(path.join(workspace, directory));
    fs.copyFileSync(templatePath("audit-brief.md"), path.join(workspace, "audit-brief.md"));
    fs.copyFileSync(templatePath("report.md"), path.join(workspace, "report.md"));
  } catch (error) { if (fs.existsSync(workspace)) fs.rmSync(workspace, { recursive: true, force: true }); throw error; }
  return { workspace, featureSlug, mode: config.mode, timestamp };
}

export async function runCli(argv, dependencies = {}) {
  const stdout = dependencies.stdout ?? process.stdout; const stderr = dependencies.stderr ?? process.stderr;
  try { const result = await (dependencies.initializeWorkspace ?? initializeWorkspace)(parseArgs(argv, dependencies.homeDir ?? os.homedir())); stdout.write(`${JSON.stringify(result)}\n`); return 0; }
  catch (error) { if (error instanceof UsageError) { stderr.write(`Invalid API audit workspace input: ${error.message}\n`); return 2; } stderr.write("API audit workspace initialization failure prevented a valid result.\n"); return 3; }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = await runCli(process.argv.slice(2));
