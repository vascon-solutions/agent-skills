#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

class UsageError extends Error {}

const modes = new Set(["focused", "journey", "rollout"]);
const timestampPattern = /^\d{8}T\d{6}Z$/;

function takeValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value) throw new UsageError(`${flag} requires a value.`);
  return value;
}

export function parseArgs(argv, homeDir = os.homedir()) {
  const values = {
    artifactRoot: path.join(homeDir, "agent-artifacts", "ui-audits"),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (["--feature", "--mode", "--artifact-root", "--tested-repo", "--timestamp"].includes(flag)) {
      const value = takeValue(argv, index, flag);
      const key = {
        "--feature": "feature",
        "--mode": "mode",
        "--artifact-root": "artifactRoot",
        "--tested-repo": "testedRepo",
        "--timestamp": "timestamp",
      }[flag];
      if (values[key] !== undefined && !["artifactRoot"].includes(key)) {
        throw new UsageError(`${flag} may be supplied only once.`);
      }
      values[key] = value;
      index += 1;
      continue;
    }
    throw new UsageError("Unknown workspace initializer argument.");
  }
  if (!values.feature?.trim()) throw new UsageError("--feature is required.");
  if (!modes.has(values.mode)) throw new UsageError("--mode must be focused, journey, or rollout.");
  if (values.timestamp && !isValidTimestamp(values.timestamp)) {
    throw new UsageError("--timestamp must be a valid UTC YYYYMMDDTHHMMSSZ value.");
  }
  return values;
}

export function slugify(value, fallback = "ui-audit") {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

export function isValidTimestamp(value) {
  if (!timestampPattern.test(value)) return false;
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`;
  const date = new Date(iso);
  return !Number.isNaN(date.valueOf()) && date.toISOString().replace(/[-:]/g, "").replace(".000", "") === value;
}

export function utcTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function nearestExistingAncestor(target) {
  let current = path.resolve(target);
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) throw new Error("No existing ancestor found.");
    current = parent;
  }
  return current;
}

export function canonicalFuturePath(target) {
  const absolute = path.resolve(target);
  const ancestor = nearestExistingAncestor(absolute);
  const canonicalAncestor = fs.realpathSync(ancestor);
  return path.resolve(canonicalAncestor, path.relative(ancestor, absolute));
}

function containsPath(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

export function assertWorkspaceSafe(workspace, testedRepo) {
  if (!testedRepo) return;
  if (!fs.existsSync(testedRepo)) throw new UsageError("--tested-repo must exist.");
  const canonicalRepo = fs.realpathSync(testedRepo);
  const canonicalWorkspace = canonicalFuturePath(workspace);
  if (containsPath(canonicalRepo, canonicalWorkspace) || containsPath(canonicalWorkspace, canonicalRepo)) {
    throw new UsageError("Unsafe artifact workspace overlaps the tested repository.");
  }
}

function collisionSafePath(basePath) {
  if (!fs.existsSync(basePath)) return basePath;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${basePath}-${suffix}`;
    if (!fs.existsSync(candidate)) return candidate;
  }
}

function templatePath(name) {
  return fileURLToPath(new URL(`../assets/templates/${name}`, import.meta.url));
}

export function initializeWorkspace(config) {
  const featureSlug = slugify(config.feature);
  const timestamp = config.timestamp ?? utcTimestamp();
  const planned = path.resolve(config.artifactRoot, featureSlug, timestamp);
  const workspace = collisionSafePath(planned);
  assertWorkspaceSafe(workspace, config.testedRepo);

  try {
    fs.mkdirSync(path.dirname(workspace), { recursive: true });
    fs.mkdirSync(workspace, { recursive: false });
    for (const directory of ["screenshots", "traces", "downloads", "logs"]) {
      fs.mkdirSync(path.join(workspace, directory));
    }
    fs.copyFileSync(templatePath("audit-brief.md"), path.join(workspace, "audit-brief.md"));
    fs.copyFileSync(templatePath("report.md"), path.join(workspace, "report.md"));
  } catch (error) {
    if (fs.existsSync(workspace)) fs.rmSync(workspace, { recursive: true, force: true });
    throw error;
  }

  return { workspace, featureSlug, mode: config.mode, timestamp };
}

export async function runCli(argv, dependencies = {}) {
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  const initialize = dependencies.initializeWorkspace ?? initializeWorkspace;
  try {
    const config = parseArgs(argv, dependencies.homeDir ?? os.homedir());
    const result = await initialize(config);
    stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      stderr.write(`Invalid audit workspace input: ${error.message}\n`);
      return 2;
    }
    stderr.write("Audit workspace initialization failure prevented a valid result.\n");
    return 3;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await runCli(process.argv.slice(2));
}
