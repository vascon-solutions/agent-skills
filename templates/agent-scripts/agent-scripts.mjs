// agent-scripts v1 sha256:a0a3da0ea3927e7145af9329c448b15b3987be31938163a90c3e5b020165591f
// Canonical copy: vascon-solutions/agent-skills templates/agent-scripts/agent-scripts.mjs.
// Vendor this file unmodified; see the README next to the canonical copy.
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const VERSION = 1;
const SCHEMAS = new Set([1]);
const DEFAULT_READY_TIMEOUT_SECONDS = 120;
const DEFAULT_STOP_TIMEOUT_SECONDS = 10;
const DEFAULT_MAX_ARG_BYTES = 100_000;
const SERVE_ENV_DEFAULTS = { NX_DAEMON: "false", NX_TUI: "false" };

class UsageError extends Error {}

function log(message) {
  process.stderr.write(`agent-scripts: ${message}\n`);
}

function fail(message) {
  throw new UsageError(message);
}

// ---------------------------------------------------------------------------
// Version header

const HEADER = /^\/\/ agent-scripts v(\d+) sha256:([0-9a-f]{64})$/;

function splitHeader(bytes) {
  const newline = bytes.indexOf(0x0a);
  if (newline === -1) return { header: bytes.toString("utf8"), body: Buffer.alloc(0) };
  return { header: bytes.subarray(0, newline).toString("utf8"), body: bytes.subarray(newline + 1) };
}

function digest(body) {
  return createHash("sha256").update(body).digest("hex");
}

function verifyFile(file) {
  const { header, body } = splitHeader(fs.readFileSync(file));
  const match = HEADER.exec(header);
  const computed = digest(body);
  if (!match) return { ok: false, message: `${file}: line 1 is not an agent-scripts version header` };
  if (match[2] !== computed) return { ok: false, message: `${file}: drift (v${match[1]} header sha256:${match[2]}, content sha256:${computed})` };
  return { ok: true, message: `${file}: agent-scripts v${match[1]} sha256:${computed} matches` };
}

function stampFile(file) {
  const { body } = splitHeader(fs.readFileSync(file));
  fs.writeFileSync(file, Buffer.concat([Buffer.from(`// agent-scripts v${VERSION} sha256:${digest(body)}\n`), body]));
}

// ---------------------------------------------------------------------------
// Arguments

function parseArgs(argv) {
  const options = { positionals: [], exclude: [], port: [] };
  const flags = new Set(["--detach", "--stop", "--status", "--working-tree-only", "--verify", "--stamp"]);
  const valued = new Set(["--base", "--paths-from", "--exclude", "--port", "--config"]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      options.positionals.push(...argv.slice(index + 1));
      break;
    }
    const eq = arg.startsWith("--") ? arg.indexOf("=") : -1;
    const name = eq === -1 ? arg : arg.slice(0, eq);
    if (flags.has(name)) {
      if (eq !== -1) fail(`${name} takes no value`);
      options[name.slice(2)] = true;
    } else if (valued.has(name)) {
      const value = eq === -1 ? argv[++index] : arg.slice(eq + 1);
      if (value === undefined) fail(`${name} needs a value`);
      const key = name.slice(2);
      if (key === "exclude" || key === "port") options[key].push(value);
      else if (options[key] !== undefined) fail(`${name} given twice`);
      else options[key] = value;
    } else if (arg.startsWith("-")) {
      fail(`unknown option ${arg}`);
    } else {
      options.positionals.push(arg);
    }
  }
  return options;
}

// ---------------------------------------------------------------------------
// Git and configuration

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: options.encoding ?? "utf8", maxBuffer: 256 * 1024 * 1024, ...options, shell: false });
  if (result.error) return { status: null, stdout: "", stderr: String(result.error.message), error: result.error };
  return result;
}

function git(root, args, encoding = "utf8") {
  const result = run("git", ["-C", root, ...args], { encoding });
  if (result.status !== 0) return null;
  return result.stdout;
}

function repoRoot(cwd) {
  const out = git(cwd, ["rev-parse", "--show-toplevel"]);
  if (out === null) fail(`${cwd} is not inside a Git working tree`);
  return out.trim();
}

function gitDir(root) {
  const out = git(root, ["rev-parse", "--absolute-git-dir"]);
  if (out === null) fail("cannot resolve the Git directory");
  return out.trim();
}

const CONFIG_KEYS = new Set(["schema", "base", "extensions", "ignore", "fix", "lint", "gate", "serve"]);
const STEP_KEYS = new Set(["command", "extensions", "cwd", "appendPaths"]);
const GATE_KEYS = new Set(["command", "env"]);
const SERVE_KEYS = new Set(["commands", "readyTimeoutSeconds", "stopTimeoutSeconds"]);
const SERVE_COMMAND_KEYS = new Set(["name", "command", "cwd", "env", "ports", "ready", "default"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function checkKeys(value, allowed, where) {
  if (!isObject(value)) fail(`${where} must be an object`);
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail(`${where} has unknown key ${JSON.stringify(key)}`);
}

function checkArgv(value, where) {
  if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === "string")) fail(`${where} must be a nonempty array of strings`);
}

function checkStringArray(value, where) {
  if (value !== undefined && (!Array.isArray(value) || !value.every((item) => typeof item === "string"))) fail(`${where} must be an array of strings`);
}

function checkEnv(value, where) {
  if (value === undefined) return;
  if (!isObject(value) || !Object.values(value).every((item) => typeof item === "string")) fail(`${where} must map names to strings`);
}

function checkRelative(value, where) {
  if (value === undefined) return;
  if (typeof value !== "string" || path.isAbsolute(value) || value.split(/[\\/]/).includes("..")) fail(`${where} must be a relative path with no ".." segment`);
}

function validateConfig(config) {
  checkKeys(config, CONFIG_KEYS, "agentScripts");
  if (!SCHEMAS.has(config.schema)) fail(`agentScripts.schema ${JSON.stringify(config.schema)} is not supported by agent-scripts v${VERSION} (supported: ${[...SCHEMAS].join(", ")})`);
  if (config.base !== undefined && typeof config.base !== "string") fail("agentScripts.base must be a string");
  checkStringArray(config.extensions, "agentScripts.extensions");
  checkStringArray(config.ignore, "agentScripts.ignore");
  for (const kind of ["fix", "lint"]) {
    if (config[kind] === undefined) continue;
    if (!Array.isArray(config[kind])) fail(`agentScripts.${kind} must be an array of steps`);
    config[kind].forEach((step, index) => {
      const where = `agentScripts.${kind}[${index}]`;
      checkKeys(step, STEP_KEYS, where);
      checkArgv(step.command, `${where}.command`);
      checkStringArray(step.extensions, `${where}.extensions`);
      checkRelative(step.cwd, `${where}.cwd`);
      if (step.appendPaths !== undefined && typeof step.appendPaths !== "boolean") fail(`${where}.appendPaths must be a boolean`);
    });
  }
  if (config.gate !== undefined) {
    if (!Array.isArray(config.gate)) fail("agentScripts.gate must be an array of steps");
    config.gate.forEach((step, index) => {
      checkKeys(step, GATE_KEYS, `agentScripts.gate[${index}]`);
      checkArgv(step.command, `agentScripts.gate[${index}].command`);
      checkEnv(step.env, `agentScripts.gate[${index}].env`);
    });
  }
  if (config.serve !== undefined) {
    checkKeys(config.serve, SERVE_KEYS, "agentScripts.serve");
    for (const key of ["readyTimeoutSeconds", "stopTimeoutSeconds"]) {
      const value = config.serve[key];
      if (value !== undefined && !(typeof value === "number" && value > 0)) fail(`agentScripts.serve.${key} must be a positive number`);
    }
    if (!Array.isArray(config.serve.commands) || config.serve.commands.length === 0) fail("agentScripts.serve.commands must be a nonempty array");
    const names = new Set();
    const ports = new Map();
    config.serve.commands.forEach((command, index) => {
      const where = `agentScripts.serve.commands[${index}]`;
      checkKeys(command, SERVE_COMMAND_KEYS, where);
      if (typeof command.name !== "string" || !/^[A-Za-z0-9_.-]+$/.test(command.name)) fail(`${where}.name must match [A-Za-z0-9_.-]+`);
      if (names.has(command.name)) fail(`serve command ${command.name} is defined twice`);
      names.add(command.name);
      checkArgv(command.command, `${where}.command`);
      checkRelative(command.cwd, `${where}.cwd`);
      checkEnv(command.env, `${where}.env`);
      if (typeof command.ready !== "string") fail(`${where}.ready must be a URL string`);
      if (command.default !== undefined && typeof command.default !== "boolean") fail(`${where}.default must be a boolean`);
      if (command.ports === undefined) command.ports = {};
      if (!isObject(command.ports)) fail(`${where}.ports must be an object`);
      for (const [portName, spec] of Object.entries(command.ports)) {
        if (!/^[A-Za-z0-9_-]+$/.test(portName)) fail(`${where}.ports name ${JSON.stringify(portName)} must match [A-Za-z0-9_-]+`);
        checkKeys(spec, new Set(["default"]), `${where}.ports.${portName}`);
        if (!validPort(spec.default)) fail(`${where}.ports.${portName}.default must be a TCP port`);
        if (ports.has(portName)) fail(`port ${portName} is owned by both ${ports.get(portName)} and ${command.name}`);
        ports.set(portName, command.name);
      }
    });
  }
  return config;
}

function validPort(value) {
  return Number.isInteger(value) && value > 0 && value < 65536;
}

function loadConfig(root, configPath) {
  const file = configPath ? path.resolve(configPath) : path.join(root, "package.json");
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`cannot read ${file}: ${error.message}`);
  }
  if (!isObject(parsed) || parsed.agentScripts === undefined) fail(`${file} has no agentScripts key`);
  return validateConfig(parsed.agentScripts);
}

// ---------------------------------------------------------------------------
// Changed paths

function splitNul(text) {
  return text.split("\0").filter((item) => item !== "");
}

function normalizeRelative(file) {
  const normalized = path.posix.normalize(file.split(path.sep).join("/")).replace(/^\.\//, "");
  if (normalized === "." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) fail(`path ${JSON.stringify(file)} is outside the repository`);
  return normalized;
}

function resolveBase(root, options, config) {
  if (options.base !== undefined) return { ref: options.base, source: "--base" };
  if (config.base !== undefined) return { ref: config.base, source: "agentScripts.base" };
  const policyFile = path.join(root, ".agent", "delivery-policy.json");
  if (fs.existsSync(policyFile)) {
    try {
      const policy = JSON.parse(fs.readFileSync(policyFile, "utf8"));
      if (typeof policy.defaultBase === "string") return { ref: policy.defaultBase, source: ".agent/delivery-policy.json defaultBase" };
    } catch (error) {
      fail(`cannot read ${policyFile}: ${error.message}`);
    }
  }
  return null;
}

function discoverPaths(root, options, config) {
  const changed = new Set();
  let compareTo = "HEAD";
  if (!options["working-tree-only"]) {
    const base = resolveBase(root, options, config);
    if (!base) fail("no base: pass --base REF, set agentScripts.base, or set defaultBase in .agent/delivery-policy.json (or use --working-tree-only)");
    if (base.ref.startsWith("-")) fail(`base ${JSON.stringify(base.ref)} from ${base.source} is not a ref`);
    if (git(root, ["rev-parse", "--verify", "--quiet", `${base.ref}^{commit}`]) === null) fail(`base ${JSON.stringify(base.ref)} from ${base.source} does not resolve to a commit`);
    const mergeBase = git(root, ["merge-base", base.ref, "HEAD"]);
    if (mergeBase === null) fail(`no merge base between ${base.ref} and HEAD`);
    compareTo = mergeBase.trim();
  }
  const tracked = git(root, ["diff", "-z", "--name-only", "--no-renames", "--diff-filter=d", compareTo, "--"]);
  if (tracked === null) fail(`cannot diff the working tree against ${compareTo}`);
  for (const file of splitNul(tracked)) changed.add(file);
  const untracked = git(root, ["ls-files", "-z", "--others", "--exclude-standard"]);
  if (untracked === null) fail("cannot list untracked files");
  for (const file of splitNul(untracked)) changed.add(file);
  return [...changed];
}

function readPathsFrom(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    fail(`cannot read --paths-from ${file}: ${error.message}`);
  }
  return text.includes("\0") ? splitNul(text) : text.split(/\r?\n/).filter((line) => line !== "");
}

function globToRegExp(glob) {
  const directoryOnly = glob.endsWith("/");
  glob = glob.replace(/\/+$/, "");
  let source = "";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === "*") {
      if (glob[index + 1] === "*") {
        index += 1;
        if (glob[index + 1] === "/") {
          index += 1;
          source += "(?:.*/)?";
        } else {
          source += ".*";
        }
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}${directoryOnly ? "/.*" : "(?:/.*)?"}$`);
}

function changedPaths(root, options, config) {
  const raw = options["paths-from"] !== undefined ? readPathsFrom(options["paths-from"]) : discoverPaths(root, options, config);
  const excluded = new Set(options.exclude.map(normalizeRelative));
  const ignore = (config.ignore ?? []).map(globToRegExp);
  const realRoot = fs.realpathSync(root);
  const result = new Set();
  for (const entry of raw) {
    const file = normalizeRelative(entry);
    if (excluded.has(file) || ignore.some((pattern) => pattern.test(file))) continue;
    let stat;
    try {
      stat = fs.lstatSync(path.join(root, file));
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    const resolved = fs.realpathSync(path.join(root, file));
    const relative = path.relative(realRoot, resolved);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail(`path ${JSON.stringify(file)} resolves outside the repository`);
    result.add(file);
  }
  return [...result].sort();
}

function displayPath(file) {
  return /[\u0000-\u001f\u007f]/.test(file) ? JSON.stringify(file) : file;
}

// ---------------------------------------------------------------------------
// Steps

function exitStatus(result) {
  if (result.error) {
    log(`cannot run ${result.command}: ${result.error.message}`);
    return 127;
  }
  if (result.status !== null) return result.status;
  return 128 + (signalNumber(result.signal) ?? 1);
}

function signalNumber(signal) {
  return signal ? (os.constants.signals[signal] ?? null) : null;
}

function runArgv(argv, cwd, env) {
  const result = spawnSync(argv[0], argv.slice(1), { cwd, env, stdio: "inherit", shell: false });
  return exitStatus({ ...result, command: argv[0] });
}

function argBytes(items) {
  return items.reduce((total, item) => total + Buffer.byteLength(item) + 1, 0);
}

function chunk(argv, files, limit) {
  const budget = limit - argBytes(argv);
  if (budget <= 0) fail(`command ${argv[0]} leaves no room for paths under the ${limit}-byte argument limit`);
  const chunks = [];
  let current = [];
  let size = 0;
  for (const file of files) {
    const bytes = Buffer.byteLength(file) + 1;
    if (current.length > 0 && size + bytes > budget) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(file);
    size += bytes;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function stepPaths(step, files, defaults) {
  const extensions = step.extensions ?? defaults ?? null;
  const directory = path.normalize(step.cwd ?? ".");
  const prefix = directory === "." || directory === `.${path.sep}` ? "" : `${normalizeRelative(directory).replace(/\/+$/, "")}/`;
  const selected = [];
  for (const file of files) {
    if (extensions && !extensions.some((extension) => file.endsWith(extension))) continue;
    if (prefix && !file.startsWith(prefix)) continue;
    const relative = file.slice(prefix.length);
    selected.push(relative.startsWith("-") ? `./${relative}` : relative);
  }
  return selected;
}

function repositoryDigests(root) {
  const listed = git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]);
  if (listed === null) fail("cannot list files for the lint read-only check");
  const digests = new Map();
  for (const file of new Set(splitNul(listed))) {
    const absolute = path.join(root, file);
    try {
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) digests.set(file, `link:${fs.readlinkSync(absolute)}`);
      else if (stat.isFile()) digests.set(file, `${stat.mode}:${digest(fs.readFileSync(absolute))}`);
    } catch (error) {
      if (error.code === "ENOENT") digests.set(file, null);
      else fail(`cannot snapshot ${displayPath(file)} for the lint read-only check: ${error.message}`);
    }
  }
  return digests;
}

function runSteps(kind, root, options, config) {
  const steps = config[kind];
  if (!steps || steps.length === 0) fail(`agentScripts.${kind} has no steps`);
  const files = changedPaths(root, options, config);
  if (files.length === 0) {
    process.stderr.write("agent-scripts: no changed files\n");
    return 0;
  }
  log(`${files.length} changed path${files.length === 1 ? "" : "s"}:`);
  for (const file of files) process.stderr.write(`  ${displayPath(file)}\n`);
  const limit = Number(process.env.AGENT_SCRIPTS_MAX_ARG_BYTES) || DEFAULT_MAX_ARG_BYTES;
  const before = kind === "lint" ? repositoryDigests(root) : null;
  let failure = 0;
  for (const [index, step] of steps.entries()) {
    const cwd = step.cwd ? path.join(root, step.cwd) : root;
    const selected = stepPaths(step, files, config.extensions);
    const label = `${kind}[${index}] ${step.command.join(" ")}`;
    if (selected.length === 0) {
      log(`${label}: no matching paths, skipped`);
      continue;
    }
    const batches = step.appendPaths === false ? [[]] : chunk(step.command, selected, limit);
    for (const batch of batches) {
      const status = runArgv([...step.command, ...batch], cwd, process.env);
      if (status !== 0) {
        log(`${label}: exit ${status}`);
        if (kind === "fix") return status;
        failure ||= status;
        break;
      }
    }
  }
  if (before) {
    const after = repositoryDigests(root);
    const mutated = [...new Set([...before.keys(), ...after.keys()])]
      .filter((file) => before.get(file) !== after.get(file)).sort();
    if (mutated.length > 0) {
      log(`lint steps must not modify files; changed: ${mutated.map(displayPath).join(", ")}`);
      failure ||= 1;
    }
  }
  return failure;
}

function runGate(root, config) {
  if (!config.gate || config.gate.length === 0) fail("agentScripts.gate has no steps");
  for (const [index, step] of config.gate.entries()) {
    log(`gate[${index}] ${step.command.join(" ")}`);
    const status = runArgv(step.command, root, { ...process.env, ...(step.env ?? {}) });
    if (status !== 0) {
      log(`gate[${index}] failed with exit ${status}`);
      return status;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Processes

const IS_LINUX = process.platform === "linux";

function readProcStat(pid) {
  try {
    const text = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const fields = text.slice(text.lastIndexOf(")") + 2).split(" ");
    return { ppid: Number(fields[1]), start: `linux:${fields[19]}` };
  } catch {
    return null;
  }
}

// A PID plus its kernel start time identifies one process instance; a PID alone never does.
function startTime(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  if (IS_LINUX) return readProcStat(pid)?.start ?? null;
  const result = run("ps", ["-o", "lstart=", "-p", String(pid)], { env: { ...process.env, LC_ALL: "C" } });
  if (result.status !== 0) return null;
  const value = result.stdout.trim();
  return value ? `ps:${value}` : null;
}

function processTable() {
  const table = new Map();
  if (IS_LINUX) {
    for (const entry of fs.readdirSync("/proc")) {
      if (!/^\d+$/.test(entry)) continue;
      const stat = readProcStat(Number(entry));
      if (stat) table.set(Number(entry), stat);
    }
    return table;
  }
  const result = run("ps", ["-A", "-o", "pid=,ppid=,lstart="], { env: { ...process.env, LC_ALL: "C" } });
  if (result.status !== 0) fail(`cannot read the process table: ${result.stderr}`);
  for (const line of result.stdout.split("\n")) {
    const match = /^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(line);
    if (match) table.set(Number(match[1]), { ppid: Number(match[2]), start: `ps:${match[3]}` });
  }
  return table;
}

function commandLine(pid) {
  const result = run("ps", ["-o", "command=", "-p", String(pid)], { env: { ...process.env, LC_ALL: "C" } });
  return result.status === 0 ? result.stdout.trim() : "";
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function groupAlive(pgid) {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function signalGroup(pgid, signal) {
  try {
    process.kill(-pgid, signal);
  } catch {
    // The group already exited.
  }
}

function signalPid(pid, signal) {
  try {
    process.kill(pid, signal);
  } catch {
    // The process already exited.
  }
}

// Waits on timers rather than blocking, so a supervisor's event loop can reap its own exited children.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(100);
  }
  return predicate();
}

function listenerPids(port) {
  if (IS_LINUX) {
    const ss = run("ss", ["-H", "-ltnp", `sport = :${port}`]);
    if (ss.status === 0) return [...new Set([...ss.stdout.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1])))];
  }
  const lsof = run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fp"]);
  if (lsof.error) fail(`no listener probe available: install lsof${IS_LINUX ? " or ss" : ""}`);
  if (lsof.status !== 0 && lsof.stdout.trim() === "") return [];
  return [...new Set([...lsof.stdout.matchAll(/^p(\d+)$/gm)].map((match) => Number(match[1])))];
}

// Catches listeners whose owner the probes cannot see, such as another user's process or a root-owned docker-proxy.
async function acceptsConnections(port) {
  const attempt = (host) => new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const settle = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(1000, () => settle(false));
    socket.once("connect", () => settle(true));
    socket.once("error", () => settle(false));
  });
  return (await Promise.all(["127.0.0.1", "::1"].map(attempt))).some(Boolean);
}

function describeProcess(pid) {
  return `pid ${pid} (${commandLine(pid) || "unknown command"}, started ${startTime(pid) ?? "unknown"})`;
}

// ---------------------------------------------------------------------------
// Serve

function servePaths(root) {
  const dir = path.join(gitDir(root), "agent-serve");
  return { dir, state: path.join(dir, "state.json"), lock: path.join(dir, "lifecycle.lock") };
}

function tryServeLock(paths) {
  fs.mkdirSync(paths.dir, { recursive: true, mode: 0o700 });
  let fd;
  try {
    fd = fs.openSync(paths.lock, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") return null;
    throw error;
  }
  const token = randomUUID();
  try {
    fs.writeFileSync(fd, JSON.stringify({ token, pid: process.pid, start_time: startTime(process.pid) }));
  } catch (error) {
    fs.unlinkSync(paths.lock);
    throw error;
  } finally {
    fs.closeSync(fd);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (readState(paths.lock)?.token === token) fs.unlinkSync(paths.lock);
  };
}

function busyServeLock(paths) {
  fail(`server lifecycle operation is in progress (${paths.lock}); retry after it finishes; remove a stale lock only after verifying its recorded PID and start time are gone`);
}

async function waitForServeLock(paths, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  do {
    const release = tryServeLock(paths);
    if (release) return release;
    await sleep(50);
  } while (Date.now() < deadline);
  busyServeLock(paths);
}

function readState(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`cannot read ${file}: ${error.message}`);
  }
}

function writeState(file, state) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function childStatus(child) {
  const current = startTime(child.pid);
  return current !== null && current === child.start_time ? "live" : "stale";
}

function resolvePorts(config, overrides) {
  const ports = {};
  for (const command of config.serve.commands) for (const [name, spec] of Object.entries(command.ports)) ports[name] = spec.default;
  for (const override of overrides) {
    const match = /^([A-Za-z0-9_-]+)=(\d+)$/.exec(override);
    if (!match) fail(`--port expects name=value, got ${JSON.stringify(override)}`);
    if (!(match[1] in ports)) fail(`--port names unknown port ${match[1]}`);
    const value = Number(match[2]);
    if (!validPort(value)) fail(`--port ${match[1]} needs a TCP port`);
    ports[match[1]] = value;
  }
  return ports;
}

function substitute(text, ports, where) {
  return text.replace(/\{port:([A-Za-z0-9_-]+)\}/g, (_, name) => {
    if (!(name in ports)) fail(`${where} names unknown port ${name}`);
    return String(ports[name]);
  });
}

function effectiveServe(config, names, overrides) {
  if (!config.serve) fail("agentScripts.serve is not configured");
  const all = config.serve.commands;
  let selected;
  if (names.length > 0) {
    selected = names.map((name) => all.find((command) => command.name === name) ?? fail(`no serve command named ${name}`));
  } else {
    selected = all.filter((command) => command.default);
    if (selected.length === 0) fail("no serve command named and none is marked default");
  }
  const ports = resolvePorts(config, overrides);
  return selected.map((command) => ({
    name: command.name,
    argv: command.command.map((arg, index) => substitute(arg, ports, `${command.name}.command[${index}]`)),
    cwd: command.cwd ?? ".",
    env: Object.fromEntries(Object.entries(command.env ?? {}).map(([key, value]) => [key, substitute(value, ports, `${command.name}.env.${key}`)])),
    ready: substitute(command.ready, ports, `${command.name}.ready`),
    ports: Object.fromEntries(Object.keys(command.ports).map((name) => [name, ports[name]])),
  }));
}

function logTail(file, lines = 40) {
  try {
    return fs.readFileSync(file, "utf8").split("\n").slice(-lines).join("\n");
  } catch {
    return "(no log)";
  }
}

async function probeReady(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000), redirect: "manual" });
    await response.body?.cancel();
    return true;
  } catch {
    return false;
  }
}

async function serveStart(root, options, config) {
  const paths = servePaths(root);
  const release = tryServeLock(paths) ?? busyServeLock(paths);
  const state = { run_id: randomUUID(), supervisor_pid: process.pid, started_at: new Date().toISOString(), children: [] };
  let finishRegistration;
  const registered = new Promise((resolve) => { finishRegistration = resolve; });
  let stopRequested = false;
  let stopping = null;
  const stopOnce = (quiet) => {
    stopRequested = true;
    return stopping ??= (async () => {
      await registered;
      return serveStop(root, config, { quiet, state });
    })();
  };
  const signals = ["SIGINT", "SIGTERM", "SIGHUP"];
  const onSignal = (signal) => {
    stopOnce(false).finally(() => process.exit(128 + os.constants.signals[signal]));
  };
  for (const signal of signals) process.on(signal, onSignal);
  const handles = [];
  let exited = null;
  try {
    let registrationError = null;
    try {
      const existing = readState(paths.state);
      if (existing?.children?.some((child) => childStatus(child) === "live")) fail(`servers from an earlier start are still live; run serve --stop first (${paths.state})`);
      const commands = effectiveServe(config, options.positionals, options.port);
      for (const command of commands) {
        for (const [name, port] of Object.entries(command.ports)) {
          const holders = listenerPids(port);
          if (holders.length > 0) fail(`port ${name}=${port} already has a listener: ${holders.map(describeProcess).join("; ")}`);
          if (await acceptsConnections(port)) fail(`port ${name}=${port} already accepts connections from a process this user cannot identify`);
        }
      }
      writeState(paths.state, state);
      for (const command of commands) {
        if (stopRequested) break;
        const logFile = path.join(paths.dir, `${command.name}.log`);
        const fd = fs.openSync(logFile, "w", 0o600);
        let child;
        try {
          child = spawn(command.argv[0], command.argv.slice(1), {
            cwd: path.join(root, command.cwd),
            env: { ...process.env, ...SERVE_ENV_DEFAULTS, ...command.env },
            stdio: ["ignore", fd, fd],
            detached: true,
            shell: false,
          });
        } finally {
          fs.closeSync(fd);
        }
        const handle = { command, child, logFile };
        child.once("exit", (code, signal) => (exited ??= { handle, code, signal }));
        const spawnError = await new Promise((resolve) => {
          child.once("error", resolve);
          child.once("spawn", () => resolve(null));
        });
        if (spawnError) fail(`cannot start ${command.name}: ${spawnError.message}`);
        state.children.push({ name: command.name, pid: child.pid, pgid: child.pid, start_time: startTime(child.pid), command: command.argv, ports: command.ports, log: logFile });
        handles.push(handle);
        writeState(paths.state, state);
      }
    } catch (error) {
      registrationError = error;
    } finally {
      // Signals wait for this point, including registration of a racing spawn.
      release();
      finishRegistration();
    }
    if (registrationError) {
      if (state.children.length > 0) await stopOnce(true);
      throw registrationError;
    }
    if (stopRequested) {
      await stopOnce(false);
      return 1;
    }
    const timeout = (config.serve.readyTimeoutSeconds ?? DEFAULT_READY_TIMEOUT_SECONDS) * 1000;
    const deadline = Date.now() + timeout;
    const pending = new Set(handles);
    while (pending.size > 0 && !exited && !stopRequested && Date.now() < deadline) {
      for (const handle of [...pending]) if (await probeReady(handle.command.ready)) pending.delete(handle);
      if (pending.size > 0) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (stopRequested) {
      await stopOnce(false);
      return 1;
    }
    if (pending.size > 0 || exited) {
      const reason = exited ? `${exited.handle.command.name} exited (${exited.signal ?? exited.code}) before it was ready` : `not ready after ${timeout / 1000}s: ${[...pending].map((handle) => handle.command.name).join(", ")}`;
      log(reason);
      for (const handle of handles) process.stderr.write(`--- ${handle.command.name} log tail (${handle.logFile})\n${logTail(handle.logFile)}\n`);
      await stopOnce(true);
      return 1;
    }
    for (const handle of handles) log(`${handle.command.name} ready at ${handle.command.ready} (pid ${handle.child.pid}, log ${handle.logFile})`);
    if (options.detach) {
      for (const signal of signals) process.off(signal, onSignal);
      for (const handle of handles) handle.child.unref();
      log(`detached; stop with serve --stop (state ${paths.state})`);
      return 0;
    }
    return await new Promise((resolve) => {
      for (const handle of handles) {
        handle.child.once("exit", async (code, signal) => {
          if (stopping) return;
          log(`${handle.command.name} exited (${signal ?? code}); stopping the rest`);
          const stopStatus = await stopOnce(false);
          resolve((code ?? 1) || stopStatus);
        });
      }
    });
  } finally {
    release();
    finishRegistration();
    for (const signal of signals) process.off(signal, onSignal);
  }
}

function descendantsOf(table, roots) {
  const children = new Map();
  for (const [pid, entry] of table) {
    if (!children.has(entry.ppid)) children.set(entry.ppid, []);
    children.get(entry.ppid).push(pid);
  }
  const found = new Map();
  const queue = [...roots];
  while (queue.length > 0) {
    const pid = queue.shift();
    for (const child of children.get(pid) ?? []) {
      if (found.has(child) || roots.includes(child)) continue;
      found.set(child, table.get(child).start);
      queue.push(child);
    }
  }
  return found;
}

async function terminate(pid, timeoutMs) {
  signalPid(pid, "SIGTERM");
  if (!(await waitUntil(() => !alive(pid), timeoutMs))) {
    signalPid(pid, "SIGKILL");
    await waitUntil(() => !alive(pid), 2000);
  }
}

async function serveStop(root, config, { quiet = false, state = null } = {}) {
  const paths = servePaths(root);
  const release = await waitForServeLock(paths, ((config?.serve?.stopTimeoutSeconds ?? DEFAULT_STOP_TIMEOUT_SECONDS) + 5) * 1000);
  try {
    return await stopRecordedServers(root, config, { quiet, state: state ?? readState(paths.state) });
  } finally {
    release();
  }
}

async function stopRecordedServers(root, config, { quiet, state }) {
  const paths = servePaths(root);
  const say = quiet ? () => {} : log;
  if (!state || !Array.isArray(state.children)) {
    say("no recorded servers");
    return 0;
  }
  const stopMs = (config?.serve?.stopTimeoutSeconds ?? DEFAULT_STOP_TIMEOUT_SECONDS) * 1000;
  // Verify every recorded instance before sending any signal: a reused PID can sit in a group that is not ours.
  const verified = [];
  for (const child of state.children) {
    if (childStatus(child) === "live") verified.push(child);
    else say(`${child.name}: pid ${child.pid} is gone (no process with its recorded start time); nothing sent`);
  }
  const owned = new Map(verified.map((child) => [child.pid, child.start_time]));
  const snapshot = verified.length > 0 ? descendantsOf(processTable(), verified.map((child) => child.pid)) : new Map();
  for (const [pid, start] of snapshot) owned.set(pid, start);
  for (const child of verified) signalGroup(child.pgid, "SIGTERM");
  const groupsDown = () => verified.every((child) => !groupAlive(child.pgid));
  if (!(await waitUntil(groupsDown, stopMs))) {
    for (const child of verified) if (groupAlive(child.pgid)) signalGroup(child.pgid, "SIGKILL");
    await waitUntil(groupsDown, 2000);
  }
  for (const child of verified) say(`${child.name}: stopped process group ${child.pgid}`);
  for (const [pid, start] of snapshot) {
    if (startTime(pid) !== start) continue;
    say(`killing escaped descendant ${describeProcess(pid)}`);
    await terminate(pid, Math.min(stopMs, 2000));
  }
  let foreign = 0;
  for (const child of state.children) {
    for (const [name, port] of Object.entries(child.ports ?? {})) {
      for (const pid of listenerPids(port)) {
        const start = startTime(pid);
        if (start !== null && owned.get(pid) === start) {
          say(`port ${name}=${port}: killing owned listener ${describeProcess(pid)}`);
          await terminate(pid, Math.min(stopMs, 2000));
          if (!alive(pid)) continue;
        }
        if (alive(pid)) {
          foreign += 1;
          log(`port ${name}=${port} still has a listener this run does not own: ${describeProcess(pid)}; decide whether to stop it`);
        }
      }
      if (listenerPids(port).length === 0 && (await acceptsConnections(port))) {
        foreign += 1;
        log(`port ${name}=${port} still accepts connections from a process this user cannot identify; decide whether to stop it`);
      }
    }
  }
  const survivors = [...owned].filter(([pid, start]) => startTime(pid) === start);
  for (const [pid] of survivors) log(`residue: owned ${describeProcess(pid)} survived`);
  const current = readState(paths.state);
  if (survivors.length === 0 && current?.run_id === state.run_id && current?.supervisor_pid === state.supervisor_pid && current?.started_at === state.started_at) fs.rmSync(paths.state, { force: true });
  return foreign > 0 || survivors.length > 0 ? 1 : 0;
}

function serveStatus(root) {
  const state = readState(servePaths(root).state);
  if (!state || !Array.isArray(state.children) || state.children.length === 0) {
    process.stdout.write("none\n");
    return 0;
  }
  for (const child of state.children) {
    const ports = Object.entries(child.ports ?? {}).map(([name, port]) => `${name}=${port}`).join(",");
    process.stdout.write(`${child.name}\t${childStatus(child)}\tpid=${child.pid}\tports=${ports}\n`);
  }
  return 0;
}

// ---------------------------------------------------------------------------

const USAGE = `usage: node agent-scripts.mjs <command> [options]
  fix|lint [--base REF | --working-tree-only] [--paths-from FILE] [--exclude PATH]...
  gate
  serve [name...] [--port name=value]... [--detach]
  serve --stop | serve --status
  --verify [FILE]      check the version header against the file content
options: --config FILE (default: package.json at the repository root)`;

async function main(argv) {
  const options = parseArgs(argv);
  const self = fileURLToPath(import.meta.url);
  if (options.verify) {
    const result = verifyFile(options.positionals[0] ?? self);
    process.stdout.write(`${result.message}\n`);
    return result.ok ? 0 : 1;
  }
  if (options.stamp) {
    stampFile(options.positionals[0] ?? self);
    return 0;
  }
  const [command, ...rest] = options.positionals;
  options.positionals = rest;
  if (!command) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  const root = repoRoot(process.cwd());
  if (command === "serve" && (options.stop || options.status)) {
    if (options.stop && options.status) fail("choose one of --stop and --status");
    if (options.status) return serveStatus(root);
    let config = null;
    try {
      config = loadConfig(root, options.config);
    } catch {
      config = null;
    }
    return serveStop(root, config);
  }
  const config = loadConfig(root, options.config);
  if (command === "fix" || command === "lint") {
    if (rest.length > 0) fail(`${command} takes no positional arguments; use --paths-from`);
    return runSteps(command, root, options, config);
  }
  if (rest.length > 0 && command !== "serve") fail(`${command} takes no positional arguments`);
  if (command === "gate") return runGate(root, config);
  if (command === "serve") return serveStart(root, options, config);
  fail(`unknown command ${command}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (status) => {
      process.exitCode = status;
    },
    (error) => {
      if (error instanceof UsageError) {
        log(error.message);
        process.exitCode = 2;
      } else {
        log(error.stack ?? String(error));
        process.exitCode = 1;
      }
    },
  );
}
