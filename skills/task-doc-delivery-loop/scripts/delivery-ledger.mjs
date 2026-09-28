#!/usr/bin/env node
// Delivery ledger helper, schema_version 1. The contract is
// ../references/delivery-ledger.md; the structure is
// ../references/delivery-ledger.schema.json, which this file loads and
// enforces. Dependency-free by design so every runtime can run it.
import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(SCRIPT_DIR, "..", "references", "delivery-ledger.schema.json");
const EXCLUDE_RULE = "/.agent/deliveries/";
const LEDGER_DIR = [".agent", "deliveries"];
const HOSTILE_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const COLLECTIONS = ["validation", "audits", "reviews", "defect_shapes", "publications", "role_runs", "sessions", "limitations"];
const QUALIFIED_COLLECTIONS = ["validation", "audits", "reviews", "publications", "role_runs", "sessions"];
const ACTIVE_PHASES = ["delivery", "review_round", "watch"];
const CHECKPOINTS = ["bootstrap", "implement", "validate", "audit", "review", "publish", null];
const ENDPOINTS = ["local", "commit", "push", "draft_pr", "ready_pr"];
const PUSH_ENDPOINTS = new Set(["push", "draft_pr", "ready_pr"]);
const PR_ENDPOINTS = new Set(["draft_pr", "ready_pr"]);
const COMMITTED_ENDPOINTS = new Set(["commit", "push", "draft_pr", "ready_pr"]);
const TERMINAL_STEPS = new Set(["verified", "failed"]);
const INDEPENDENT_REVIEW_SOURCES = new Set(["delegated", "codex-bot", "human"]);
const INDEPENDENCE_REQUIRED = "independence_required";
const RECEIPT_ADAPTER = "ncdmb-validation-receipt-v1";

const EXIT_BY_CODE = {
  argument_error: 1,
  environment_error: 1,
  io_error: 1,
  network_error: 1,
  json_error: 2,
  schema_error: 2,
  invariant_error: 2,
  mutex_held: 3,
  owner_conflict: 3,
  stale_revision: 3,
  claim_mismatch: 3,
  recovery_guard_held: 3,
  identity_mismatch: 4,
};

export class LedgerError extends Error {
  constructor(code, message, { path: errorPath = null, id = null, expected = null, observed = null } = {}) {
    super(message);
    if (!(code in EXIT_BY_CODE)) {
      throw new Error(`unknown error code ${code}`);
    }
    this.code = code;
    this.path = errorPath;
    this.id = id;
    this.expected = expected;
    this.observed = observed;
  }
}

const fail = (code, message, details) => {
  throw new LedgerError(code, message, details);
};

// ---------------------------------------------------------------------------
// Small utilities

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const now = () => new Date().toISOString();
const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function branchKey(branch) {
  return sha256(Buffer.from(branch, "utf8"));
}

function rejectHostileKeys(value, where = "") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectHostileKeys(item, `${where}/${index}`));
  } else if (isObject(value)) {
    for (const key of Object.keys(value)) {
      if (HOSTILE_KEYS.has(key)) {
        fail("schema_error", `hostile key ${JSON.stringify(key)} is not allowed`, { path: `${where}/${key}` });
      }
      rejectHostileKeys(value[key], `${where}/${key}`);
    }
  }
}

function parseJson(text, where) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    fail("json_error", `${where} is not valid JSON: ${error.message}`, { path: where });
  }
  rejectHostileKeys(value);
  return value;
}

function readJsonFile(file, label) {
  requireAbsolute(file, label);
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    fail("io_error", `cannot read ${label}: ${error.code ?? error.message}`, { path: file });
  }
  return parseJson(text, file);
}

function requireAbsolute(file, label) {
  if (typeof file !== "string" || !path.isAbsolute(file) || file.includes("\0")) {
    fail("argument_error", `${label} must be an absolute path`, { path: typeof file === "string" ? file : null });
  }
}

function hashFile(file) {
  return sha256(fs.readFileSync(file));
}

function sourceFor(file) {
  requireAbsolute(file, "source path");
  let stat;
  try {
    stat = fs.statSync(file);
  } catch (error) {
    fail("io_error", `source file is unreadable: ${error.code ?? error.message}`, { path: file });
  }
  if (!stat.isFile()) {
    fail("argument_error", "source path is not a regular file", { path: file });
  }
  return { path: file, sha256: hashFile(file) };
}

function currentHash(file) {
  try {
    return hashFile(file);
  } catch {
    return null;
  }
}

function verifySourceHash(source, label) {
  const observed = currentHash(source.path);
  if (observed !== source.sha256) {
    fail("identity_mismatch", `${label} hash does not match the file`, {
      path: source.path,
      expected: source.sha256,
      observed,
    });
  }
}

// Deterministic tree identity for dependency build output: sorted relative
// paths, raw file bytes, and link targets (never followed).
function hashTree(root) {
  const entries = [];
  const walk = (dir, rel) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const relPath = rel ? `${rel}/${name}` : name;
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) {
        entries.push(`L\0${relPath}\0${sha256(fs.readlinkSync(full, { encoding: "buffer" }))}`);
      } else if (stat.isDirectory()) {
        walk(full, relPath);
      } else if (stat.isFile()) {
        entries.push(`F\0${relPath}\0${hashFile(full)}`);
      }
    }
  };
  walk(root, "");
  return sha256(entries.join("\n"));
}

function outputHash(target) {
  try {
    const stat = fs.statSync(target);
    return stat.isDirectory() ? hashTree(target) : hashFile(target);
  } catch {
    return null;
  }
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Test-only fault injection, inert unless DELIVERY_LEDGER_TEST_HOOKS=1.
function testHook(point) {
  if (process.env.DELIVERY_LEDGER_TEST_HOOKS !== "1") {
    return;
  }
  const barrier = process.env.DELIVERY_LEDGER_TEST_BARRIER;
  if (point === "before-lock" && barrier) {
    const deadline = Date.now() + 15_000;
    while (!fs.existsSync(barrier) && Date.now() < deadline) {
      sleepMs(5);
    }
  }
  if (point === "locked" && process.env.DELIVERY_LEDGER_TEST_HOLD_MS) {
    sleepMs(Number(process.env.DELIVERY_LEDGER_TEST_HOLD_MS));
  }
  if (process.env.DELIVERY_LEDGER_TEST_CRASH === point) {
    process.kill(process.pid, "SIGKILL");
  }
}

// ---------------------------------------------------------------------------
// Schema subset interpreter for delivery-ledger.schema.json

let schemaCache = null;
function loadSchema() {
  if (!schemaCache) {
    schemaCache = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  }
  return schemaCache;
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?Z$/;
function isTimestamp(value) {
  const match = TIMESTAMP.exec(value);
  if (!match) return false;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d && h < 24 && mi < 60 && s < 60;
}

function schemaErrors(value, schema, where, errors, root) {
  if (errors.length >= 20) return;
  if (schema.$ref) {
    const name = schema.$ref.replace("#/$defs/", "");
    const target = root.$defs[name];
    if (!target) throw new Error(`schema reference ${schema.$ref} is undefined`);
    schemaErrors(value, target, where, errors, root);
    return;
  }
  if (hasOwn(schema, "const") && !isDeepStrictEqual(value, schema.const)) {
    errors.push(`${where || "/"}: must equal ${JSON.stringify(schema.const)}`);
    return;
  }
  if (schema.enum && !schema.enum.some((option) => option === value)) {
    errors.push(`${where || "/"}: must be one of ${schema.enum.map((option) => JSON.stringify(option)).join(", ")}`);
    return;
  }
  if (schema.type) {
    const types = [].concat(schema.type);
    const actual = typeOf(value);
    const ok = types.includes(actual) || (actual === "integer" && types.includes("number"));
    if (!ok) {
      errors.push(`${where || "/"}: expected ${types.join(" or ")}, got ${actual}`);
      return;
    }
    if (actual === "number" && !Number.isFinite(value)) {
      errors.push(`${where || "/"}: must be finite`);
      return;
    }
    if (actual === "integer" && !Number.isSafeInteger(value)) {
      errors.push(`${where || "/"}: must be a safe integer`);
      return;
    }
  }
  if (schema.anyOf) {
    const matched = schema.anyOf.some((branch) => {
      const branchErrors = [];
      schemaErrors(value, branch, where, branchErrors, root);
      return branchErrors.length === 0;
    });
    if (!matched) {
      const first = [];
      schemaErrors(value, schema.anyOf[schema.anyOf.length - 1], where, first, root);
      errors.push(first[0] ?? `${where || "/"}: matches no allowed shape`);
      return;
    }
  }
  if (schema.allOf) {
    for (const branch of schema.allOf) schemaErrors(value, branch, where, errors, root);
  }
  if (schema.if) {
    const conditionErrors = [];
    schemaErrors(value, schema.if, where, conditionErrors, root);
    if (conditionErrors.length === 0 && schema.then) schemaErrors(value, schema.then, where, errors, root);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${where}: must not be empty`);
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) errors.push(`${where}: does not match ${schema.pattern}`);
    if (schema.format === "date-time" && !isTimestamp(value)) errors.push(`${where}: must be a UTC RFC3339 timestamp`);
    if (schema.format === "absolute-path" && (!path.isAbsolute(value) || value.includes("\0"))) errors.push(`${where}: must be an absolute path`);
  }
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) {
    errors.push(`${where}: must be >= ${schema.minimum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${where}: needs at least ${schema.minItems} item(s)`);
    if (schema.items) value.forEach((item, index) => schemaErrors(item, schema.items, `${where}/${index}`, errors, root));
  }
  if (isObject(value)) {
    for (const key of schema.required ?? []) {
      if (!hasOwn(value, key)) errors.push(`${where}/${key}: is required`);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (hasOwn(value, key)) schemaErrors(value[key], sub, `${where}/${key}`, errors, root);
    }
  }
}

export function validateShape(value, defName = null) {
  const root = loadSchema();
  const schema = defName ? root.$defs[defName] : root;
  const errors = [];
  schemaErrors(value, schema, "", errors, root);
  return errors;
}

function requireShape(value, defName, label) {
  const errors = validateShape(value, defName);
  if (errors.length > 0) {
    fail("schema_error", `${label} is schema-invalid: ${errors.slice(0, 5).join("; ")}`, { observed: errors.slice(0, 20) });
  }
}

function requireExactKeys(value, keys, label) {
  if (!isObject(value)) fail("schema_error", `${label} must be a JSON object`);
  const extra = Object.keys(value).filter((key) => !keys.includes(key));
  const missing = keys.filter((key) => !hasOwn(value, key));
  if (extra.length > 0 || missing.length > 0) {
    fail("schema_error", `${label} has missing or unknown keys`, { expected: keys, observed: { missing, extra } });
  }
}

// ---------------------------------------------------------------------------
// Git

function git(cwd, args, { allowFail = false, buffer = false } = {}) {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    encoding: buffer ? "buffer" : "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) {
    fail("environment_error", `git is unavailable: ${result.error.message}`);
  }
  if (result.status !== 0 && !allowFail) {
    const stderr = buffer ? result.stderr.toString("utf8") : result.stderr;
    fail("environment_error", `git ${args[0]} failed: ${stderr.trim().split("\n")[0]}`);
  }
  return buffer ? result : { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const gitOut = (cwd, args) => git(cwd, args).stdout.trim();

function gitOk(cwd, args) {
  return git(cwd, args, { allowFail: true }).status === 0;
}

function resolveCommit(cwd, ref) {
  const result = git(cwd, ["rev-parse", "--verify", "--quiet", "--end-of-options", `${ref}^{commit}`], { allowFail: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

function isAncestor(cwd, ancestor, descendant) {
  const result = git(cwd, ["merge-base", "--is-ancestor", ancestor, descendant], { allowFail: true });
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  fail("environment_error", `cannot compare ${ancestor} and ${descendant}`);
}

function splitNul(buffer) {
  const parts = [];
  let start = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] === 0) {
      parts.push(buffer.subarray(start, index));
      start = index + 1;
    }
  }
  if (start < buffer.length) parts.push(buffer.subarray(start));
  return parts;
}

function decodePath(bytes) {
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    fail("invariant_error", "unsupported non-UTF-8 path in the worktree", { observed: bytes.toString("hex") });
  }
  return text;
}

function currentBranch(worktree) {
  const result = git(worktree, ["symbolic-ref", "--quiet", "HEAD"], { allowFail: true });
  if (result.status !== 0) return null;
  const ref = result.stdout.trim();
  return ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : null;
}

function headOid(worktree) {
  return resolveCommit(worktree, "HEAD");
}

function worktreesWithBranch(worktree, branch) {
  const out = git(worktree, ["worktree", "list", "--porcelain", "-z"], { buffer: true }).stdout;
  const matches = [];
  let current = null;
  for (const field of splitNul(out)) {
    const text = field.toString("utf8");
    if (text.startsWith("worktree ")) current = text.slice("worktree ".length);
    if (text === `branch refs/heads/${branch}` && current) matches.push(current);
  }
  return matches;
}

// Porcelain v1 -z status; the ledger directory is ignored so never appears.
function statusEntries(worktree) {
  const out = git(worktree, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--no-renames"], { buffer: true }).stdout;
  return splitNul(out)
    .filter((entry) => entry.length > 3)
    .map((entry) => ({ code: entry.subarray(0, 2).toString("utf8"), path: decodePath(entry.subarray(3)) }));
}

function summarizeStatus(worktree) {
  const entries = statusEntries(worktree);
  const unmerged = entries.filter(({ code }) => /U/.test(code) || code === "AA" || code === "DD").map(({ path: p }) => p);
  const untracked = entries.filter(({ code }) => code === "??").map(({ path: p }) => p);
  const tracked = entries.filter(({ code }) => code !== "??" && code !== "!!").map(({ path: p }) => p);
  return { unmerged, untracked, tracked };
}

function gitObjectFormatLength(worktree) {
  const result = git(worktree, ["rev-parse", "--show-object-format"], { allowFail: true });
  return result.status === 0 && result.stdout.trim() === "sha256" ? 64 : 40;
}

function configuredRemoteUrl(worktree, remoteName) {
  const result = git(worktree, ["config", "--get", `remote.${remoteName}.url`], { allowFail: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

// Live read of one remote ref. Never fetches or updates tracking refs.
function lsRemote(worktree, remoteName, ref) {
  const result = spawnSync("git", ["-C", worktree, "ls-remote", "--refs", "--", remoteName, ref], {
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
  });
  if (result.error || result.status !== 0) {
    return { ok: false, error: (result.stderr || result.error?.message || "ls-remote failed").trim().split("\n")[0] };
  }
  const line = result.stdout.split("\n").find((entry) => entry.endsWith(`\t${ref}`));
  return { ok: true, oid: line ? line.split("\t")[0] : null };
}

function baseBranchName(ledger) {
  const ref = ledger.repo.base_ref;
  const remote = ledger.repo.remote_name;
  if (ref.startsWith("refs/remotes/") && remote && ref.startsWith(`refs/remotes/${remote}/`)) return ref.slice(`refs/remotes/${remote}/`.length);
  if (ref.startsWith("refs/heads/")) return ref.slice("refs/heads/".length);
  if (remote && ref.startsWith(`${remote}/`)) return ref.slice(remote.length + 1);
  return ref;
}

const destinationRef = (ledger) => `refs/heads/${ledger.candidate.branch}`;
const githubRepository = (github) => (github ? `${github.owner}/${github.name}` : null);

// ---------------------------------------------------------------------------
// Argument parsing

const SELECTION = { repo: "string", branch: "string", ledger: "string" };
const OWNED = { runtime: "string", session: "string", "claim-id": "string", "expected-revision": "string" };
const OWNED_REQUIRED = ["runtime", "session", "claim-id", "expected-revision"];

const COMMANDS = {
  path: { flags: SELECTION },
  "prepare-init": {
    flags: { repo: "string", branch: "string", endpoint: "string", brief: "string", "output-dir": "string", remote: "string", "no-remote": "boolean", "github-host": "string", instruction: "repeat", "skill-source": "repeat", "same-session": "boolean" },
    required: ["repo", "endpoint", "brief", "output-dir"],
  },
  init: {
    flags: {
      repo: "string",
      branch: "string",
      runtime: "string",
      session: "string",
      model: "string",
      "task-doc": "repeat",
      spec: "repeat",
      base: "string",
      endpoint: "string",
      "authorization-file": "string",
      "bootstrap-file": "string",
    },
    required: ["repo", "runtime", "session", "task-doc", "base", "endpoint", "authorization-file", "bootstrap-file"],
  },
  show: { flags: { ...SELECTION, field: "string" } },
  validate: { flags: SELECTION },
  check: { flags: { ...SELECTION, stage: "string", pr: "boolean" }, required: ["stage"] },
  claim: {
    flags: {
      ...SELECTION,
      runtime: "string",
      session: "string",
      model: "string",
      phase: "string",
      "grant-file": "string",
      force: "boolean",
      reason: "string",
      recovery: "boolean",
      "claim-id": "string",
      "expected-revision": "string",
    },
    required: ["runtime", "session", "phase", "expected-revision"],
  },
  update: { flags: { ...SELECTION, ...OWNED }, required: OWNED_REQUIRED, stdin: true },
  "source-add": { flags: { ...SELECTION, ...OWNED, kind: "string", path: "string", reason: "string" }, required: [...OWNED_REQUIRED, "kind", "path", "reason"] },
  append: { flags: { ...SELECTION, ...OWNED }, required: OWNED_REQUIRED, stdin: true, positional: 1 },
  authorize: { flags: { ...SELECTION, ...OWNED, "grant-file": "string" }, required: [...OWNED_REQUIRED, "grant-file"] },
  "record-context": { flags: { ...SELECTION, ...OWNED, "context-file": "string", reason: "string" }, required: [...OWNED_REQUIRED, "context-file", "reason"] },
  "begin-change": { flags: { ...SELECTION, ...OWNED }, required: OWNED_REQUIRED },
  freeze: { flags: { ...SELECTION, ...OWNED, oid: "string", "evidence-file": "string" }, required: [...OWNED_REQUIRED, "oid", "evidence-file"] },
  reconcile: { flags: { ...SELECTION, ...OWNED, "evidence-file": "string" }, required: [...OWNED_REQUIRED, "evidence-file"] },
  "content-manifest": { flags: { ...SELECTION, "manifest-file": "string", "output-file": "string", "exclude-path": "repeat", "inputs-file": "string" } },
  measure: { flags: { ...SELECTION, ...OWNED }, required: OWNED_REQUIRED },
  release: { flags: { ...SELECTION, ...OWNED, outcome: "string", "release-file": "string" }, required: [...OWNED_REQUIRED, "outcome", "release-file"] },
  "recover-lock": {
    flags: { ...SELECTION, runtime: "string", session: "string", kind: "string", "operation-id": "string", "expected-lock-sha256": "string", reason: "string" },
    required: ["runtime", "session", "kind", "reason"],
  },
  "set-review-bound": { flags: { ...SELECTION, ...OWNED, "bound-file": "string" }, required: [...OWNED_REQUIRED, "bound-file"] },
  "summary-body": {
    flags: { ...SELECTION, "current-body-file": "string", "summary-file": "string", "expected-current-sha256": "string" },
    required: ["current-body-file", "summary-file"],
  },
};

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || !hasOwn(COMMANDS, command)) {
    fail("argument_error", `unknown command ${JSON.stringify(command ?? "")}`, { expected: Object.keys(COMMANDS) });
  }
  const spec = COMMANDS[command];
  const options = {};
  const positionals = [];
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const name = token.slice(2);
    const type = spec.flags[name];
    if (!type) fail("argument_error", `unknown flag --${name} for ${command}`);
    if (type === "boolean") {
      if (hasOwn(options, name)) fail("argument_error", `duplicate flag --${name}`);
      options[name] = true;
      continue;
    }
    const value = rest[index + 1];
    if (value === undefined || value.startsWith("--")) fail("argument_error", `--${name} needs a value`);
    index += 1;
    if (type === "repeat") {
      options[name] = [...(options[name] ?? []), value];
    } else {
      if (hasOwn(options, name)) fail("argument_error", `duplicate flag --${name}`);
      options[name] = value;
    }
  }
  const allowedPositionals = spec.positional ?? 0;
  if (positionals.length !== allowedPositionals) {
    fail("argument_error", `${command} takes ${allowedPositionals} positional argument(s)`, { observed: positionals });
  }
  for (const name of spec.required ?? []) {
    if (!hasOwn(options, name)) fail("argument_error", `--${name} is required for ${command}`);
  }
  if (hasOwn(options, "ledger") && (hasOwn(options, "repo") || hasOwn(options, "branch"))) {
    fail("argument_error", "use --repo [--branch] or --ledger, not both");
  }
  if (command !== "init" && !hasOwn(options, "ledger") && !hasOwn(options, "repo")) {
    fail("argument_error", "select a ledger with --repo DIR [--branch NAME] or --ledger ABS_PATH");
  }
  for (const [name, value] of Object.entries(options)) {
    if (typeof value === "string" && value.length === 0) fail("argument_error", `--${name} must not be empty`);
    if (typeof value === "string" && value.includes("\0")) fail("argument_error", `--${name} contains NUL`);
  }
  if (hasOwn(options, "expected-revision")) {
    if (!/^(0|[1-9]\d*)$/.test(options["expected-revision"]) || !Number.isSafeInteger(Number(options["expected-revision"]))) {
      fail("argument_error", "--expected-revision must be a nonnegative integer");
    }
    options["expected-revision"] = Number(options["expected-revision"]);
  }
  for (const name of ["runtime"]) {
    if (hasOwn(options, name) && !["claude", "codex", "gemini"].includes(options[name])) {
      fail("argument_error", `--${name} must be claude, codex or gemini`);
    }
  }
  if (hasOwn(options, "phase") && !ACTIVE_PHASES.includes(options.phase)) {
    fail("argument_error", "--phase must be delivery, review_round or watch");
  }
  if (hasOwn(options, "endpoint") && !ENDPOINTS.includes(options.endpoint)) {
    fail("argument_error", `--endpoint must be one of ${ENDPOINTS.join(", ")}`);
  }
  if (command === "check" && !["working", "frozen", "published"].includes(options.stage)) {
    fail("argument_error", "--stage must be working, frozen or published");
  }
  if (command === "release" && !["complete", "handoff", "blocked"].includes(options.outcome)) {
    fail("argument_error", "--outcome must be complete, handoff or blocked");
  }
  if (command === "source-add" && !["task_doc", "spec", "instruction"].includes(options.kind)) {
    fail("argument_error", "--kind must be task_doc, spec or instruction");
  }
  if (command === "recover-lock") {
    if (!["branch", "exclude"].includes(options.kind)) fail("argument_error", "--kind must be branch or exclude");
    const selectors = ["operation-id", "expected-lock-sha256"].filter((name) => hasOwn(options, name));
    if (selectors.length !== 1) fail("argument_error", "recover-lock needs exactly one of --operation-id or --expected-lock-sha256");
    if (hasOwn(options, "expected-lock-sha256") && !/^[0-9a-f]{64}$/.test(options["expected-lock-sha256"])) {
      fail("argument_error", "--expected-lock-sha256 must be 64 lowercase hex characters");
    }
  }
  if (command === "claim") {
    if (options.force && !options.reason) fail("argument_error", "--force requires --reason with the user's quoted statement");
    if (options.reason && !options.force) fail("argument_error", "--reason applies only to --force");
  }
  if (command === "prepare-init") {
    requireAbsolute(options["output-dir"], "--output-dir");
    if (Boolean(options.remote) === Boolean(options["no-remote"])) fail("argument_error", "choose --remote NAME or --no-remote explicitly");
  }
  if (command === "content-manifest") {
    if (Boolean(options["manifest-file"]) === Boolean(options["output-file"])) fail("argument_error", "choose --manifest-file to verify or --output-file to generate a manifest");
    if (options["manifest-file"] && (options["exclude-path"] || options["inputs-file"])) fail("argument_error", "exclusions and inputs apply only when generating a manifest");
  }
  if (command === "append") {
    const field = positionals[0];
    if (![...COLLECTIONS, "decisions"].includes(field)) {
      fail("argument_error", `append FIELD must be one of ${[...COLLECTIONS, "decisions"].join(", ")}`);
    }
    options.field = field;
  }
  if (command === "freeze" && !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(options.oid)) {
    fail("argument_error", "--oid must be a full lowercase object ID");
  }
  for (const [name, value] of Object.entries(options)) {
    if (name.endsWith("-file")) requireAbsolute(value, `--${name}`);
  }
  if (hasOwn(options, "ledger")) requireAbsolute(options.ledger, "--ledger");
  for (const name of ["task-doc", "spec", "instruction", "skill-source"]) {
    for (const value of options[name] ?? []) requireAbsolute(value, `--${name}`);
  }
  return { command, options };
}

// Only update and append read stdin; everything else refuses input it
// would silently ignore. The probe is asynchronous and time-boxed because a
// caller's stdin can be an open pipe that never reaches EOF.
function readRequiredStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch (error) {
    if (error.code === "EOF") return "";
    return fail("io_error", `cannot read stdin: ${error.code}`);
  }
}

function probeUnexpectedStdin() {
  let stat;
  try {
    stat = fs.fstatSync(0);
  } catch {
    return Promise.resolve();
  }
  if (stat.isFile()) {
    return stat.size > 0 ? Promise.reject(new LedgerError("argument_error", "this command does not read stdin")) : Promise.resolve();
  }
  if (!stat.isFIFO() && !stat.isSocket()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const stream = process.stdin;
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stream.removeAllListeners("data");
      stream.pause();
      stream.destroy();
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => finish(), 100);
    stream.on("data", (chunk) => {
      if (chunk.length > 0) finish(new LedgerError("argument_error", "this command does not read stdin"));
    });
    stream.on("end", () => finish());
    stream.on("error", () => finish());
  });
}

// ---------------------------------------------------------------------------
// Worktree, ledger and lock resolution

function realpathOr(target, code, message) {
  try {
    return fs.realpathSync(target);
  } catch {
    return fail(code, message, { path: target });
  }
}

// One rev-parse for the worktree root, common Git directory and symbolic
// HEAD; each Git spawn is a noticeable share of a helper call.
function repoFacts(dir) {
  const result = git(dir, ["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-common-dir", "--symbolic-full-name", "HEAD"], { allowFail: true });
  if (result.status !== 0) fail("environment_error", "not inside a Git worktree", { path: dir });
  const [top, common, head] = result.stdout.replace(/\n$/, "").split("\n");
  return {
    worktree: realpathOr(top, "environment_error", "worktree root is unreadable"),
    common: realpathOr(common, "environment_error", "common Git directory is unreadable"),
    checkedOut: head && head.startsWith("refs/heads/") ? head.slice("refs/heads/".length) : null,
  };
}

function assertNotSymlink(target) {
  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch (error) {
    if (error.code === "ENOENT") return;
    fail("io_error", `cannot inspect ${target}: ${error.code}`, { path: target });
  }
  if (stat.isSymbolicLink()) fail("invariant_error", "symlinked ledger, lock or exclusion path refused", { path: target });
}

function validBranchName(worktree, branch) {
  return gitOk(worktree, ["check-ref-format", `refs/heads/${branch}`]);
}

export function resolveContext(options, { mutation }) {
  let facts;
  let branch = null;
  let key;
  if (options.ledger) {
    const file = options.ledger;
    const dir = path.dirname(file);
    const base = path.basename(file);
    if (!/^[0-9a-f]{64}\.json$/.test(base) || path.basename(dir) !== LEDGER_DIR[1] || path.basename(path.dirname(dir)) !== LEDGER_DIR[0]) {
      fail("argument_error", "--ledger must name <worktree>/.agent/deliveries/<branch-key>.json", { path: file });
    }
    const claimedRoot = path.dirname(path.dirname(dir));
    facts = repoFacts(claimedRoot);
    if (facts.worktree !== realpathOr(claimedRoot, "environment_error", "ledger worktree is unreadable")) {
      fail("identity_mismatch", "ledger path is not at the root of its worktree", { path: file, observed: facts.worktree });
    }
    key = base.slice(0, 64);
  } else {
    facts = repoFacts(path.resolve(options.repo));
    branch = options.branch ?? facts.checkedOut;
    if (!branch) fail("identity_mismatch", "HEAD is detached; check out the delivery branch or pass --branch for a read");
    if (options.branch && !validBranchName(facts.worktree, branch)) fail("argument_error", "invalid branch name", { observed: branch });
    key = branchKey(branch);
  }
  const { worktree, common, checkedOut } = facts;
  const ledgerPath = path.join(worktree, ...LEDGER_DIR, `${key}.json`);
  assertNotSymlink(path.join(worktree, LEDGER_DIR[0]));
  assertNotSymlink(path.join(worktree, ...LEDGER_DIR));
  assertNotSymlink(ledgerPath);
  if (mutation) {
    if (!checkedOut) fail("identity_mismatch", "HEAD is detached; ledger mutations need the delivery branch checked out");
    if (branch !== null && checkedOut !== branch) {
      fail("identity_mismatch", "--branch does not match the checked-out branch", { expected: branch, observed: checkedOut });
    }
    if (branch === null && branchKey(checkedOut) !== key) {
      fail("identity_mismatch", "the ledger belongs to a branch that is not checked out here", { observed: checkedOut });
    }
    branch = checkedOut;
  }
  return { worktree, common, branch, key, ledgerPath, checkedOut };
}

function locksDir(ctx) {
  const dir = path.join(ctx.common, "agent-delivery-locks");
  assertNotSymlink(dir);
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  } catch (error) {
    fail("io_error", `cannot create the lock directory: ${error.code}`, { path: dir });
  }
  return dir;
}

const lockPath = (ctx, kind) => path.join(locksDir(ctx), kind === "branch" ? `${ctx.key}.lock` : "exclude.lock");

function describeLock(file) {
  let raw;
  try {
    raw = fs.readFileSync(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    fail("io_error", `cannot read lock ${file}: ${error.code}`, { path: file });
  }
  let metadata = null;
  try {
    const parsed = JSON.parse(raw.toString("utf8"));
    const complete = isObject(parsed) && ["kind", "pid", "hostname", "created_at", "worktree", "operation_id"].every((key) => hasOwn(parsed, key));
    metadata = complete ? parsed : null;
  } catch {
    metadata = null;
  }
  return { path: file, sha256: sha256(raw), complete: metadata !== null, metadata };
}

function acquireLock(ctx, kind) {
  const file = lockPath(ctx, kind);
  const metadata = {
    kind,
    pid: process.pid,
    hostname: os.hostname(),
    created_at: now(),
    worktree: ctx.worktree,
    operation_id: randomUUID(),
    branch_key: kind === "branch" ? ctx.key : null,
  };
  let fd;
  try {
    fd = fs.openSync(file, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") {
      const holder = describeLock(file);
      fail("mutex_held", `the ${kind} mutex is held; if its holder has stopped, use recover-lock with the recorded identity`, {
        path: file,
        id: holder?.metadata?.operation_id ?? null,
        observed: holder,
      });
    }
    fail("io_error", `cannot create the ${kind} mutex: ${error.code}`, { path: file });
  }
  try {
    fs.writeSync(fd, JSON.stringify(metadata));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  return { file, operationId: metadata.operation_id };
}

function releaseLock(lock) {
  const holder = describeLock(lock.file);
  if (holder?.metadata?.operation_id === lock.operationId) fs.unlinkSync(lock.file);
}

function withLock(ctx, kind, fn) {
  testHook("before-lock");
  const lock = acquireLock(ctx, kind);
  try {
    testHook("locked");
    return fn();
  } finally {
    releaseLock(lock);
  }
}

// ---------------------------------------------------------------------------
// Exclusion

function ledgerRelativePath(ctx) {
  return path.relative(ctx.worktree, ctx.ledgerPath).split(path.sep).join("/");
}

function exclusionEffective(ctx) {
  const rel = ledgerRelativePath(ctx);
  const tracked = git(ctx.worktree, ["ls-files", "-z", "--cached", "--", `:(literal)${rel}`], { buffer: true }).stdout;
  if (tracked.length > 0) fail("invariant_error", "the ledger path is tracked by Git; untrack it yourself before continuing", { path: ctx.ledgerPath });
  const result = git(ctx.worktree, ["check-ignore", "-q", "--", rel], { allowFail: true });
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  return fail("environment_error", `git check-ignore failed: ${result.stderr.trim()}`, { path: ctx.ledgerPath });
}

export function ensureExclusion(ctx) {
  if (exclusionEffective(ctx)) return { written: false };
  return withLock(ctx, "exclude", () => {
    if (exclusionEffective(ctx)) return { written: false };
    const infoDir = path.join(ctx.common, "info");
    const file = path.join(infoDir, "exclude");
    assertNotSymlink(infoDir);
    assertNotSymlink(file);
    let existing = Buffer.alloc(0);
    try {
      existing = fs.readFileSync(file);
    } catch (error) {
      if (error.code !== "ENOENT") fail("io_error", `cannot read info/exclude: ${error.code}`, { path: file });
    }
    const prefix = existing.length > 0 && existing[existing.length - 1] !== 0x0a ? "\n" : "";
    try {
      fs.mkdirSync(infoDir, { recursive: true });
      fs.appendFileSync(file, `${prefix}${EXCLUDE_RULE}\n`);
    } catch (error) {
      fail("io_error", `cannot write info/exclude: ${error.code}`, { path: file });
    }
    if (!exclusionEffective(ctx)) {
      fail("invariant_error", "an overriding ignore rule keeps the ledger path unignored; the appended exclusion line is harmless", { path: ctx.ledgerPath });
    }
    return { written: true, path: file };
  });
}

// ---------------------------------------------------------------------------
// Ledger I/O

function readLedger(ctx, { required = true } = {}) {
  assertNotSymlink(ctx.ledgerPath);
  let text;
  try {
    text = fs.readFileSync(ctx.ledgerPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      if (!required) return null;
      fail("io_error", "no ledger exists at this path", { path: ctx.ledgerPath });
    }
    fail("io_error", `cannot read the ledger: ${error.code}`, { path: ctx.ledgerPath });
  }
  const ledger = parseJson(text, ctx.ledgerPath);
  checkLedger(ledger, ctx);
  return ledger;
}

function checkLedger(ledger, ctx) {
  if (!isObject(ledger)) fail("schema_error", "the ledger must be a JSON object");
  if (ledger.schema_version !== 1) {
    fail("schema_error", "unsupported schema_version; only 1 is supported", { expected: 1, observed: ledger.schema_version ?? null });
  }
  requireShape(ledger, null, "ledger");
  const problems = ledgerInvariants(ledger);
  if (problems.length > 0) {
    fail("invariant_error", `ledger invariant violated: ${problems.slice(0, 5).join("; ")}`, { observed: problems.slice(0, 20) });
  }
  if (ctx && branchKey(ledger.candidate.branch) !== ctx.key) {
    fail("identity_mismatch", "the ledger's branch does not match its file name", { observed: ledger.candidate.branch });
  }
}

function ensureLedgerDir(ctx) {
  const agentDir = path.join(ctx.worktree, LEDGER_DIR[0]);
  const dir = path.join(ctx.worktree, ...LEDGER_DIR);
  for (const target of [agentDir, dir]) {
    assertNotSymlink(target);
    try {
      fs.mkdirSync(target, { mode: 0o700 });
    } catch (error) {
      if (error.code !== "EEXIST") fail("io_error", `cannot create ${target}: ${error.code}`, { path: target });
    }
  }
  if (realpathOr(dir, "io_error", "ledger directory is unreadable") !== dir) {
    fail("invariant_error", "the ledger directory resolves outside the worktree", { path: dir });
  }
  return dir;
}

function writeLedger(ctx, ledger) {
  const dir = ensureLedgerDir(ctx);
  const text = `${JSON.stringify(ledger, null, 2)}\n`;
  const temp = path.join(dir, `.${ctx.key}.${randomBytes(8).toString("hex")}.tmp`);
  let fd;
  try {
    fd = fs.openSync(temp, "wx", 0o600);
    fs.writeSync(fd, text);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    testHook("before-rename");
    fs.renameSync(temp, ctx.ledgerPath);
  } catch (error) {
    if (fd !== undefined) fs.closeSync(fd);
    fs.rmSync(temp, { force: true });
    fail("io_error", `cannot write the ledger: ${error.code ?? error.message}`, { path: ctx.ledgerPath });
  }
  testHook("after-rename");
  try {
    const dirFd = fs.openSync(dir, "r");
    fs.fsyncSync(dirFd);
    fs.closeSync(dirFd);
  } catch {
    // Directory fsync is best effort; the read-back below is the check.
  }
  if (fs.readFileSync(ctx.ledgerPath, "utf8") !== text) {
    fail("io_error", "ledger read-back differs from what was written; re-read before retrying", { path: ctx.ledgerPath });
  }
}

function envelope(command, changed, revision, data) {
  return { ok: true, command, changed, revision, data };
}

// Every mutation: branch mutex, fresh read, stale-revision check first,
// operation on a copy, full validation, atomic replace, read-back.
function mutate(ctx, options, command, operation) {
  return withLock(ctx, "branch", () => {
    const ledger = readLedger(ctx);
    if (ledger.revision !== options["expected-revision"]) {
      fail("stale_revision", "the ledger changed since it was read; re-read it and retry with the current revision", {
        path: ctx.ledgerPath,
        expected: options["expected-revision"],
        observed: ledger.revision,
      });
    }
    const draft = clone(ledger);
    const result = operation(draft, ledger) ?? {};
    const data = { ledger_path: ctx.ledgerPath, ...(result.data ?? {}) };
    if (isDeepStrictEqual(draft, ledger)) return envelope(command, false, ledger.revision, data);
    const at = now();
    const actor = result.actor;
    draft.revision = ledger.revision + 1;
    draft.updated_at = at;
    draft.updated_by = { runtime: actor.runtime, model: actor.model ?? null, session: actor.session, at };
    draft.history.push({
      id: randomUUID(),
      revision: draft.revision,
      at,
      runtime: actor.runtime,
      session: actor.session,
      phase: draft.phase,
      operation: result.operation ?? command,
      detail: result.detail ?? {},
    });
    checkLedger(draft, ctx);
    writeLedger(ctx, draft);
    return envelope(command, true, draft.revision, data);
  });
}

function requireOwner(ledger, options) {
  const owner = ledger.owner;
  if (!owner) fail("claim_mismatch", "no phase is claimed; claim one before writing");
  if (owner.session === options.session && owner.runtime !== options.runtime) {
    fail("owner_conflict", "this session label is already used by a different runtime", { expected: owner.runtime, observed: options.runtime });
  }
  if (owner.session !== options.session || owner.runtime !== options.runtime) {
    fail("owner_conflict", `phase ${owner.phase} is owned by another session; stop and report`, {
      observed: { runtime: owner.runtime, session: owner.session, phase: owner.phase },
    });
  }
  if (owner.claim_id !== options["claim-id"]) fail("claim_mismatch", "the claim ID does not match the current claim");
  return owner;
}

function forbidDuringRecovery(ledger, what) {
  if (ledger.candidate.recovery_required) {
    fail("invariant_error", `${what} is not allowed while recovery is required; reconcile first`);
  }
}

// ---------------------------------------------------------------------------
// Invariants beyond the schema

function parseQualified(ref) {
  const index = ref.indexOf(":");
  if (index <= 0) return null;
  const collection = ref.slice(0, index);
  const id = ref.slice(index + 1);
  if (!QUALIFIED_COLLECTIONS.includes(collection) || id.length === 0) return null;
  return { collection, id };
}

function contentPair(item, idField, manifestField, problems, label) {
  if (item[idField] !== null && item[manifestField] === null) problems.push(`${label}: ${idField} requires ${manifestField}`);
  if (item[idField] === null && item[manifestField] !== null && idField !== "content_id") problems.push(`${label}: ${manifestField} without ${idField}`);
}

export function itemProblems(collection, item, label = collection) {
  const problems = [];
  switch (collection) {
    case "reviews": {
      contentPair(item, "content_id", "content_manifest", problems, label);
      if (item.content_id === null && item.content_manifest !== null) problems.push(`${label}: content_manifest without content_id`);
      const committed = item.candidate_oid !== null;
      const local = item.content_id !== null;
      if (item.mode === "implementation" && committed === local) problems.push(`${label}: implementation review needs exactly one of candidate_oid or content_id`);
      if (item.mode === "doc" && committed && local) problems.push(`${label}: a review identifies at most one of candidate_oid or content_id`);
      const specVerdicts = ["accept", "revise", "split", "rewrite"];
      if (item.mode === "spec" ? !specVerdicts.includes(item.verdict) : specVerdicts.includes(item.verdict)) {
        problems.push(`${label}: verdict ${item.verdict} does not fit mode ${item.mode}`);
      }
      if ((item.cycle_id === null) !== (item.cycle_kind === null)) problems.push(`${label}: cycle_id and cycle_kind are both null or both set`);
      const ids = new Set();
      item.findings.forEach((finding, index) => {
        const where = `${label}/findings/${index}`;
        if (ids.has(finding.id)) problems.push(`${where}: duplicate finding id ${finding.id}`);
        ids.add(finding.id);
        if (finding.fix_content_id !== null && finding.fix_content_manifest === null) problems.push(`${where}: fix_content_id requires fix_content_manifest`);
        if (finding.fix_content_id === null && finding.fix_content_manifest !== null) problems.push(`${where}: fix_content_manifest without fix_content_id`);
        if (finding.disposition === "fixed" && finding.fix_oid === null && finding.fix_content_id === null) {
          problems.push(`${where}: a fixed finding needs fix_oid or fix_content_id`);
        }
        if (["rejected", "deferred", "duplicate"].includes(finding.disposition) && !finding.reason) problems.push(`${where}: ${finding.disposition} needs a reason`);
      });
      break;
    }
    case "audits":
      if (item.content_id !== null && item.content_manifest === null) problems.push(`${label}: content_id requires content_manifest`);
      if (item.content_id === null && item.content_manifest !== null) problems.push(`${label}: content_manifest without content_id`);
      if ((item.oid !== null) === (item.content_id !== null)) problems.push(`${label}: audit evidence needs exactly one of oid or content_id`);
      break;
    case "validation": {
      if (item.content_id !== null && item.content_manifest === null) problems.push(`${label}: content_id requires content_manifest`);
      if (item.kind === "command" && (item.command === null || item.receipt !== null)) problems.push(`${label}: a command record has a command and no receipt`);
      if (item.kind === "receipt" && item.receipt === null) problems.push(`${label}: a receipt record needs receipt`);
      const completed = ["pass", "fail"].includes(item.result);
      if (completed && item.exit_code === null) problems.push(`${label}: ${item.result} needs its actual exit_code`);
      if (completed && item.kind === "command" && !item.log) problems.push(`${label}: ${item.result} needs its log or evidence`);
      if (["skipped", "unavailable"].includes(item.result) && !item.reason) problems.push(`${label}: ${item.result} needs a reason`);
      if ((item.reused_from === null) !== (item.reuse === null)) problems.push(`${label}: reused_from and reuse are both null or both set`);
      if (item.reuse && item.reuse.source_id !== item.reused_from) problems.push(`${label}: reuse.source_id must equal reused_from`);
      if (item.reuse && item.receipt !== null) problems.push(`${label}: a reuse record is not a newly issued receipt`);
      if (completed && item.kind === "command" && item.reused_from === null) {
        if (item.content_manifest === null || item.input_fingerprint === null) problems.push(`${label}: a completed command execution needs content_manifest and input_fingerprint`);
        if ((item.oid !== null) === (item.content_id !== null)) problems.push(`${label}: a completed command execution needs exactly one of oid or content_id`);
        if (item.content_id !== null && item.input_fingerprint !== null && item.content_id !== `sha256:${item.input_fingerprint}`) {
          problems.push(`${label}: content_id must be sha256:<input_fingerprint>`);
        }
      }
      break;
    }
    case "role_runs":
      if (item.content_id !== null && item.content_manifest === null) problems.push(`${label}: content_id requires content_manifest`);
      if (item.candidate_oid !== null && item.content_id !== null) problems.push(`${label}: a role run identifies at most one of candidate_oid or content_id`);
      if (item.execution === "inline" && !item.fallback_reason) problems.push(`${label}: inline execution records its fallback_reason`);
      if (item.status === "blocked" && !item.block_reason) problems.push(`${label}: a blocked run records its block_reason`);
      break;
    case "defect_shapes":
      if (item.sweep === "done" && (item.evidence === null || item.searched_scope.length === 0)) problems.push(`${label}: a completed sweep states its search and result`);
      break;
    case "publications":
      if (["failed", "mismatch", "uncertain"].includes(item.step) && !item.error) problems.push(`${label}: ${item.step} needs an error or explanation`);
      if (item.step === "verified" && item.observed === null) problems.push(`${label}: verified needs an observation`);
      if (item.step === "prepared" && item.observed !== null) problems.push(`${label}: prepared has no observation yet`);
      break;
    default:
      break;
  }
  return problems;
}

function collectionOf(ledger, collection) {
  return collection === "decisions" ? ledger.sources.decisions : ledger[collection];
}

// A successor must describe the same subject; it can never move evidence
// or authority to another candidate, session, operation or target.
function subjectProblem(collection, item, target) {
  const same = (...fields) => fields.every((field) => isDeepStrictEqual(item[field] ?? null, target[field] ?? null));
  switch (collection) {
    case "reviews": {
      if (!same("mode", "candidate_oid", "content_id", "source", "cycle_id", "cycle_kind", "round")) return "a review successor keeps the reviewed candidate, source and cycle";
      if (!isDeepStrictEqual(item.batch, target.batch)) return "a review successor keeps its frozen batch snapshot";
      const before = new Map(target.findings.map((finding) => [finding.id, finding]));
      if (item.findings.length !== target.findings.length) return "a review successor keeps every stable finding";
      for (const finding of item.findings) {
        const prior = before.get(finding.id);
        if (!prior) return `finding ${finding.id} is not in the superseded review`;
        for (const field of ["source_id", "severity", "location", "thread_id"]) {
          if (!isDeepStrictEqual(finding[field], prior[field])) return `finding ${finding.id} changes its ${field}`;
        }
      }
      return null;
    }
    case "audits":
      if (!same("mode", "oid", "content_id")) return "an audit successor keeps its mode and candidate";
      if (target.verdict === "FAIL" && item.verdict !== "FAIL") return "a failed audit stays FAIL; a recheck is a new audit";
      return null;
    case "validation":
      if (!same("kind", "command", "cwd", "scope", "oid", "content_id", "content_manifest", "input_fingerprint", "receipt", "reused_from")) {
        return "a validation successor observes the same execution";
      }
      return null;
    case "role_runs":
      if (!same("role", "mode", "phase", "candidate_oid", "content_id", "execution", "runtime", "session_label", "fallback_reason")) return "a role-run successor keeps its dispatch identity and fallback reason";
      return null;
    case "sessions":
      if (!same("label", "runtime", "phase")) return "a session successor keeps its label, runtime and phase";
      if (target.native_session_id !== null && item.native_session_id !== target.native_session_id) return "a known native session ID cannot change";
      return null;
    case "publications":
      return same("operation_id", "kind", "step", "candidate_oid", "target", "intended", "precondition", "batch_id") ? null : "a publication successor corrects one step of the same operation";
    case "limitations":
      return same("kind") ? null : "a limitation successor keeps its kind";
    case "defect_shapes":
      return same("shape", "candidate_oid") ? null : "a defect-shape successor keeps its shape and candidate";
    default:
      return "this collection has no successors";
  }
}

function supersessionProblems(collection, items) {
  const problems = [];
  const index = new Map(items.map((item, position) => [item.id, position]));
  const successors = new Map();
  items.forEach((item, position) => {
    const target = item.supersedes_id ?? null;
    if (target === null) return;
    const label = `${collection}/${position}`;
    if (!index.has(target) || index.get(target) >= position) {
      problems.push(`${label}: supersedes_id ${target} does not name an earlier ${collection} item`);
      return;
    }
    if (successors.has(target)) problems.push(`${label}: ${target} already has a successor`);
    successors.set(target, item.id);
    const reason = subjectProblem(collection, item, items[index.get(target)]);
    if (reason) problems.push(`${label}: ${reason}`);
  });
  return problems;
}

export function currentItems(items) {
  const superseded = new Set(items.map((item) => item.supersedes_id ?? null).filter((id) => id !== null));
  return items.filter((item) => !superseded.has(item.id));
}

function chainRoot(items, item) {
  const byId = new Map(items.map((entry) => [entry.id, entry]));
  let cursor = item;
  while (cursor.supersedes_id) cursor = byId.get(cursor.supersedes_id);
  return cursor;
}

function terminalSuccessor(items, id) {
  const next = new Map(items.filter((item) => item.supersedes_id).map((item) => [item.supersedes_id, item]));
  let cursor = items.find((item) => item.id === id);
  while (cursor && next.has(cursor.id)) cursor = next.get(cursor.id);
  return cursor;
}

function operations(ledger) {
  const ops = new Map();
  for (const event of ledger.publications) {
    if (!ops.has(event.operation_id)) ops.set(event.operation_id, []);
    ops.get(event.operation_id).push(event);
  }
  return ops;
}

const operationFields = ["candidate_oid", "kind", "target", "intended", "precondition", "batch_id"];

export function ledgerInvariants(ledger) {
  const problems = [];
  if (ledger.history.length !== ledger.revision + 1) problems.push("history must hold exactly one event per revision");
  ledger.history.forEach((event, index) => {
    if (event.revision !== index) problems.push(`history/${index}: revision must be ${index}`);
  });
  if (ledger.history[0]?.operation !== "init") problems.push("history/0 must be the init event");
  const uniqueIn = (items, label) => {
    const seen = new Set();
    for (const item of items) {
      if (seen.has(item.id)) problems.push(`${label}: duplicate id ${item.id}`);
      seen.add(item.id);
    }
  };
  for (const collection of COLLECTIONS) {
    uniqueIn(ledger[collection], collection);
    ledger[collection].forEach((item, index) => problems.push(...itemProblems(collection, item, `${collection}/${index}`)));
    problems.push(...supersessionProblems(collection, ledger[collection]));
  }
  uniqueIn(ledger.history, "history");
  uniqueIn(ledger.sources.decisions, "sources/decisions");
  uniqueIn(ledger.authorization.grants, "authorization/grants");
  for (const grant of ledger.authorization.grants) {
    if ((grant.scope === "endpoint") !== (grant.endpoint !== null)) problems.push(`grant ${grant.id}: endpoint is set only on an endpoint grant`);
  }
  const { owner, phase, candidate } = ledger;
  if (owner) {
    if (owner.phase !== phase) problems.push("owner.phase must equal phase while owned");
    if (ledger.next !== null) problems.push("next is consumed (null) while a phase is owned");
  }
  if (phase === "done") {
    if (owner || ledger.completion === null || ledger.checkpoint !== null) problems.push("done needs no owner, a completion and a null checkpoint");
  }
  if ((phase === "blocked") !== (ledger.blocker !== null)) problems.push("blocker is set exactly when phase is blocked");
  if (phase === "blocked" && owner) problems.push("a blocked ledger is unowned");
  if (candidate.state === "frozen" && (candidate.oid === null || candidate.working_head_oid !== candidate.oid)) {
    problems.push("a frozen candidate has an oid equal to working_head_oid");
  }
  if (candidate.oid === null && (candidate.generation !== 0 || candidate.previous_oid !== null)) problems.push("an unfrozen-ever candidate has generation 0 and no previous_oid");
  if (candidate.oid !== null && candidate.generation === 0) problems.push("a candidate oid implies generation >= 1");
  const reviewBatches = new Map();
  for (const review of ledger.reviews) if (review.batch) reviewBatches.set(review.batch.id, review.batch);
  for (const [operationId, events] of operations(ledger)) {
    if (events[0].step !== "prepared") problems.push(`publication operation ${operationId} starts with prepared`);
    events.slice(1).forEach((event) => {
      if (event.step === "prepared") problems.push(`publication operation ${operationId} has one prepared step`);
      for (const field of operationFields) {
        if (!isDeepStrictEqual(event[field], events[0][field])) problems.push(`publication operation ${operationId} changes ${field} between steps`);
      }
    });
    const terminal = events.findIndex((event) => TERMINAL_STEPS.has(event.step));
    if (terminal !== -1 && terminal !== events.length - 1) problems.push(`publication operation ${operationId} continues after ${events[terminal].step}`);
    if (events[0].batch_id !== null && !reviewBatches.has(events[0].batch_id)) problems.push(`publication operation ${operationId} names an unknown batch`);
  }
  const roleRunIds = new Set(ledger.role_runs.map((run) => run.id));
  for (const audit of ledger.audits) if (audit.role_run_id !== null && !roleRunIds.has(audit.role_run_id)) problems.push(`audit ${audit.id}: unknown role_run_id`);
  for (const run of ledger.role_runs) {
    if (run.parent_run_id !== null) {
      const parent = ledger.role_runs.find((entry) => entry.id === run.parent_run_id);
      if (!parent || (parent.supersedes_id ?? null) !== null) problems.push(`role run ${run.id}: parent_run_id names a stable run root`);
    }
  }
  const validationIds = new Set(ledger.validation.map((entry) => entry.id));
  for (const entry of ledger.validation) if (entry.reused_from !== null && !validationIds.has(entry.reused_from)) problems.push(`validation ${entry.id}: unknown reused_from`);
  if (ledger.completion) {
    const completion = ledger.completion;
    if ((completion.candidate_oid !== null) === (completion.content_id !== null)) problems.push("completion identifies exactly one of candidate_oid or content_id");
    if ((completion.content_id !== null) !== (completion.content_manifest !== null)) problems.push("completion content_id and content_manifest go together");
    for (const ref of completion.evidence_ids) {
      const parsed = parseQualified(ref);
      if (!parsed || !collectionOf(ledger, parsed.collection).some((item) => item.id === parsed.id)) problems.push(`completion evidence ${ref} does not resolve`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Content identity

const utf8Compare = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));

export function canonicalManifest(manifest) {
  return JSON.stringify({
    version: 1,
    baseline_oid: manifest.baseline_oid,
    files: manifest.files
      .map((file) => ({ path: file.path, mode: file.mode, state: file.state, sha256: file.sha256 }))
      .sort((left, right) => utf8Compare(left.path, right.path)),
    excluded_paths: [...manifest.excluded_paths].sort(utf8Compare),
    inputs: manifest.inputs.map((input) => ({ name: input.name, value: input.value })).sort((left, right) => utf8Compare(left.name, right.name)),
  });
}

export function manifestDigest(manifest) {
  return sha256(Buffer.from(canonicalManifest(manifest), "utf8"));
}

function validManifestPath(value) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0") || value.startsWith("/")) return false;
  return !value.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}

function manifestStructure(manifest, ledger) {
  requireExactKeys(manifest, ["version", "baseline_oid", "files", "excluded_paths", "inputs"], "content manifest");
  requireShape(manifest, "ContentManifest", "content manifest");
  manifest.files.forEach((file) => requireExactKeys(file, ["path", "mode", "state", "sha256"], "content manifest file"));
  manifest.inputs.forEach((input) => requireExactKeys(input, ["name", "value"], "content manifest input"));
  if (manifest.baseline_oid !== ledger.candidate.baseline_oid) {
    fail("invariant_error", "manifest baseline_oid must equal candidate.baseline_oid", { expected: ledger.candidate.baseline_oid, observed: manifest.baseline_oid });
  }
  const seen = new Set();
  for (const file of manifest.files) {
    if (!validManifestPath(file.path)) fail("invariant_error", "manifest paths are literal worktree-relative paths", { observed: file.path });
    if (seen.has(file.path)) fail("invariant_error", "duplicate manifest path", { observed: file.path });
    seen.add(file.path);
    if ((file.state === "deleted") !== (file.sha256 === null)) fail("invariant_error", "deleted paths have sha256 null and present paths a hash", { observed: file.path });
  }
  const excluded = new Set();
  for (const entry of manifest.excluded_paths) {
    if (!validManifestPath(entry)) fail("invariant_error", "excluded paths are literal worktree-relative paths", { observed: entry });
    if (seen.has(entry)) fail("invariant_error", "a path cannot be both listed and excluded", { observed: entry });
    if (excluded.has(entry)) fail("invariant_error", "duplicate excluded path", { observed: entry });
    excluded.add(entry);
  }
  const names = new Set();
  for (const input of manifest.inputs) {
    if (names.has(input.name)) fail("invariant_error", "duplicate manifest input name", { observed: input.name });
    names.add(input.name);
  }
}

// Loads a retained manifest named by a Source and checks its bytes and
// structure. Returns the parsed manifest and its canonical digest.
function loadManifest(source, ledger) {
  let bytes;
  try {
    bytes = fs.readFileSync(source.path);
  } catch (error) {
    fail("io_error", `content manifest is unreadable: ${error.code}`, { path: source.path });
  }
  if (sha256(bytes) !== source.sha256) {
    fail("identity_mismatch", "content manifest bytes do not match the recorded hash", { path: source.path, expected: source.sha256, observed: sha256(bytes) });
  }
  const manifest = parseJson(bytes.toString("utf8"), source.path);
  manifestStructure(manifest, ledger);
  return { manifest, digest: manifestDigest(manifest) };
}

function worktreeEntry(worktree, relPath, mode) {
  const full = path.join(worktree, ...relPath.split("/"));
  const stat = fs.lstatSync(full);
  if (stat.isSymbolicLink()) return { mode: "120000", state: "present", sha256: sha256(fs.readlinkSync(full, { encoding: "buffer" })) };
  if (!stat.isFile()) fail("invariant_error", "unsupported file type in the manifest scope", { observed: relPath });
  return { mode: mode ?? (stat.mode & 0o111 ? "100755" : "100644"), state: "present", sha256: hashFile(full) };
}

// Every difference between the committed baseline tree and the target
// content (the working tree, or a commit), including already-committed,
// staged, unstaged and untracked changes.
function actualChanges(worktree, baseline, target) {
  if (target === "worktree") {
    const unmerged = git(worktree, ["ls-files", "-u", "-z"], { buffer: true }).stdout;
    if (unmerged.length > 0) fail("invariant_error", "unresolved merge entries prevent a content identity");
  }
  const args = ["diff", "--raw", "-z", "--no-renames", "--no-abbrev", "--no-ext-diff", "--no-textconv", baseline];
  if (target !== "worktree") args.push(target);
  args.push("--");
  const fields = splitNul(git(worktree, args, { buffer: true }).stdout);
  const changes = new Map();
  for (let index = 0; index + 1 < fields.length; index += 2) {
    const [oldMode, newMode, , newSha, status] = fields[index].toString("utf8").slice(1).split(" ");
    const relPath = decodePath(fields[index + 1]);
    if (status === "D") {
      if (oldMode === "160000") fail("invariant_error", "submodule paths are unsupported", { observed: relPath });
      changes.set(relPath, { mode: oldMode, state: "deleted", sha256: null });
      continue;
    }
    if (!["100644", "100755", "120000"].includes(newMode)) fail("invariant_error", "unsupported file type in the manifest scope", { observed: relPath });
    if (target === "worktree") {
      changes.set(relPath, worktreeEntry(worktree, relPath, newMode === "120000" ? undefined : newMode));
    } else {
      const blob = git(worktree, ["cat-file", "blob", newSha], { buffer: true }).stdout;
      changes.set(relPath, { mode: newMode, state: "present", sha256: sha256(blob) });
    }
  }
  if (target === "worktree") {
    const untracked = splitNul(git(worktree, ["ls-files", "-z", "--others", "--exclude-standard"], { buffer: true }).stdout);
    for (const bytes of untracked) {
      const relPath = decodePath(bytes);
      changes.set(relPath, worktreeEntry(worktree, relPath));
    }
  }
  return changes;
}

export function verifyManifestContent(worktree, manifest, target) {
  const changes = actualChanges(worktree, manifest.baseline_oid, target);
  const listed = new Map(manifest.files.map((file) => [file.path, file]));
  const excluded = new Set(manifest.excluded_paths);
  const problems = [];
  for (const [relPath, actual] of changes) {
    if (excluded.has(relPath)) continue;
    const entry = listed.get(relPath);
    if (!entry) {
      problems.push({ path: relPath, problem: "changed path is neither listed nor explicitly excluded", observed: actual });
    } else if (entry.mode !== actual.mode || entry.state !== actual.state || entry.sha256 !== actual.sha256) {
      problems.push({ path: relPath, problem: "listed identity differs from the content", expected: { mode: entry.mode, state: entry.state, sha256: entry.sha256 }, observed: actual });
    }
  }
  for (const relPath of listed.keys()) {
    if (!changes.has(relPath)) problems.push({ path: relPath, problem: "listed path does not differ from the baseline" });
  }
  if (problems.length > 0) {
    fail("identity_mismatch", `the manifest does not describe the ${target === "worktree" ? "working" : "committed"} content`, { observed: problems.slice(0, 20) });
  }
}

// ---------------------------------------------------------------------------
// PR-body summary block

const MARKER = /<!-- agent-delivery-summary:([^\s:]+):(start|end) -->/g;

function summaryMarkers(body) {
  return [...body.matchAll(MARKER)].map((match) => ({ delivery: match[1], kind: match[2], index: match.index, end: match.index + match[0].length }));
}

function wellFormedBlock(body, deliveryId) {
  const markers = summaryMarkers(body);
  if (markers.some((marker) => marker.delivery !== deliveryId)) {
    fail("invariant_error", "the PR body carries another delivery's summary block; stop and report");
  }
  const starts = markers.filter((marker) => marker.kind === "start");
  const ends = markers.filter((marker) => marker.kind === "end");
  if (starts.length === 0 && ends.length === 0) return null;
  if (starts.length !== 1 || ends.length !== 1 || starts[0].index > ends[0].index) {
    fail("invariant_error", "duplicate or unmatched agent-delivery-summary markers; stop and report", { observed: markers.map(({ kind, index }) => ({ kind, index })) });
  }
  return { start: starts[0], end: ends[0] };
}

export function applySummaryBlock(current, deliveryId, summary) {
  if (summaryMarkers(summary).length > 0) fail("invariant_error", "the summary text must not contain summary markers");
  const start = `<!-- agent-delivery-summary:${deliveryId}:start -->`;
  const end = `<!-- agent-delivery-summary:${deliveryId}:end -->`;
  const content = summary.replace(/\n+$/, "");
  const block = wellFormedBlock(current, deliveryId);
  if (!block) {
    const separator = current === "" ? "" : current.endsWith("\n\n") ? "" : current.endsWith("\n") ? "\n" : "\n\n";
    return { action: "appended", body: `${current}${separator}${start}\n${content}\n${end}\n` };
  }
  return { action: "replaced", body: `${current.slice(0, block.start.end)}\n${content}\n${current.slice(block.end.index)}` };
}

// ---------------------------------------------------------------------------
// Local and remote identity checks

function latestSources(entries) {
  const latest = new Map();
  for (const entry of entries) latest.set(entry.path, entry);
  return [...latest.values()];
}

function dependencyProblems(dependencies) {
  const problems = [];
  for (const dependency of dependencies) {
    const head = resolveDependencyHead(dependency.path);
    if (head !== dependency.oid) problems.push({ what: "dependency_source", name: dependency.name, expected: dependency.oid, observed: head });
    if (dependency.build_hash !== null) {
      const observed = path.isAbsolute(dependency.evidence) ? outputHash(dependency.evidence) : null;
      if (observed !== dependency.build_hash) problems.push({ what: "dependency_output", name: dependency.name, expected: dependency.build_hash, observed });
    }
  }
  return problems;
}

function resolveDependencyHead(dir) {
  try {
    if (!fs.statSync(dir).isDirectory()) return null;
  } catch {
    return null;
  }
  const result = git(dir, ["rev-parse", "--verify", "--quiet", "HEAD"], { allowFail: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

function verifyDependencies(dependencies) {
  for (const dependency of dependencies) {
    if (dependency.build_hash !== null && !path.isAbsolute(dependency.evidence)) {
      fail("invariant_error", "a dependency with build_hash names its build output as an absolute evidence path", { observed: dependency.name });
    }
  }
  const problems = dependencyProblems(dependencies);
  if (problems.length > 0) fail("identity_mismatch", "dependency identity does not match its checkout or build output", { observed: problems });
  const names = new Set();
  for (const dependency of dependencies) {
    if (names.has(dependency.name)) fail("invariant_error", "duplicate dependency name", { observed: dependency.name });
    names.add(dependency.name);
  }
}

// Local facts only: no network. Mismatches are drift; environment problems
// are reported separately so a missing remote is not called drift.
function localIdentity(ctx, ledger, stage) {
  const mismatches = [];
  const environment = [];
  const warnings = [];
  const { candidate, repo } = ledger;
  if (repo.path !== ctx.worktree || candidate.worktree !== ctx.worktree) mismatches.push({ what: "worktree", expected: candidate.worktree, observed: ctx.worktree });
  if (repo.common_git_dir !== ctx.common) mismatches.push({ what: "common_git_dir", expected: repo.common_git_dir, observed: ctx.common });
  if (ctx.checkedOut !== candidate.branch) mismatches.push({ what: "branch", expected: candidate.branch, observed: ctx.checkedOut });
  const holders = worktreesWithBranch(ctx.worktree, candidate.branch);
  if (holders.length > 1) mismatches.push({ what: "branch_checked_out_twice", expected: [ctx.worktree], observed: holders });
  const head = headOid(ctx.worktree);
  const expectedHead = stage === "working" ? candidate.working_head_oid : candidate.oid;
  if (head !== expectedHead) mismatches.push({ what: "head", expected: expectedHead, observed: head });
  const status = summarizeStatus(ctx.worktree);
  if (status.unmerged.length > 0) mismatches.push({ what: "unresolved_index_conflicts", observed: status.unmerged });
  if (stage !== "working" && status.tracked.length > 0) mismatches.push({ what: "dirty_candidate", observed: status.tracked });
  for (const oid of [repo.base_oid, repo.diff_base_oid]) {
    if (!gitOk(ctx.worktree, ["cat-file", "-e", `${oid}^{commit}`])) mismatches.push({ what: "base_object_missing", expected: oid });
  }
  if (repo.remote_name !== null) {
    const url = configuredRemoteUrl(ctx.worktree, repo.remote_name);
    if (url === null) environment.push({ what: "remote_missing", expected: repo.remote_name });
    else if (url !== repo.remote_url) mismatches.push({ what: "remote_url", expected: repo.remote_url, observed: url });
  }
  for (const [kind, entries] of [["task_doc", ledger.sources.task_docs], ["spec", ledger.sources.specs], ["instruction", ledger.sources.instructions]]) {
    for (const source of latestSources(entries)) {
      const observed = currentHash(source.path);
      if (observed !== source.sha256) mismatches.push({ what: observed === null ? "source_missing" : "source_changed", kind, path: source.path, expected: source.sha256, observed });
    }
  }
  mismatches.push(...dependencyProblems(candidate.dependencies));
  for (const source of ledger.policy.skill_sources) {
    if (currentHash(source.path) !== source.sha256) warnings.push({ what: "skill_source_changed", path: source.path });
  }
  return { mismatches, environment, warnings, head, untracked: status.untracked };
}

function verifiedPushes(ledger) {
  const result = [];
  for (const events of operations(ledger).values()) {
    const last = events[events.length - 1];
    if (last.kind === "push" && last.step === "verified") result.push({ event: last, index: ledger.publications.indexOf(last) });
  }
  return result.sort((left, right) => left.index - right.index).map(({ event }) => event);
}

// Expected live state of the delivery destination: the last verified push
// to that same destination, else the adoption baseline, else absence.
export function expectedRemote(ledger) {
  const remoteName = ledger.repo.remote_name;
  const ref = destinationRef(ledger);
  const pushes = verifiedPushes(ledger).filter((event) => event.target.remote_name === remoteName && event.target.ref === ref);
  if (pushes.length > 0) return { oid: pushes[pushes.length - 1].intended.oid, source: "verified_push", remote_name: remoteName, ref };
  const baseline = ledger.candidate.remote_baseline;
  if (baseline) {
    if (baseline.remote_name !== remoteName || baseline.ref !== ref) {
      fail("invariant_error", "the remote baseline names a different destination; reconcile explicitly", { expected: { remote_name: remoteName, ref }, observed: baseline });
    }
    return { oid: baseline.oid, source: "remote_baseline", remote_name: remoteName, ref };
  }
  return { oid: null, source: "expected_absence", remote_name: remoteName, ref };
}

function remoteIdentity(ctx, ledger, stage) {
  if (ledger.repo.remote_name === null) return { status: "not_configured" };
  const expected = expectedRemote(ledger);
  const live = lsRemote(ctx.worktree, ledger.repo.remote_name, expected.ref);
  if (!live.ok) return { status: "unverified", detail: { what: "remote_unreadable", error: live.error } };
  const want = stage === "published" ? ledger.candidate.oid : expected.oid;
  if (live.oid === want) return { status: "verified", expected, observed: live.oid };
  let what = "remote_ref_moved";
  if (want === null) what = "remote_ref_unexpectedly_exists; use remote_adoption";
  else if (live.oid === null) what = "remote_ref_missing";
  return { status: "mismatch", detail: { what, expected: want, observed: live.oid, expectation: expected.source } };
}

export function readGitHubPr(pr) {
  const [owner, name] = pr.repository.split("/");
  const result = spawnSync("gh", ["api", "--method", "GET", "--hostname", pr.host, `repos/${owner}/${name}/pulls/${pr.number}`], {
    encoding: "utf8",
    env: { ...process.env, GH_PROMPT_DISABLED: "1" },
  });
  if (result.error || result.status !== 0) {
    return { ok: false, error: (result.stderr || result.error?.message || "gh api failed").trim().split("\n")[0] };
  }
  let data;
  try {
    data = JSON.parse(result.stdout);
  } catch {
    return { ok: false, error: "gh returned unparseable JSON" };
  }
  if (!isObject(data) || !isObject(data.head) || !isObject(data.base)) return { ok: false, error: "gh returned an incomplete pull request" };
  const headRepo = data.head.repo;
  return {
    ok: true,
    pr: {
      host: pr.host,
      repository: data.base.repo?.full_name ?? null,
      number: data.number,
      url: data.html_url,
      head_branch: data.head.ref,
      head: data.head.sha,
      head_repository: headRepo ? { host: pr.host, owner: headRepo.owner?.login ?? null, name: headRepo.name ?? null } : null,
      base: data.base.ref,
      draft: data.draft === true,
      state: data.merged_at || data.merged ? "MERGED" : data.state === "closed" ? "CLOSED" : "OPEN",
    },
  };
}

function prIdentity(ledger, expectedHead) {
  const stored = ledger.pr;
  const live = readGitHubPr(stored);
  if (!live.ok) return { status: "unverified", detail: { what: "pr_unreadable", error: live.error } };
  const differences = [];
  for (const field of ["repository", "number", "url", "head_branch", "head_repository", "base", "draft", "state"]) {
    if (!isDeepStrictEqual(live.pr[field], stored[field])) differences.push({ field, expected: stored[field], observed: live.pr[field] });
  }
  if (live.pr.head !== expectedHead) differences.push({ field: "head", expected: expectedHead, observed: live.pr.head });
  if (differences.length > 0) return { status: "mismatch", detail: { what: "pr_identity", differences } };
  return { status: "verified", observed: live.pr };
}

// ---------------------------------------------------------------------------
// Grants and phase authority

function readGrant(file) {
  const grant = readJsonFile(file, "--grant-file");
  if (!isObject(grant) || Array.isArray(grant.grants)) fail("schema_error", "--grant-file holds exactly one Grant, not an Authorization object or array");
  requireExactKeys(grant, ["id", "scope", "endpoint", "wording", "source", "at", "additional_cycles"], "grant");
  requireShape(grant, "Grant", "grant");
  if ((grant.scope === "endpoint") !== (grant.endpoint !== null)) fail("invariant_error", "endpoint is set only on an endpoint grant");
  if (grant.wording.trim().length === 0 || grant.source.trim().length === 0) fail("invariant_error", "a grant quotes nonempty wording and a source");
  return grant;
}

// Returns true when the grant is new, false when an identical one exists.
function addGrant(ledger, grant) {
  const existing = ledger.authorization.grants.find((entry) => entry.id === grant.id);
  if (existing) {
    if (!isDeepStrictEqual(existing, grant)) fail("invariant_error", "a grant ID was reused with different content", { id: grant.id, expected: existing, observed: grant });
    return false;
  }
  ledger.authorization.grants.push(grant);
  return true;
}

function consumedGrantIds(ledger) {
  return new Set(ledger.history.filter((event) => event.operation === "claim" && event.detail.grant_id).map((event) => event.detail.grant_id));
}

function unconsumedGrant(ledger, scopes, preferredId) {
  const consumed = consumedGrantIds(ledger);
  const candidates = ledger.authorization.grants.filter((grant) => scopes.includes(grant.scope) && !consumed.has(grant.id));
  if (preferredId) return candidates.find((grant) => grant.id === preferredId) ?? null;
  return candidates[candidates.length - 1] ?? null;
}

// ---------------------------------------------------------------------------
// Commands

function commandPath(options) {
  const ctx = resolveContext(options, { mutation: false });
  let exists = false;
  try {
    exists = fs.lstatSync(ctx.ledgerPath).isFile();
  } catch {
    exists = false;
  }
  return envelope("path", false, null, { path: ctx.ledgerPath, branch: ctx.branch, branch_key: ctx.key, exists, common_git_dir: ctx.common });
}

function commandShow(options) {
  const ctx = resolveContext(options, { mutation: false });
  const ledger = readLedger(ctx);
  if (!hasOwn(options, "field")) return envelope("show", false, ledger.revision, { value: ledger });
  const pointer = options.field;
  if (!pointer.startsWith("/")) fail("argument_error", "--field is a JSON pointer starting with /");
  let value = ledger;
  for (const raw of pointer.slice(1).split("/")) {
    if (/~(?![01])/.test(raw)) fail("argument_error", "invalid JSON pointer escape", { observed: raw });
    const segment = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (Array.isArray(value)) {
      if (!/^(0|[1-9]\d*)$/.test(segment) || Number(segment) >= value.length) fail("argument_error", "JSON pointer index does not exist", { observed: segment });
      value = value[Number(segment)];
    } else if (isObject(value) && hasOwn(value, segment)) {
      value = value[segment];
    } else {
      fail("argument_error", "JSON pointer field does not exist", { observed: pointer });
    }
  }
  return envelope("show", false, ledger.revision, { value });
}

function commandValidate(options) {
  const ctx = resolveContext(options, { mutation: false });
  const ledger = readLedger(ctx);
  return envelope("validate", false, ledger.revision, { valid: true, path: ctx.ledgerPath });
}

function parseGitHubUrl(url) {
  const patterns = [/^https:\/\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/, /^ssh:\/\/git@([^/:]+)(?::\d+)?\/([^/]+)\/([^/]+?)(?:\.git)?$/, /^git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/];
  for (const pattern of patterns) {
    const match = pattern.exec(url);
    if (match) return { host: match[1], owner: match[2], name: match[3] };
  }
  return null;
}

// First PR observation for this delivery: base repository, branch and base
// must match; a fork head repository is kept as observed.
function verifyNewPr(ledger, pr) {
  const github = ledger.repo.github;
  if (!github) fail("invariant_error", "a PR needs a GitHub repository identity for this delivery");
  const expected = {
    host: github.host,
    repository: githubRepository(github),
    head_branch: ledger.candidate.branch,
    base: baseBranchName(ledger),
    url: `https://${github.host}/${githubRepository(github)}/pull/${pr.number}`,
  };
  for (const [field, value] of Object.entries(expected)) {
    if (pr[field] !== value) fail("identity_mismatch", `the PR's ${field} does not match this delivery`, { expected: value, observed: pr[field] });
  }
  if (pr.head_repository.host !== github.host) fail("identity_mismatch", "the PR head repository is on another host", { expected: github.host, observed: pr.head_repository.host });
}

function verifyPrObservation(ledger, pr) {
  requireShape(pr, "PR", "PR observation");
  if (ledger.pr === null) {
    verifyNewPr(ledger, pr);
    const created = [...operations(ledger).values()].map((events) => events[events.length - 1]).filter((event) => event.kind === "pr_create" && event.step === "verified");
    if (created.length > 0) {
      const observed = created[created.length - 1].observed;
      if (observed.url !== pr.url) fail("identity_mismatch", "the PR observation does not match the verified pr_create result", { expected: observed.url, observed: pr.url });
      if (observed.draft !== pr.draft || observed.oid !== pr.head) {
        fail("identity_mismatch", "the first PR observation's draft state and head must match the verified pr_create result", { expected: { draft: observed.draft, head: observed.oid }, observed: { draft: pr.draft, head: pr.head } });
      }
    } else if (pr.head !== expectedRemote(ledger).oid) {
      fail("identity_mismatch", "an adopted PR's head must be the expected remote state", { expected: expectedRemote(ledger).oid, observed: pr.head });
    }
    return;
  }
  for (const field of ["host", "repository", "number", "url", "head_branch", "head_repository", "base"]) {
    if (!isDeepStrictEqual(pr[field], ledger.pr[field])) {
      fail("identity_mismatch", `PR ${field} cannot change; retargeting or replacing the PR is refused`, { expected: ledger.pr[field], observed: pr[field] });
    }
  }
  if (Date.parse(pr.observed_at) < Date.parse(ledger.pr.observed_at)) fail("invariant_error", "a PR observation cannot be older than the recorded one");
  if (pr.head !== ledger.pr.head) {
    const pushed = new Set(verifiedPushes(ledger).filter((event) => event.target.ref === destinationRef(ledger)).map((event) => event.intended.oid));
    if (!pushed.has(pr.head) && ledger.candidate.remote_baseline?.oid !== pr.head) {
      fail("invariant_error", "a new PR head is recorded only after a verified push of that OID", { observed: pr.head });
    }
  }
  if (pr.draft !== ledger.pr.draft) {
    const states = [...operations(ledger).values()]
      .map((events) => events[events.length - 1])
      .filter((event) => event.kind === "pr_state" && event.step === "verified" && event.intended.draft === pr.draft);
    if (states.length === 0) fail("invariant_error", "a draft-state change is recorded only after a verified pr_state publication", { observed: pr.draft });
  }
}

function verifySpecCheck(specCheck) {
  for (const source of specCheck.source_hashes) verifySourceHash(source, "spec-check source");
  if (specCheck.report !== null && currentHash(specCheck.report) === null) fail("io_error", "the spec-check report is unreadable", { path: specCheck.report });
  if (["accept", "revise", "split", "rewrite"].includes(specCheck.verdict) && (specCheck.report === null || specCheck.checked_at === null)) {
    fail("invariant_error", "a recorded spec-check verdict names its report and time");
  }
  if (["not_run", "skipped"].includes(specCheck.verdict) && !specCheck.reason) fail("invariant_error", `a ${specCheck.verdict} spec check records its reason`);
}

function verifyPolicy(policy) {
  for (const source of policy.skill_sources) verifySourceHash(source, "skill source");
}

// Generated inputs belong outside the checkout. Resolve the parent so a
// symlink cannot redirect evidence writes into the worktree or Git metadata.
function externalOutputPath(ctx, target) {
  requireAbsolute(target, "output path");
  const parent = realpathOr(path.dirname(target), "io_error", "the output parent directory must exist");
  const resolved = path.join(parent, path.basename(target));
  for (const protectedDir of [ctx.worktree, ctx.common]) {
    const relative = path.relative(protectedDir, resolved);
    if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
      fail("argument_error", "generated inputs must be outside the worktree and common Git directory", { path: resolved });
    }
  }
  return resolved;
}

function writeInputFile(ctx, file, value) {
  const output = externalOutputPath(ctx, file);
  try {
    fs.writeFileSync(output, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  } catch (error) {
    fail("io_error", `cannot create input file without overwriting: ${error.code}`, { path: output });
  }
  return sourceFor(output);
}

function commandPrepareInit(options) {
  const ctx = resolveContext(options, { mutation: false });
  const remoteName = options.remote ?? null;
  const remoteUrl = remoteName === null ? null : configuredRemoteUrl(ctx.worktree, remoteName);
  if (remoteName !== null && remoteUrl === null) fail("environment_error", "the named remote is not configured", { observed: remoteName });
  const parsedRemote = remoteUrl === null ? null : parseGitHubUrl(remoteUrl);
  if (options["github-host"] && parsedRemote?.host !== options["github-host"]) fail("argument_error", "--github-host must match the selected remote host");
  const github = parsedRemote && (parsedRemote.host === "github.com" || parsedRemote.host === options["github-host"]) ? parsedRemote : null;
  const skillFiles = [...new Set([
    path.join(SCRIPT_DIR, "delivery-ledger.mjs"), SCHEMA_PATH,
    path.join(SCRIPT_DIR, "..", "SKILL.md"),
    path.join(SCRIPT_DIR, "..", "references", "authorization.md"),
    path.join(SCRIPT_DIR, "..", "references", "delivery-ledger.md"),
    ...(options["skill-source"] ?? []),
  ])];
  const authorization = { endpoint: options.endpoint, merge: false, monitoring: "none", notes: "", repo_overrides: [], grants: [] };
  const bootstrap = {
    brief: options.brief,
    instructions: (options.instruction ?? []).map(sourceFor),
    decisions: [],
    spec_check: { verdict: "not_run", report: null, source_hashes: [], checked_at: null, reason: "no pre-delivery spec check supplied" },
    policy: { skill_pack_oid: resolveCommit(SCRIPT_DIR, "HEAD"), skill_sources: skillFiles.map(sourceFor), session_mode: options["same-session"] ? "same_session" : "fresh" },
    dependencies: [], remote_name: remoteName, github,
    pr: null, remote_baseline: null,
    audit_policy: { required: false, state: "not_requested", reason: "no live audit requested" },
  };
  requireShape(authorization, "AuthorizationObject", "authorization");
  requireShape(bootstrap, "BootstrapInput", "bootstrap");
  const output = externalOutputPath(ctx, options["output-dir"]);
  try {
    fs.mkdirSync(output, { mode: 0o700 });
  } catch (error) {
    fail("io_error", `use a new output directory: ${error.code}`, { path: output });
  }
  const authorizationFile = writeInputFile(ctx, path.join(output, "authorization.json"), authorization);
  const bootstrapFile = writeInputFile(ctx, path.join(output, "bootstrap.json"), bootstrap);
  const status = summarizeStatus(ctx.worktree);
  return envelope("prepare-init", true, null, {
    authorization_file: authorizationFile.path, bootstrap_file: bootstrapFile.path,
    dirty_paths: [...new Set([...status.tracked, ...status.untracked])].sort(utf8Compare),
    note: "Inputs only; no ledger, claim or authority was created. Fill existing grants, source decisions, dependencies, audit policy and any verified PR/remote adoption before init.",
  });
}

function commandInit(options) {
  const ctx = resolveContext({ repo: options.repo, branch: options.branch }, { mutation: true });
  const authorization = readJsonFile(options["authorization-file"], "--authorization-file");
  requireExactKeys(authorization, ["endpoint", "merge", "monitoring", "notes", "repo_overrides", "grants"], "authorization");
  requireShape(authorization, "AuthorizationObject", "authorization");
  if (authorization.endpoint !== options.endpoint) {
    fail("invariant_error", "the authorization endpoint must equal --endpoint", { expected: options.endpoint, observed: authorization.endpoint });
  }
  const bootstrap = readJsonFile(options["bootstrap-file"], "--bootstrap-file");
  requireExactKeys(bootstrap, ["brief", "instructions", "decisions", "spec_check", "policy", "dependencies", "remote_name", "github", "pr", "remote_baseline", "audit_policy"], "bootstrap");
  requireShape(bootstrap, "BootstrapInput", "bootstrap");
  const baseOid = resolveCommit(ctx.worktree, options.base);
  if (!baseOid) fail("argument_error", "--base does not resolve to a commit", { observed: options.base });
  const head = headOid(ctx.worktree);
  if (!head) fail("identity_mismatch", "the delivery branch has no commit");
  const mergeBase = git(ctx.worktree, ["merge-base", baseOid, head], { allowFail: true });
  if (mergeBase.status !== 0) fail("identity_mismatch", "--base shares no history with the delivery branch", { observed: options.base });
  const holders = worktreesWithBranch(ctx.worktree, ctx.branch);
  if (holders.length > 1) fail("identity_mismatch", "the branch is checked out in more than one worktree", { observed: holders });
  const taskDocs = options["task-doc"].map((file) => sourceFor(file));
  const specs = (options.spec ?? []).map((file) => sourceFor(file));
  for (const source of bootstrap.instructions) verifySourceHash(source, "instruction");
  verifySpecCheck(bootstrap.spec_check);
  verifyPolicy(bootstrap.policy);
  verifyDependencies(bootstrap.dependencies);
  const decisionIds = new Set();
  for (const decision of bootstrap.decisions) {
    if (decisionIds.has(decision.id)) fail("invariant_error", "duplicate decision id", { id: decision.id });
    decisionIds.add(decision.id);
  }
  const status = summarizeStatus(ctx.worktree);
  if (status.unmerged.length > 0) fail("identity_mismatch", "unresolved index conflicts", { observed: status.unmerged });
  const dirty = [...status.tracked, ...status.untracked];
  if (dirty.length > 0) {
    const scope = bootstrap.decisions.find((decision) => decision.id === "dirty_scope");
    const unexplained = dirty.filter((file) => !scope || !mentionsPath(scope.text, file));
    if (unexplained.length > 0) {
      fail("invariant_error", "a dirty bootstrap needs a dirty_scope decision naming every included and excluded changed path", { observed: unexplained });
    }
  }
  let remoteUrl = null;
  if (bootstrap.remote_name !== null) {
    remoteUrl = configuredRemoteUrl(ctx.worktree, bootstrap.remote_name);
    if (remoteUrl === null) fail("environment_error", "the named remote is not configured", { observed: bootstrap.remote_name });
  }
  if (bootstrap.github !== null) {
    if (remoteUrl === null) fail("invariant_error", "a GitHub identity needs a configured remote");
    const parsed = parseGitHubUrl(remoteUrl);
    if (!parsed || !isDeepStrictEqual(parsed, bootstrap.github)) fail("identity_mismatch", "the GitHub identity does not match the remote URL", { expected: bootstrap.github, observed: parsed });
  }
  const at = now();
  const ledger = {
    schema_version: 1,
    delivery_id: randomUUID(),
    revision: 0,
    created_at: at,
    updated_at: at,
    repo: {
      path: ctx.worktree,
      common_git_dir: ctx.common,
      remote_name: bootstrap.remote_name,
      remote_url: remoteUrl,
      github: bootstrap.github,
      base_ref: options.base,
      base_oid: baseOid,
      diff_base_oid: mergeBase.stdout.trim(),
    },
    sources: { task_docs: taskDocs, specs, instructions: bootstrap.instructions, decisions: bootstrap.decisions, spec_check: bootstrap.spec_check },
    authorization,
    phase: "delivery",
    checkpoint: "bootstrap",
    owner: null,
    next: { phase: "delivery", checkpoint: "bootstrap", suggested_runtime: null, brief: bootstrap.brief, inputs: [], authorization_required: false },
    blocker: null,
    completion: null,
    policy: bootstrap.policy,
    candidate: {
      branch: ctx.branch,
      worktree: ctx.worktree,
      oid: null,
      previous_oid: null,
      generation: 0,
      baseline_oid: head,
      working_head_oid: head,
      recovery_required: false,
      state: "working",
      dependencies: bootstrap.dependencies,
      remote_baseline: bootstrap.remote_baseline,
    },
    validation: [],
    audits: [],
    reviews: [],
    defect_shapes: [],
    publications: [],
    role_runs: [],
    sessions: [],
    limitations: [],
    history: [],
    audit_policy: bootstrap.audit_policy,
    review_bound: null,
    pr: null,
    measurements: {
      files: null,
      additions: null,
      deletions: null,
      binary_files: null,
      measured_oid: null,
      diff_base_oid: null,
      review_rounds: 0,
      post_pr_findings: null,
      validation_reruns: 0,
      cohort_id: null,
      comparison_delivery_ids: [],
      observation_started_at: null,
      observation_ends_at: null,
      observation_complete: false,
      attribution_state: "not_enrolled",
      main_tokens: null,
      total_attributable_tokens: null,
      exclusion_reason: null,
    },
    updated_by: null,
  };
  if (bootstrap.remote_baseline !== null) {
    const baseline = bootstrap.remote_baseline;
    if (baseline.remote_name !== bootstrap.remote_name || baseline.ref !== destinationRef(ledger)) {
      fail("invariant_error", "the remote baseline must name this delivery's remote and branch ref", { expected: { remote_name: bootstrap.remote_name, ref: destinationRef(ledger) }, observed: baseline });
    }
    if (baseline.oid !== head) fail("identity_mismatch", "an adopted remote branch must match the verified baseline", { expected: head, observed: baseline.oid });
  }
  if (bootstrap.pr !== null) {
    verifyNewPr(ledger, bootstrap.pr);
    const expectedHead = bootstrap.remote_baseline?.oid ?? null;
    if (bootstrap.pr.head !== expectedHead) fail("identity_mismatch", "an adopted PR head must equal the adopted remote baseline", { expected: expectedHead, observed: bootstrap.pr.head });
    ledger.pr = bootstrap.pr;
  }
  if (PUSH_ENDPOINTS.has(authorization.endpoint) && (remoteUrl === null || (PR_ENDPOINTS.has(authorization.endpoint) && bootstrap.github === null))) {
    ledger.limitations.push({
      id: "init-publication-unavailable",
      kind: "publication_unavailable",
      phase: "delivery",
      reason: remoteUrl === null ? "no remote is configured, so the authorized push/PR endpoint cannot be reached" : "the remote is not GitHub, so the authorized PR endpoint cannot be reached",
      affects: ["authorization.endpoint"],
      at,
    });
  }
  ledger.history.push({
    id: randomUUID(),
    revision: 0,
    at,
    runtime: options.runtime,
    session: options.session,
    phase: "delivery",
    operation: "init",
    detail: { model: options.model ?? null, endpoint: authorization.endpoint, base_ref: options.base },
  });
  checkLedger(ledger, ctx);
  return withLock(ctx, "branch", () => {
    if (readLedger(ctx, { required: false }) !== null) {
      fail("invariant_error", "a ledger already exists for this branch; read it with show and continue it with claim", { path: ctx.ledgerPath });
    }
    const exclusion = ensureExclusion(ctx);
    writeLedger(ctx, ledger);
    return envelope("init", true, 0, { ledger_path: ctx.ledgerPath, delivery_id: ledger.delivery_id, exclusion_written: exclusion.written });
  });
}

function mentionsPath(text, file) {
  const boundary = (char) => char === undefined || /[\s`"'(),;:]/.test(char);
  for (let index = text.indexOf(file); index !== -1; index = text.indexOf(file, index + 1)) {
    if (boundary(text[index - 1]) && boundary(text[index + file.length])) return true;
  }
  return false;
}

function stageFor(ledger) {
  return ledger.candidate.state === "frozen" ? "frozen" : "working";
}

function commandCheck(options) {
  const ctx = resolveContext(options, { mutation: false });
  const ledger = readLedger(ctx);
  const stage = options.stage;
  if (stage !== "published" && stage !== stageFor(ledger)) {
    fail("invariant_error", `check --stage ${stage} does not fit a ${ledger.candidate.state} candidate`);
  }
  if (stage === "published" && ledger.candidate.state !== "frozen") fail("invariant_error", "only a frozen candidate can be verified as published");
  if (options.pr && ledger.pr === null) fail("invariant_error", "--pr needs a stored PR; none is recorded");
  const local = localIdentity(ctx, ledger, stage === "published" ? "frozen" : stage);
  const detail = { stage, local: { mismatches: local.mismatches, warnings: local.warnings, untracked: local.untracked } };
  const unverified = (what) =>
    fail(what.code, "the identity could not be verified", { path: ctx.ledgerPath, observed: { status: "unverified", detail: what.detail } });
  if (local.mismatches.length > 0) {
    fail("identity_mismatch", "local identity does not match the ledger", { path: ctx.ledgerPath, expected: { stage }, observed: { status: "mismatch", detail } });
  }
  if (local.environment.length > 0) unverified({ code: "environment_error", detail: { ...detail, environment: local.environment } });
  const remote = remoteIdentity(ctx, ledger, stage);
  detail.remote = remote;
  if (remote.status === "unverified") unverified({ code: "network_error", detail });
  if (remote.status === "mismatch") fail("identity_mismatch", "remote identity does not match the ledger", { path: ctx.ledgerPath, expected: { stage }, observed: { status: "mismatch", detail } });
  if (stage === "published" && remote.status === "not_configured") unverified({ code: "environment_error", detail: { ...detail, what: "no_remote" } });
  const needsPr = options.pr || (stage === "published" && PR_ENDPOINTS.has(ledger.authorization.endpoint));
  if (needsPr) {
    if (ledger.pr === null) fail("identity_mismatch", "the endpoint needs a PR and none is recorded", { observed: { status: "mismatch", detail } });
    const expectedHead = stage === "published" ? ledger.candidate.oid : (expectedRemote(ledger).oid ?? ledger.pr.head);
    const pr = prIdentity(ledger, expectedHead);
    detail.pr = pr;
    if (pr.status === "unverified") unverified({ code: "network_error", detail });
    if (pr.status === "mismatch") fail("identity_mismatch", "the PR does not match the ledger", { path: ctx.ledgerPath, expected: { stage }, observed: { status: "mismatch", detail } });
  }
  return envelope("check", false, ledger.revision, { status: "verified", ...detail });
}

function claimTransition(ledger, options, grant) {
  const phase = options.phase;
  if (ledger.phase === "done") {
    if (phase === "delivery") fail("invariant_error", "a completed delivery is not reopened; new findings need a review_round grant");
    return { checkpoint: phase === "review_round" ? "review" : null, fresh: true };
  }
  if (ledger.phase === "blocked") {
    if (phase !== ledger.blocker.resume_phase) fail("invariant_error", `a blocked ledger resumes only phase ${ledger.blocker.resume_phase}`, { expected: ledger.blocker.resume_phase, observed: phase });
    return { checkpoint: ledger.next?.checkpoint ?? ledger.blocker.resume_checkpoint, fresh: false };
  }
  if (phase !== ledger.phase) {
    fail("invariant_error", `wrong-phase reentry: phase ${ledger.phase} is unfinished`, { expected: ledger.phase, observed: phase });
  }
  if (ledger.next === null || ledger.next.phase !== phase) fail("invariant_error", "no recorded next step for this phase");
  if (ledger.next.authorization_required && !grant) fail("invariant_error", "the recorded next step needs new authorization");
  return { checkpoint: ledger.next.checkpoint, fresh: false };
}

function phaseGrant(ledger, phase, supplied, fresh) {
  if (phase === "delivery") {
    if (supplied) fail("invariant_error", "a delivery claim takes no grant; record authority with authorize");
    return null;
  }
  const scopes = phase === "review_round" ? ["review_round"] : ["monitor_observe", "monitor_remediate"];
  if (supplied) {
    if (!scopes.includes(supplied.scope)) fail("invariant_error", `a ${phase} claim accepts a ${scopes.join(" or ")} grant`, { observed: supplied.scope });
    if (consumedGrantIds(ledger).has(supplied.id)) fail("invariant_error", "this grant already started a phase; a new batch or watch needs a new request", { id: supplied.id });
    return supplied;
  }
  if (!fresh) return null;
  const recorded = unconsumedGrant(ledger, scopes);
  if (!recorded) {
    fail("invariant_error", `starting a new ${phase} needs a recorded ${scopes.join(" or ")} grant; an advisory next step or an old grant does not authorize it`);
  }
  return recorded;
}

function commandClaim(options) {
  const ctx = resolveContext(options, { mutation: true });
  const supplied = options["grant-file"] ? readGrant(options["grant-file"]) : null;
  return mutate(ctx, options, "claim", (draft, ledger) => {
    const actor = { runtime: options.runtime, session: options.session, model: options.model ?? null };
    if (ledger.owner) {
      const owner = ledger.owner;
      if (owner.session === options.session && owner.runtime !== options.runtime) {
        fail("owner_conflict", "this session label is already used by a different runtime", { expected: owner.runtime, observed: options.runtime });
      }
      const sameOwner = owner.session === options.session && owner.runtime === options.runtime;
      if (sameOwner && options["claim-id"] === owner.claim_id && owner.phase === options.phase && !options.force && !options.recovery) {
        if (supplied && !ledger.authorization.grants.some((entry) => isDeepStrictEqual(entry, supplied))) fail("invariant_error", "a reclaim cannot add a grant; use authorize");
        const last = [...ledger.history].reverse().find((event) => event.operation === "claim" && event.detail.claim_id === owner.claim_id);
        return { actor, data: { claim_id: owner.claim_id, consumed_next: last?.detail.consumed_next ?? null } };
      }
      if (!options.force) fail("owner_conflict", `phase ${owner.phase} is owned by another session; stop and report`, { observed: { runtime: owner.runtime, session: owner.session, phase: owner.phase } });
      if (!supplied || supplied.scope !== "takeover") fail("invariant_error", "a forced takeover records the user's stopped-owner statement as a takeover grant");
      if (options.phase !== owner.phase) fail("invariant_error", "a forced takeover resumes the interrupted phase; it cannot start another", { expected: owner.phase, observed: options.phase });
      if (consumedGrantIds(ledger).has(supplied.id)) fail("invariant_error", "this takeover grant was already used", { id: supplied.id });
      if (ledger.candidate.recovery_required && !options.recovery) fail("invariant_error", "recovery is required; take over with --recovery and reconcile");
      const drift = localIdentity(ctx, ledger, stageFor(ledger));
      if (!options.recovery) {
        if (drift.environment.length > 0) fail("environment_error", "the recorded remote is not configured here", { observed: drift.environment });
        if (drift.mismatches.length > 0) fail("identity_mismatch", "the checkout drifted from the ledger; take over with --recovery to reconcile", { observed: drift.mismatches });
      }
      addGrant(draft, supplied);
      const claimId = randomUUID();
      draft.owner = { ...actor, phase: owner.phase, claim_id: claimId, claimed_at: now() };
      if (options.recovery) draft.candidate.recovery_required = true;
      return {
        actor,
        data: { claim_id: claimId, consumed_next: null },
        detail: {
          claim_id: claimId,
          forced: true,
          reason: options.reason,
          grant_id: supplied.id,
          previous_owner: { runtime: owner.runtime, session: owner.session, model: owner.model, phase: owner.phase, claim_id: owner.claim_id, claimed_at: owner.claimed_at },
          consumed_next: null,
          recovery: Boolean(options.recovery),
          mismatches: options.recovery ? [...drift.mismatches, ...drift.environment] : [],
        },
      };
    }
    if (options.force) fail("invariant_error", "--force applies only when another session holds the claim");
    if (ledger.candidate.recovery_required && !options.recovery) fail("invariant_error", "recovery is required; claim with --recovery and reconcile");
    const transition = claimTransition(ledger, options, supplied);
    const grant = phaseGrant(ledger, options.phase, supplied, transition.fresh);
    const identity = localIdentity(ctx, ledger, stageFor(ledger));
    const drift = [...identity.mismatches];
    if (!options.recovery) {
      if (identity.environment.length > 0) fail("environment_error", "the recorded remote is not configured here", { observed: identity.environment });
      if (drift.length > 0) fail("identity_mismatch", "the checkout drifted from the ledger; stop and report, or claim --recovery", { observed: drift });
    }
    if (supplied) addGrant(draft, supplied);
    if (grant && grant.scope === "monitor_observe") draft.authorization.monitoring = "observe";
    if (grant && grant.scope === "monitor_remediate") draft.authorization.monitoring = "remediate";
    const claimId = randomUUID();
    const consumed = ledger.next;
    draft.owner = { ...actor, phase: options.phase, claim_id: claimId, claimed_at: now() };
    draft.phase = options.phase;
    draft.checkpoint = transition.checkpoint;
    draft.next = null;
    draft.blocker = null;
    if (options.recovery) draft.candidate.recovery_required = true;
    return {
      actor,
      data: { claim_id: claimId, consumed_next: consumed },
      detail: {
        claim_id: claimId,
        forced: false,
        grant_id: grant?.id ?? null,
        consumed_next: consumed,
        from_phase: ledger.phase,
        recovery: Boolean(options.recovery),
        mismatches: options.recovery ? [...drift, ...identity.environment] : [],
        warnings: identity.warnings,
      },
    };
  });
}

function commandUpdate(options, stdin) {
  const ctx = resolveContext(options, { mutation: true });
  const patch = parseJson(stdin, "stdin");
  if (!isObject(patch) || Object.keys(patch).length === 0) fail("schema_error", "update takes a nonempty JSON object patch");
  const protectedKeys = Object.keys(patch).filter((key) => !["checkpoint", "audit_policy"].includes(key));
  if (protectedKeys.length > 0) {
    fail("invariant_error", "generic update is limited to checkpoint and audit_policy; protected fields change only through their dedicated commands", { observed: protectedKeys });
  }
  return mutate(ctx, options, "update", (draft, ledger) => {
    const owner = requireOwner(ledger, options);
    forbidDuringRecovery(ledger, "update");
    if (hasOwn(patch, "checkpoint")) {
      if (!CHECKPOINTS.includes(patch.checkpoint)) fail("schema_error", "checkpoint is not a known checkpoint", { observed: patch.checkpoint });
      if (patch.checkpoint === null && ledger.phase !== "watch") fail("invariant_error", "only a watch uses a null checkpoint");
      if (patch.checkpoint === "implement" && ledger.candidate.state === "frozen") fail("invariant_error", "return a frozen candidate to implement with begin-change");
      if (ledger.phase === "watch" && ledger.authorization.monitoring !== "remediate" && patch.checkpoint !== null) {
        fail("invariant_error", "an observe-only watch never remediates");
      }
      draft.checkpoint = patch.checkpoint;
    }
    if (hasOwn(patch, "audit_policy")) {
      if (!isObject(patch.audit_policy)) fail("schema_error", "audit_policy patch must be an object");
      const unknown = Object.keys(patch.audit_policy).filter((key) => !["required", "state", "reason"].includes(key));
      if (unknown.length > 0) fail("schema_error", "unknown audit_policy keys", { observed: unknown });
      if (ledger.audit_policy.required && patch.audit_policy.required === false) {
        fail("invariant_error", "a required audit is not waived through update; record the blocked gate or a new authorized delivery");
      }
      Object.assign(draft.audit_policy, patch.audit_policy);
    }
    return { actor: owner, detail: { patch } };
  });
}

const SOURCE_FIELDS = { task_doc: "task_docs", spec: "specs", instruction: "instructions" };

// Reviews that relied on an older identity of a changed source no longer
// apply; they stay in the ledger as history.
function reviewsInvalidatedBy(ledger, source) {
  return currentItems(ledger.reviews)
    .filter((review) => review.source_hashes.some((entry) => entry.path === source.path && entry.sha256 !== source.sha256))
    .map((review) => `reviews:${review.id}`);
}

function addSource(draft, ledger, kind, source) {
  const field = SOURCE_FIELDS[kind];
  const latest = latestSources(ledger.sources[field]).find((entry) => entry.path === source.path);
  if (latest && latest.sha256 === source.sha256) return null;
  draft.sources[field].push(source);
  return { previous_sha256: latest?.sha256 ?? null, invalidated_evidence: reviewsInvalidatedBy(ledger, source) };
}

function commandSourceAdd(options) {
  const ctx = resolveContext(options, { mutation: true });
  const source = sourceFor(options.path);
  return mutate(ctx, options, "source-add", (draft, ledger) => {
    const owner = requireOwner(ledger, options);
    const change = addSource(draft, ledger, options.kind, source);
    return { actor: owner, data: { source }, detail: change ? { kind: options.kind, path: source.path, sha256: source.sha256, reason: options.reason, ...change } : {} };
  });
}

const ITEM_DEFS = {
  validation: "Validation",
  audits: "Audit",
  reviews: "Review",
  defect_shapes: "DefectShape",
  publications: "PublicationEvent",
  role_runs: "RoleRun",
  sessions: "Session",
  limitations: "Limitation",
  decisions: "Decision",
};

function recomputeCounters(ledger) {
  const cycles = new Set(currentItems(ledger.reviews).map((review) => review.cycle_id).filter((cycle) => cycle !== null));
  ledger.measurements.review_rounds = cycles.size;
  const groups = new Map();
  for (const entry of currentItems(ledger.validation)) {
    if (entry.kind !== "command" || entry.reused_from !== null || !["pass", "fail"].includes(entry.result)) continue;
    const key = `${sha256(JSON.stringify([entry.cwd, entry.command, entry.scope]))}:${entry.input_fingerprint}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  ledger.measurements.validation_reruns = [...groups.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
}

function requireCommit(ctx, oid, label) {
  if (!gitOk(ctx.worktree, ["cat-file", "-e", `${oid}^{commit}`])) fail("identity_mismatch", `${label} is not a commit in this repository`, { observed: oid });
}

function checkContentIdentity(ledger, contentId, manifestSource, label) {
  if (contentId === null) return null;
  const { manifest, digest } = loadManifest(manifestSource, ledger);
  if (contentId !== `sha256:${digest}`) fail("identity_mismatch", `${label} content_id does not match its manifest`, { expected: `sha256:${digest}`, observed: contentId });
  return manifest;
}

function readReceipt(receipt) {
  const bytes = (() => {
    try {
      return fs.readFileSync(receipt.path);
    } catch {
      return null;
    }
  })();
  if (bytes === null) return { ok: false, reason: "receipt file is missing" };
  if (sha256(bytes) !== receipt.sha256) return { ok: false, reason: "receipt file changed since it was recorded" };
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    return { ok: false, reason: "receipt is not JSON" };
  }
  const keys = ["baseOid", "candidateOid", "dependency", "exitCode", "lane", "lockfileHash", "policyHash"];
  if (!isObject(parsed) || JSON.stringify(Object.keys(parsed).sort()) !== JSON.stringify(keys)) return { ok: false, reason: "receipt keys do not match the adapter" };
  return { ok: true, receipt: parsed };
}

// The ncdmb UI receipt adapter, unchanged: it attests candidate, lane,
// lockfile, policy and base, and cannot attest a non-null dependency.
function receiptAccepts(ctx, ledger, validation, candidateOid) {
  if (validation.receipt.adapter !== RECEIPT_ADAPTER) return { ok: false, reason: `unsupported receipt adapter ${validation.receipt.adapter}` };
  const read = readReceipt(validation.receipt);
  if (!read.ok) return read;
  const receipt = read.receipt;
  const identity = { baseOid: receipt.baseOid, candidateOid: receipt.candidateOid, dependency: receipt.dependency, lane: receipt.lane, lockfileHash: receipt.lockfileHash, policyHash: receipt.policyHash };
  if (!isDeepStrictEqual(validation.receipt.identity, identity)) return { ok: false, reason: "recorded receipt identity differs from the receipt" };
  if (receipt.dependency !== null) return { ok: false, reason: "the receipt adapter cannot attest a dependency" };
  if (receipt.exitCode !== 0) return { ok: false, reason: "the receipt is not green" };
  if (receipt.candidateOid !== candidateOid) return { ok: false, reason: "the receipt names another candidate" };
  if (!["affected", "required"].includes(receipt.lane)) return { ok: false, reason: "a focused-lane receipt is not a gate" };
  if (currentHash(path.join(ctx.worktree, "pnpm-lock.yaml")) !== receipt.lockfileHash) return { ok: false, reason: "lockfile changed" };
  if (currentHash(path.join(ctx.worktree, ".agent", "delivery-policy.json")) !== receipt.policyHash) return { ok: false, reason: "delivery policy changed" };
  if (receipt.lane === "affected" && ![ledger.repo.diff_base_oid, ledger.repo.base_oid].includes(receipt.baseOid)) return { ok: false, reason: "receipt base is not this delivery's base" };
  if (receipt.lane === "required" && receipt.baseOid !== null && ![ledger.repo.diff_base_oid, ledger.repo.base_oid].includes(receipt.baseOid)) {
    return { ok: false, reason: "receipt base is not this delivery's base" };
  }
  return { ok: true };
}

function appendValidationChecks(ctx, ledger, item) {
  const execution = item.kind === "command" && item.reused_from === null && ["pass", "fail"].includes(item.result);
  let manifest = null;
  let digest = null;
  if (item.content_manifest !== null) ({ manifest, digest } = loadManifest(item.content_manifest, ledger));
  if (item.content_id !== null && item.content_id !== `sha256:${digest}`) fail("identity_mismatch", "content_id does not match its manifest", { expected: `sha256:${digest}`, observed: item.content_id });
  if (execution && item.input_fingerprint !== digest) {
    fail("invariant_error", "a completed command's input_fingerprint must be its manifest's canonical digest", { expected: digest, observed: item.input_fingerprint });
  }
  if (execution && item.content_id !== null) verifyManifestContent(ctx.worktree, manifest, "worktree");
  if (item.oid !== null) {
    requireCommit(ctx, item.oid, "validation oid");
    if (execution) {
      if (ledger.candidate.state !== "frozen" || item.oid !== ledger.candidate.oid) fail("invariant_error", "a committed gate records the frozen candidate OID", { expected: ledger.candidate.oid, observed: item.oid });
      const status = summarizeStatus(ctx.worktree);
      if (headOid(ctx.worktree) !== item.oid || status.tracked.length > 0) fail("identity_mismatch", "a dirty or moved checkout cannot produce committed-candidate evidence", { observed: status.tracked });
      verifyManifestContent(ctx.worktree, manifest, item.oid);
    }
  }
  if (item.kind === "receipt") {
    const read = readReceipt(item.receipt);
    if (!read.ok) fail("identity_mismatch", read.reason, { path: item.receipt.path });
    const receipt = read.receipt;
    if (item.oid !== receipt.candidateOid) fail("identity_mismatch", "validation oid must be the receipt's candidateOid", { expected: receipt.candidateOid, observed: item.oid });
    if (item.exit_code !== receipt.exitCode || (item.result === "pass") !== (receipt.exitCode === 0)) fail("invariant_error", "result and exit_code must match the receipt");
  }
  if (item.reused_from !== null) {
    const source = currentItems(ledger.validation).find((entry) => entry.id === item.reused_from);
    if (!source) fail("invariant_error", "reused_from names a missing or superseded validation record", { id: item.reused_from });
    if (source.result !== "pass") fail("invariant_error", "only passing evidence can be reused", { id: source.id });
    if (source.input_fingerprint === null) fail("invariant_error", "evidence without an input fingerprint cannot support reuse", { id: source.id });
    if (item.input_fingerprint !== null) fail("invariant_error", "a reuse record is not an execution; its input_fingerprint is null");
    if (item.reuse.source_oid !== source.oid || item.reuse.target_oid !== item.oid) fail("invariant_error", "reuse source and target OIDs must match the records");
    if (item.exit_code !== source.exit_code || item.log !== source.log || item.command !== source.command || item.cwd !== source.cwd || item.scope !== source.scope) {
      fail("invariant_error", "a reuse record points at the original command, log and exit code");
    }
    if (manifest === null) fail("invariant_error", "a reuse record retains the target content manifest");
    if (digest !== source.input_fingerprint) fail("identity_mismatch", "changed inputs reject reuse", { expected: source.input_fingerprint, observed: digest });
    for (const input of item.reuse.unchanged_inputs) verifySourceHash(input, "reuse input");
    if (item.oid !== null) verifyManifestContent(ctx.worktree, manifest, item.oid);
  }
}

function readBatchSnapshot(batch) {
  let bytes;
  try {
    bytes = fs.readFileSync(batch.path);
  } catch {
    fail("io_error", "the review batch snapshot is unreadable", { path: batch.path });
  }
  if (sha256(bytes) !== batch.sha256) fail("identity_mismatch", "the review batch snapshot changed since it was frozen", { path: batch.path });
  const snapshot = parseJson(bytes.toString("utf8"), batch.path);
  if (!isObject(snapshot) || !Array.isArray(snapshot.threads)) fail("schema_error", "a review batch snapshot has a threads array");
  for (const thread of snapshot.threads) {
    // GitHub's databaseId is numeric; keep the persisted snapshot's bytes
    // unchanged while normalizing the representation used for comparisons.
    if (isObject(thread) && Number.isSafeInteger(thread.root_comment_database_id) && thread.root_comment_database_id > 0) {
      thread.root_comment_database_id = String(thread.root_comment_database_id);
    }
    if (!isObject(thread) || typeof thread.thread_graphql_id !== "string" || typeof thread.root_comment_database_id !== "string" || !thread.thread_graphql_id || !thread.root_comment_database_id) {
      fail("schema_error", "each snapshot thread names thread_graphql_id and root_comment_database_id as nonempty strings");
    }
  }
  if (snapshot.id !== batch.id || snapshot.head !== batch.head || snapshot.complete !== batch.complete) fail("identity_mismatch", "the batch record does not match its snapshot");
  return snapshot;
}

function appendReviewChecks(ctx, ledger, item) {
  checkContentIdentity(ledger, item.content_id, item.content_manifest, "review");
  if (item.candidate_oid !== null) requireCommit(ctx, item.candidate_oid, "review candidate_oid");
  for (const finding of item.findings) {
    checkContentIdentity(ledger, finding.fix_content_id, finding.fix_content_manifest, `finding ${finding.id}`);
    if (finding.fix_oid !== null) requireCommit(ctx, finding.fix_oid, `finding ${finding.id} fix_oid`);
  }
  if (item.batch) {
    const snapshot = readBatchSnapshot(item.batch);
    if (ledger.pr && isObject(snapshot.pr)) {
      if (snapshot.pr.repository !== ledger.pr.repository || snapshot.pr.number !== ledger.pr.number) fail("identity_mismatch", "the batch snapshot is for another PR");
    }
    const threads = new Set(snapshot.threads.map((thread) => thread.thread_graphql_id));
    for (const finding of item.findings) {
      if (finding.thread_id !== null && !threads.has(finding.thread_id)) fail("invariant_error", `finding ${finding.id} names a thread outside the frozen batch`);
    }
  }
}

function lastSteps(ledger) {
  return [...operations(ledger).entries()].map(([operationId, events]) => ({ operationId, first: events[0], last: events[events.length - 1] }));
}

function batchReview(ledger, batchId) {
  const review = currentItems(ledger.reviews).find((entry) => entry.batch?.id === batchId);
  if (!review) fail("invariant_error", "batch_id names no current review batch", { id: batchId });
  if (!review.batch.complete) fail("invariant_error", "an incomplete PR findings snapshot is unavailable, not an empty batch; it cannot back publication", { id: batchId });
  return review;
}

function checkBody(file, expectedHash, deliveryId) {
  let body;
  try {
    body = fs.readFileSync(file);
  } catch {
    fail("io_error", "the body file is unreadable", { path: file });
  }
  if (sha256(body) !== expectedHash) fail("identity_mismatch", "body_sha256 does not match the body file", { path: file, expected: expectedHash, observed: sha256(body) });
  return body.toString("utf8");
}

function checkPrTarget(ledger, item) {
  const pr = ledger.pr;
  if (!pr) fail("invariant_error", "this publication needs a recorded PR");
  if (item.target.pr_number !== pr.number || item.target.pr_url !== pr.url) fail("identity_mismatch", "the publication targets another PR", { expected: { pr_number: pr.number, pr_url: pr.url }, observed: item.target });
}

function publicationAuthority(ledger, item) {
  const { owner, authorization } = ledger;
  if (owner.phase === "watch" && authorization.monitoring !== "remediate") fail("invariant_error", "an observe-only watch never publishes or remediates");
  if (ledger.pr && ledger.pr.state !== "OPEN") fail("invariant_error", `the PR is ${ledger.pr.state}; no further publication`);
  if (item.kind === "push" && !PUSH_ENDPOINTS.has(authorization.endpoint)) fail("invariant_error", `a push exceeds the authorized ${authorization.endpoint} endpoint`);
  if (["pr_create", "pr_body", "pr_state"].includes(item.kind) && !PR_ENDPOINTS.has(authorization.endpoint)) {
    fail("invariant_error", `a PR publication exceeds the authorized ${authorization.endpoint} endpoint`);
  }
  if (item.kind === "pr_state" && item.intended.draft === false && authorization.endpoint !== "ready_pr") fail("invariant_error", "marking the PR ready needs the ready_pr endpoint");
  if (item.kind === "pr_create" && item.intended.draft === false && authorization.endpoint !== "ready_pr") fail("invariant_error", "a non-draft PR needs the ready_pr endpoint");
  if (["reply", "resolve"].includes(item.kind) && !(owner.phase === "review_round" || (owner.phase === "watch" && authorization.monitoring === "remediate"))) {
    fail("invariant_error", "replies and resolutions need an authorized review_round or remediating watch; an advisory next step never triggers posting");
  }
}

function prepareChecks(ctx, ledger, item) {
  const { candidate, repo } = ledger;
  if (candidate.state !== "frozen" || item.candidate_oid !== candidate.oid) fail("invariant_error", "publication uses the frozen candidate unchanged", { expected: candidate.oid, observed: item.candidate_oid });
  publicationAuthority(ledger, item);
  const drift = localIdentity(ctx, ledger, "frozen");
  if (drift.environment.length > 0) fail("environment_error", "the recorded remote is not configured here", { observed: drift.environment });
  if (drift.mismatches.length > 0) fail("identity_mismatch", "the checkout drifted from the frozen candidate; stop before publishing", { observed: drift.mismatches });
  const github = repo.github;
  if (item.kind === "push") {
    if (repo.remote_name === null) fail("invariant_error", "no remote is configured for this delivery");
    if (item.target.remote_name !== repo.remote_name || item.target.remote_url !== repo.remote_url) fail("identity_mismatch", "the push targets another remote", { expected: { remote_name: repo.remote_name, remote_url: repo.remote_url }, observed: item.target });
    if (item.target.host !== (github?.host ?? null) || item.target.repository !== githubRepository(github)) {
      fail("identity_mismatch", "push host/repository must be this delivery's GitHub identity, or null for a non-GitHub remote", { observed: item.target });
    }
    if (item.intended.oid !== item.candidate_oid) fail("invariant_error", "a push publishes the candidate OID");
    if (item.target.ref !== destinationRef(ledger)) {
      fail("invariant_error", "a delivery pushes only to its own branch ref", { expected: destinationRef(ledger), observed: item.target.ref });
    }
    const expected = expectedRemote(ledger);
    if (item.precondition.head_oid !== expected.oid) {
      fail("identity_mismatch", "the push precondition must be the expected remote state (null only for an absent destination)", { expected: expected.oid, observed: item.precondition.head_oid });
    }
  } else {
    if (!github) fail("invariant_error", "GitHub publication needs a GitHub repository identity");
    if (item.target.host !== github.host || item.target.repository !== githubRepository(github)) {
      fail("identity_mismatch", "the publication targets another repository", { expected: { host: github.host, repository: githubRepository(github) }, observed: { host: item.target.host, repository: item.target.repository } });
    }
  }
  const remoteHead = expectedRemote(ledger).oid;
  switch (item.kind) {
    case "pr_create": {
      if (ledger.pr !== null) fail("invariant_error", "a PR is already recorded for this delivery");
      if (item.target.pr_number !== null || item.target.pr_url !== null) fail("invariant_error", "pr_number and pr_url stay null until the new PR is observed");
      if (!isDeepStrictEqual(item.intended.head_repository, github) || item.intended.head_branch !== candidate.branch || item.intended.base !== baseBranchName(ledger)) {
        fail("identity_mismatch", "the PR must be opened from this delivery's branch onto its verified base", { expected: { head_repository: github, head_branch: candidate.branch, base: baseBranchName(ledger) }, observed: item.intended });
      }
      if (remoteHead !== item.candidate_oid || item.precondition.head_oid !== item.candidate_oid) fail("identity_mismatch", "push the candidate before opening its PR", { expected: item.candidate_oid, observed: remoteHead });
      if (!wellFormedBlock(checkBody(item.intended.body_file, item.intended.body_sha256), ledger.delivery_id)) fail("invariant_error", "the PR body carries this delivery's summary block");
      break;
    }
    case "pr_body":
    case "pr_state":
    case "reply":
    case "resolve": {
      checkPrTarget(ledger, item);
      const expectedHead = remoteHead ?? ledger.pr.head;
      if (item.precondition.head_oid !== expectedHead) {
        fail("identity_mismatch", "the PR head moved since the ledger's last verified state; stop conflicting writes", { expected: expectedHead, observed: item.precondition.head_oid });
      }
      if (item.kind === "pr_body") {
        if (item.precondition.body_sha256 === null) fail("invariant_error", "a PR-body write records the current body hash it compared");
        if (!wellFormedBlock(checkBody(item.intended.body_file, item.intended.body_sha256), ledger.delivery_id)) fail("invariant_error", "the PR body carries this delivery's summary block");
      }
      if (item.kind === "pr_state" && item.precondition.state !== "OPEN") fail("invariant_error", "a draft-state change needs an open PR");
      if (item.kind === "reply" || item.kind === "resolve") replyChecks(ctx, ledger, item, remoteHead);
      break;
    }
    default:
      break;
  }
  if (["reply", "resolve"].includes(item.kind) === (item.batch_id === null)) {
    fail("invariant_error", "replies and resolutions name their frozen batch; other publications do not");
  }
  for (const { operationId, first, last } of lastSteps(ledger)) {
    if (first.kind === item.kind && isDeepStrictEqual(first.target, item.target) && !TERMINAL_STEPS.has(last.step)) {
      fail("invariant_error", "the same action has an unresolved operation; inspect remote state and finish it before starting another", { id: operationId });
    }
  }
}

function replyChecks(ctx, ledger, item, remoteHead) {
  const review = batchReview(ledger, item.batch_id);
  const snapshot = readBatchSnapshot(review.batch);
  const thread = snapshot.threads.find((entry) => entry.thread_graphql_id === item.target.thread_graphql_id);
  if (!thread) fail("identity_mismatch", "the thread is not in the frozen batch", { observed: item.target.thread_graphql_id });
  const finding = review.findings.find((entry) => entry.thread_id === thread.thread_graphql_id);
  if (!finding) fail("invariant_error", "no finding in the batch is paired with this thread");
  if (item.kind === "reply") {
    if (thread.root_comment_database_id !== item.target.root_comment_database_id) {
      fail("identity_mismatch", "the root comment and thread IDs do not belong together in the frozen batch", { expected: thread.root_comment_database_id, observed: item.target.root_comment_database_id });
    }
    if (finding.disposition === "pending") fail("invariant_error", "disposition the finding before replying");
    checkBody(item.intended.body_file, item.intended.body_sha256);
    const replied = lastSteps(ledger).some(({ first, last }) => first.kind === "reply" && first.batch_id === item.batch_id && first.target.thread_graphql_id === item.target.thread_graphql_id && last.step === "verified");
    if (replied) fail("invariant_error", "this thread already has a verified reply for the batch; never recreate it");
    return;
  }
  const reply = operations(ledger).get(item.intended.reply_operation_id);
  const replyLast = reply?.[reply.length - 1];
  if (!reply || reply[0].kind !== "reply" || replyLast.step !== "verified" || reply[0].target.thread_graphql_id !== item.target.thread_graphql_id || reply[0].batch_id !== item.batch_id) {
    fail("invariant_error", "resolve only after this thread's reply is verified", { id: item.intended.reply_operation_id });
  }
  if (!["fixed", "duplicate", "already_resolved"].includes(finding.disposition)) fail("invariant_error", `a ${finding.disposition} thread stays unresolved`);
  if (finding.disposition === "fixed") {
    if (finding.fix_oid === null || remoteHead === null || !isAncestor(ctx.worktree, finding.fix_oid, remoteHead)) {
      fail("invariant_error", "resolve a fixed finding only after its fix is remotely verified");
    }
  }
}

function verifiedObservationChecks(ledger, item) {
  const observed = item.observed;
  const mismatch = (message, expected, actual) => fail("identity_mismatch", `${message}; record a mismatch step instead`, { expected, observed: actual });
  const sameTarget = (fields) => {
    for (const field of fields) {
      if (!isDeepStrictEqual(observed.target[field], item.target[field])) mismatch(`observed ${field} differs from the target`, item.target[field], observed.target[field]);
    }
  };
  switch (item.kind) {
    case "push":
      sameTarget(["remote_url", "ref"]);
      if (observed.oid !== item.intended.oid) mismatch("the observed remote OID differs", item.intended.oid, observed.oid);
      break;
    case "pr_create":
      sameTarget(["host", "repository"]);
      if (!observed.object_id || !observed.url) mismatch("a created PR is identified by object ID and URL", "object_id and url", observed);
      for (const field of ["head_repository", "head_branch", "base"]) {
        if (!isDeepStrictEqual(observed.target[field], item.intended[field])) mismatch(`the created PR's ${field} differs`, item.intended[field], observed.target[field]);
      }
      if (observed.oid !== item.candidate_oid || observed.draft !== item.intended.draft || observed.body_sha256 !== item.intended.body_sha256 || observed.state !== "OPEN") {
        mismatch("the created PR's head, draft state or body differs", { oid: item.candidate_oid, draft: item.intended.draft, body_sha256: item.intended.body_sha256 }, observed);
      }
      break;
    case "pr_body":
      sameTarget(["host", "repository", "pr_number", "pr_url"]);
      if (observed.oid !== item.precondition.head_oid || observed.body_sha256 !== item.intended.body_sha256) mismatch("the PR head or decoded body differs", item.intended.body_sha256, observed.body_sha256);
      break;
    case "pr_state":
      sameTarget(["host", "repository", "pr_number", "pr_url"]);
      if (observed.draft !== item.intended.draft || observed.state !== "OPEN" || observed.oid !== item.precondition.head_oid) mismatch("the PR draft state or head differs", item.intended.draft, observed.draft);
      break;
    case "reply":
      sameTarget(["host", "repository", "pr_number", "root_comment_database_id", "thread_graphql_id"]);
      if (!observed.object_id || !observed.url) mismatch("a reply is identified by its returned ID and URL", "object_id and url", observed);
      if (observed.body_sha256 !== item.intended.body_sha256) mismatch("the reply's decoded body differs", item.intended.body_sha256, observed.body_sha256);
      break;
    case "resolve":
      sameTarget(["thread_graphql_id"]);
      if (observed.resolved !== true) mismatch("the thread is not resolved", true, observed.resolved);
      break;
    default:
      break;
  }
}

function publicationChecks(ctx, ledger, item) {
  const events = operations(ledger).get(item.operation_id);
  if (item.step === "prepared") {
    if (events) fail("invariant_error", "this operation is already prepared", { id: item.operation_id });
    prepareChecks(ctx, ledger, item);
    return;
  }
  if (!events) fail("invariant_error", "record a prepared step before observing an operation", { id: item.operation_id });
  for (const field of operationFields) {
    if (!isDeepStrictEqual(item[field], events[0][field])) fail("invariant_error", `an operation keeps its ${field} across steps`, { expected: events[0][field], observed: item[field] });
  }
  const last = events[events.length - 1];
  if (TERMINAL_STEPS.has(last.step)) fail("invariant_error", `the operation already ended as ${last.step}`, { id: item.operation_id });
  if (item.step === "verified") verifiedObservationChecks(ledger, item);
}

function appendChecks(ctx, ledger, field, item) {
  switch (field) {
    case "validation":
      appendValidationChecks(ctx, ledger, item);
      break;
    case "audits":
      checkContentIdentity(ledger, item.content_id, item.content_manifest, "audit");
      if (item.oid !== null) requireCommit(ctx, item.oid, "audit oid");
      break;
    case "reviews":
      appendReviewChecks(ctx, ledger, item);
      break;
    case "role_runs":
      checkContentIdentity(ledger, item.content_id, item.content_manifest, "role run");
      if (item.fallback_reason === INDEPENDENCE_REQUIRED && (item.status !== "blocked" || item.execution !== "inline")) {
        fail("invariant_error", "a required independent review that is unavailable is a blocked gate; self-review never substitutes for it");
      }
      break;
    case "publications":
      forbidDuringRecovery(ledger, "publication");
      publicationChecks(ctx, ledger, item);
      break;
    default:
      break;
  }
}

function commandAppend(options, stdin) {
  const ctx = resolveContext(options, { mutation: true });
  const field = options.field;
  const item = parseJson(stdin, "stdin");
  if (!isObject(item)) fail("schema_error", "append takes exactly one JSON object");
  requireShape(item, ITEM_DEFS[field], field);
  const problems = itemProblems(field, item);
  if (problems.length > 0) fail("invariant_error", problems.join("; "), { id: item.id ?? null });
  return mutate(ctx, options, "append", (draft, ledger) => {
    const owner = requireOwner(ledger, options);
    const items = collectionOf(draft, field);
    const existing = items.find((entry) => entry.id === item.id);
    if (existing) {
      if (isDeepStrictEqual(existing, item)) return { actor: owner, data: { id: item.id } };
      fail("invariant_error", "an existing ID was reused with different content; use a new ID and supersedes_id", { id: item.id });
    }
    appendChecks(ctx, ledger, field, item);
    items.push(item);
    recomputeCounters(draft);
    return { actor: owner, operation: `append ${field}`, data: { id: item.id }, detail: { collection: field, id: item.id } };
  });
}

function applyGrantEffect(draft, grant) {
  if (grant.scope === "endpoint") draft.authorization.endpoint = grant.endpoint;
  if (grant.scope === "monitor_observe") draft.authorization.monitoring = "observe";
  if (grant.scope === "monitor_remediate") draft.authorization.monitoring = "remediate";
  if (grant.scope === "merge") draft.authorization.merge = true;
}

function commandAuthorize(options) {
  const ctx = resolveContext(options, { mutation: true });
  const grant = readGrant(options["grant-file"]);
  return mutate(ctx, options, "authorize", (draft, ledger) => {
    const owner = requireOwner(ledger, options);
    if (ledger.candidate.recovery_required && grant.scope !== "reconcile") fail("invariant_error", "during recovery only a reconcile grant can be recorded");
    if (!addGrant(draft, grant)) return { actor: owner, data: { grant_id: grant.id } };
    applyGrantEffect(draft, grant);
    return { actor: owner, data: { grant_id: grant.id }, detail: { grant_id: grant.id, scope: grant.scope, endpoint: grant.endpoint } };
  });
}

function currentValidationRefs(ledger) {
  return currentItems(ledger.validation).map((entry) => `validation:${entry.id}`);
}

function currentInputEvidenceRefs(ledger) {
  return [...currentValidationRefs(ledger), ...["reviews", "audits"].flatMap((collection) => currentItems(ledger[collection]).map((item) => `${collection}:${item.id}`))];
}

function commandRecordContext(options) {
  const ctx = resolveContext(options, { mutation: true });
  const payload = readJsonFile(options["context-file"], "--context-file");
  if (!isObject(payload) || Object.keys(payload).length === 0) fail("schema_error", "the context payload is a nonempty object");
  const unknown = Object.keys(payload).filter((key) => !["spec_check", "policy", "dependencies", "pr"].includes(key));
  if (unknown.length > 0) fail("invariant_error", "record-context writes only spec_check, policy, dependencies and pr; it cannot change authorization or identity", { observed: unknown });
  if (hasOwn(payload, "spec_check")) {
    requireShape(payload.spec_check, "SpecCheck", "spec_check");
    verifySpecCheck(payload.spec_check);
  }
  if (hasOwn(payload, "policy")) {
    requireShape(payload.policy, "Policy", "policy");
    verifyPolicy(payload.policy);
  }
  if (hasOwn(payload, "dependencies")) {
    if (!Array.isArray(payload.dependencies)) fail("schema_error", "dependencies must be an array");
    payload.dependencies.forEach((dependency) => requireShape(dependency, "Dependency", "dependency"));
    verifyDependencies(payload.dependencies);
  }
  return mutate(ctx, options, "record-context", (draft, ledger) => {
    const owner = requireOwner(ledger, options);
    forbidDuringRecovery(ledger, "record-context");
    const before = {};
    const after = {};
    let invalidated = [];
    if (hasOwn(payload, "spec_check")) {
      before.spec_check = ledger.sources.spec_check;
      draft.sources.spec_check = payload.spec_check;
      after.spec_check = payload.spec_check;
    }
    if (hasOwn(payload, "policy")) {
      before.policy = ledger.policy;
      draft.policy = payload.policy;
      after.policy = payload.policy;
    }
    if (hasOwn(payload, "dependencies")) {
      forbidDuringRecovery(ledger, "a dependency change outside dependency_refresh");
      if (ledger.candidate.state === "frozen" && !isDeepStrictEqual(payload.dependencies, ledger.candidate.dependencies)) {
        fail("invariant_error", "a frozen candidate's dependencies change only after begin-change (or through dependency_refresh recovery)");
      }
      before.dependencies = ledger.candidate.dependencies;
      draft.candidate.dependencies = payload.dependencies;
      after.dependencies = payload.dependencies;
      if (!isDeepStrictEqual(payload.dependencies, ledger.candidate.dependencies)) invalidated = currentInputEvidenceRefs(ledger);
    }
    if (hasOwn(payload, "pr")) {
      verifyPrObservation(ledger, payload.pr);
      before.pr = ledger.pr;
      draft.pr = payload.pr;
      after.pr = payload.pr;
    }
    return { actor: owner, detail: { reason: options.reason, before, after, invalidated_evidence: invalidated } };
  });
}

function beginChangeTransition(draft, ledger) {
  if (ledger.candidate.state === "frozen") {
    draft.candidate.state = "working";
    draft.candidate.working_head_oid = ledger.candidate.oid;
  }
  draft.checkpoint = "implement";
}

function commandBeginChange(options) {
  const ctx = resolveContext(options, { mutation: true });
  return mutate(ctx, options, "begin-change", (draft, ledger) => {
    const owner = requireOwner(ledger, options);
    forbidDuringRecovery(ledger, "begin-change");
    if (ledger.phase === "watch" && ledger.authorization.monitoring !== "remediate") fail("invariant_error", "an observe-only watch never remediates");
    beginChangeTransition(draft, ledger);
    return { actor: owner, detail: { from_state: ledger.candidate.state, working_head_oid: draft.candidate.working_head_oid } };
  });
}

function inScope(file, scopes) {
  return scopes.some((scope) => file === scope || file.startsWith(`${scope}/`));
}

function readCommitEvidence(evidence) {
  requireExactKeys(evidence, ["prior_head", "reason", "source", "intended_paths", "excluded_paths"], "commit evidence");
  requireShape(evidence, "CommitEvidence", "commit evidence");
  for (const entry of [...evidence.intended_paths, ...evidence.excluded_paths]) {
    if (!validManifestPath(entry)) fail("invariant_error", "commit-evidence paths are literal relative Git paths", { observed: entry });
  }
  return evidence;
}

// Shared by freeze and interrupted_commit reconciliation. Returns null
// for an exact no-op.
function applyFreeze(ctx, ledger, draft, oid, evidence) {
  const { candidate } = ledger;
  if (evidence.prior_head !== candidate.working_head_oid) {
    fail("identity_mismatch", "prior_head must be the recorded working head", { expected: candidate.working_head_oid, observed: evidence.prior_head });
  }
  if (ctx.checkedOut !== candidate.branch) fail("identity_mismatch", "freeze runs on the recorded branch", { expected: candidate.branch, observed: ctx.checkedOut });
  const head = headOid(ctx.worktree);
  if (head !== oid) fail("identity_mismatch", "HEAD must equal --oid", { expected: oid, observed: head });
  const status = summarizeStatus(ctx.worktree);
  if (status.tracked.length > 0 || status.unmerged.length > 0) fail("identity_mismatch", "a frozen candidate has no tracked or index changes", { observed: [...status.tracked, ...status.unmerged] });
  const stray = status.untracked.filter((file) => inScope(file, evidence.intended_paths));
  if (stray.length > 0) fail("identity_mismatch", "untracked implementation files inside the intended scope", { observed: stray });
  const dependencies = dependencyProblems(candidate.dependencies);
  if (dependencies.length > 0) fail("identity_mismatch", "dependency identity drifted; reconcile before freezing", { observed: dependencies });
  if (candidate.state === "frozen" && oid === candidate.oid) return null;
  if (candidate.state === "frozen") fail("invariant_error", "return to working with begin-change before freezing a different commit");
  let changedPaths = [];
  if (oid !== evidence.prior_head) {
    if (!isAncestor(ctx.worktree, evidence.prior_head, oid)) fail("identity_mismatch", "the new commit does not descend from the working head", { expected: evidence.prior_head, observed: oid });
    changedPaths = splitNul(git(ctx.worktree, ["diff", "--name-only", "-z", "--no-renames", evidence.prior_head, oid, "--"], { buffer: true }).stdout).map(decodePath);
    const outside = changedPaths.filter((file) => !inScope(file, evidence.intended_paths) || inScope(file, evidence.excluded_paths));
    if (outside.length > 0) fail("identity_mismatch", "the commit changes paths outside the intended scope; an unexplained advance is refused", { observed: outside });
  }
  if (oid !== candidate.oid) {
    draft.candidate.previous_oid = candidate.oid;
    draft.candidate.oid = oid;
    draft.candidate.generation = candidate.generation + 1;
  }
  draft.candidate.state = "frozen";
  draft.candidate.working_head_oid = oid;
  return { oid, previous_oid: draft.candidate.previous_oid, generation: draft.candidate.generation, prior_head: evidence.prior_head, changed_paths: changedPaths, reason: evidence.reason, source: evidence.source };
}

function commandFreeze(options) {
  const ctx = resolveContext(options, { mutation: true });
  const evidence = readCommitEvidence(readJsonFile(options["evidence-file"], "--evidence-file"));
  return mutate(ctx, options, "freeze", (draft, ledger) => {
    const owner = requireOwner(ledger, options);
    forbidDuringRecovery(ledger, "an ordinary freeze");
    if (ledger.phase === "watch" && ledger.authorization.monitoring !== "remediate") fail("invariant_error", "an observe-only watch never remediates");
    const transition = applyFreeze(ctx, ledger, draft, options.oid, evidence);
    return { actor: owner, data: { oid: options.oid }, detail: transition ?? {} };
  });
}

const RECONCILE_OBSERVED = {
  interrupted_commit: ["oid", "commit_evidence"],
  interrupted_push: ["event"],
  remote_adoption: ["remote_baseline", "pr"],
  source_refresh: ["kind", "source"],
  dependency_refresh: ["dependencies"],
};

function commandReconcile(options) {
  const ctx = resolveContext(options, { mutation: true });
  const evidence = readJsonFile(options["evidence-file"], "--evidence-file");
  requireExactKeys(evidence, ["case", "reason", "source", "grant_id", "expected", "observed", "evidence_paths"], "reconcile evidence");
  requireShape(evidence, "ReconcileEvidence", "reconcile evidence");
  requireExactKeys(evidence.expected, ["candidate_oid", "working_head_oid"], "reconcile expected");
  requireExactKeys(evidence.observed, RECONCILE_OBSERVED[evidence.case], `${evidence.case} observed`);
  for (const file of evidence.evidence_paths) if (currentHash(file) === null) fail("io_error", "a reconcile evidence path is unreadable", { path: file });
  return mutate(ctx, options, "reconcile", (draft, ledger) => {
    const owner = requireOwner(ledger, options);
    if (ledger.phase === "watch" && ledger.authorization.monitoring !== "remediate" && ["interrupted_commit", "dependency_refresh"].includes(evidence.case)) {
      fail("invariant_error", "an observe-only watch never remediates");
    }
    const { candidate } = ledger;
    if (evidence.expected.candidate_oid !== candidate.oid || evidence.expected.working_head_oid !== candidate.working_head_oid) {
      fail("identity_mismatch", "reconcile expected identities must match the current ledger", { expected: { candidate_oid: candidate.oid, working_head_oid: candidate.working_head_oid }, observed: evidence.expected });
    }
    if (evidence.grant_id !== null && !ledger.authorization.grants.some((grant) => grant.id === evidence.grant_id && grant.scope === "reconcile")) {
      fail("invariant_error", "grant_id must name a recorded reconcile grant", { id: evidence.grant_id });
    }
    const observed = evidence.observed;
    const detail = { case: evidence.case, reason: evidence.reason, source: evidence.source, grant_id: evidence.grant_id, expected: evidence.expected, evidence_paths: evidence.evidence_paths, invalidated_evidence: [] };
    switch (evidence.case) {
      case "interrupted_commit": {
        const commitEvidence = readCommitEvidence(observed.commit_evidence);
        if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(observed.oid ?? "")) fail("schema_error", "observed.oid must be an OID");
        if (candidate.state !== "working") fail("invariant_error", "an interrupted commit is reconciled from a working candidate");
        if (commitEvidence.prior_head !== evidence.expected.working_head_oid) fail("identity_mismatch", "commit_evidence.prior_head must equal expected.working_head_oid");
        detail.transition = applyFreeze(ctx, ledger, draft, observed.oid, commitEvidence);
        break;
      }
      case "interrupted_push": {
        const event = observed.event;
        requireShape(event, "PublicationEvent", "observed event");
        const problems = itemProblems("publications", event);
        if (problems.length > 0) fail("invariant_error", problems.join("; "));
        const events = operations(ledger).get(event.operation_id);
        const existing = ledger.publications.find((entry) => entry.id === event.id);
        if (existing) {
          if (!isDeepStrictEqual(existing, event)) fail("invariant_error", "an existing event ID was reused with different content", { id: event.id });
          break;
        }
        if (!events || events[0].kind !== "push") fail("invariant_error", "interrupted_push names an existing push operation", { id: event.operation_id });
        if (!["verified", "failed"].includes(event.step)) fail("invariant_error", "interrupted_push records the observed verified or failed outcome");
        for (const field of operationFields) if (!isDeepStrictEqual(event[field], events[0][field])) fail("invariant_error", `an operation keeps its ${field} across steps`);
        if (TERMINAL_STEPS.has(events[events.length - 1].step)) fail("invariant_error", "the push operation already ended");
        if (event.step === "verified") verifiedObservationChecks(ledger, event);
        draft.publications.push(event);
        detail.event_id = event.id;
        break;
      }
      case "remote_adoption": {
        requireShape(observed.remote_baseline, "RemoteBaseline", "remote_baseline");
        if (observed.pr !== null) requireShape(observed.pr, "PR", "pr");
        if (candidate.remote_baseline !== null) fail("invariant_error", "an established destination is never replaced");
        if (verifiedPushes(ledger).some((event) => event.target.ref === destinationRef(ledger))) fail("invariant_error", "the destination already has verified pushes");
        const baseline = observed.remote_baseline;
        if (baseline.remote_name !== ledger.repo.remote_name || baseline.ref !== destinationRef(ledger)) fail("identity_mismatch", "the adopted ref must be this delivery's destination", { expected: { remote_name: ledger.repo.remote_name, ref: destinationRef(ledger) }, observed: baseline });
        if (![candidate.oid, candidate.baseline_oid, candidate.working_head_oid].includes(baseline.oid)) fail("identity_mismatch", "an adopted remote ref must match the baseline or current candidate", { observed: baseline.oid });
        draft.candidate.remote_baseline = baseline;
        if (observed.pr !== null) {
          if (ledger.pr === null) {
            verifyNewPr(ledger, observed.pr);
            if (observed.pr.head !== baseline.oid) fail("identity_mismatch", "the adopted PR head must equal the adopted remote ref", { expected: baseline.oid, observed: observed.pr.head });
          } else {
            verifyPrObservation({ ...ledger, candidate: { ...candidate, remote_baseline: baseline } }, observed.pr);
          }
          draft.pr = observed.pr;
        }
        break;
      }
      case "source_refresh": {
        if (!Object.keys(SOURCE_FIELDS).includes(observed.kind)) fail("schema_error", "observed.kind must be task_doc, spec or instruction");
        requireExactKeys(observed.source, ["path", "sha256"], "observed.source");
        requireShape(observed.source, "Source", "observed.source");
        verifySourceHash(observed.source, "refreshed source");
        const change = addSource(draft, ledger, observed.kind, observed.source);
        detail.invalidated_evidence = change?.invalidated_evidence ?? [];
        break;
      }
      case "dependency_refresh": {
        if (!Array.isArray(observed.dependencies)) fail("schema_error", "observed.dependencies must be an array");
        observed.dependencies.forEach((dependency) => requireShape(dependency, "Dependency", "dependency"));
        verifyDependencies(observed.dependencies);
        if (candidate.state === "frozen") beginChangeTransition(draft, ledger);
        draft.candidate.dependencies = observed.dependencies;
        detail.invalidated_evidence = currentInputEvidenceRefs(ledger);
        break;
      }
      default:
        break;
    }
    if (draft.candidate.recovery_required) {
      const recheck = localIdentity(ctx, draft, stageFor(draft));
      if (recheck.mismatches.length === 0 && recheck.environment.length === 0) {
        draft.candidate.recovery_required = false;
        detail.recovery_cleared = true;
      } else {
        detail.recovery_cleared = false;
        detail.remaining = [...recheck.mismatches, ...recheck.environment];
      }
    }
    return { actor: owner, detail };
  });
}

function commandContentManifest(options) {
  const ctx = resolveContext(options, { mutation: false });
  const ledger = readLedger(ctx);
  let source;
  if (options["output-file"]) {
    const excluded = options["exclude-path"] ?? [];
    for (const file of excluded) {
      if (!ledger.sources.decisions.some((decision) => mentionsPath(decision.text, file))) {
        fail("invariant_error", "record a scope decision before excluding a changed path", { observed: file });
      }
    }
    const inputs = options["inputs-file"] ? readJsonFile(options["inputs-file"], "--inputs-file") : [];
    const manifest = {
      version: 1, baseline_oid: ledger.candidate.baseline_oid,
      files: [...actualChanges(ctx.worktree, ledger.candidate.baseline_oid, "worktree")]
        .filter(([file]) => !excluded.includes(file))
        .map(([file, entry]) => ({ path: file, ...entry })).sort((a, b) => utf8Compare(a.path, b.path)),
      excluded_paths: [...excluded].sort(utf8Compare), inputs,
    };
    manifestStructure(manifest, ledger);
    verifyManifestContent(ctx.worktree, manifest, "worktree");
    source = writeInputFile(ctx, options["output-file"], manifest);
  } else {
    source = sourceFor(options["manifest-file"]);
  }
  const { manifest, digest } = loadManifest(source, ledger);
  verifyManifestContent(ctx.worktree, manifest, "worktree");
  return envelope("content-manifest", Boolean(options["output-file"]), ledger.revision, { content_id: `sha256:${digest}`, input_fingerprint: digest, manifest: source, files: manifest.files.length });
}

function commandMeasure(options) {
  const ctx = resolveContext(options, { mutation: true });
  return mutate(ctx, options, "measure", (draft, ledger) => {
    const owner = requireOwner(ledger, options);
    forbidDuringRecovery(ledger, "measure");
    if (ledger.candidate.state !== "frozen") fail("invariant_error", "measure needs a frozen candidate; leave local-only work unmeasured with an explicit limitation");
    const out = git(ctx.worktree, ["diff", "--numstat", "-z", "--no-renames", ledger.repo.diff_base_oid, ledger.candidate.oid, "--"], { buffer: true }).stdout;
    let files = 0;
    let additions = 0;
    let deletions = 0;
    let binary = 0;
    for (const record of splitNul(out)) {
      const text = record.toString("utf8");
      const first = text.indexOf("\t");
      const second = text.indexOf("\t", first + 1);
      if (first === -1 || second === -1) continue;
      const added = text.slice(0, first);
      const removed = text.slice(first + 1, second);
      files += 1;
      if (added === "-" || removed === "-") binary += 1;
      else {
        additions += Number(added);
        deletions += Number(removed);
      }
    }
    Object.assign(draft.measurements, { files, additions, deletions, binary_files: binary, measured_oid: ledger.candidate.oid, diff_base_oid: ledger.repo.diff_base_oid });
    return { actor: owner, data: { files, additions, deletions, binary_files: binary }, detail: { measured_oid: ledger.candidate.oid, diff_base_oid: ledger.repo.diff_base_oid } };
  });
}

function invalidatedRefs(ledger) {
  const refs = new Set();
  for (const event of ledger.history) for (const ref of event.detail.invalidated_evidence ?? []) refs.add(ref);
  return refs;
}

function resolveEvidence(ledger, ref) {
  const parsed = parseQualified(ref);
  if (!parsed) fail("invariant_error", "completion evidence uses qualified <collection>:<id> references", { observed: ref });
  const items = collectionOf(ledger, parsed.collection);
  if (!items.some((item) => item.id === parsed.id)) fail("invariant_error", "completion evidence does not resolve in its collection", { observed: ref });
  const current = terminalSuccessor(items, parsed.id);
  const root = chainRoot(items, current);
  return { ref, collection: parsed.collection, item: current, rootRef: `${parsed.collection}:${root.id}` };
}

function isInvalidated(ledger, invalidated, collection, item) {
  const items = collectionOf(ledger, collection);
  let cursor = item;
  const byId = new Map(items.map((entry) => [entry.id, entry]));
  while (cursor) {
    if (invalidated.has(`${collection}:${cursor.id}`)) return true;
    cursor = cursor.supersedes_id ? byId.get(cursor.supersedes_id) : null;
  }
  return false;
}

function validationApplies(ctx, ledger, entry, completion) {
  if (entry.result !== "pass") return `${entry.id} is ${entry.result}, which is never a passing gate`;
  if (completion.endpoint === "local") {
    if (entry.content_id !== completion.content_id) return `${entry.id} does not identify the completed content`;
    return null;
  }
  if (entry.oid !== completion.candidate_oid) return `${entry.id} observed another candidate; old evidence is never relabeled`;
  if (entry.scope !== "gate") return `${entry.id} is a focused check, not the final gate for a committed endpoint`;
  if (entry.kind === "receipt") {
    const accepted = receiptAccepts(ctx, ledger, entry, completion.candidate_oid);
    return accepted.ok ? null : `${entry.id}: ${accepted.reason}`;
  }
  if (entry.reused_from !== null) {
    const source = currentItems(ledger.validation).find((item) => item.id === entry.reused_from);
    if (!source || source.result !== "pass") return `${entry.id} reuses evidence that no longer passes`;
  }
  verifyManifestContent(ctx.worktree, loadManifest(entry.content_manifest, ledger).manifest, completion.candidate_oid);
  return null;
}

function contentApplies(ctx, ledger, contentId, manifestSource, completion) {
  if (contentId === null || !manifestSource) return false;
  const manifest = checkContentIdentity(ledger, contentId, manifestSource, "completion evidence");
  if (completion.endpoint === "local") return contentId === completion.content_id;
  try {
    verifyManifestContent(ctx.worktree, manifest, completion.candidate_oid);
    return true;
  } catch (error) {
    if (error instanceof LedgerError && error.code === "identity_mismatch") return false;
    throw error;
  }
}

function identityApplies(ctx, ledger, item, completion, oidField) {
  if (item.content_id !== null) return contentApplies(ctx, ledger, item.content_id, item.content_manifest, completion);
  return completion.endpoint !== "local" && item[oidField] === completion.candidate_oid;
}

function reviewApplies(ctx, ledger, review, completion) {
  if (review.verdict === "fail") return `review ${review.id} failed; a failing review never satisfies completion`;
  if (identityApplies(ctx, ledger, review, completion, "candidate_oid")) {
    const pending = review.findings.filter((finding) => finding.disposition === "pending");
    return pending.length === 0 ? null : `review ${review.id} has pending findings`;
  }
  for (const finding of review.findings) {
    if (finding.disposition === "pending") return `review ${review.id} has pending findings`;
    if (finding.disposition !== "fixed") continue;
    const fixed = contentApplies(ctx, ledger, finding.fix_content_id, finding.fix_content_manifest, completion)
      || (completion.endpoint !== "local" && finding.fix_oid !== null && isAncestor(ctx.worktree, finding.fix_oid, completion.candidate_oid));
    if (!fixed) return `review ${review.id} finding ${finding.id} is not fixed in the completed candidate`;
  }
  if (!review.findings.some((finding) => finding.disposition === "fixed")) return `review ${review.id} reviewed another candidate and no fix chain reaches this one`;
  return null;
}

function completeChecks(ctx, ledger, completion) {
  const { authorization, candidate, owner } = ledger;
  if (completion.endpoint !== authorization.endpoint) {
    fail("invariant_error", "complete records the authorized endpoint; a narrower endpoint needs a recorded endpoint grant, otherwise hand off or block", {
      expected: authorization.endpoint,
      observed: completion.endpoint,
    });
  }
  if (completion.endpoint === "local") {
    if (completion.candidate_oid !== null || completion.content_id === null) fail("invariant_error", "local completion identifies content, not a commit");
    const { manifest, digest } = loadManifest(completion.content_manifest, ledger);
    if (completion.content_id !== `sha256:${digest}`) fail("identity_mismatch", "completion content_id does not match its manifest");
    verifyManifestContent(ctx.worktree, manifest, "worktree");
  } else {
    if (candidate.state !== "frozen" || completion.candidate_oid !== candidate.oid || completion.content_id !== null) {
      fail("invariant_error", "a committed endpoint completes on the frozen candidate", { expected: candidate.oid, observed: completion.candidate_oid });
    }
    const local = localIdentity(ctx, ledger, "frozen");
    if (local.mismatches.length > 0) fail("identity_mismatch", "the frozen candidate drifted", { observed: local.mismatches });
  }
  const invalidated = invalidatedRefs(ledger);
  const evidence = completion.evidence_ids.map((ref) => resolveEvidence(ledger, ref));
  for (const entry of evidence) {
    if (isInvalidated(ledger, invalidated, entry.collection, entry.item)) fail("invariant_error", `${entry.ref} was invalidated by a later input change`, { observed: entry.ref });
  }
  const byCollection = (collection) => evidence.filter((entry) => entry.collection === collection).map((entry) => entry.item);
  const watchObservation = owner.phase === "watch" && authorization.monitoring === "observe";
  const validations = byCollection("validation");
  for (const entry of validations) {
    const problem = validationApplies(ctx, ledger, entry, completion);
    if (problem) fail("invariant_error", problem);
  }
  if (!watchObservation && validations.length === 0) fail("invariant_error", "complete needs an applicable passing validation gate for the final candidate");
  if (watchObservation && evidence.length === 0) fail("invariant_error", "observation-only watch completion cites its final observation");
  const publications = byCollection("publications");
  const verifiedOps = new Map();
  for (const event of publications) {
    const events = operations(ledger).get(event.operation_id);
    const last = events[events.length - 1];
    if (last.step !== "verified") fail("invariant_error", `publication operation ${event.operation_id} is not verified`);
    verifiedOps.set(event.operation_id, last);
  }
  const verified = [...verifiedOps.values()];
  if (!watchObservation && PUSH_ENDPOINTS.has(completion.endpoint)) {
    const reachesDestination = (event) => event.kind === "push" && event.target.ref === destinationRef(ledger) && event.intended.oid === completion.candidate_oid;
    const cited = verified.some(reachesDestination);
    // A later phase completes at the endpoint the delivery already reached,
    // so the recorded push (or the adopted remote) can stand without a cite.
    const reached = verifiedPushes(ledger).some(reachesDestination) || expectedRemote(ledger).oid === completion.candidate_oid;
    if (!cited && !(owner.phase !== "delivery" && reached)) fail("invariant_error", "the endpoint needs a cited verified push of the final candidate");
  }
  if (!watchObservation && PR_ENDPOINTS.has(completion.endpoint)) {
    const pr = ledger.pr;
    if (!pr || pr.head !== completion.candidate_oid || pr.state !== "OPEN" || pr.draft !== (completion.endpoint === "draft_pr")) {
      fail("invariant_error", `the endpoint needs a recorded open ${completion.endpoint === "draft_pr" ? "draft" : "ready"} PR at the final candidate`, { observed: pr });
    }
    if (owner.phase === "delivery" && !verified.some((event) => ["pr_create", "pr_body"].includes(event.kind))) {
      fail("invariant_error", "a PR delivery cites the verified PR body carrying its durable summary");
    }
  }
  for (const audit of byCollection("audits")) {
    if (audit.verdict !== "PASS") fail("invariant_error", `audit ${audit.id} is ${audit.verdict}; a failed or blocked audit is never accepted as a role failure`);
    if (!identityApplies(ctx, ledger, audit, completion, "oid")) fail("invariant_error", `audit ${audit.id} observed another candidate`);
  }
  if (ledger.audit_policy.required && !watchObservation) {
    if (ledger.audit_policy.state !== "complete" || byCollection("audits").length === 0) fail("invariant_error", "a required audit needs its passing result cited and audit_policy complete");
  }
  if (ledger.audit_policy.state === "blocked") fail("invariant_error", "the audit gate is blocked");
  const reviews = byCollection("reviews");
  // A caller chooses supporting evidence, not which unresolved findings
  // exist. Historical reviews remain readable; disposition them through a
  // successor instead of dropping their references to obtain completion.
  if (!watchObservation) {
    for (const review of currentItems(ledger.reviews)) {
      if (review.mode === "spec") continue;
      if (review.verdict === "fail" || review.findings.some((finding) => finding.disposition === "pending")) {
        fail("invariant_error", `review ${review.id} has a failing verdict or pending findings; omission from completion evidence does not resolve it`);
      }
    }
    if (owner.phase === "delivery" && PR_ENDPOINTS.has(completion.endpoint)
        && !reviews.some((review) => review.mode !== "spec")
        && !authorization.grants.some((grant) => grant.scope === "review_waiver")) {
      fail("invariant_error", "a PR delivery needs an applicable review or an explicit review_waiver grant permitted by repository policy");
    }
  }
  for (const review of reviews) {
    if (review.mode === "spec") continue;
    const problem = reviewApplies(ctx, ledger, review, completion);
    if (problem) fail("invariant_error", problem);
  }
  const blockedIndependence = currentItems(ledger.role_runs).filter((run) => run.fallback_reason === INDEPENDENCE_REQUIRED && run.status === "blocked");
  if (blockedIndependence.length > 0) {
    const independent = reviews.some((review) => review.mode === "implementation" && INDEPENDENT_REVIEW_SOURCES.has(review.source) && identityApplies(ctx, ledger, review, completion, "candidate_oid"));
    if (!independent) fail("invariant_error", "a required independent review is blocked; report the blocked gate instead of completing", { observed: blockedIndependence.map((run) => run.id) });
  }
  if (owner.phase === "review_round") {
    const batches = reviews.filter((review) => review.batch !== null);
    if (batches.length === 0 || batches.some((review) => !readBatchSnapshot(review.batch).complete)) {
      fail("invariant_error", "a review round completes with a complete batch's dispositions; an incomplete snapshot is unavailable, never empty");
    }
  }
}

function nextProblems(ledger, next, outcome) {
  if (next === null) return;
  if (outcome === "complete") {
    if (next.phase === "delivery") fail("invariant_error", "a completed delivery has no delivery continuation");
    if (!next.authorization_required) {
      const scopes = next.phase === "review_round" ? ["review_round"] : ["monitor_observe", "monitor_remediate"];
      if (!unconsumedGrant(ledger, scopes)) fail("invariant_error", "an unauthorized continuation is only a suggestion (authorization_required true)");
    }
  }
}

function commandRelease(options) {
  const ctx = resolveContext(options, { mutation: true });
  const payload = readJsonFile(options["release-file"], "--release-file");
  requireExactKeys(payload, ["next", "completion", "blocker"], "release payload");
  requireShape(payload, "ReleaseInput", "release payload");
  return mutate(ctx, options, "release", (draft, ledger) => {
    const owner = requireOwner(ledger, options);
    const { next, completion, blocker } = payload;
    const outcome = options.outcome;
    const detail = { outcome, released_claim_id: owner.claim_id };
    if (outcome === "complete") {
      if (completion === null || blocker !== null) fail("invariant_error", "complete needs a completion and no blocker");
      forbidDuringRecovery(ledger, "completion");
      completeChecks(ctx, ledger, completion);
      nextProblems(ledger, next, outcome);
      const pendingWatch = unconsumedGrant(ledger, ["monitor_observe", "monitor_remediate"]);
      if (pendingWatch && owner.phase !== "watch" && (next === null || next.phase !== "watch" || next.authorization_required)) {
        fail("invariant_error", "an authorized watch remains; record it as next with authorization_required false");
      }
      detail.previous_completion = ledger.completion;
      if (owner.phase === "watch") detail.watch_stop = completion.limitations;
      draft.completion = completion;
      draft.phase = "done";
      draft.checkpoint = null;
      draft.blocker = null;
    } else if (outcome === "handoff") {
      if (completion !== null || blocker !== null || next === null) fail("invariant_error", "handoff needs a next step and no completion or blocker");
      if (next.phase !== owner.phase || next.checkpoint !== ledger.checkpoint || next.authorization_required) {
        fail("invariant_error", "a handoff's next step is the unfinished authorized phase and checkpoint", { expected: { phase: owner.phase, checkpoint: ledger.checkpoint }, observed: next });
      }
    } else {
      if (completion !== null || blocker === null || next === null) fail("invariant_error", "blocked needs a blocker, a matching next step and no completion");
      if (blocker.resume_phase !== owner.phase || next.phase !== blocker.resume_phase || next.checkpoint !== blocker.resume_checkpoint) {
        fail("invariant_error", "a blocked release resumes the same phase at the blocker's checkpoint");
      }
      draft.phase = "blocked";
      draft.blocker = blocker;
    }
    draft.owner = null;
    draft.next = next;
    return { actor: owner, detail };
  });
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function commandRecoverLock(options) {
  const ctx = resolveContext(options, { mutation: false });
  const target = lockPath(ctx, options.kind);
  const guard = `${target}.recovery.lock`;
  testHook("before-lock");
  let fd;
  try {
    fd = fs.openSync(guard, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") {
      fail("recovery_guard_held", "another recovery holds the guard; remove it manually only after every helper for this Git directory has stopped, then retry", {
        path: guard,
        observed: describeLock(guard),
      });
    }
    fail("io_error", `cannot create the recovery guard: ${error.code}`, { path: guard });
  }
  const guardId = randomUUID();
  try {
    fs.writeSync(fd, JSON.stringify({ kind: "recovery", pid: process.pid, hostname: os.hostname(), created_at: now(), worktree: ctx.worktree, operation_id: guardId }));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    testHook("locked");
    const holder = describeLock(target);
    if (!holder) return envelope("recover-lock", false, null, { status: "already_absent", path: target });
    if (options["operation-id"]) {
      if (!holder.complete || holder.metadata.operation_id !== options["operation-id"]) {
        fail("mutex_held", "the lock's identity changed or its metadata is incomplete; nothing was removed", { path: target, expected: options["operation-id"], observed: holder });
      }
    } else if (holder.complete) {
      fail("mutex_held", "the lock metadata is complete; recover it by --operation-id", { path: target, observed: holder });
    } else if (holder.sha256 !== options["expected-lock-sha256"]) {
      fail("mutex_held", "the lock file changed; nothing was removed", { path: target, expected: options["expected-lock-sha256"], observed: holder });
    }
    if (holder.complete && holder.metadata.hostname === os.hostname() && processAlive(holder.metadata.pid)) {
      fail("mutex_held", "the recorded holder process is still running; recovery needs a stopped holder", { path: target, observed: holder });
    }
    fs.unlinkSync(target);
    return envelope("recover-lock", false, null, { status: "removed", path: target, removed: holder, reason: options.reason, runtime: options.runtime, session: options.session });
  } finally {
    if (describeLock(guard)?.metadata?.operation_id === guardId) fs.unlinkSync(guard);
  }
}

function commandSummaryBody(options) {
  const ctx = resolveContext(options, { mutation: false });
  const ledger = readLedger(ctx);
  const read = (file) => {
    try {
      return fs.readFileSync(file);
    } catch (error) {
      return fail("io_error", `cannot read ${file}: ${error.code}`, { path: file });
    }
  };
  const current = read(options["current-body-file"]);
  const currentSha = sha256(current);
  if (options["expected-current-sha256"] && options["expected-current-sha256"] !== currentSha) {
    fail("identity_mismatch", "the PR body changed since it was read; re-read it and never overwrite another writer's edit", { expected: options["expected-current-sha256"], observed: currentSha });
  }
  const result = applySummaryBlock(current.toString("utf8"), ledger.delivery_id, read(options["summary-file"]).toString("utf8"));
  return envelope("summary-body", false, ledger.revision, { action: result.action, body: result.body, body_sha256: sha256(Buffer.from(result.body, "utf8")), current_body_sha256: currentSha });
}

const HANDLERS = {
  path: commandPath,
  "prepare-init": commandPrepareInit,
  init: commandInit,
  show: commandShow,
  validate: commandValidate,
  check: commandCheck,
  claim: commandClaim,
  update: commandUpdate,
  "source-add": commandSourceAdd,
  append: commandAppend,
  authorize: commandAuthorize,
  "record-context": commandRecordContext,
  "begin-change": commandBeginChange,
  freeze: commandFreeze,
  reconcile: commandReconcile,
  "content-manifest": commandContentManifest,
  measure: commandMeasure,
  release: commandRelease,
  "recover-lock": commandRecoverLock,
  "set-review-bound": () => fail("invariant_error", "set-review-bound is enabled in R3; R1 keeps review_bound null"),
  "summary-body": commandSummaryBody,
};

export async function run(argv) {
  const { command, options } = parseArgs(argv);
  let stdin = "";
  if (COMMANDS[command].stdin === true) stdin = readRequiredStdin();
  else await probeUnexpectedStdin();
  return HANDLERS[command](options, stdin);
}

export async function main(argv = process.argv.slice(2)) {
  let result;
  let exitCode = 0;
  try {
    result = await run(argv);
  } catch (error) {
    const known = error instanceof LedgerError;
    result = {
      ok: false,
      command: typeof argv[0] === "string" ? argv[0] : "",
      code: known ? error.code : "io_error",
      message: known ? error.message : "unexpected helper error; see stderr",
      path: known ? error.path : null,
      id: known ? error.id : null,
      expected: known ? error.expected : null,
      observed: known ? error.observed : null,
    };
    exitCode = known ? EXIT_BY_CODE[error.code] : 1;
    if (!known) process.stderr.write(`${String(error?.stack ?? error).replace(/(gh[opsu]_|github_pat_)\w+/g, "$1[redacted]")}\n`);
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return exitCode;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
