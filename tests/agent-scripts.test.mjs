import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const script = path.join(root, "templates", "agent-scripts", "agent-scripts.mjs");
const tools = fs.mkdtempSync(path.join(os.tmpdir(), "agent-scripts-tools-"));

fs.writeFileSync(path.join(tools, "record.mjs"), `import fs from "node:fs";
fs.appendFileSync(process.env.RECORD_FILE, JSON.stringify({ tag: process.argv[2], cwd: process.cwd(), args: process.argv.slice(3), env: process.env.GATE_FLAG ?? null }) + "\\n");
process.exit(Number(process.env["EXIT_" + process.argv[2]] ?? 0));
`);
fs.writeFileSync(path.join(tools, "upper.mjs"), `import fs from "node:fs";
for (const file of process.argv.slice(2)) fs.writeFileSync(file, fs.readFileSync(file, "utf8").toUpperCase());
`);
fs.writeFileSync(path.join(tools, "server.mjs"), `import http from "node:http";
import fs from "node:fs";
import { spawn } from "node:child_process";
const [mode, port, out] = process.argv.slice(2);
if (out) fs.writeFileSync(out, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(), env: { API_ORIGIN: process.env.API_ORIGIN ?? null, NX_DAEMON: process.env.NX_DAEMON ?? null, NX_TUI: process.env.NX_TUI ?? null } }));
const listen = () => http.createServer((request, response) => response.end("ok")).listen(Number(port), "127.0.0.1");
if (mode === "serve") listen();
if (mode === "serve-with-orphan") {
  listen();
  const orphan = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: true, stdio: "ignore" });
  orphan.unref();
  fs.writeFileSync(out + ".descendant", String(orphan.pid));
}
if (mode === "delegate") {
  const holder = spawn(process.execPath, [process.argv[1], "serve", port], { detached: true, stdio: "ignore" });
  holder.unref();
  fs.writeFileSync(out + ".descendant", String(holder.pid));
  setInterval(() => {}, 1000);
}
if (mode === "never") setInterval(() => {}, 1000);
`);

const tool = (name) => path.join(tools, name);

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout;
}

function makeRepo(agentScripts, files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-scripts-repo-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Test");
  git(dir, "config", "commit.gpgsign", "false");
  write(dir, "package.json", JSON.stringify({ name: "fixture", agentScripts }, null, 2));
  for (const [file, text] of Object.entries(files)) write(dir, file, text);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "base");
  git(dir, "switch", "-q", "-c", "feature");
  return dir;
}

function write(dir, file, text) {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), text);
}

function cli(cwd, args, env = {}) {
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8", env: { ...process.env, ...env } });
}

function recorded(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function withRecord(dir) {
  return path.join(dir, "..", `${path.basename(dir)}.record.jsonl`);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function listeners(port) {
  const result = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fp"], { encoding: "utf8" });
  return [...result.stdout.matchAll(/^p(\d+)$/gm)].map((match) => Number(match[1]));
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

async function waitFor(predicate, ms = 5000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return predicate();
}

const recordStep = (tag, extra = {}) => ({ command: ["node", tool("record.mjs"), tag], ...extra });

test.after(() => fs.rmSync(tools, { recursive: true, force: true }));

test("changed-path discovery covers committed, staged, unstaged, untracked and odd names, and skips deletions and ignored files", () => {
  const dir = makeRepo({ schema: 1, lint: [recordStep("all", { extensions: [".ts"] })] }, {
    "committed.ts": "a\n", "staged.ts": "a\n", "unstaged.ts": "a\n", "old.ts": "a\n", "deleted.ts": "a\n", "unchanged.ts": "a\n", ".gitignore": "ignored.ts\n",
  });
  const record = withRecord(dir);
  try {
    write(dir, "committed.ts", "b\n");
    git(dir, "mv", "old.ts", "renamed.ts");
    git(dir, "rm", "-q", "deleted.ts");
    git(dir, "commit", "-q", "-am", "feature");
    write(dir, "staged.ts", "b\n");
    git(dir, "add", "staged.ts");
    write(dir, "unstaged.ts", "b\n");
    write(dir, "untracked.ts", "b\n");
    write(dir, "ignored.ts", "b\n");
    fs.appendFileSync(path.join(dir, ".git", "info", "exclude"), "excluded.ts\n");
    write(dir, "excluded.ts", "b\n");
    write(dir, "with space.ts", "b\n");
    write(dir, "new\nline.ts", "b\n");
    write(dir, "notes.md", "b\n");

    const result = cli(dir, ["lint", "--base", "main"], { RECORD_FILE: record });
    assert.equal(result.status, 0, result.stderr);
    const args = recorded(record).flatMap((entry) => entry.args).sort();
    assert.deepEqual(args, ["committed.ts", "new\nline.ts", "renamed.ts", "staged.ts", "unstaged.ts", "untracked.ts", "with space.ts"].sort());

    fs.rmSync(record);
    const working = cli(dir, ["lint", "--working-tree-only"], { RECORD_FILE: record });
    assert.equal(working.status, 0, working.stderr);
    assert.deepEqual(recorded(record).flatMap((entry) => entry.args).sort(), ["new\nline.ts", "staged.ts", "unstaged.ts", "untracked.ts", "with space.ts"].sort());

    const bad = cli(dir, ["lint", "--base", "no-such-ref"], { RECORD_FILE: record });
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /base "no-such-ref" from --base does not resolve to a commit/);
    const none = cli(dir, ["lint"], { RECORD_FILE: record });
    assert.equal(none.status, 2);
    assert.match(none.stderr, /no base: pass --base REF/);

    write(dir, ".agent/delivery-policy.json", JSON.stringify({ defaultBase: "main" }));
    fs.rmSync(record);
    const policy = cli(dir, ["lint"], { RECORD_FILE: record });
    assert.equal(policy.status, 0, policy.stderr);
    assert.ok(recorded(record).flatMap((entry) => entry.args).includes("committed.ts"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(record, { force: true });
  }
});

test("each step gets only its own extensions and cwd, appendPaths false runs once, and chunks finish before the next step", () => {
  const webStep = recordStep("web", { extensions: [".ts"], cwd: "apps/web" });
  const webPaths = Array.from({ length: 6 }, (_, index) => `file-${index}-${"x".repeat(20)}.ts`);
  const commandBytes = webStep.command.reduce((total, arg) => total + Buffer.byteLength(arg) + 1, 0);
  const maxArgBytes = commandBytes + 2 * (Buffer.byteLength(webPaths[0]) + 1);
  const dir = makeRepo({
    schema: 1,
    lint: [
      webStep,
      recordStep("docs", { extensions: [".md"] }),
      recordStep("affected", { appendPaths: false }),
    ],
  }, { "apps/web/keep.ts": "a\n" });
  const record = withRecord(dir);
  try {
    for (const file of webPaths) write(dir, `apps/web/${file}`, "a\n");
    write(dir, "lib/outside.ts", "a\n");
    write(dir, "README.md", "a\n");
    const result = cli(dir, ["lint", "--base", "main"], { RECORD_FILE: record, AGENT_SCRIPTS_MAX_ARG_BYTES: String(maxArgBytes) });
    assert.equal(result.status, 0, result.stderr);
    const entries = recorded(record);
    const tags = entries.map((entry) => entry.tag);
    const webChunks = entries.filter((entry) => entry.tag === "web");
    assert.ok(webChunks.length > 1, "the small argument limit should split the web step");
    assert.deepEqual(tags, [...webChunks.map(() => "web"), "docs", "affected"]);
    for (const entry of webChunks) assert.equal(fs.realpathSync(entry.cwd), fs.realpathSync(path.join(dir, "apps", "web")));
    assert.deepEqual(webChunks.flatMap((entry) => entry.args).sort(), webPaths);
    assert.deepEqual(entries.find((entry) => entry.tag === "docs").args, ["README.md"]);
    assert.deepEqual(entries.find((entry) => entry.tag === "affected").args, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(record, { force: true });
  }
});

test("lint runs every step and keeps the first failure, fix stops at the first failure, and lint refuses to mutate files", () => {
  const dir = makeRepo({
    schema: 1,
    lint: [recordStep("one"), recordStep("two"), recordStep("three")],
    fix: [recordStep("one"), recordStep("two")],
  });
  const record = withRecord(dir);
  try {
    write(dir, "a.ts", "a\n");
    const lint = cli(dir, ["lint", "--base", "main"], { RECORD_FILE: record, EXIT_one: "3", EXIT_two: "4" });
    assert.equal(lint.status, 3);
    assert.deepEqual(recorded(record).map((entry) => entry.tag), ["one", "two", "three"]);
    fs.rmSync(record);
    const fix = cli(dir, ["fix", "--base", "main"], { RECORD_FILE: record, EXIT_one: "5" });
    assert.equal(fix.status, 5);
    assert.deepEqual(recorded(record).map((entry) => entry.tag), ["one"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(record, { force: true });
  }

  const mutating = makeRepo({ schema: 1, lint: [{ command: ["node", tool("upper.mjs")] }] });
  try {
    write(mutating, "a.ts", "a\n");
    const result = cli(mutating, ["lint", "--base", "main"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /lint steps must not modify files; changed: a\.ts/);
  } finally {
    fs.rmSync(mutating, { recursive: true, force: true });
  }

  const outside = makeRepo({ schema: 1, extensions: [".ts"], lint: [{
    command: ["node", "-e", `
      const fs = require("node:fs");
      fs.writeFileSync("unchanged.txt", "rewritten\\n");
      fs.writeFileSync("unrelated.txt", "rewritten\\n");
      fs.writeFileSync("existing.txt", "rewritten\\n");
      fs.writeFileSync("new\\nfile.txt", "created\\n");
      fs.unlinkSync("deleted.txt");
      fs.unlinkSync("link.txt");
      fs.symlinkSync("other.txt", "link.txt");
    `],
    appendPaths: false,
  }] }, { "unchanged.txt": "original\n", "unrelated.txt": "original\n", "deleted.txt": "original\n", "other.txt": "original\n" });
  try {
    write(outside, "a.ts", "a\n");
    write(outside, "unrelated.txt", "unrelated edit\n");
    write(outside, "existing.txt", "untracked\n");
    fs.symlinkSync("unchanged.txt", path.join(outside, "link.txt"));
    const paths = path.join(outside, ".git", "delivery-paths");
    fs.writeFileSync(paths, "a.ts\n");
    const result = cli(outside, ["lint", "--paths-from", paths, "--exclude", "unrelated.txt"]);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /lint steps must not modify files; changed:/);
    for (const file of ["unchanged.txt", "unrelated.txt", "existing.txt", "deleted.txt", "link.txt"]) assert.ok(result.stderr.includes(file), file);
    assert.ok(result.stderr.includes('"new\\nfile.txt"'), "new paths are reported with escaped newlines");
  } finally {
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("fix formats only delivery-owned paths: unchanged files and excluded unrelated edits stay byte-identical", () => {
  const dir = makeRepo({ schema: 1, fix: [{ command: ["node", tool("upper.mjs")], extensions: [".ts"] }] }, { "owned.ts": "owned\n", "unrelated.ts": "unrelated\n", "unchanged.ts": "unchanged\n" });
  const list = path.join(dir, "..", `${path.basename(dir)}.paths`);
  try {
    write(dir, "owned.ts", "owned edit\n");
    write(dir, "unrelated.ts", "unrelated edit\n");
    fs.writeFileSync(list, "owned.ts\n");
    const viaList = cli(dir, ["fix", "--paths-from", list]);
    assert.equal(viaList.status, 0, viaList.stderr);
    assert.equal(fs.readFileSync(path.join(dir, "owned.ts"), "utf8"), "OWNED EDIT\n");
    assert.equal(fs.readFileSync(path.join(dir, "unrelated.ts"), "utf8"), "unrelated edit\n");
    assert.equal(fs.readFileSync(path.join(dir, "unchanged.ts"), "utf8"), "unchanged\n");
    assert.match(viaList.stderr, /1 changed path:\n  owned\.ts\n/);
    assert.doesNotMatch(viaList.stderr, /unrelated/);

    write(dir, "owned.ts", "owned again\n");
    const viaExclude = cli(dir, ["fix", "--base", "main", "--exclude", "unrelated.ts"]);
    assert.equal(viaExclude.status, 0, viaExclude.stderr);
    assert.equal(fs.readFileSync(path.join(dir, "owned.ts"), "utf8"), "OWNED AGAIN\n");
    assert.equal(fs.readFileSync(path.join(dir, "unrelated.ts"), "utf8"), "unrelated edit\n");
    assert.equal(fs.readFileSync(path.join(dir, "unchanged.ts"), "utf8"), "unchanged\n");

    fs.writeFileSync(list, "owned.ts\0unrelated.ts\0");
    const nul = cli(dir, ["lint", "--paths-from", list]);
    assert.equal(nul.status, 2, "lint with no steps is a configuration error");
    assert.match(nul.stderr, /agentScripts\.lint has no steps/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(list, { force: true });
  }
});

test("no changed files exits 0 without running a step, and gate stops at the first failure with its status", () => {
  const dir = makeRepo({
    schema: 1,
    fix: [recordStep("never")],
    gate: [recordStep("first"), { command: ["node", tool("record.mjs"), "second"], env: { GATE_FLAG: "on" } }, recordStep("third")],
  });
  const record = withRecord(dir);
  try {
    const empty = cli(dir, ["fix", "--base", "main"], { RECORD_FILE: record });
    assert.equal(empty.status, 0, empty.stderr);
    assert.match(empty.stderr, /^agent-scripts: no changed files$/m);
    assert.deepEqual(recorded(record), []);
    const gate = cli(dir, ["gate"], { RECORD_FILE: record, EXIT_second: "7" });
    assert.equal(gate.status, 7);
    const entries = recorded(record);
    assert.deepEqual(entries.map((entry) => entry.tag), ["first", "second"]);
    assert.equal(entries[1].env, "on");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(record, { force: true });
  }
});

test("hostile file names and config values reach tools as literal argv elements", () => {
  const dir = makeRepo({ schema: 1, lint: [{ command: ["node", tool("record.mjs"), "hostile", "$(touch pwned-config)", "; touch pwned-semicolon"] }] });
  const record = withRecord(dir);
  try {
    const names = ["$(touch pwned-name).ts", "; touch pwned-two;.ts", "`touch pwned-three`.ts", "-rf.ts", "a'b\"c.ts"];
    for (const name of names) write(dir, name, "x\n");
    const result = cli(dir, ["lint", "--base", "main"], { RECORD_FILE: record });
    assert.equal(result.status, 0, result.stderr);
    const [entry] = recorded(record);
    assert.deepEqual(entry.args.slice(0, 2), ["$(touch pwned-config)", "; touch pwned-semicolon"]);
    assert.deepEqual(entry.args.slice(2).sort(), names.map((name) => (name.startsWith("-") ? `./${name}` : name)).sort());
    for (const file of fs.readdirSync(dir)) assert.doesNotMatch(file, /^pwned/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(record, { force: true });
  }
});

test("--verify reports a match for the shipped file and drift after a one-byte edit; unknown schemas are refused", () => {
  const shipped = cli(root, ["--verify"]);
  assert.equal(shipped.status, 0, shipped.stdout + shipped.stderr);
  assert.match(shipped.stdout, /agent-scripts v1 sha256:[0-9a-f]{64} matches/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-scripts-verify-"));
  try {
    const copy = path.join(dir, "agent-scripts.mjs");
    const bytes = fs.readFileSync(script);
    bytes[bytes.length - 2] = bytes[bytes.length - 2] === 0x7d ? 0x20 : 0x7d;
    fs.writeFileSync(copy, bytes);
    const drift = spawnSync(process.execPath, [script, "--verify", copy], { encoding: "utf8" });
    assert.equal(drift.status, 1);
    assert.match(drift.stdout, /drift/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const repo = makeRepo({ schema: 99, fix: [] });
  try {
    const result = cli(repo, ["fix", "--base", "main"]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /agentScripts\.schema 99 is not supported/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

function serveConfig(ports, extra = {}) {
  return {
    schema: 1,
    serve: {
      readyTimeoutSeconds: 10,
      stopTimeoutSeconds: 2,
      commands: [
        { name: "api", command: ["node", tool("server.mjs"), extra.apiMode ?? "serve", "{port:api}", "{port:api}.api.json"], ports: { api: { default: ports.api } }, ready: "http://127.0.0.1:{port:api}/health", default: true, cwd: "out" },
        { name: "web", command: ["node", tool("server.mjs"), extra.webMode ?? "serve-with-orphan", "{port:web}", "{port:web}.web.json"], env: { API_ORIGIN: "http://localhost:{port:api}" }, ports: { web: { default: ports.web } }, ready: "http://127.0.0.1:{port:web}/" , cwd: "out" },
      ],
      ...extra.serve,
    },
  };
}

test("serve --detach returns only when ready, resolves placeholders and port overrides, and --stop leaves no process or listener", async () => {
  const [api, web, apiOverride] = [await freePort(), await freePort(), await freePort()];
  const dir = makeRepo(serveConfig({ api, web }), { "out/.keep": "" });
  try {
    const start = cli(dir, ["serve", "api", "web", "--detach", "--port", `api=${apiOverride}`]);
    assert.equal(start.status, 0, start.stderr);
    const response = await fetch(`http://127.0.0.1:${apiOverride}/health`);
    assert.equal(await response.text(), "ok");
    const webInfo = JSON.parse(fs.readFileSync(path.join(dir, "out", `${web}.web.json`), "utf8"));
    assert.deepEqual(webInfo.argv, ["serve-with-orphan", String(web), `${web}.web.json`]);
    assert.deepEqual(webInfo.env, { API_ORIGIN: `http://localhost:${apiOverride}`, NX_DAEMON: "false", NX_TUI: "false" });
    assert.equal(fs.realpathSync(webInfo.cwd), fs.realpathSync(path.join(dir, "out")));
    assert.ok(fs.existsSync(path.join(dir, "out", `${apiOverride}.api.json`)));
    const descendant = Number(fs.readFileSync(path.join(dir, "out", `${web}.web.json.descendant`), "utf8"));
    assert.ok(alive(descendant), "the detached descendant runs in its own process group");

    const state = JSON.parse(fs.readFileSync(path.join(dir, ".git", "agent-serve", "state.json"), "utf8"));
    assert.deepEqual(state.children.map((child) => child.name), ["api", "web"]);
    for (const child of state.children) assert.ok(child.start_time && child.pgid === child.pid);
    assert.match(cli(dir, ["serve", "--status"]).stdout, /^api\tlive\tpid=\d+\tports=api=\d+\nweb\tlive/m);

    const again = cli(dir, ["serve", "--detach"]);
    assert.equal(again.status, 2);
    assert.match(again.stderr, /still live; run serve --stop first/);

    const stop = cli(dir, ["serve", "--stop"]);
    assert.equal(stop.status, 0, stop.stderr);
    assert.match(stop.stderr, /killing escaped descendant/);
    assert.ok(await waitFor(() => !alive(descendant)), "descendant stopped");
    for (const child of state.children) assert.ok(!alive(child.pid), `${child.name} stopped`);
    assert.deepEqual(listeners(apiOverride), []);
    assert.deepEqual(listeners(web), []);
    assert.equal(cli(dir, ["serve", "--status"]).stdout, "none\n");
  } finally {
    cli(dir, ["serve", "--stop"]);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("serve refuses a bound port and stops everything on a ready timeout", async () => {
  const [api, web] = [await freePort(), await freePort()];
  const dir = makeRepo(serveConfig({ api, web }, { apiMode: "never", serve: { readyTimeoutSeconds: 1 } }), { "out/.keep": "" });
  const blocker = net.createServer().listen(web, "127.0.0.1");
  try {
    await new Promise((resolve) => blocker.once("listening", resolve));
    const refused = cli(dir, ["serve", "api", "web", "--detach"]);
    assert.equal(refused.status, 2);
    assert.match(refused.stderr, new RegExp(`port web=${web} already has a listener: pid ${process.pid}`));
    await new Promise((resolve) => blocker.close(resolve));

    const timedOut = cli(dir, ["serve", "api", "--detach"]);
    assert.equal(timedOut.status, 1);
    assert.match(timedOut.stderr, /not ready after 1s: api/);
    assert.match(timedOut.stderr, /--- api log tail/);
    assert.equal(cli(dir, ["serve", "--status"]).stdout, "none\n");
  } finally {
    blocker.close();
    cli(dir, ["serve", "--stop"]);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("serve --stop never signals a process it cannot prove it started", async () => {
  const [api, web] = [await freePort(), await freePort()];
  const dir = makeRepo(serveConfig({ api, web }), { "out/.keep": "" });
  const strangers = [];
  try {
    // Same-command restart: the recorded child exits and another session starts the identical command on the same port.
    const start = cli(dir, ["serve", "api", "--detach"]);
    assert.equal(start.status, 0, start.stderr);
    const statePath = path.join(dir, ".git", "agent-serve", "state.json");
    const [recordedChild] = JSON.parse(fs.readFileSync(statePath, "utf8")).children;
    process.kill(-recordedChild.pgid, "SIGKILL");
    assert.ok(await waitFor(() => !alive(recordedChild.pid)));
    assert.ok(await waitFor(() => listeners(api).length === 0));
    const stranger = spawn(recordedChild.command[0], recordedChild.command.slice(1), { cwd: path.join(dir, "out"), detached: true, stdio: "ignore" });
    strangers.push(stranger.pid);
    assert.ok(await waitFor(() => listeners(api).includes(stranger.pid)));
    const stop = cli(dir, ["serve", "--stop"]);
    assert.equal(stop.status, 1);
    assert.match(stop.stderr, /api: pid \d+ is gone/);
    assert.match(stop.stderr, new RegExp(`port api=${api} still has a listener this run does not own: pid ${stranger.pid}`));
    assert.ok(alive(stranger.pid), "the restarted command keeps running");

    // Stale PID: the state names a live sentinel whose start time no longer matches the record.
    const sentinel = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: true, stdio: "ignore" });
    strangers.push(sentinel.pid);
    await waitFor(() => alive(sentinel.pid));
    fs.writeFileSync(statePath, JSON.stringify({ supervisor_pid: 1, started_at: new Date().toISOString(), children: [{ name: "ghost", pid: sentinel.pid, pgid: sentinel.pid, start_time: "ps:Mon Jan  1 00:00:00 2001", command: ["node"], ports: {} }] }));
    const stale = cli(dir, ["serve", "--stop"]);
    assert.equal(stale.status, 0, stale.stderr);
    assert.match(stale.stderr, new RegExp(`ghost: pid ${sentinel.pid} is gone`));
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.ok(alive(sentinel.pid), "the sentinel at the stale PID survives");
  } finally {
    for (const pid of strangers) {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {}
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("serve --stop stops an owned descendant that holds the port from its own process group", async () => {
  const [api, web] = [await freePort(), await freePort()];
  const dir = makeRepo(serveConfig({ api, web }, { apiMode: "delegate" }), { "out/.keep": "" });
  try {
    const start = cli(dir, ["serve", "api", "--detach"]);
    assert.equal(start.status, 0, start.stderr);
    const holder = Number(fs.readFileSync(path.join(dir, "out", `${api}.api.json.descendant`), "utf8"));
    assert.deepEqual(listeners(api), [holder]);
    const stop = cli(dir, ["serve", "--stop"]);
    assert.equal(stop.status, 0, stop.stderr);
    assert.ok(await waitFor(() => !alive(holder)), "the port-holding descendant stopped");
    assert.deepEqual(listeners(api), []);
  } finally {
    cli(dir, ["serve", "--stop"]);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
