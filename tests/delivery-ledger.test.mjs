// R1 acceptance suite for the delivery ledger helper. Test names start with
// the implementation-spec section 13.1 tag they cover (F13, N12, F1, ...),
// so the PR's test-case matrix can cite them by name. Every case runs in a
// temporary repository; GitHub is a fake `gh` that refuses writes.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test as serialTest } from "node:test";

// Cases are independent temporary repositories, so they run concurrently.
const suite = [];
const test = (name, fn) => suite.push({ name, fn });

const root = path.resolve(new URL("..", import.meta.url).pathname);
const HELPER = path.join(root, "skills", "task-doc-delivery-loop", "scripts", "delivery-ledger.mjs");
const SCHEMA = JSON.parse(fs.readFileSync(path.join(root, "skills", "task-doc-delivery-loop", "references", "delivery-ledger.schema.json"), "utf8"));
const sha = (data) => createHash("sha256").update(data).digest("hex");
const nowIso = () => new Date().toISOString();

const SANDBOX = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "delivery ledger ")));
process.on("exit", () => fs.rmSync(SANDBOX, { recursive: true, force: true }));
const HOME = path.join(SANDBOX, "home");
const FAKE_BIN = path.join(SANDBOX, "bin");
const GLOBAL_EXCLUDES = path.join(HOME, "global-excludes");
fs.mkdirSync(HOME, { recursive: true });
fs.mkdirSync(FAKE_BIN, { recursive: true });
fs.writeFileSync(GLOBAL_EXCLUDES, "");
fs.writeFileSync(
  path.join(HOME, ".gitconfig"),
  `[user]\n\tname = Ledger Test\n\temail = ledger@example.com\n[init]\n\tdefaultBranch = main\n[commit]\n\tgpgsign = false\n[core]\n\texcludesFile = ${GLOBAL_EXCLUDES}\n[protocol "file"]\n\tallow = always\n`,
);
fs.writeFileSync(
  path.join(FAKE_BIN, "gh"),
  `#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const dir = process.env.FAKE_GH_DIR;
const args = process.argv.slice(2);
if (!dir) { process.stderr.write("no FAKE_GH_DIR"); process.exit(2); }
fs.appendFileSync(path.join(dir, "calls.jsonl"), JSON.stringify(args) + "\\n");
const method = args.includes("--method") ? args[args.indexOf("--method") + 1] : "GET";
if (method !== "GET") { process.stderr.write("fake gh refuses writes"); process.exit(9); }
let routes = {};
try { routes = JSON.parse(fs.readFileSync(path.join(dir, "routes.json"), "utf8")); } catch {}
const route = routes[args[args.length - 1]];
if (!route) { process.stderr.write("HTTP 404: Not Found"); process.exit(1); }
if (route.fail) { process.stderr.write(route.fail); process.exit(1); }
process.stdout.write(JSON.stringify(route.body));
`,
  { mode: 0o755 },
);

const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_") && key !== "FAKE_GH_DIR"));
const baseEnv = {
  ...cleanEnv,
  HOME,
  GIT_CONFIG_GLOBAL: path.join(HOME, ".gitconfig"),
  GIT_CONFIG_NOSYSTEM: "1",
  PATH: `${FAKE_BIN}:${process.env.PATH}`,
};

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, env: baseEnv, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${result.stderr}`);
  return result.stdout.trim();
}

function parseEnvelope(result) {
  const lines = result.stdout.split("\n").filter(Boolean);
  assert.equal(lines.length, 1, `stdout must be exactly one JSON line, got: ${result.stdout}\nstderr: ${result.stderr}`);
  return JSON.parse(lines[0]);
}

function run(args, { stdin = "", env = {}, cwd = SANDBOX } = {}) {
  const result = spawnSync(process.execPath, [HELPER, ...args], { cwd, env: { ...baseEnv, ...env }, input: stdin, encoding: "utf8", timeout: 60_000 });
  if (result.signal) return { status: null, signal: result.signal, stdout: result.stdout, stderr: result.stderr };
  const json = parseEnvelope(result);
  return { status: result.status, json, stderr: result.stderr };
}

function runAsync(args, { stdin = "", env = {} } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [HELPER, ...args], { cwd: SANDBOX, env: { ...baseEnv, ...env } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (status, signal) => resolve({ status, signal, json: stdout.trim() ? parseEnvelope({ stdout, stderr }) : null, stderr }));
    child.stdin.end(stdin);
  });
}

function ok(result, message = "") {
  assert.equal(result.status, 0, `${message} expected success, got ${JSON.stringify(result.json)} ${result.stderr ?? ""}`);
  assert.equal(result.json.ok, true);
  return result.json;
}

function refused(result, exit, code, message = "") {
  assert.equal(result.status, exit, `${message} expected exit ${exit}/${code}, got ${result.status}: ${JSON.stringify(result.json)} ${result.stderr ?? ""}`);
  assert.equal(result.json.ok, false);
  if (code) assert.equal(result.json.code, code, `${message} ${JSON.stringify(result.json)}`);
  assert.equal(hasOwn(result.json, "data"), false, "failure envelopes carry no data member");
  return result.json;
}

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function writeJson(file, value, pretty = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, pretty ? `${JSON.stringify(value, null, 2)}\n` : JSON.stringify(value));
  return file;
}

// A disposable local delivery: working clone, bare remote behind a
// GitHub-style URL (insteadOf), inputs directory, fake gh directory.
let caseCounter = 0;
function makeRepo({ branch = "feat/ledger-case", remote = "github", files = { "README.md": "readme\n", "src/app.js": "export const v = 1;\n" } } = {}) {
  caseCounter += 1;
  const dir = path.join(SANDBOX, `case ${caseCounter}`);
  const work = path.join(dir, "work tree");
  const bare = path.join(dir, "remote.git");
  const inputs = path.join(dir, "inputs");
  const gh = path.join(dir, "gh");
  fs.mkdirSync(inputs, { recursive: true });
  fs.mkdirSync(gh, { recursive: true });
  git(dir, "init", "-q", "--bare", "-b", "main", bare);
  git(dir, "init", "-q", "-b", "main", work);
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(work, file)), { recursive: true });
    fs.writeFileSync(path.join(work, file), content);
  }
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "base");
  const github = { host: "github.com", owner: "acme", name: `widget-${caseCounter}` };
  let remoteUrl = null;
  if (remote === "github") {
    remoteUrl = `https://github.com/${github.owner}/${github.name}.git`;
    git(work, "remote", "add", "origin", remoteUrl);
    git(work, "config", `url.${bare}.insteadOf`, remoteUrl);
  } else if (remote === "plain") {
    remoteUrl = bare;
    git(work, "remote", "add", "origin", bare);
  }
  if (remote) {
    git(work, "push", "-q", "origin", "main");
    git(work, "fetch", "-q", "origin");
  }
  git(work, "checkout", "-q", "-b", branch);
  const taskDoc = path.join(inputs, "task.md");
  fs.writeFileSync(taskDoc, "# Task\n\nDo the thing.\n");
  const repo = {
    dir,
    work: fs.realpathSync(work),
    bare,
    inputs,
    gh,
    branch,
    remote,
    github: remote === "github" ? github : null,
    remoteUrl,
    taskDoc,
    base: remote ? "origin/main" : "main",
    ledgerPath: path.join(fs.realpathSync(work), ".agent", "deliveries", `${sha(Buffer.from(branch, "utf8"))}.json`),
  };
  return repo;
}

function input(repo, name, value, pretty = false) {
  return writeJson(path.join(repo.inputs, `${name}-${randomUUID()}.json`), value, pretty);
}

function defaultAuthorization(endpoint, overrides = {}) {
  return { endpoint, merge: false, monitoring: "none", notes: "", repo_overrides: [], grants: [], ...overrides };
}

function defaultBootstrap(repo, overrides = {}) {
  return {
    brief: "Deliver the task doc to its authorized endpoint.",
    instructions: [],
    decisions: [],
    spec_check: { verdict: "not_run", report: null, source_hashes: [], checked_at: null, reason: "no pre-delivery spec check was supplied" },
    policy: { skill_pack_oid: null, skill_sources: [], session_mode: "fresh" },
    dependencies: [],
    remote_name: repo.remote ? "origin" : null,
    github: repo.github,
    pr: null,
    remote_baseline: null,
    audit_policy: { required: false, state: "not_requested", reason: "not requested" },
    ...overrides,
  };
}

function initArgs(repo, { endpoint = "draft_pr", bootstrap = {}, authorization = {}, specs = [], runtime = "claude", session = "claude-owner", branch } = {}) {
  const args = [
    "init",
    "--repo",
    repo.work,
    "--runtime",
    runtime,
    "--session",
    session,
    "--task-doc",
    repo.taskDoc,
    "--base",
    repo.base,
    "--endpoint",
    endpoint,
    "--authorization-file",
    input(repo, "authorization", defaultAuthorization(endpoint, authorization)),
    "--bootstrap-file",
    input(repo, "bootstrap", defaultBootstrap(repo, bootstrap)),
  ];
  for (const spec of specs) args.push("--spec", spec);
  if (branch) args.push("--branch", branch);
  return args;
}

function grant(scope, overrides = {}) {
  return { id: `grant-${randomUUID()}`, scope, endpoint: null, wording: `"please ${scope.replace("_", " ")}"`, source: "user message", at: nowIso(), additional_cycles: null, ...overrides };
}

// One owner session driving the helper; it re-reads the revision before
// every owned write, as a real caller would.
class Session {
  constructor(repo, runtime = "claude", session = `${runtime}-${randomUUID().slice(0, 8)}`) {
    this.repo = repo;
    this.runtime = runtime;
    this.session = session;
    this.claimId = null;
  }

  ledger() {
    return JSON.parse(fs.readFileSync(this.repo.ledgerPath, "utf8"));
  }

  get revision() {
    return this.ledger().revision;
  }

  select() {
    return ["--repo", this.repo.work];
  }

  claim(phase = "delivery", { grantFile, force, reason, recovery, env } = {}) {
    const args = ["claim", ...this.select(), "--runtime", this.runtime, "--session", this.session, "--phase", phase, "--expected-revision", String(this.revision)];
    if (grantFile) args.push("--grant-file", grantFile);
    if (force) args.push("--force", "--reason", reason ?? '"the other session has stopped"');
    if (recovery) args.push("--recovery");
    const result = run(args, { env });
    if (result.status === 0) this.claimId = result.json.data.claim_id;
    return result;
  }

  owned(command, args = [], { stdin = "", env = {}, revision } = {}) {
    return run(
      [command, ...args.slice(0, command === "append" ? 1 : 0), ...this.select(), "--runtime", this.runtime, "--session", this.session, "--claim-id", String(this.claimId), "--expected-revision", String(revision ?? this.revision), ...args.slice(command === "append" ? 1 : 0)],
      { stdin, env },
    );
  }

  append(field, item, options = {}) {
    return this.owned("append", [field], { stdin: JSON.stringify(item), ...options });
  }

  update(patch) {
    return this.owned("update", [], { stdin: JSON.stringify(patch) });
  }

  release(outcome, payload) {
    return this.owned("release", ["--outcome", outcome, "--release-file", input(this.repo, "release", payload)]);
  }

  authorize(value) {
    return this.owned("authorize", ["--grant-file", input(this.repo, "grant", value)]);
  }

  recordContext(payload, reason = "observed context") {
    return this.owned("record-context", ["--context-file", input(this.repo, "context", payload), "--reason", reason]);
  }

  freeze(oid, { intended = ["src"], excluded = [], prior } = {}) {
    const evidence = { prior_head: prior ?? this.ledger().candidate.working_head_oid, reason: "commit the authorized change", source: "delivery owner", intended_paths: intended, excluded_paths: excluded };
    return this.owned("freeze", ["--oid", oid, "--evidence-file", input(this.repo, "freeze", evidence)]);
  }

  reconcile(evidence) {
    return this.owned("reconcile", ["--evidence-file", input(this.repo, "reconcile", evidence)]);
  }

  check(stage, { pr = false } = {}) {
    const args = ["check", ...this.select(), "--stage", stage];
    if (pr) args.push("--pr");
    return run(args, { env: { FAKE_GH_DIR: this.repo.gh } });
  }
}

function initDelivery(repo, options = {}) {
  ok(run(initArgs(repo, options)), "init");
  const owner = new Session(repo, options.runtime ?? "claude");
  ok(owner.claim("delivery"), "claim");
  return owner;
}

function commit(repo, files, message = "change") {
  for (const [file, content] of Object.entries(files)) {
    const full = path.join(repo.work, file);
    if (content === null) fs.rmSync(full);
    else {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    }
  }
  git(repo.work, "add", "-A");
  git(repo.work, "commit", "-q", "-m", message);
  return git(repo.work, "rev-parse", "HEAD");
}

function entry(repo, file, { state = "present", mode } = {}) {
  if (state === "deleted") return { path: file, mode: mode ?? "100644", state, sha256: null };
  const full = path.join(repo.work, file);
  const stat = fs.lstatSync(full);
  if (stat.isSymbolicLink()) return { path: file, mode: "120000", state, sha256: sha(fs.readlinkSync(full, { encoding: "buffer" })) };
  return { path: file, mode: mode ?? (stat.mode & 0o111 ? "100755" : "100644"), state, sha256: sha(fs.readFileSync(full)) };
}

function manifestFile(repo, owner, files, { excluded = [], inputs = [], pretty = false, baseline } = {}) {
  const manifest = { version: 1, baseline_oid: baseline ?? owner.ledger().candidate.baseline_oid, files, excluded_paths: excluded, inputs };
  const file = input(repo, "manifest", manifest, pretty);
  return { file, source: { path: file, sha256: sha(fs.readFileSync(file)) }, manifest };
}

function contentId(repo, manifest) {
  return ok(run(["content-manifest", "--repo", repo.work, "--manifest-file", manifest.file]), "content-manifest").data;
}

function commandValidation(repo, overrides = {}) {
  return {
    id: `val-${randomUUID()}`,
    kind: "command",
    command: "node --test",
    cwd: repo.work,
    scope: "gate",
    oid: null,
    content_id: null,
    content_manifest: null,
    result: "pass",
    exit_code: 0,
    at: nowIso(),
    log: path.join(repo.inputs, "test.log"),
    receipt: null,
    reason: null,
    reused_from: null,
    input_fingerprint: null,
    reuse: null,
    ...overrides,
  };
}

// Records a gate for the frozen candidate with the full baseline-to-candidate
// manifest as its input basis.
function recordGate(repo, owner, files, overrides = {}) {
  const manifest = manifestFile(repo, owner, files.map((file) => (typeof file === "string" ? entry(repo, file) : file)));
  const digest = contentId(repo, manifest).input_fingerprint;
  const item = commandValidation(repo, { oid: owner.ledger().candidate.oid, content_manifest: manifest.source, input_fingerprint: digest, ...overrides });
  ok(owner.append("validation", item), "gate validation");
  return item;
}

function recordFocused(repo, owner, files, overrides = {}) {
  const manifest = manifestFile(repo, owner, files.map((file) => (typeof file === "string" ? entry(repo, file) : file)));
  const { content_id, input_fingerprint } = contentId(repo, manifest);
  const item = commandValidation(repo, { scope: "focused", content_id, content_manifest: manifest.source, input_fingerprint, ...overrides });
  ok(owner.append("validation", item), "focused validation");
  return { item, manifest, content_id };
}

function pushEvent(repo, owner, overrides = {}) {
  const ledger = owner.ledger();
  const operation = overrides.operation_id ?? `push-${randomUUID()}`;
  return {
    id: `pub-${randomUUID()}`,
    operation_id: operation,
    step: "prepared",
    kind: "push",
    at: nowIso(),
    candidate_oid: ledger.candidate.oid,
    target: { remote_name: "origin", remote_url: repo.remoteUrl, ref: `refs/heads/${repo.branch}`, host: repo.github?.host ?? null, repository: repo.github ? `${repo.github.owner}/${repo.github.name}` : null },
    intended: { oid: ledger.candidate.oid },
    precondition: { head_oid: null, body_sha256: null, state: null, observed_at: nowIso() },
    batch_id: null,
    observed: null,
    error: null,
    ...overrides,
  };
}

function step(event, stepName, extra = {}) {
  return { ...event, id: `pub-${randomUUID()}`, step: stepName, at: nowIso(), ...extra };
}

function observedFor(event, extra = {}) {
  return { object_id: null, url: null, target: event.target, oid: null, body_sha256: null, draft: null, resolved: null, state: null, observed_at: nowIso(), ...extra };
}

// Prepared push, the real git push, then a verified read-back.
function pushCandidate(repo, owner, { precondition } = {}) {
  const expected = precondition === undefined ? null : precondition;
  const prepared = pushEvent(repo, owner, { precondition: { head_oid: expected, body_sha256: null, state: null, observed_at: nowIso() } });
  ok(owner.append("publications", prepared), "prepared push");
  git(repo.work, "push", "-q", "origin", `HEAD:refs/heads/${repo.branch}`);
  const live = git(repo.work, "ls-remote", "origin", `refs/heads/${repo.branch}`).split("\t")[0];
  ok(owner.append("publications", step(prepared, "verified", { observed: observedFor(prepared, { oid: live }) })), "verified push");
  return prepared;
}

function prRecord(repo, owner, { number = 7, draft = true, head, state = "OPEN", headRepository } = {}) {
  const ledger = owner.ledger();
  return {
    host: "github.com",
    repository: `${repo.github.owner}/${repo.github.name}`,
    number,
    url: `https://github.com/${repo.github.owner}/${repo.github.name}/pull/${number}`,
    head_branch: repo.branch,
    head: head ?? ledger.candidate.oid,
    head_repository: headRepository ?? { ...repo.github },
    base: "main",
    draft,
    state,
    observed_at: nowIso(),
  };
}

function ghPull(repo, pr, overrides = {}) {
  const head = pr.head_repository;
  const body = {
    number: pr.number,
    html_url: pr.url,
    state: pr.state === "OPEN" ? "open" : "closed",
    merged_at: pr.state === "MERGED" ? nowIso() : null,
    draft: pr.draft,
    head: { ref: pr.head_branch, sha: pr.head, repo: { full_name: `${head.owner}/${head.name}`, name: head.name, owner: { login: head.owner } } },
    base: { ref: pr.base, repo: { full_name: pr.repository } },
    ...overrides,
  };
  const routesFile = path.join(repo.gh, "routes.json");
  const routes = fs.existsSync(routesFile) ? JSON.parse(fs.readFileSync(routesFile, "utf8")) : {};
  routes[`repos/${pr.repository}/pulls/${pr.number}`] = { body };
  writeJson(routesFile, routes);
}

function ghCalls(repo) {
  const file = path.join(repo.gh, "calls.jsonl");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [];
}

function summaryBody(repo, owner, summary, current = "") {
  const currentFile = path.join(repo.inputs, `body-current-${randomUUID()}.md`);
  const summaryFile = path.join(repo.inputs, `summary-${randomUUID()}.md`);
  fs.writeFileSync(currentFile, current);
  fs.writeFileSync(summaryFile, summary);
  const result = ok(run(["summary-body", "--repo", repo.work, "--current-body-file", currentFile, "--summary-file", summaryFile]), "summary-body").data;
  const bodyFile = path.join(repo.inputs, `body-${randomUUID()}.md`);
  fs.writeFileSync(bodyFile, result.body);
  return { ...result, bodyFile };
}

// Push, open a draft PR with the summary block, verify it, record it.
function openPr(repo, owner, { number = 7, draft = true } = {}) {
  pushCandidate(repo, owner);
  const body = summaryBody(repo, owner, "Delivery summary: validation passed.");
  const ledger = owner.ledger();
  const prepared = {
    id: `pub-${randomUUID()}`,
    operation_id: `pr-create-${randomUUID()}`,
    step: "prepared",
    kind: "pr_create",
    at: nowIso(),
    candidate_oid: ledger.candidate.oid,
    target: { host: "github.com", repository: `${repo.github.owner}/${repo.github.name}`, pr_number: null, pr_url: null },
    intended: { head_repository: { ...repo.github }, head_branch: repo.branch, base: "main", draft, body_file: body.bodyFile, body_sha256: body.body_sha256 },
    precondition: { head_oid: ledger.candidate.oid, body_sha256: null, state: null, observed_at: nowIso() },
    batch_id: null,
    observed: null,
    error: null,
  };
  ok(owner.append("publications", prepared), "prepared pr_create");
  const pr = prRecord(repo, owner, { number, draft });
  const verified = step(prepared, "verified", {
    observed: observedFor(prepared, {
      object_id: `PR_${number}`,
      url: pr.url,
      target: { ...prepared.target, pr_number: number, pr_url: pr.url, head_repository: { ...repo.github }, head_branch: repo.branch, base: "main" },
      oid: ledger.candidate.oid,
      body_sha256: body.body_sha256,
      draft,
      state: "OPEN",
    }),
  });
  ok(owner.append("publications", verified), "verified pr_create");
  ok(owner.recordContext({ pr }), "record new PR");
  ghPull(repo, pr);
  return { pr, prepared, verified };
}

function openPrWithoutRecord(repo, owner, { number = 9, draft = true } = {}) {
  pushCandidate(repo, owner);
  const body = summaryBody(repo, owner, "Summary.");
  const oid = owner.ledger().candidate.oid;
  const target = { host: "github.com", repository: `${repo.github.owner}/${repo.github.name}`, pr_number: null, pr_url: null };
  const prepared = { id: `pub-${randomUUID()}`, operation_id: `pr-${randomUUID()}`, step: "prepared", kind: "pr_create", at: nowIso(), candidate_oid: oid, target, intended: { head_repository: { ...repo.github }, head_branch: repo.branch, base: "main", draft, body_file: body.bodyFile, body_sha256: body.body_sha256 }, precondition: { head_oid: oid, body_sha256: null, state: null, observed_at: nowIso() }, batch_id: null, observed: null, error: null };
  ok(owner.append("publications", prepared));
  const pr = prRecord(repo, owner, { number, draft });
  ok(owner.append("publications", step(prepared, "verified", { observed: observedFor(prepared, { object_id: `PR_${number}`, url: pr.url, target: { ...target, pr_number: number, pr_url: pr.url, head_repository: { ...repo.github }, head_branch: repo.branch, base: "main" }, oid, body_sha256: body.body_sha256, draft, state: "OPEN" }) })));
  return pr;
}

function deliverToFrozen(repo, owner, files = { "src/app.js": "export const v = 2;\n" }) {
  const oid = commit(repo, files);
  ok(owner.freeze(oid), "freeze");
  return oid;
}

// A full draft-PR delivery ready for complete release.
function draftPrDelivery(repo, owner) {
  const oid = deliverToFrozen(repo, owner);
  const gate = recordGate(repo, owner, ["src/app.js"]);
  const implementation = review(owner);
  ok(owner.append("reviews", implementation), "delivery implementation review");
  repo.deliveryReviewId = implementation.id;
  const { pr, prepared, verified } = openPr(repo, owner);
  const pushes = owner.ledger().publications.filter((event) => event.kind === "push" && event.step === "verified");
  return { oid, gate, pr, prCreate: verified, push: pushes[pushes.length - 1] };
}

function completion(owner, evidence, overrides = {}) {
  const ledger = owner.ledger();
  // Only the review created by draftPrDelivery is part of that shared fixture.
  // Other tests choose their own evidence, including intentional omissions.
  const implementation = ledger.reviews.find((item) => item.id === owner.repo.deliveryReviewId && item.candidate_oid === ledger.candidate.oid);
  const references = [...new Set([...evidence, ...(implementation ? [`reviews:${implementation.id}`] : [])])];
  return { endpoint: ledger.authorization.endpoint, reached_at: nowIso(), candidate_oid: ledger.candidate.oid, content_id: null, content_manifest: null, evidence_ids: references, limitations: [], ...overrides };
}

function nextStep(phase, checkpoint, overrides = {}) {
  return { phase, checkpoint, suggested_runtime: null, brief: "continue", inputs: [], authorization_required: false, ...overrides };
}

function batchFile(repo, owner, threads, { complete = true, head, id = `batch-${randomUUID()}` } = {}) {
  const ledger = owner.ledger();
  const snapshot = { id, pr: { repository: ledger.pr.repository, number: ledger.pr.number }, head: head ?? ledger.pr.head, observed_at: nowIso(), complete, threads };
  const file = writeJson(path.join(repo.inputs, `${id}.json`), snapshot);
  return { id, path: file, sha256: sha(fs.readFileSync(file)), head: snapshot.head, observed_at: snapshot.observed_at, complete };
}

function finding(overrides = {}) {
  return {
    id: `f-${randomUUID()}`,
    source_id: null,
    severity: "important",
    shape: null,
    location: "src/app.js:1",
    expected: "correct behavior",
    actual: "incorrect behavior",
    evidence: [],
    classification: "valid",
    disposition: "pending",
    reason: null,
    fix_oid: null,
    fix_content_id: null,
    fix_content_manifest: null,
    thread_id: null,
    ...overrides,
  };
}

function review(owner, overrides = {}) {
  return {
    id: `rev-${randomUUID()}`,
    round: null,
    mode: "implementation",
    candidate_oid: owner.ledger().candidate.oid,
    content_id: null,
    content_manifest: null,
    source_hashes: [],
    runtime: "codex",
    model: null,
    source: "delegated",
    verdict: "pass",
    report: null,
    findings: [],
    batch: null,
    cycle_id: null,
    cycle_kind: null,
    at: nowIso(),
    ...overrides,
  };
}

function roleRun(owner, overrides = {}) {
  return {
    id: `run-${randomUUID()}`,
    role: "reviewer",
    mode: "implementation",
    phase: "delivery",
    candidate_oid: owner.ledger().candidate.oid,
    content_id: null,
    content_manifest: null,
    execution: "inline",
    runtime: "claude",
    runtime_version: "2.1.281",
    client: "cli",
    session_label: owner.session,
    native_session_id: null,
    requested_tier: "deep",
    requested_model: null,
    requested_effort: null,
    observed_model: null,
    observed_effort: null,
    config_hash: null,
    enforcement: { tools: "not applicable: inline", filesystem: "instructional", github: "instructional", delegation: "instructional" },
    status: "complete",
    block_reason: null,
    fallback_reason: "role_unavailable",
    parent_run_id: null,
    result_report: null,
    result_summary: "inline review",
    started_at: nowIso(),
    ended_at: nowIso(),
    heavy_commands: [],
    ...overrides,
  };
}

function limitation(overrides = {}) {
  return { id: `lim-${randomUUID()}`, kind: "note", phase: "delivery", reason: "recorded limitation", affects: [], at: nowIso(), ...overrides };
}

function sessionRecord(owner, overrides = {}) {
  return {
    id: `ses-${randomUUID()}`,
    label: owner.session,
    runtime: owner.runtime,
    runtime_version: "1.0.0",
    client: "cli",
    native_session_id: null,
    phase: "delivery",
    started_at: nowIso(),
    ended_at: null,
    transcript_ref: null,
    parent_session_id: null,
    measurement_state: "unavailable",
    ...overrides,
  };
}

function snapshotTree(dir) {
  const out = {};
  const walk = (current) => {
    for (const name of fs.readdirSync(current).sort()) {
      const full = path.join(current, name);
      const rel = path.relative(dir, full);
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) out[rel] = `link:${fs.readlinkSync(full)}`;
      else if (stat.isDirectory()) walk(full);
      else out[rel] = sha(fs.readFileSync(full));
    }
  };
  walk(dir);
  return out;
}

function deadPid() {
  const child = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
  return Number(child.stdout);
}

function lockFile(repo, kind = "branch") {
  const common = git(repo.work, "rev-parse", "--path-format=absolute", "--git-common-dir");
  const dir = path.join(fs.realpathSync(common), "agent-delivery-locks");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, kind === "branch" ? `${sha(Buffer.from(repo.branch, "utf8"))}.lock` : "exclude.lock");
}

function staleLock(repo, kind = "branch", overrides = {}) {
  const file = lockFile(repo, kind);
  const metadata = { kind, pid: deadPid(), hostname: os.hostname(), created_at: nowIso(), worktree: repo.work, operation_id: randomUUID(), branch_key: null, ...overrides };
  fs.writeFileSync(file, JSON.stringify(metadata));
  return { file, metadata };
}

function recoverLock(repo, kind, selector) {
  const args = ["recover-lock", "--repo", repo.work, "--runtime", "codex", "--session", "codex-recovery", "--kind", kind, "--reason", '"the holder crashed and has stopped"'];
  if (selector.operationId) args.push("--operation-id", selector.operationId);
  if (selector.sha256) args.push("--expected-lock-sha256", selector.sha256);
  return run(args);
}

function manualEdit(repo, mutateLedger) {
  const ledger = JSON.parse(fs.readFileSync(repo.ledgerPath, "utf8"));
  mutateLedger(ledger);
  fs.writeFileSync(repo.ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
}

function barrierEnv(extra = {}) {
  const barrier = path.join(SANDBOX, `barrier-${randomUUID()}`);
  return { barrier, env: { DELIVERY_LEDGER_TEST_HOOKS: "1", DELIVERY_LEDGER_TEST_BARRIER: barrier, ...extra } };
}

async function race(commands, { holdMs = 300 } = {}) {
  const { barrier, env } = barrierEnv({ DELIVERY_LEDGER_TEST_HOLD_MS: String(holdMs) });
  const running = commands.map((command) => runAsync(command.args, { stdin: command.stdin ?? "", env }));
  await new Promise((resolve) => setTimeout(resolve, 150));
  fs.writeFileSync(barrier, "go");
  return Promise.all(running);
}

// ---------------------------------------------------------------------------
// F13 / N12: branch key and exclusion (5.1)

test("F13 slash/underscore branch names get distinct hashed ledger paths", () => {
  const repo = makeRepo({ branch: "feat/a" });
  git(repo.work, "branch", "feat__a");
  const slash = ok(run(["path", "--repo", repo.work, "--branch", "feat/a"])).data;
  const underscore = ok(run(["path", "--repo", repo.work, "--branch", "feat__a"])).data;
  assert.notEqual(slash.path, underscore.path);
  assert.equal(slash.branch_key, sha(Buffer.from("feat/a", "utf8")));
  assert.equal(path.basename(underscore.path), `${sha(Buffer.from("feat__a", "utf8"))}.json`);
});

test("F13 very long and Unicode branch names resolve to 64-hex keys and round-trip", () => {
  const branch = `feat/${"ü".repeat(100)}/日本語/${"x".repeat(120)}`;
  const repo = makeRepo({ branch });
  ok(run(initArgs(repo)));
  const ledger = JSON.parse(fs.readFileSync(repo.ledgerPath, "utf8"));
  assert.equal(ledger.candidate.branch, branch);
  assert.match(path.basename(repo.ledgerPath), /^[0-9a-f]{64}\.json$/);
});

test("F13 a linked worktree keeps its ledger local and its exclusion and locks in the common Git directory", () => {
  const repo = makeRepo();
  const linked = path.join(repo.dir, "linked tree");
  git(repo.work, "worktree", "add", "-q", "-b", "feat/linked", linked);
  const linkedRepo = { ...repo, work: fs.realpathSync(linked), branch: "feat/linked", ledgerPath: path.join(fs.realpathSync(linked), ".agent", "deliveries", `${sha(Buffer.from("feat/linked", "utf8"))}.json`) };
  ok(run(initArgs(linkedRepo)));
  const ledger = JSON.parse(fs.readFileSync(linkedRepo.ledgerPath, "utf8"));
  assert.equal(ledger.repo.common_git_dir, fs.realpathSync(path.join(repo.work, ".git")));
  assert.equal(ledger.repo.path, linkedRepo.work);
  assert.match(fs.readFileSync(path.join(repo.work, ".git", "info", "exclude"), "utf8"), /^\/\.agent\/deliveries\/$/m);
  assert.ok(fs.existsSync(path.join(repo.work, ".git", "agent-delivery-locks")));
});

test("F13 info/exclude without a trailing newline is preserved byte-for-byte", () => {
  const repo = makeRepo();
  const exclude = path.join(repo.work, ".git", "info", "exclude");
  fs.writeFileSync(exclude, "# local rules\n*.swp");
  const result = ok(run(initArgs(repo)));
  assert.equal(result.data.exclusion_written, true);
  assert.equal(fs.readFileSync(exclude, "utf8"), "# local rules\n*.swp\n/.agent/deliveries/\n");
});

test("F13/N12 an equivalent effective rule in info/exclude, .gitignore or the global excludes file causes no write", () => {
  const sources = {
    info: (repo) => fs.appendFileSync(path.join(repo.work, ".git", "info", "exclude"), ".agent/\n"),
    gitignore: (repo) => {
      fs.writeFileSync(path.join(repo.work, ".gitignore"), ".agent/deliveries/*.json\n");
      commit(repo, {}, "ignore");
    },
    global: (repo) => {
      const excludes = path.join(repo.dir, "global-excludes");
      fs.writeFileSync(excludes, ".agent/deliveries/\n");
      const config = path.join(repo.dir, "gitconfig");
      fs.writeFileSync(config, fs.readFileSync(path.join(HOME, ".gitconfig"), "utf8").replace(GLOBAL_EXCLUDES, excludes));
      return { GIT_CONFIG_GLOBAL: config };
    },
  };
  for (const [name, add] of Object.entries(sources)) {
    const repo = makeRepo();
    const env = add(repo) ?? {};
    const exclude = path.join(repo.work, ".git", "info", "exclude");
    const before = fs.readFileSync(exclude);
    const result = ok(run(initArgs(repo), { env }), name);
    assert.equal(result.data.exclusion_written, false, name);
    assert.deepEqual(fs.readFileSync(exclude), before, `${name}: info/exclude unchanged`);
  }
});

test("F13/N12 an ignored probe path never stands in for the actual ledger path", () => {
  const probeOnly = makeRepo();
  fs.writeFileSync(path.join(probeOnly.work, ".gitignore"), ".agent/deliveries/probe.json\n");
  commit(probeOnly, {}, "probe rule");
  assert.equal(ok(run(initArgs(probeOnly))).data.exclusion_written, true);

  const overridden = makeRepo();
  fs.writeFileSync(path.join(overridden.work, ".gitignore"), "!/.agent/deliveries/\n");
  commit(overridden, {}, "negation");
  refused(run(initArgs(overridden)), 2, "invariant_error");
  assert.equal(fs.existsSync(overridden.ledgerPath), false, "no ledger is created when exclusion fails");
});

test("F13/N12 a tracked ledger path always fails, even when an ignore rule matches it", () => {
  const repo = makeRepo();
  fs.mkdirSync(path.dirname(repo.ledgerPath), { recursive: true });
  fs.writeFileSync(repo.ledgerPath, "{}");
  git(repo.work, "add", "-f", path.relative(repo.work, repo.ledgerPath));
  git(repo.work, "commit", "-q", "-m", "tracked ledger");
  fs.appendFileSync(path.join(repo.work, ".git", "info", "exclude"), "/.agent/deliveries/\n");
  fs.rmSync(repo.ledgerPath);
  refused(run(initArgs(repo)), 2, "invariant_error");
});

test("F13/N12 a permission error fails only when a needed exclusion write cannot be performed", (t) => {
  if (process.getuid?.() === 0) return t.skip("root bypasses file-mode write restrictions");
  const needsWrite = makeRepo();
  const exclude = path.join(needsWrite.work, ".git", "info", "exclude");
  fs.chmodSync(exclude, 0o444);
  refused(run(initArgs(needsWrite)), 1, "io_error");
  assert.equal(fs.existsSync(needsWrite.ledgerPath), false);

  const noWrite = makeRepo();
  fs.writeFileSync(path.join(noWrite.work, ".gitignore"), "/.agent/\n");
  commit(noWrite, {}, "ignore agent dir");
  fs.chmodSync(path.join(noWrite.work, ".git", "info", "exclude"), 0o444);
  ok(run(initArgs(noWrite)));
});

test("F13 detached HEAD and a mismatched --branch are refused for mutations", () => {
  const repo = makeRepo();
  git(repo.work, "branch", "other");
  refused(run(initArgs(repo, { branch: "other" })), 4, "identity_mismatch");
  git(repo.work, "checkout", "-q", "--detach");
  refused(run(initArgs(repo)), 4, "identity_mismatch");
});

test("F13 symlinked ledger directories and files are refused", () => {
  const repo = makeRepo();
  const elsewhere = path.join(repo.dir, "elsewhere");
  fs.mkdirSync(elsewhere);
  fs.symlinkSync(elsewhere, path.join(repo.work, ".agent"));
  refused(run(initArgs(repo)), 2, "invariant_error");

  const fileLink = makeRepo();
  ok(run(initArgs(fileLink)));
  const real = path.join(fileLink.dir, "real-ledger.json");
  fs.renameSync(fileLink.ledgerPath, real);
  fs.symlinkSync(real, fileLink.ledgerPath);
  refused(run(["show", "--repo", fileLink.work]), 2, "invariant_error");
});

test("F13 concurrent exclusion writers leave exactly one rule", async () => {
  const repo = makeRepo({ branch: "feat/one" });
  const linked = path.join(repo.dir, "second tree");
  git(repo.work, "worktree", "add", "-q", "-b", "feat/two", linked);
  const second = { ...repo, work: fs.realpathSync(linked), branch: "feat/two" };
  const results = await race([{ args: initArgs(repo) }, { args: initArgs(second) }]);
  for (const result of results) assert.ok([0, 3].includes(result.status), JSON.stringify(result.json));
  for (const [index, result] of results.entries()) if (result.status === 3) ok(run(initArgs(index === 0 ? repo : second)), "retry after a held exclusion lock");
  const rules = fs.readFileSync(path.join(repo.work, ".git", "info", "exclude"), "utf8").split("\n").filter((line) => line === "/.agent/deliveries/");
  assert.equal(rules.length, 1);
});

test("F13 a branch checked out in two worktrees is refused before init and claim", () => {
  const repo = makeRepo();
  ok(run(initArgs(repo)));
  const twin = path.join(repo.dir, "twin");
  git(repo.work, "worktree", "add", "-q", "--force", twin, repo.branch);
  const owner = new Session(repo);
  const drift = refused(owner.claim("delivery"), 4, "identity_mismatch");
  assert.match(JSON.stringify(drift.observed), /branch_checked_out_twice/);
  const fresh = makeRepo();
  git(fresh.work, "worktree", "add", "-q", "--force", path.join(fresh.dir, "twin"), fresh.branch);
  refused(run(initArgs(fresh)), 4, "identity_mismatch");
});

// ---------------------------------------------------------------------------
// Smoke: one full draft-PR delivery through complete release

test("N2/V7 a draft-PR delivery reaches done through helper commands only", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const { gate, push, prCreate } = draftPrDelivery(repo, owner);
  const done = owner.release("complete", { next: null, completion: completion(owner, [`validation:${gate.id}`, `publications:${push.id}`, `publications:${prCreate.id}`]), blocker: null });
  ok(done, "complete");
  const ledger = owner.ledger();
  assert.equal(ledger.phase, "done");
  assert.equal(ledger.owner, null);
  ok(run(["validate", "--repo", repo.work]));
  for (const key of SCHEMA.required) assert.ok(hasOwn(ledger, key), key);
});

// ---------------------------------------------------------------------------
// F1 / N6: locking, revisions and recovery (5.2)

test("F1 racing init calls behind a barrier: exactly one succeeds", async () => {
  const repo = makeRepo();
  const results = await race([{ args: initArgs(repo) }, { args: initArgs(repo) }]);
  const statuses = results.map((result) => result.status).sort();
  assert.equal(statuses[0], 0);
  assert.ok([2, 3].includes(statuses[1]), "the loser sees the held mutex, or the ledger if it arrived late");
  assert.equal(JSON.parse(fs.readFileSync(repo.ledgerPath, "utf8")).revision, 0);
});

test("F1 racing two distinct claims: exactly one succeeds", async () => {
  const repo = makeRepo();
  ok(run(initArgs(repo)));
  const claimArgs = (session) => ["claim", "--repo", repo.work, "--runtime", "codex", "--session", session, "--phase", "delivery", "--expected-revision", "0"];
  const results = await race([{ args: claimArgs("codex-a") }, { args: claimArgs("codex-b") }]);
  assert.deepEqual(results.map((result) => result.status).sort(), [0, 3]);
  const ledger = JSON.parse(fs.readFileSync(repo.ledgerPath, "utf8"));
  assert.equal(ledger.revision, 1);
  assert.equal(results.find((result) => result.status === 0).json.data.claim_id, ledger.owner.claim_id);
});

test("F1 racing appends at one revision: one commits, the other exits 3, no history is lost", async () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const args = (item) => ["append", "limitations", "--repo", repo.work, "--runtime", owner.runtime, "--session", owner.session, "--claim-id", owner.claimId, "--expected-revision", String(owner.revision)];
  const first = limitation();
  const second = limitation();
  const results = await race([{ args: args(first), stdin: JSON.stringify(first) }, { args: args(second), stdin: JSON.stringify(second) }]);
  assert.deepEqual(results.map((result) => result.status).sort(), [0, 3]);
  const ledger = owner.ledger();
  assert.equal(ledger.limitations.length, 1);
  assert.equal(ledger.history.length, ledger.revision + 1);
});

test("F1 a writer killed before rename keeps the last valid ledger and leaves an identifiable lock", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const before = fs.readFileSync(repo.ledgerPath, "utf8");
  const crashed = owner.append("limitations", limitation(), { env: { DELIVERY_LEDGER_TEST_HOOKS: "1", DELIVERY_LEDGER_TEST_CRASH: "before-rename" } });
  assert.equal(crashed.signal, "SIGKILL");
  assert.equal(fs.readFileSync(repo.ledgerPath, "utf8"), before);
  const held = refused(owner.append("limitations", limitation()), 3, "mutex_held");
  assert.equal(held.observed.complete, true);
  ok(recoverLock(repo, "branch", { operationId: held.id }));
  const item = limitation();
  ok(owner.append("limitations", item));
  assert.deepEqual(owner.ledger().limitations.map((entry) => entry.id), [item.id]);
});

test("F1 a writer killed after rename is recovered by re-reading, never by replaying", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const item = limitation();
  const revision = owner.revision;
  const crashed = owner.append("limitations", item, { env: { DELIVERY_LEDGER_TEST_HOOKS: "1", DELIVERY_LEDGER_TEST_CRASH: "after-rename" } });
  assert.equal(crashed.signal, "SIGKILL");
  const held = refused(owner.append("limitations", item, { revision }), 3, "mutex_held");
  ok(recoverLock(repo, "branch", { operationId: held.id }));
  refused(owner.append("limitations", item, { revision }), 3, "stale_revision");
  const retry = ok(owner.append("limitations", item));
  assert.equal(retry.changed, false);
  assert.equal(owner.ledger().limitations.length, 1);
  assert.equal(owner.ledger().revision, revision + 1);
});

test("F1/N6 stale claims are rejected after a forced takeover that did not need the old claim_id", () => {
  const repo = makeRepo();
  const first = initDelivery(repo);
  const second = new Session(repo, "codex");
  refused(second.claim("delivery"), 3, "owner_conflict");
  const takeover = ok(second.claim("delivery", { force: true, grantFile: input(repo, "grant", grant("takeover")) }));
  assert.equal(takeover.data.consumed_next, null);
  refused(first.append("limitations", limitation()), 3, "owner_conflict");
  refused(first.claim("delivery"), 3, "owner_conflict");
  const history = first.ledger().history.at(-1);
  assert.equal(history.detail.previous_owner.session, first.session);
  assert.equal(history.detail.forced, true);
});

test("F1 identical session labels from different runtimes are rejected", () => {
  const repo = makeRepo();
  const claude = initDelivery(repo);
  const impostor = new Session(repo, "codex", claude.session);
  impostor.claimId = claude.claimId;
  refused(impostor.append("limitations", limitation()), 3, "owner_conflict");
  refused(impostor.claim("delivery"), 3, "owner_conflict");
});

test("F1 racing releases of one claim with different next payloads: exactly one commits", async () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const payload = (brief) => input(repo, "release", { next: nextStep("delivery", "bootstrap", { brief }), completion: null, blocker: null });
  const args = (file) => ["release", "--repo", repo.work, "--runtime", owner.runtime, "--session", owner.session, "--claim-id", owner.claimId, "--expected-revision", String(owner.revision), "--outcome", "handoff", "--release-file", file];
  const revision = owner.revision;
  const results = await race([{ args: args(payload("brief A")) }, { args: args(payload("brief B")) }]);
  assert.deepEqual(results.map((result) => result.status).sort(), [0, 3]);
  const ledger = owner.ledger();
  assert.equal(ledger.revision, revision + 1);
  assert.equal(ledger.owner, null);
  assert.ok(["brief A", "brief B"].includes(ledger.next.brief));
  assert.equal(ledger.blocker, null);
});

test("F1 append racing release at one revision: only one commits and a retry needs a fresh read and ownership", async () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const revision = String(owner.revision);
  const item = limitation();
  const common = ["--repo", repo.work, "--runtime", owner.runtime, "--session", owner.session, "--claim-id", owner.claimId, "--expected-revision", revision];
  const releaseFile = input(repo, "release", { next: nextStep("delivery", "bootstrap"), completion: null, blocker: null });
  const results = await race([
    { args: ["append", "limitations", ...common], stdin: JSON.stringify(item) },
    { args: ["release", ...common, "--outcome", "handoff", "--release-file", releaseFile] },
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [0, 3]);
  const releaseWon = results[1].status === 0;
  if (releaseWon) {
    refused(owner.append("limitations", item), 3, "claim_mismatch");
  } else {
    ok(owner.release("handoff", { next: nextStep("delivery", "bootstrap"), completion: null, blocker: null }));
  }
});

test("F1 manual JSON edits and other clones are outside the lock boundary: detected, not prevented", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  manualEdit(repo, (ledger) => {
    ledger.revision += 5;
  });
  refused(owner.append("limitations", limitation(), { revision: owner.revision }), 2, "invariant_error");
  const reference = fs.readFileSync(path.join(root, "skills", "task-doc-delivery-loop", "references", "delivery-ledger.md"), "utf8");
  assert.match(reference, /another clone[\s\S]*another host[\s\S]*manual JSON edit/i);
});

test("N6 an init interrupted while holding its lock leaves no ledger and is recoverable", () => {
  const repo = makeRepo();
  const crashed = run(initArgs(repo), { env: { DELIVERY_LEDGER_TEST_HOOKS: "1", DELIVERY_LEDGER_TEST_CRASH: "before-rename" } });
  assert.equal(crashed.signal, "SIGKILL");
  assert.equal(fs.existsSync(repo.ledgerPath), false);
  const held = refused(run(initArgs(repo)), 3, "mutex_held");
  ok(recoverLock(repo, "branch", { operationId: held.id }));
  const retry = ok(run(initArgs(repo)));
  assert.equal(retry.data.exclusion_written, false, "the exclusion line left by the failed init is reused");
  const rules = fs.readFileSync(path.join(repo.work, ".git", "info", "exclude"), "utf8").split("\n").filter((line) => line === "/.agent/deliveries/");
  assert.equal(rules.length, 1);
});

test("N6 a successful init retry refuses and never overwrites the ledger", () => {
  const repo = makeRepo();
  ok(run(initArgs(repo)));
  const before = fs.readFileSync(repo.ledgerPath, "utf8");
  refused(run(initArgs(repo)), 2, "invariant_error");
  assert.equal(fs.readFileSync(repo.ledgerPath, "utf8"), before);
});

test("N6 a stale exclusion lock is reported with its holder and recoverable by identity", () => {
  const repo = makeRepo();
  const { metadata } = staleLock(repo, "exclude");
  const held = refused(run(initArgs(repo)), 3, "mutex_held");
  assert.equal(held.id, metadata.operation_id);
  assert.equal(held.observed.metadata.pid, metadata.pid);
  ok(recoverLock(repo, "exclude", { operationId: metadata.operation_id }));
  ok(run(initArgs(repo)));
});

test("N6 a mismatched or new operation survives a stale recovery request", () => {
  const repo = makeRepo();
  ok(run(initArgs(repo)));
  const { file } = staleLock(repo, "branch");
  const replaced = recoverLock(repo, "branch", { operationId: randomUUID() });
  refused(replaced, 3, "mutex_held");
  assert.ok(fs.existsSync(file), "the replacement lock was not removed");
});

test("N6 simultaneous recoveries of one lock remove it exactly once", async () => {
  const repo = makeRepo();
  ok(run(initArgs(repo)));
  const { metadata } = staleLock(repo, "branch");
  const args = ["recover-lock", "--repo", repo.work, "--runtime", "codex", "--session", "codex-r", "--kind", "branch", "--operation-id", metadata.operation_id, "--reason", '"holder stopped"'];
  const results = await race([{ args }, { args }]);
  const outcomes = results.map((result) => (result.status === 0 ? result.json.data.status : result.json.code)).sort();
  assert.equal(outcomes.filter((outcome) => outcome === "removed").length, 1);
  assert.ok(outcomes.every((outcome) => ["removed", "already_absent", "recovery_guard_held"].includes(outcome)), outcomes.join());
});

test("N6 incomplete lock metadata is reported with its hash and recovered only by that exact hash", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const file = lockFile(repo, "branch");
  fs.writeFileSync(file, '{"kind":"branch","pid":');
  const held = refused(owner.append("limitations", limitation()), 3, "mutex_held");
  assert.equal(held.observed.complete, false);
  assert.equal(held.observed.sha256, sha(fs.readFileSync(file)));
  refused(recoverLock(repo, "branch", { operationId: randomUUID() }), 3, "mutex_held");
  refused(recoverLock(repo, "branch", { sha256: "0".repeat(64) }), 3, "mutex_held");
  ok(recoverLock(repo, "branch", { sha256: held.observed.sha256 }));
  ok(owner.append("limitations", limitation()));
});

test("N6 a held recovery guard returns recovery_guard_held without recursive guards", () => {
  const repo = makeRepo();
  ok(run(initArgs(repo)));
  const { file, metadata } = staleLock(repo, "branch");
  fs.writeFileSync(`${file}.recovery.lock`, "partial");
  const result = refused(recoverLock(repo, "branch", { operationId: metadata.operation_id }), 3, "recovery_guard_held");
  assert.equal(result.path, `${file}.recovery.lock`);
  assert.deepEqual(fs.readdirSync(path.dirname(file)).filter((name) => name.includes("recovery")), [path.basename(`${file}.recovery.lock`)]);
});

test("N6 a live lock holder is never recovered, and complete metadata is recovered only by its identity", () => {
  const repo = makeRepo();
  ok(run(initArgs(repo)));
  const stale = staleLock(repo, "branch");
  refused(recoverLock(repo, "branch", { sha256: sha(fs.readFileSync(stale.file)) }), 3, "mutex_held");
  ok(recoverLock(repo, "branch", { operationId: stale.metadata.operation_id }));
  const { metadata } = staleLock(repo, "branch", { pid: process.pid });
  refused(recoverLock(repo, "branch", { operationId: metadata.operation_id }), 3, "mutex_held");
});

test("N6 an exact no-op retry leaves revision and history unchanged; a stale revision still fails first", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const item = limitation();
  const stale = owner.revision;
  ok(owner.append("limitations", item));
  const before = fs.readFileSync(repo.ledgerPath, "utf8");
  refused(owner.append("limitations", item, { revision: stale }), 3, "stale_revision");
  const retry = ok(owner.append("limitations", item));
  assert.equal(retry.changed, false);
  assert.equal(fs.readFileSync(repo.ledgerPath, "utf8"), before);
  const claimAgain = ok(run(["claim", "--repo", repo.work, "--runtime", owner.runtime, "--session", owner.session, "--claim-id", owner.claimId, "--phase", "delivery", "--expected-revision", String(owner.revision)]));
  assert.equal(claimAgain.changed, false);
  assert.equal(fs.readFileSync(repo.ledgerPath, "utf8"), before);
});

// ---------------------------------------------------------------------------
// F2 / N1 / V5: schema (5.3)

function dependencyRepo(repo, name = "shared") {
  const dir = path.join(repo.dir, name);
  git(repo.dir, "init", "-q", "-b", "main", dir);
  fs.writeFileSync(path.join(dir, "index.js"), "export {};\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "dep");
  const output = path.join(dir, "dist");
  fs.mkdirSync(output);
  fs.writeFileSync(path.join(output, "index.js"), "built\n");
  return { dir, output, oid: git(dir, "rev-parse", "HEAD") };
}

function treeHash(dir) {
  const entries = [];
  const walk = (current, rel) => {
    for (const name of fs.readdirSync(current).sort()) {
      const full = path.join(current, name);
      const relPath = rel ? `${rel}/${name}` : name;
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) entries.push(`L\0${relPath}\0${sha(fs.readlinkSync(full, { encoding: "buffer" }))}`);
      else if (stat.isDirectory()) walk(full, relPath);
      else entries.push(`F\0${relPath}\0${sha(fs.readFileSync(full))}`);
    }
  };
  walk(dir, "");
  return sha(entries.join("\n"));
}

function dependencyRecord(dep, overrides = {}) {
  return { name: "shared", path: dep.dir, oid: dep.oid, build_hash: treeHash(dep.output), evidence: dep.output, ...overrides };
}

test("F2 explicit null versus absent: required nullable fields must be present", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const missing = limitation();
  delete missing.at;
  refused(owner.append("limitations", missing), 2, "schema_error");
  const withoutReason = commandValidation(repo, { result: "skipped", exit_code: null, log: null, reason: "not applicable" });
  delete withoutReason.reason;
  refused(owner.append("validation", withoutReason), 2, "schema_error");
  const omittedSuccessor = sessionRecord(owner);
  assert.equal(hasOwn(omittedSuccessor, "supersedes_id"), false);
  ok(owner.append("sessions", omittedSuccessor), "omitted supersedes_id means null");
  manualEdit(repo, (ledger) => {
    delete ledger.blocker;
  });
  refused(run(["validate", "--repo", repo.work]), 2, "schema_error");
  manualEdit(repo, (ledger) => {
    ledger.blocker = null;
  });
  ok(run(["validate", "--repo", repo.work]));
});

test("F2 every root enum and nested item enum rejects an invalid value", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const rootCases = [
    ["phase", (l) => (l.phase = "reviewing")],
    ["checkpoint", (l) => (l.checkpoint = "deploy")],
    ["authorization.endpoint", (l) => (l.authorization.endpoint = "merge")],
    ["authorization.monitoring", (l) => (l.authorization.monitoring = true)],
    ["candidate.state", (l) => (l.candidate.state = "published")],
    ["audit_policy.state", (l) => (l.audit_policy.state = "done")],
    ["measurements.attribution_state", (l) => (l.measurements.attribution_state = "full")],
    ["owner.runtime", (l) => (l.owner.runtime = "cursor")],
    ["spec_check.verdict", (l) => (l.sources.spec_check.verdict = "maybe")],
    ["policy.session_mode", (l) => (l.policy.session_mode = "sticky")],
    ["grant.scope", (l) => l.authorization.grants.push({ ...grant("review_round"), scope: "anything" })],
    ["review_bound", (l) => (l.review_bound = { max_rounds: 2 })],
    ["schema_version", (l) => (l.schema_version = 2)],
    ["revision negative", (l) => (l.revision = -1)],
    ["timestamp", (l) => (l.updated_at = "2026-13-40T00:00:00Z")],
    ["measurement tokens", (l) => (l.measurements.main_tokens = -5)],
  ];
  const pristine = fs.readFileSync(repo.ledgerPath, "utf8");
  for (const [name, edit] of rootCases) {
    manualEdit(repo, edit);
    refused(run(["validate", "--repo", repo.work]), 2, "schema_error", name);
    fs.writeFileSync(repo.ledgerPath, pristine);
  }
  const itemCases = [
    ["validation", commandValidation(repo, { kind: "script" })],
    ["validation", commandValidation(repo, { scope: "full" })],
    ["validation", commandValidation(repo, { result: "green" })],
    ["audits", { id: "a", mode: "visual", runtime: "claude", model: null, verdict: "PASS", report: "r", oid: null, content_id: null, content_manifest: null, at: nowIso(), role_run_id: null }],
    ["audits", { id: "a", mode: "ui", runtime: "claude", model: null, verdict: "OK", report: "r", oid: null, content_id: null, content_manifest: null, at: nowIso(), role_run_id: null }],
    ["reviews", review(owner, { mode: "security" })],
    ["reviews", review(owner, { source: "bot" })],
    ["reviews", review(owner, { verdict: "lgtm" })],
    ["reviews", review(owner, { cycle_kind: "extra", cycle_id: "c" })],
    ["reviews", review(owner, { findings: [finding({ severity: "blocker" })] })],
    ["reviews", review(owner, { findings: [finding({ classification: "wrong" })] })],
    ["reviews", review(owner, { findings: [finding({ disposition: "wontfix" })] })],
    ["defect_shapes", { id: "d", shape: "s", first_seen: nowIso(), candidate_oid: "a".repeat(40), sweep: "later", searched_scope: [], siblings_fixed: [], evidence: null }],
    ["publications", { ...pushEvent(repo, owner, { candidate_oid: "a".repeat(40), intended: { oid: "a".repeat(40) } }), step: "posted" }],
    ["publications", { ...pushEvent(repo, owner, { candidate_oid: "a".repeat(40), intended: { oid: "a".repeat(40) } }), kind: "comment" }],
    ["role_runs", roleRun(owner, { execution: "remote" })],
    ["role_runs", roleRun(owner, { status: "done" })],
    ["role_runs", roleRun(owner, { enforcement: "enforced" })],
    ["sessions", sessionRecord(owner, { phase: "done" })],
    ["sessions", sessionRecord(owner, { measurement_state: "some" })],
    ["limitations", limitation({ phase: "later" })],
  ];
  for (const [field, item] of itemCases) refused(owner.append(field, item), 2, "schema_error", `${field} ${JSON.stringify(item).slice(0, 60)}`);
});

test("F2 malformed arrays return exit 2 with a parseable envelope, never an exception", () => {
  const repo = makeRepo();
  initDelivery(repo);
  const pristine = fs.readFileSync(repo.ledgerPath, "utf8");
  const cases = [
    (l) => (l.validation = {}),
    (l) => (l.history = "x"),
    (l) => (l.publications = [null]),
    (l) => (l.reviews = [{ findings: 5 }]),
    (l) => (l.sources.task_docs = []),
    (l) => (l.authorization.grants = [[1]]),
  ];
  for (const edit of cases) {
    manualEdit(repo, edit);
    for (const command of [["validate"], ["show"], ["check", "--stage", "working"]]) {
      const result = run([command[0], "--repo", repo.work, ...command.slice(1)]);
      assert.equal(result.status, 2, JSON.stringify(result.json));
      assert.match(result.json.code, /schema_error|invariant_error/);
    }
    fs.writeFileSync(repo.ledgerPath, pristine);
  }
  fs.writeFileSync(repo.ledgerPath, "{ not json");
  refused(run(["show", "--repo", repo.work]), 2, "json_error");
});

test("F2/N1 unknown fields survive rewrites recursively and never become authority", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  manualEdit(repo, (ledger) => {
    ledger.x_root = { nested: [1, { deep: true }] };
    ledger.candidate.x_note = "kept";
    ledger.authorization.x_allow_ready = true;
    ledger.x_owner_override = { session: "anyone" };
  });
  const item = { ...limitation(), x_item: { keep: "me" } };
  ok(owner.append("limitations", item));
  const ledger = owner.ledger();
  assert.deepEqual(ledger.x_root, { nested: [1, { deep: true }] });
  assert.equal(ledger.candidate.x_note, "kept");
  assert.deepEqual(ledger.limitations[0].x_item, { keep: "me" });
  const stranger = new Session(repo, "codex", "anyone");
  refused(stranger.append("limitations", limitation()), 3, "owner_conflict");
  const oid = deliverToFrozen(repo, owner);
  const readyAttempt = pushEvent(repo, owner);
  ok(owner.append("publications", readyAttempt));
  const prState = { ...readyAttempt, id: "p2", operation_id: "state-op", kind: "pr_state", target: { host: "github.com", repository: "acme/x", pr_number: 1, pr_url: "u" }, intended: { draft: false } };
  refused(owner.append("publications", prState), 2, "invariant_error");
  assert.equal(owner.ledger().authorization.endpoint, "draft_pr");
  assert.ok(oid);
});

test("F2 hostile keys are rejected in stdin items, input files and the ledger", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  refused(owner.owned("append", ["limitations"], { stdin: `{"id":"x","__proto__":{"admin":true}}` }), 2, "schema_error");
  refused(owner.owned("append", ["limitations"], { stdin: JSON.stringify({ ...limitation(), affects: [{ constructor: 1 }] }).replace('"affects":[{"constructor":1}]', '"affects":[],"nested":{"prototype":{}}') }), 2, "schema_error");
  refused(owner.update({ audit_policy: { prototype: 1 } }), 2, "schema_error");
  refused(owner.authorize({ ...grant("merge"), constructor: "x" }), 2, "schema_error");
  const text = fs.readFileSync(repo.ledgerPath, "utf8").replace('"x_placeholder"', "");
  fs.writeFileSync(repo.ledgerPath, text.replace('"notes": ""', '"notes": "", "__proto__": {"merge": true}'));
  refused(run(["show", "--repo", repo.work]), 2, "schema_error");
});

test("F2 duplicate event IDs: identical content is a no-op, different content fails", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const item = limitation();
  ok(owner.append("limitations", item));
  assert.equal(ok(owner.append("limitations", item)).changed, false);
  refused(owner.append("limitations", { ...item, reason: "different" }), 2, "invariant_error");
  const decision = { id: "d1", text: "use the ledger", source: "task doc" };
  ok(owner.append("decisions", decision));
  assert.equal(ok(owner.append("decisions", decision)).changed, false);
  refused(owner.append("decisions", { ...decision, text: "other" }), 2, "invariant_error");
});

test("F2/N2 protected and permission fields cannot be changed or escalated through update", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  for (const patch of [{ authorization: { merge: true } }, { owner: null }, { candidate: { oid: "a".repeat(40) } }, { review_bound: null }, { phase: "done" }, { history: [] }, { pr: null }, { measurements: { review_rounds: 9 } }]) {
    refused(owner.update(patch), 2, "invariant_error", JSON.stringify(patch));
  }
  ok(owner.update({ checkpoint: "implement", audit_policy: { reason: "still not requested" } }));
  assert.equal(owner.ledger().checkpoint, "implement");
  assert.equal(owner.ledger().authorization.merge, false);
});

test("F2 a fixed finding needs a fix OID or a valid local-content identity", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "local" });
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 3;\n");
  const { content_id, manifest } = recordFocused(repo, owner, ["src/app.js"]);
  const base = { content_id, content_manifest: manifest.source, candidate_oid: null };
  refused(owner.append("reviews", review(owner, { ...base, findings: [finding({ disposition: "fixed" })] })), 2, "invariant_error");
  refused(owner.append("reviews", review(owner, { ...base, findings: [finding({ disposition: "fixed", fix_content_id: content_id })] })), 2, "invariant_error");
  refused(owner.append("reviews", review(owner, { ...base, findings: [finding({ disposition: "fixed", fix_content_id: `sha256:${"0".repeat(64)}`, fix_content_manifest: manifest.source })] })), 4, "identity_mismatch");
  refused(owner.append("reviews", review(owner, { ...base, findings: [finding({ disposition: "rejected" })] })), 2, "invariant_error");
  ok(owner.append("reviews", review(owner, { ...base, findings: [finding({ disposition: "fixed", fix_content_id: content_id, fix_content_manifest: manifest.source })] })));
});

test("N1 all extended defaults are initialized and validate", () => {
  const repo = makeRepo();
  ok(run(initArgs(repo)));
  const ledger = JSON.parse(fs.readFileSync(repo.ledgerPath, "utf8"));
  assert.deepEqual(ledger.measurements, {
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
  });
  assert.equal(ledger.review_bound, null);
  assert.equal(ledger.updated_by, null);
  assert.deepEqual(
    { oid: ledger.candidate.oid, previous: ledger.candidate.previous_oid, generation: ledger.candidate.generation, state: ledger.candidate.state, recovery: ledger.candidate.recovery_required },
    { oid: null, previous: null, generation: 0, state: "working", recovery: false },
  );
  assert.equal(ledger.candidate.working_head_oid, ledger.candidate.baseline_oid);
  assert.deepEqual(ledger.next, { phase: "delivery", checkpoint: "bootstrap", suggested_runtime: null, brief: "Deliver the task doc to its authorized endpoint.", inputs: [], authorization_required: false });
  for (const field of ["validation", "audits", "reviews", "defect_shapes", "publications", "role_runs", "sessions", "limitations"]) assert.deepEqual(ledger[field], []);
  assert.equal(ledger.history.length, 1);
  assert.equal(ledger.history[0].operation, "init");
  ok(run(["validate", "--repo", repo.work]));
});

test("N1 restored scalars reject object, array and null where they are not nullable", () => {
  const repo = makeRepo();
  const dep = dependencyRepo(repo);
  ok(run(initArgs(repo, { bootstrap: { dependencies: [dependencyRecord(dep)] } })));
  const pristine = fs.readFileSync(repo.ledgerPath, "utf8");
  const targets = {
    "repo.base_ref": (l, value) => (l.repo.base_ref = value),
    "Dependency.evidence": (l, value) => (l.candidate.dependencies[0].evidence = value),
    "audit_policy.reason": (l, value) => (l.audit_policy.reason = value),
  };
  for (const [name, set] of Object.entries(targets)) {
    for (const value of [{}, [], null]) {
      manualEdit(repo, (ledger) => set(ledger, value));
      refused(run(["validate", "--repo", repo.work]), 2, "schema_error", `${name}=${JSON.stringify(value)}`);
      fs.writeFileSync(repo.ledgerPath, pristine);
    }
  }
});

test("N1 a fork head repository survives round-trip", () => {
  const repo = makeRepo();
  const head = git(repo.work, "rev-parse", "HEAD");
  git(repo.work, "push", "-q", "origin", `HEAD:refs/heads/${repo.branch}`);
  const fork = { host: "github.com", owner: "forker", name: repo.github.name };
  const pr = { host: "github.com", repository: `${repo.github.owner}/${repo.github.name}`, number: 12, url: `https://github.com/${repo.github.owner}/${repo.github.name}/pull/12`, head_branch: repo.branch, head, head_repository: fork, base: "main", draft: true, state: "OPEN", observed_at: nowIso() };
  const baseline = { remote_name: "origin", ref: `refs/heads/${repo.branch}`, oid: head, observed_at: nowIso() };
  ok(run(initArgs(repo, { bootstrap: { pr, remote_baseline: baseline } })));
  const owner = new Session(repo);
  ok(owner.claim());
  assert.deepEqual(owner.ledger().pr.head_repository, fork);
  ok(owner.recordContext({ pr: { ...pr, observed_at: nowIso() } }));
  refused(owner.recordContext({ pr: { ...pr, head_repository: { ...repo.github }, observed_at: nowIso() } }), 4, "identity_mismatch");
  ghPull(repo, pr);
  ok(owner.check("working", { pr: true }));
});

test("N1 a same-collection successor succeeds; missing, cross-collection and branched successors fail", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const first = sessionRecord(owner);
  ok(owner.append("sessions", first));
  const successor = { ...first, id: `ses-${randomUUID()}`, supersedes_id: first.id, ended_at: nowIso(), native_session_id: "native-1" };
  ok(owner.append("sessions", successor));
  refused(owner.append("sessions", { ...first, id: "s-missing", supersedes_id: "nope" }), 2, "invariant_error");
  const other = limitation();
  ok(owner.append("limitations", other));
  refused(owner.append("sessions", { ...first, id: "s-cross", supersedes_id: other.id }), 2, "invariant_error");
  refused(owner.append("sessions", { ...first, id: "s-branch", supersedes_id: first.id }), 2, "invariant_error");
  refused(owner.append("sessions", { ...successor, id: "s-renamed", supersedes_id: successor.id, native_session_id: "native-2" }), 2, "invariant_error");
});

test("N1 superseding a Review updates dispositions without adding review cycles", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  deliverToFrozen(repo, owner);
  const pending = review(owner, { cycle_id: "cycle-1", cycle_kind: "implementation_review", verdict: "pass-with-fixes", findings: [finding({ id: "f1" })] });
  ok(owner.append("reviews", pending));
  assert.equal(owner.ledger().measurements.review_rounds, 1);
  const fixedOid = owner.ledger().candidate.oid;
  const disposed = { ...pending, id: `rev-${randomUUID()}`, supersedes_id: pending.id, findings: [{ ...pending.findings[0], disposition: "fixed", fix_oid: fixedOid }] };
  ok(owner.append("reviews", disposed));
  assert.equal(owner.ledger().measurements.review_rounds, 1);
  refused(owner.append("reviews", { ...disposed, id: "rev-drop", supersedes_id: disposed.id, findings: [] }), 2, "invariant_error");
  refused(owner.append("reviews", { ...disposed, id: "rev-move", supersedes_id: disposed.id, candidate_oid: owner.ledger().candidate.baseline_oid }), 2, "invariant_error");
});

test("N1/V5 a successor status observation keeps the role-run identity", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const running = roleRun(owner, { status: "running", execution: "delegated", fallback_reason: null, ended_at: null });
  ok(owner.append("role_runs", running));
  const done = { ...running, id: `run-${randomUUID()}`, supersedes_id: running.id, status: "complete", ended_at: nowIso() };
  ok(owner.append("role_runs", done));
  refused(owner.append("role_runs", { ...done, id: "run-other-role", supersedes_id: done.id, role: "scout" }), 2, "invariant_error");
  const escalation = roleRun(owner, { execution: "delegated", fallback_reason: null, parent_run_id: running.id });
  ok(owner.append("role_runs", escalation));
  refused(owner.append("role_runs", roleRun(owner, { execution: "delegated", fallback_reason: null, parent_run_id: done.id })), 2, "invariant_error");
});

test("V5 each publication target/intended variant is validated independently", () => {
  const variants = {
    PushTarget: [{ remote_name: "origin", remote_url: "u", ref: "refs/heads/x", host: null, repository: null }, { remote_name: "origin", remote_url: "u", ref: "x", host: null, repository: null }],
    PrCreateTarget: [{ host: "h", repository: "o/n", pr_number: null, pr_url: null }, { host: "h", repository: "o/n" }],
    PrTarget: [{ host: "h", repository: "o/n", pr_number: 1, pr_url: "u" }, { host: "h", repository: "o/n", pr_number: 0, pr_url: "u" }],
    ReplyTarget: [{ host: "h", repository: "o/n", pr_number: 1, pr_url: "u", root_comment_database_id: "1", thread_graphql_id: "T" }, { host: "h", repository: "o/n", pr_number: 1, pr_url: "u", root_comment_database_id: 1, thread_graphql_id: "T" }],
    ResolveTarget: [{ host: "h", repository: "o/n", pr_number: 1, pr_url: "u", thread_graphql_id: "T" }, { host: "h", repository: "o/n", pr_number: 1, pr_url: "u" }],
    PushIntended: [{ oid: "a".repeat(40) }, { oid: "A".repeat(40) }],
    PrCreateIntended: [{ head_repository: { host: "h", owner: "o", name: "n" }, head_branch: "b", base: "main", draft: true, body_file: "/b.md", body_sha256: "a".repeat(64) }, { head_repository: { host: "h", owner: "o", name: "n" }, head_branch: "b", base: "main", draft: "yes", body_file: "/b.md", body_sha256: "a".repeat(64) }],
    BodyIntended: [{ body_file: "/b.md", body_sha256: "a".repeat(64) }, { body_file: "b.md", body_sha256: "a".repeat(64) }],
    PrStateIntended: [{ draft: false }, { draft: null }],
    ResolveIntended: [{ resolved: true, reply_operation_id: "op" }, { resolved: false, reply_operation_id: "op" }],
  };
  return import(pathToHelper()).then(({ validateShape }) => {
    for (const [name, [valid, invalid]] of Object.entries(variants)) {
      assert.deepEqual(validateShape(valid, name), [], `${name} valid`);
      assert.notDeepEqual(validateShape(invalid, name), [], `${name} invalid`);
    }
  });
});

function pathToHelper() {
  return new URL(`file://${HELPER}`).href;
}

// ---------------------------------------------------------------------------
// F14 / N2 / N11: helper contract, initialization and counters (5.4)

test("F14 strict argv: unknown flags, missing values, duplicates, extra positionals and invalid values are refused", () => {
  const repo = makeRepo();
  ok(run(initArgs(repo)));
  const cases = [
    [[]],
    [["nope"]],
    [["show", "--repo", repo.work, "--bogus"]],
    [["show", "--repo"]],
    [["show", "--repo", repo.work, "--repo", repo.work]],
    [["show", "--repo", repo.work, "extra"]],
    [["show", "--repo", repo.work, "--ledger", repo.ledgerPath]],
    [["show"]],
    [["check", "--repo", repo.work]],
    [["check", "--repo", repo.work, "--stage", "shipped"]],
    [["claim", "--repo", repo.work, "--runtime", "claude", "--session", "s", "--phase", "done", "--expected-revision", "0"]],
    [["claim", "--repo", repo.work, "--runtime", "cursor", "--session", "s", "--phase", "delivery", "--expected-revision", "0"]],
    [["claim", "--repo", repo.work, "--runtime", "claude", "--session", "s", "--phase", "delivery", "--expected-revision", "-1"]],
    [["claim", "--repo", repo.work, "--runtime", "claude", "--session", "s", "--phase", "delivery", "--expected-revision", "0", "--phase", "watch"]],
    [["claim", "--repo", repo.work, "--runtime", "claude", "--session", "s", "--phase", "delivery", "--expected-revision", "0", "--force"]],
    [["claim", "--repo", repo.work, "--runtime", "claude", "--session", "s", "--phase", "delivery"]],
    [["append", "--repo", repo.work, "--runtime", "claude", "--session", "s", "--claim-id", "c", "--expected-revision", "0"]],
    [["append", "history", "--repo", repo.work, "--runtime", "claude", "--session", "s", "--claim-id", "c", "--expected-revision", "0"]],
    [["freeze", "--repo", repo.work, "--runtime", "claude", "--session", "s", "--claim-id", "c", "--expected-revision", "0", "--oid", "HEAD", "--evidence-file", "/x"]],
    [["freeze", "--repo", repo.work, "--runtime", "claude", "--session", "s", "--claim-id", "c", "--expected-revision", "0", "--oid", "a".repeat(40), "--evidence-file", "relative.json"]],
    [["release", "--repo", repo.work, "--runtime", "claude", "--session", "s", "--claim-id", "c", "--expected-revision", "0", "--outcome", "done", "--release-file", "/x"]],
    [["recover-lock", "--repo", repo.work, "--runtime", "claude", "--session", "s", "--kind", "branch", "--reason", "r"]],
    [["recover-lock", "--repo", repo.work, "--runtime", "claude", "--session", "s", "--kind", "all", "--operation-id", "x", "--reason", "r"]],
    [["source-add", "--repo", repo.work, "--runtime", "claude", "--session", "s", "--claim-id", "c", "--expected-revision", "0", "--kind", "memo", "--path", "/x", "--reason", "r"]],
    [["init", "--repo", repo.work, "--runtime", "claude", "--session", "s", "--base", "main", "--endpoint", "draft_pr", "--authorization-file", "/a", "--bootstrap-file", "/b"]],
    [["init", "--repo", repo.work, "--runtime", "claude", "--session", "s", "--task-doc", "task.md", "--base", "main", "--endpoint", "draft_pr", "--authorization-file", "/a", "--bootstrap-file", "/b"]],
    [["init", "--repo", repo.work, "--runtime", "claude", "--session", "s", "--task-doc", repo.taskDoc, "--base", "main", "--endpoint", "merged", "--authorization-file", "/a", "--bootstrap-file", "/b"]],
  ];
  for (const [args] of cases) refused(run(args), 1, "argument_error", args.join(" "));
});

test("F14 read and lock-only commands refuse unexpected stdin; update and append read it", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  for (const args of [["path", "--repo", repo.work], ["show", "--repo", repo.work], ["validate", "--repo", repo.work], ["check", "--repo", repo.work, "--stage", "working"]]) {
    refused(run(args, { stdin: "{}" }), 1, "argument_error", args[0]);
  }
  refused(owner.owned("begin-change", [], { stdin: "x" }), 1, "argument_error");
  refused(owner.owned("append", ["limitations"], { stdin: "" }), 2, "json_error");
  refused(owner.owned("append", ["limitations"], { stdin: "[1,2]" }), 2, "schema_error");
  ok(owner.update({ checkpoint: "implement" }));
});

test("F14 exact exit codes and a single parseable JSON envelope for every error class", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const envelopeKeys = ["ok", "command", "code", "message", "path", "id", "expected", "observed"];
  const failures = [
    [run(["show", "--repo", repo.work, "--nope"]), 1, "argument_error"],
    [run(["show", "--repo", path.join(repo.dir, "missing")]), 1, "environment_error"],
    [owner.owned("append", ["limitations"], { stdin: "{" }), 2, "json_error"],
    [owner.append("limitations", { id: "x" }), 2, "schema_error"],
    [owner.update({ owner: null }), 2, "invariant_error"],
    [owner.append("limitations", limitation(), { revision: 0 }), 3, "stale_revision"],
    [run(["append", "limitations", "--repo", repo.work, "--runtime", owner.runtime, "--session", owner.session, "--claim-id", "wrong", "--expected-revision", String(owner.revision)], { stdin: JSON.stringify(limitation()) }), 3, "claim_mismatch"],
    [owner.freeze("b".repeat(40)), 4, "identity_mismatch"],
  ];
  for (const [result, exit, code] of failures) {
    const json = refused(result, exit, code);
    assert.deepEqual(Object.keys(json).sort(), [...envelopeKeys].sort());
  }
  const success = ok(run(["show", "--repo", repo.work, "--field", "/revision"]));
  assert.deepEqual(Object.keys(success).sort(), ["changed", "command", "data", "ok", "revision"]);
});

test("F14 schema-invalid check input is rejected before any identity read", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  manualEdit(repo, (ledger) => {
    ledger.candidate.oid = "not-an-oid";
  });
  refused(owner.check("working"), 2, "schema_error");
  assert.deepEqual(ghCalls(repo), []);
});

test("F14/N5 no helper command mutates sources, index, refs, remote refs or GitHub, and none fetches", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const { pr } = draftPrDelivery(repo, owner);
  const state = () => ({
    tree: Object.fromEntries(Object.entries(snapshotTree(repo.work)).filter(([file]) => !file.startsWith(".agent") && !file.startsWith(".git"))),
    index: sha(fs.readFileSync(path.join(repo.work, ".git", "index"))),
    refs: git(repo.work, "for-each-ref", "--format=%(refname) %(objectname)"),
    head: git(repo.work, "rev-parse", "HEAD"),
    fetchHead: fs.existsSync(path.join(repo.work, ".git", "FETCH_HEAD")) ? sha(fs.readFileSync(path.join(repo.work, ".git", "FETCH_HEAD"))) : null,
    remote: git(repo.bare, "for-each-ref", "--format=%(refname) %(objectname)"),
  });
  const before = state();
  ok(owner.check("frozen", { pr: true }));
  ok(owner.check("published", { pr: true }));
  ok(run(["show", "--repo", repo.work]));
  ok(run(["validate", "--repo", repo.work]));
  ok(run(["path", "--repo", repo.work]));
  ok(owner.owned("measure"));
  ok(owner.append("limitations", limitation()));
  ok(owner.recordContext({ pr: { ...pr, observed_at: nowIso() } }));
  assert.deepEqual(state(), before);
  const methods = ghCalls(repo).map((args) => args[args.indexOf("--method") + 1]);
  assert.ok(methods.length > 0);
  assert.ok(methods.every((method) => method === "GET"), methods.join());
});

test("F14 whitespace, newline and binary filenames in manifests and measurement", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const files = { "src/a b.txt": "spaced\n", "src/new\nline.txt": "newline\n", "src/tab\tname.txt": "tab\n", "src/blob.bin": Buffer.from([0, 1, 2, 255, 0, 10]) };
  for (const [file, content] of Object.entries(files)) fs.writeFileSync(path.join(repo.work, file), content);
  const manifest = manifestFile(repo, owner, Object.keys(files).map((file) => entry(repo, file)));
  const identity = contentId(repo, manifest);
  assert.match(identity.content_id, /^sha256:[0-9a-f]{64}$/);
  git(repo.work, "add", "-A");
  git(repo.work, "commit", "-q", "-m", "odd names");
  ok(owner.freeze(git(repo.work, "rev-parse", "HEAD")));
  const measured = ok(owner.owned("measure")).data;
  assert.deepEqual(measured, { ledger_path: repo.ledgerPath, files: 4, additions: 3, deletions: 0, binary_files: 1 });
});

test("F14 an empty diff measures zero and measure uses the fixed recorded base", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const baseline = owner.ledger().candidate.baseline_oid;
  ok(owner.freeze(baseline));
  assert.deepEqual(ok(owner.owned("measure")).data, { ledger_path: repo.ledgerPath, files: 0, additions: 0, deletions: 0, binary_files: 0 });

  const moving = makeRepo();
  const mover = initDelivery(moving);
  const recordedBase = mover.ledger().repo.diff_base_oid;
  git(moving.work, "checkout", "-q", "main");
  commit(moving, { "upstream.txt": "one\ntwo\nthree\n" }, "upstream");
  git(moving.work, "push", "-q", "origin", "main");
  git(moving.work, "fetch", "-q", "origin");
  git(moving.work, "checkout", "-q", moving.branch);
  const oid = commit(moving, { "src/app.js": "export const v = 9;\n" });
  ok(mover.freeze(oid));
  const measured = ok(mover.owned("measure")).data;
  assert.equal(measured.files, 1);
  assert.equal(mover.ledger().measurements.diff_base_oid, recordedBase);
});

test("F14 measure refuses a working candidate: local-only work stays unmeasured", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "local" });
  refused(owner.owned("measure"), 2, "invariant_error");
  ok(owner.append("limitations", limitation({ kind: "unmeasured", reason: "local-only work has no frozen candidate to measure" })));
});

test("F14 set-review-bound is refused in R1 without mutation", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const before = fs.readFileSync(repo.ledgerPath, "utf8");
  refused(owner.owned("set-review-bound", ["--bound-file", input(repo, "bound", { max_rounds: 2 })]), 2, "invariant_error");
  assert.equal(fs.readFileSync(repo.ledgerPath, "utf8"), before);
  assert.equal(owner.ledger().review_bound, null);
});

test("F14 show --field reads JSON pointers; missing fields and bad escapes are argument errors", () => {
  const repo = makeRepo({ branch: "feat/pointer" });
  ok(run(initArgs(repo)));
  assert.equal(ok(run(["show", "--repo", repo.work, "--field", "/candidate/branch"])).data.value, "feat/pointer");
  assert.equal(ok(run(["show", "--repo", repo.work, "--field", "/owner"])).data.value, null);
  assert.equal(ok(run(["show", "--repo", repo.work, "--field", "/history/0/operation"])).data.value, "init");
  manualEdit(repo, (ledger) => {
    ledger["a/b~c"] = 1;
  });
  assert.equal(ok(run(["show", "--repo", repo.work, "--field", "/a~1b~0c"])).data.value, 1);
  refused(run(["show", "--repo", repo.work, "--field", "/nope"]), 1, "argument_error");
  refused(run(["show", "--repo", repo.work, "--field", "/history/9"]), 1, "argument_error");
  refused(run(["show", "--repo", repo.work, "--field", "/a~2b"]), 1, "argument_error");
  refused(run(["show", "--repo", repo.work, "--field", "candidate"]), 1, "argument_error");
});

test("F14 path, show and --ledger selection resolve the same ledger", () => {
  const repo = makeRepo();
  ok(run(initArgs(repo)));
  const resolved = ok(run(["path", "--repo", repo.work])).data;
  assert.equal(resolved.path, repo.ledgerPath);
  assert.equal(resolved.exists, true);
  assert.equal(ok(run(["show", "--ledger", repo.ledgerPath, "--field", "/delivery_id"])).data.value, ok(run(["show", "--repo", repo.work, "--field", "/delivery_id"])).data.value);
  refused(run(["show", "--ledger", path.join(repo.work, "ledger.json")]), 1, "argument_error");
});

test("F14 content-manifest validates without staging files or writing Git objects", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  fs.writeFileSync(path.join(repo.work, "src/new.js"), "new\n");
  const objectsBefore = snapshotTree(path.join(repo.work, ".git", "objects"));
  const index = sha(fs.readFileSync(path.join(repo.work, ".git", "index")));
  contentId(repo, manifestFile(repo, owner, [entry(repo, "src/new.js")]));
  assert.deepEqual(snapshotTree(path.join(repo.work, ".git", "objects")), objectsBefore);
  assert.equal(sha(fs.readFileSync(path.join(repo.work, ".git", "index"))), index);
});

test("F14 source-add appends a changed identity, is a no-op when unchanged, and invalidates reviews of the old hash", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "commit" });
  deliverToFrozen(repo, owner);
  const gate = recordGate(repo, owner, ["src/app.js"]);
  const reviewed = review(owner, { source_hashes: [{ path: repo.taskDoc, sha256: sha(fs.readFileSync(repo.taskDoc)) }] });
  ok(owner.append("reviews", reviewed));
  const args = (file) => ["--kind", "task_doc", "--path", file, "--reason", "the task doc was clarified"];
  assert.equal(ok(owner.owned("source-add", args(repo.taskDoc))).changed, false, "an unchanged source is a no-op");
  refused(owner.owned("source-add", args(path.join(repo.inputs, "missing.md"))), 1, "io_error");
  refused(owner.owned("source-add", ["--kind", "task_doc", "--path", "relative.md", "--reason", "r"]), 1, "argument_error");
  fs.writeFileSync(repo.taskDoc, "# Task\n\nClarified.\n");
  ok(owner.owned("source-add", args(repo.taskDoc)));
  const ledger = owner.ledger();
  assert.equal(ledger.sources.task_docs.length, 2, "earlier hashes are kept");
  assert.deepEqual(ledger.history.at(-1).detail.invalidated_evidence, [`reviews:${reviewed.id}`]);
  refused(owner.release("complete", { next: null, completion: completion(owner, [`validation:${gate.id}`, `reviews:${reviewed.id}`]), blocker: null }), 2, "invariant_error");
  ok(owner.release("complete", { next: null, completion: completion(owner, [`validation:${gate.id}`]), blocker: null }));
});

test("N2 initialize without a spec, and local-only without a remote", () => {
  const repo = makeRepo({ remote: null });
  ok(run(initArgs(repo, { endpoint: "local" })));
  const ledger = JSON.parse(fs.readFileSync(repo.ledgerPath, "utf8"));
  assert.deepEqual(ledger.sources.specs, []);
  assert.equal(ledger.repo.remote_name, null);
  assert.equal(ledger.repo.remote_url, null);
  assert.deepEqual(ledger.limitations, []);
});

test("N2/F5 import a spec report, instructions and dirty-bootstrap decisions before initialization", () => {
  const repo = makeRepo();
  const spec = path.join(repo.inputs, "spec.md");
  fs.writeFileSync(spec, "# Spec\n");
  const report = path.join(repo.inputs, "spec-check.md");
  fs.writeFileSync(report, "accept\n");
  const agents = path.join(repo.work, "AGENTS.md");
  fs.writeFileSync(agents, "rules\n");
  const specCheck = { verdict: "accept", report, source_hashes: [{ path: spec, sha256: sha(fs.readFileSync(spec)) }], checked_at: nowIso(), reason: null };
  const instructions = [{ path: agents, sha256: sha(fs.readFileSync(agents)) }];
  refused(run(initArgs(repo, { specs: [spec], bootstrap: { spec_check: specCheck, instructions } })), 2, "invariant_error", "dirty without a scope decision");
  refused(run(initArgs(repo, { specs: [spec], bootstrap: { spec_check: specCheck, instructions, decisions: [{ id: "dirty_scope", text: "Included: MY-AGENTS.md.bak only.", source: "owner" }] } })), 2, "invariant_error", "a substring is not a named path");
  const decisions = [{ id: "dirty_scope", text: "Included: `AGENTS.md`. Excluded: nothing else is dirty.", source: "owner" }];
  refused(run(initArgs(repo, { specs: [spec], bootstrap: { spec_check: specCheck, instructions: [{ path: agents, sha256: "0".repeat(64) }], decisions } })), 4, "identity_mismatch");
  refused(run(initArgs(repo, { specs: [spec], bootstrap: { spec_check: { ...specCheck, verdict: "not_run", report: null, checked_at: null, reason: null }, instructions, decisions } })), 2, "invariant_error", "not_run needs a reason");
  ok(run(initArgs(repo, { specs: [spec], bootstrap: { spec_check: specCheck, instructions, decisions } })));
  const ledger = JSON.parse(fs.readFileSync(repo.ledgerPath, "utf8"));
  assert.equal(ledger.sources.spec_check.verdict, "accept");
  assert.deepEqual(ledger.sources.instructions, instructions);
  assert.equal(ledger.sources.specs[0].path, spec);
  assert.equal(ledger.sources.decisions[0].id, "dirty_scope");
});

test("N2 persist same-session mode and a changed policy hash with before/after history", () => {
  const repo = makeRepo();
  const skill = path.join(repo.inputs, "SKILL.md");
  fs.writeFileSync(skill, "v1\n");
  const owner = initDelivery(repo, { bootstrap: { policy: { skill_pack_oid: null, skill_sources: [{ path: skill, sha256: sha("v1\n") }], session_mode: "fresh" } } });
  fs.writeFileSync(skill, "v2\n");
  refused(owner.recordContext({ policy: { skill_pack_oid: null, skill_sources: [{ path: skill, sha256: sha("v1\n") }], session_mode: "same_session" } }), 4, "identity_mismatch");
  ok(owner.recordContext({ policy: { skill_pack_oid: null, skill_sources: [{ path: skill, sha256: sha("v2\n") }], session_mode: "same_session" } }, "the user asked to continue in this session"));
  const ledger = owner.ledger();
  assert.equal(ledger.policy.session_mode, "same_session");
  const event = ledger.history.at(-1);
  assert.equal(event.detail.before.policy.session_mode, "fresh");
  assert.equal(event.detail.after.policy.skill_sources[0].sha256, sha("v2\n"));
  assert.equal(event.detail.reason, "the user asked to continue in this session");
});

test("N2 a frozen candidate refuses a dependency replacement", () => {
  const repo = makeRepo();
  const dep = dependencyRepo(repo);
  const owner = initDelivery(repo, { bootstrap: { dependencies: [dependencyRecord(dep)] } });
  deliverToFrozen(repo, owner);
  commit({ work: dep.dir }, { "index.js": "export const x = 1;\n" });
  refused(owner.recordContext({ dependencies: [dependencyRecord(dep, { oid: git(dep.dir, "rev-parse", "HEAD") })] }), 2, "invariant_error");
});

test("N2 record a newly created PR and a later same-identity observation; refuse retargeting", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const { pr } = draftPrDelivery(repo, owner);
  ok(owner.recordContext({ pr: { ...pr, observed_at: nowIso() } }));
  refused(owner.recordContext({ pr: { ...pr, base: "develop", observed_at: nowIso() } }), 4, "identity_mismatch");
  const first = makeRepo();
  const firstOwner = initDelivery(first, { endpoint: "ready_pr" });
  deliverToFrozen(first, firstOwner);
  const created = openPrWithoutRecord(first, firstOwner, { draft: true });
  refused(firstOwner.recordContext({ pr: { ...created, draft: false } }), 4, "identity_mismatch", "the first observation cannot claim a ready PR the verified create did not produce");
  ok(firstOwner.recordContext({ pr: created }));
  refused(owner.recordContext({ pr: { ...pr, number: 8, url: pr.url.replace("/7", "/8"), observed_at: nowIso() } }), 4, "identity_mismatch");
  refused(owner.recordContext({ pr: { ...pr, draft: false, observed_at: nowIso() } }), 2, "invariant_error", "draft changes need a verified pr_state");
  refused(owner.recordContext({ pr: { ...pr, head: owner.ledger().candidate.baseline_oid, observed_at: nowIso() } }), 2, "invariant_error", "head changes need a verified push");
});

test("N2 context writes cannot escalate permissions or change identity", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  for (const payload of [{ authorization: { merge: true } }, { candidate: { oid: "a".repeat(40) } }, { phase: "done" }, { repo: {} }, { completion: null }, {}]) {
    const result = owner.recordContext(payload);
    assert.equal(result.status, 2, JSON.stringify(payload));
  }
  assert.equal(owner.ledger().authorization.merge, false);
});

test("N11 duplicate retries and successor records do not inflate counters", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 5;\n");
  const pending = commandValidation(repo, { scope: "focused", result: "pending", exit_code: null, log: null });
  ok(owner.append("validation", pending));
  const { item } = recordFocused(repo, owner, ["src/app.js"]);
  ok(owner.append("validation", item));
  const successor = { ...item, id: `val-${randomUUID()}`, supersedes_id: item.id, at: nowIso() };
  ok(owner.append("validation", successor));
  assert.equal(owner.ledger().measurements.validation_reruns, 0);
  const cycle = review(owner, { candidate_oid: null, content_id: item.content_id, content_manifest: item.content_manifest, cycle_id: "c1", cycle_kind: "implementation_review" });
  ok(owner.append("reviews", cycle));
  ok(owner.append("reviews", cycle));
  ok(owner.append("reviews", { ...cycle, id: `rev-${randomUUID()}`, supersedes_id: cycle.id }));
  assert.equal(owner.ledger().measurements.review_rounds, 1);
});

test("N11 an unchanged-input rerun adds one; a changed input adds zero", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 6;\n");
  recordFocused(repo, owner, ["src/app.js"]);
  recordFocused(repo, owner, ["src/app.js"]);
  assert.equal(owner.ledger().measurements.validation_reruns, 1);
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 7;\n");
  recordFocused(repo, owner, ["src/app.js"]);
  assert.equal(owner.ledger().measurements.validation_reruns, 1);
  recordFocused(repo, owner, ["src/app.js"], { command: "node --test other" });
  assert.equal(owner.ledger().measurements.validation_reruns, 1);
});

test("N11 reused evidence adds zero executions and a review-only session is recorded", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const oid = deliverToFrozen(repo, owner);
  const gate = recordGate(repo, owner, ["src/app.js"]);
  ok(owner.owned("begin-change"));
  git(repo.work, "commit", "-q", "--allow-empty", "-m", "message-only change");
  const next = git(repo.work, "rev-parse", "HEAD");
  assert.notEqual(next, oid);
  ok(owner.freeze(next, { intended: ["src"] }));
  const manifest = manifestFile(repo, owner, [entry(repo, "src/app.js")]);
  const reuse = commandValidation(repo, {
    oid: next,
    content_manifest: manifest.source,
    reused_from: gate.id,
    reuse: { source_id: gate.id, source_oid: oid, target_oid: next, unchanged_inputs: [], reason: "commit-message-only change; identical tree" },
    log: gate.log,
  });
  ok(owner.append("validation", reuse));
  assert.equal(owner.ledger().measurements.validation_reruns, 0);
  ok(owner.append("sessions", sessionRecord(owner, { phase: "review_round", label: "codex-review-only", runtime: "codex" })));
  assert.equal(owner.ledger().sessions[0].phase, "review_round");
});

// ---------------------------------------------------------------------------
// F3 / N5 / V1 / V2: candidate identity, expected remote state, resume (5.5)

function adoptedDelivery(repo, { endpoint = "draft_pr", number = 21 } = {}) {
  const head = git(repo.work, "rev-parse", "HEAD");
  git(repo.work, "push", "-q", "origin", "HEAD:refs/heads/" + repo.branch);
  const pr = { host: "github.com", repository: repo.github.owner + "/" + repo.github.name, number, url: "https://github.com/" + repo.github.owner + "/" + repo.github.name + "/pull/" + number, head_branch: repo.branch, head, head_repository: { ...repo.github }, base: "main", draft: true, state: "OPEN", observed_at: nowIso() };
  const remote_baseline = { remote_name: "origin", ref: "refs/heads/" + repo.branch, oid: head, observed_at: nowIso() };
  ok(run(initArgs(repo, { endpoint, bootstrap: { pr, remote_baseline } })), "adopting init");
  ghPull(repo, pr);
  const owner = new Session(repo);
  ok(owner.claim());
  return { owner, head, pr };
}

test("F3 the wrong branch at an identical OID is drift", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  git(repo.work, "checkout", "-q", "-b", "feat/same-oid");
  refused(run(["check", "--ledger", repo.ledgerPath, "--stage", "working"]), 4, "identity_mismatch");
  refused(run(["claim", "--ledger", repo.ledgerPath, "--runtime", "codex", "--session", "c2", "--phase", "delivery", "--expected-revision", String(owner.revision)]), 4, "identity_mismatch");
});

test("F3 the wrong worktree is drift", () => {
  const repo = makeRepo();
  initDelivery(repo);
  const other = path.join(repo.dir, "other tree");
  git(repo.work, "worktree", "add", "-q", "-b", "feat/other", other);
  const copied = path.join(fs.realpathSync(other), ".agent", "deliveries", path.basename(repo.ledgerPath));
  fs.mkdirSync(path.dirname(copied), { recursive: true });
  fs.copyFileSync(repo.ledgerPath, copied);
  const drift = refused(run(["check", "--ledger", copied, "--stage", "working"]), 4, "identity_mismatch");
  assert.match(JSON.stringify(drift.observed), /worktree/);
});

test("F3/V2 a stale remote URL is drift; a missing configured remote still fails as an environment problem", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  git(repo.work, "remote", "set-url", "origin", "https://github.com/acme/elsewhere.git");
  refused(owner.check("working"), 4, "identity_mismatch");
  git(repo.work, "remote", "remove", "origin");
  const missing = refused(owner.check("working"), 1, "environment_error");
  assert.equal(missing.observed.status, "unverified");
  const fresh = new Session(repo, "codex");
  ok(owner.release("handoff", { next: nextStep("delivery", "bootstrap"), completion: null, blocker: null }));
  refused(fresh.claim("delivery"), 1, "environment_error");
});

test("F3 a fork PR's identity and the same PR number in another repository are distinguished", () => {
  const repo = makeRepo();
  const { owner, pr } = adoptedDelivery(repo);
  ok(owner.check("working", { pr: true }));
  ghPull(repo, pr, { base: { ref: "main", repo: { full_name: "acme/other-repo" } } });
  refused(owner.check("working", { pr: true }), 4, "identity_mismatch");
  ghPull(repo, pr, { head: { ref: repo.branch, sha: pr.head, repo: { full_name: "forker/" + repo.github.name, name: repo.github.name, owner: { login: "forker" } } } });
  refused(owner.check("working", { pr: true }), 4, "identity_mismatch");
  ghPull(repo, pr);
  ok(owner.check("working", { pr: true }));
  const unreadable = makeRepo();
  const second = adoptedDelivery(unreadable);
  writeJson(path.join(unreadable.gh, "routes.json"), { ["repos/" + second.pr.repository + "/pulls/" + second.pr.number]: { fail: "HTTP 502" } });
  const network = refused(second.owner.check("working", { pr: true }), 1, "network_error");
  assert.equal(network.observed.status, "unverified");
});

test("F3 a dirty index blocks frozen checks and freeze", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const oid = commit(repo, { "src/app.js": "export const v = 2;\n" });
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 3;\n");
  git(repo.work, "add", "src/app.js");
  refused(owner.freeze(oid), 4, "identity_mismatch");
  git(repo.work, "reset", "-q", "--hard", oid);
  ok(owner.freeze(oid));
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 4;\n");
  git(repo.work, "add", "src/app.js");
  refused(owner.check("frozen"), 4, "identity_mismatch");
});

test("F3 a changed dependency output is drift", () => {
  const repo = makeRepo();
  const dep = dependencyRepo(repo);
  const owner = initDelivery(repo, { bootstrap: { dependencies: [dependencyRecord(dep)] } });
  ok(owner.check("working"));
  fs.writeFileSync(path.join(dep.output, "index.js"), "rebuilt differently\n");
  const drift = refused(owner.check("working"), 4, "identity_mismatch");
  assert.match(JSON.stringify(drift.observed), /dependency_output/);
  ok(owner.release("handoff", { next: nextStep("delivery", "bootstrap"), completion: null, blocker: null }));
  refused(new Session(repo, "codex").claim("delivery"), 4, "identity_mismatch");
});

test("F3/F15 a missing or changed source file is drift and is reported", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  ok(owner.release("handoff", { next: nextStep("delivery", "bootstrap"), completion: null, blocker: null }));
  fs.writeFileSync(repo.taskDoc, "# Task\n\nChanged scope.\n");
  const changed = refused(new Session(repo, "codex").claim("delivery"), 4, "identity_mismatch");
  assert.match(JSON.stringify(changed.observed), /source_changed/);
  fs.renameSync(repo.taskDoc, repo.taskDoc + ".moved");
  const moved = refused(new Session(repo, "codex").claim("delivery"), 4, "identity_mismatch");
  assert.match(JSON.stringify(moved.observed), /source_missing/);
});

test("F3 a local fix ahead of the PR is accepted only before the published stage", () => {
  const repo = makeRepo();
  const { owner } = adoptedDelivery(repo);
  const fix = commit(repo, { "src/app.js": "export const v = 2;\n" });
  ok(owner.freeze(fix));
  ok(owner.check("frozen", { pr: true }), "the PR may still show the expected previous remote OID");
  const unpublished = refused(owner.check("published", { pr: true }), 4, "identity_mismatch");
  assert.match(JSON.stringify(unpublished.observed), /remote_ref_moved/);
});

test("F3/N5 a crash after commit is recovered by reconciliation without rewriting evidence", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 2;\n");
  const { item } = recordFocused(repo, owner, ["src/app.js"]);
  const working = owner.ledger().candidate.working_head_oid;
  const oid = commit(repo, {}, "the commit landed, then the session crashed");
  const fresh = new Session(repo, "codex");
  refused(fresh.claim("delivery", { force: true, grantFile: input(repo, "grant", grant("takeover")) }), 4, "identity_mismatch", "a normal takeover refuses drift");
  ok(fresh.claim("delivery", { force: true, recovery: true, grantFile: input(repo, "grant", grant("takeover")) }));
  assert.equal(fresh.ledger().candidate.recovery_required, true);
  refused(fresh.freeze(oid), 2, "invariant_error", "ordinary freeze is forbidden during recovery");
  const evidence = {
    case: "interrupted_commit",
    reason: "the interrupted owner's authorized commit",
    source: "history of the previous claim",
    grant_id: null,
    expected: { candidate_oid: null, working_head_oid: working },
    observed: { oid, commit_evidence: { prior_head: working, reason: "authorized change", source: "delivery owner", intended_paths: ["src"], excluded_paths: [] } },
    evidence_paths: [repo.taskDoc],
  };
  ok(fresh.reconcile(evidence));
  const ledger = fresh.ledger();
  assert.equal(ledger.candidate.state, "frozen");
  assert.equal(ledger.candidate.oid, oid);
  assert.equal(ledger.candidate.recovery_required, false);
  assert.deepEqual(ledger.validation, [item], "old evidence is retained unchanged");
});

test("F3/N5 a crash after push resumes from the observed remote state", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "push" });
  deliverToFrozen(repo, owner);
  const prepared = pushEvent(repo, owner);
  ok(owner.append("publications", prepared));
  git(repo.work, "push", "-q", "origin", "HEAD:refs/heads/" + repo.branch);
  const fresh = new Session(repo, "codex");
  ok(fresh.claim("delivery", { force: true, recovery: true, grantFile: input(repo, "grant", grant("takeover")) }));
  refused(fresh.append("publications", step(prepared, "verified", { observed: observedFor(prepared, { oid: prepared.intended.oid }) })), 2, "invariant_error", "no publication during recovery");
  const live = git(repo.work, "ls-remote", "origin", "refs/heads/" + repo.branch).split("\t")[0];
  const verified = step(prepared, "verified", { observed: observedFor(prepared, { oid: live }) });
  const evidence = { case: "interrupted_push", reason: "read back the interrupted push", source: "ls-remote", grant_id: null, expected: { candidate_oid: prepared.candidate_oid, working_head_oid: prepared.candidate_oid }, observed: { event: verified }, evidence_paths: [] };
  ok(fresh.reconcile(evidence));
  assert.equal(ok(fresh.reconcile(evidence)).changed, false, "the event id makes the retry idempotent");
  const ledger = fresh.ledger();
  assert.equal(ledger.candidate.recovery_required, false);
  assert.deepEqual(ledger.publications.map((event) => event.step), ["prepared", "verified"]);
  ok(fresh.check("published"));
});

test("F3/V1 drift after freezing refuses a prepared publication without waiting for a reclaim", () => {
  const repo = makeRepo();
  const dep = dependencyRepo(repo);
  const owner = initDelivery(repo, { endpoint: "push", bootstrap: { dependencies: [dependencyRecord(dep)] } });
  deliverToFrozen(repo, owner);
  fs.writeFileSync(path.join(dep.output, "index.js"), "rebuilt after the freeze\n");
  const drift = refused(owner.append("publications", pushEvent(repo, owner)), 4, "identity_mismatch");
  assert.match(JSON.stringify(drift.observed), /dependency_output/);
  assert.deepEqual(owner.ledger().publications, []);
});

test("F3 a closed or merged PR prevents further publication", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const { pr } = draftPrDelivery(repo, owner);
  ok(owner.recordContext({ pr: { ...pr, state: "MERGED", observed_at: nowIso() } }));
  const body = summaryBody(repo, owner, "late summary");
  const event = { id: "p", operation_id: "body-late", step: "prepared", kind: "pr_body", at: nowIso(), candidate_oid: pr.head, target: { host: "github.com", repository: pr.repository, pr_number: pr.number, pr_url: pr.url }, intended: { body_file: body.bodyFile, body_sha256: body.body_sha256 }, precondition: { head_oid: pr.head, body_sha256: "a".repeat(64), state: "OPEN", observed_at: nowIso() }, batch_id: null, observed: null, error: null };
  refused(owner.append("publications", event), 2, "invariant_error");
  refused(owner.append("publications", pushEvent(repo, owner, { precondition: { head_oid: pr.head, body_sha256: null, state: null, observed_at: nowIso() } })), 2, "invariant_error");
});

test("N5 an intended commit then freeze succeeds; an unrelated advance refuses", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const unrelated = commit(repo, { "README.md": "someone else\n" }, "unrelated");
  refused(owner.freeze(unrelated, { intended: ["src"] }), 4, "identity_mismatch");
  git(repo.work, "reset", "-q", "--hard", "HEAD~1");
  const intended = commit(repo, { "src/app.js": "export const v = 2;\n" });
  ok(owner.freeze(intended, { intended: ["src"] }));
  assert.equal(owner.ledger().candidate.generation, 1);
});

test("N5/V4 a fresh owner in restricted recovery cannot progress or publish before reconciliation", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  deliverToFrozen(repo, owner);
  ok(owner.release("handoff", { next: nextStep("delivery", "bootstrap"), completion: null, blocker: null }));
  const fresh = new Session(repo, "codex");
  ok(fresh.claim("delivery", { recovery: true }));
  refused(fresh.append("publications", pushEvent(repo, fresh)), 2, "invariant_error");
  refused(fresh.owned("begin-change"), 2, "invariant_error");
  refused(fresh.update({ checkpoint: "validate" }), 2, "invariant_error");
  refused(fresh.freeze(fresh.ledger().candidate.oid), 2, "invariant_error");
  refused(fresh.authorize(grant("endpoint", { endpoint: "ready_pr" })), 2, "invariant_error");
  refused(fresh.recordContext({ policy: { skill_pack_oid: null, skill_sources: [], session_mode: "same_session" } }), 2, "invariant_error");
  refused(fresh.owned("measure"), 2, "invariant_error");
  ok(fresh.append("limitations", limitation({ kind: "recovery", reason: "claimed for reconciliation" })), "evidence recording stays allowed");
  ok(fresh.authorize(grant("reconcile")), "a reconcile grant is recordable");
  refused(fresh.release("complete", { next: null, completion: completion(fresh, []), blocker: null }), 2, "invariant_error");
  ok(fresh.release("blocked", { next: nextStep("delivery", "bootstrap"), completion: null, blocker: { reason: "recovery pending", resume_phase: "delivery", resume_checkpoint: "bootstrap", required_action: "reconcile" } }));
  assert.equal(fresh.ledger().candidate.recovery_required, true);
});

test("N5/V2 init on a verified existing PR needs no invented push, and the adopted PR can resume", () => {
  const repo = makeRepo();
  const { owner } = adoptedDelivery(repo);
  assert.deepEqual(owner.ledger().publications, []);
  ok(owner.check("working", { pr: true }));
  ok(owner.release("handoff", { next: nextStep("delivery", "bootstrap"), completion: null, blocker: null }));
  const resumed = new Session(repo, "codex");
  ok(resumed.claim("delivery"));
  ok(resumed.check("working", { pr: true }));
});

test("N5 push-only and non-GitHub remotes verify without a PR and fabricate no GitHub identity", () => {
  const repo = makeRepo({ remote: "plain" });
  const owner = initDelivery(repo, { endpoint: "push" });
  deliverToFrozen(repo, owner);
  refused(owner.append("publications", pushEvent(repo, owner, { target: { remote_name: "origin", remote_url: repo.remoteUrl, ref: "refs/heads/" + repo.branch, host: "github.com", repository: "acme/x" } })), 4, "identity_mismatch");
  const push = pushCandidate(repo, owner);
  ok(owner.check("published"));
  assert.deepEqual(ghCalls(repo), []);
  const gate = recordGate(repo, owner, ["src/app.js"]);
  const verified = owner.ledger().publications.find((event) => event.operation_id === push.operation_id && event.step === "verified");
  ok(owner.release("complete", { next: null, completion: completion(owner, ["validation:" + gate.id, "publications:" + verified.id]), blocker: null }));
});

test("N5 remote URL or ref drift is distinguished from network failure", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "push" });
  deliverToFrozen(repo, owner);
  pushCandidate(repo, owner);
  ok(owner.check("published"));
  fs.renameSync(repo.bare, repo.bare + ".away");
  const network = refused(owner.check("published"), 1, "network_error");
  assert.equal(network.observed.status, "unverified");
  fs.renameSync(repo.bare + ".away", repo.bare);
  const other = path.join(repo.dir, "other clone");
  git(repo.dir, "clone", "-q", repo.bare, other);
  git(other, "checkout", "-q", repo.branch);
  commit({ work: other }, { "src/other.js": "x\n" }, "someone else pushed");
  git(other, "push", "-q", "origin", repo.branch);
  const moved = refused(owner.check("published"), 4, "identity_mismatch");
  assert.equal(moved.observed.status, "mismatch");
});

test("V1 local-only review, then begin-change, then a fix keeps a non-null working head and makes no commit", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "local" });
  const head = git(repo.work, "rev-parse", "HEAD");
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 2;\n");
  const first = recordFocused(repo, owner, ["src/app.js"]);
  ok(owner.append("reviews", review(owner, { candidate_oid: null, content_id: first.content_id, content_manifest: first.manifest.source, verdict: "pass-with-fixes", findings: [finding({ id: "f1" })] })));
  ok(owner.owned("begin-change"));
  assert.equal(ok(owner.owned("begin-change")).changed, false, "repeating begin-change at implement is a no-op");
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 3;\n");
  const fixed = recordFocused(repo, owner, ["src/app.js"]);
  const ledger = owner.ledger();
  assert.equal(ledger.candidate.working_head_oid, head);
  assert.equal(ledger.candidate.oid, null);
  assert.equal(git(repo.work, "rev-parse", "HEAD"), head, "no commit was created");
  assert.notEqual(fixed.content_id, first.content_id);
});

test("V1 frozen B to working to frozen B changes state without a new generation; repeating the freeze changes no bytes", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const b = deliverToFrozen(repo, owner);
  assert.equal(owner.ledger().candidate.generation, 1);
  ok(owner.owned("begin-change"));
  assert.equal(owner.ledger().candidate.state, "working");
  assert.equal(owner.ledger().candidate.working_head_oid, b);
  ok(owner.freeze(b));
  let ledger = owner.ledger();
  assert.deepEqual([ledger.candidate.state, ledger.candidate.generation, ledger.candidate.oid, ledger.candidate.previous_oid], ["frozen", 1, b, null]);
  const bytes = fs.readFileSync(repo.ledgerPath, "utf8");
  assert.equal(ok(owner.freeze(b)).changed, false);
  assert.equal(fs.readFileSync(repo.ledgerPath, "utf8"), bytes);
  ok(owner.owned("begin-change"));
  const c = commit(repo, { "src/app.js": "export const v = 3;\n" });
  ok(owner.freeze(c));
  ledger = owner.ledger();
  assert.deepEqual([ledger.candidate.generation, ledger.candidate.oid, ledger.candidate.previous_oid], [2, c, b]);
  refused(owner.freeze(commit(repo, { "src/app.js": "export const v = 4;\n" })), 2, "invariant_error", "a frozen candidate needs begin-change first");
});

test("V1 changed frozen dependency: restricted claim, reconcile, working revalidation, then freeze, with no publication during recovery", () => {
  const repo = makeRepo();
  const dep = dependencyRepo(repo);
  const owner = initDelivery(repo, { bootstrap: { dependencies: [dependencyRecord(dep)] } });
  const b = deliverToFrozen(repo, owner);
  const oldGate = recordGate(repo, owner, ["src/app.js"]);
  ok(owner.release("handoff", { next: nextStep("delivery", "bootstrap"), completion: null, blocker: null }));
  fs.writeFileSync(path.join(dep.output, "index.js"), "rebuilt\n");
  const fresh = new Session(repo, "codex");
  refused(fresh.claim("delivery"), 4, "identity_mismatch");
  ok(fresh.claim("delivery", { recovery: true }));
  refused(fresh.append("publications", pushEvent(repo, fresh)), 2, "invariant_error");
  const refreshed = dependencyRecord(dep);
  ok(fresh.reconcile({ case: "dependency_refresh", reason: "sibling output was rebuilt", source: "dependency build log", grant_id: null, expected: { candidate_oid: b, working_head_oid: b }, observed: { dependencies: [refreshed] }, evidence_paths: [] }));
  let ledger = fresh.ledger();
  assert.equal(ledger.candidate.state, "working");
  assert.equal(ledger.candidate.recovery_required, false);
  assert.deepEqual(ledger.candidate.dependencies, [refreshed]);
  assert.ok(ledger.history.at(-1).detail.invalidated_evidence.includes("validation:" + oldGate.id));
  ok(fresh.check("working"));
  ok(fresh.freeze(b));
  ledger = fresh.ledger();
  assert.equal(ledger.candidate.state, "frozen");
  assert.equal(ledger.candidate.generation, 1);
  const newGate = recordGate(repo, fresh, ["src/app.js"]);
  assert.notEqual(newGate.id, oldGate.id);
});

test("V2/C1 an adopted remote at A: the first push precondition is A; null is refused; an absent or moved live ref refuses", () => {
  const repo = makeRepo();
  const { owner, head: a } = adoptedDelivery(repo);
  const b = commit(repo, { "src/app.js": "export const v = 2;\n" });
  ok(owner.freeze(b));
  refused(owner.append("publications", pushEvent(repo, owner)), 4, "identity_mismatch", "null precondition while the baseline establishes A");
  ok(owner.check("frozen"), "a live remote at A satisfies the precondition");
  const prepared = pushEvent(repo, owner, { precondition: { head_oid: a, body_sha256: null, state: null, observed_at: nowIso() } });
  ok(owner.append("publications", prepared));
  git(repo.work, "push", "-q", "--force", "origin", b + ":refs/heads/" + repo.branch);
  refused(owner.check("frozen"), 4, "identity_mismatch", "a moved live ref refuses the write");
  git(repo.bare, "update-ref", "-d", "refs/heads/" + repo.branch);
  const absent = refused(owner.check("frozen"), 4, "identity_mismatch", "an absent live ref refuses the write");
  assert.match(JSON.stringify(absent.observed), /remote_ref_missing/);
});

test("V2/V7 a new local branch with an absent remote ref is claimed and frozen before its first push, whose precondition is null", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "push" });
  ok(owner.check("working"), "expected absence matches an absent remote ref");
  const b = deliverToFrozen(repo, owner);
  ok(owner.check("frozen"));
  refused(owner.append("publications", pushEvent(repo, owner, { precondition: { head_oid: b, body_sha256: null, state: null, observed_at: nowIso() } })), 4, "identity_mismatch");
  pushCandidate(repo, owner, { precondition: null });
  ok(owner.check("published"));
});

test("V2 unexpected creation of the selected remote ref refuses until remote_adoption", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  git(repo.work, "push", "-q", "origin", "HEAD:refs/heads/" + repo.branch);
  const created = refused(owner.check("working"), 4, "identity_mismatch");
  assert.match(JSON.stringify(created.observed), /remote_adoption/);
  const head = git(repo.work, "rev-parse", "HEAD");
  const baseline = { remote_name: "origin", ref: "refs/heads/" + repo.branch, oid: head, observed_at: nowIso() };
  ok(owner.reconcile({ case: "remote_adoption", reason: "the branch was pushed before the ledger existed", source: "ls-remote read", grant_id: null, expected: { candidate_oid: null, working_head_oid: head }, observed: { remote_baseline: baseline, pr: null }, evidence_paths: [] }));
  ok(owner.check("working"));
  refused(owner.reconcile({ case: "remote_adoption", reason: "again", source: "x", grant_id: null, expected: { candidate_oid: null, working_head_oid: head }, observed: { remote_baseline: baseline, pr: null }, evidence_paths: [] }), 2, "invariant_error", "an established destination is never replaced");
});

test("V2 an unrelated publication ref cannot supply the expected OID", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "push" });
  const b = deliverToFrozen(repo, owner);
  for (const ref of ["refs/heads/backup", "refs/heads/main", "refs/tags/v1"]) {
    const other = pushEvent(repo, owner, { target: { remote_name: "origin", remote_url: repo.remoteUrl, ref, host: "github.com", repository: repo.github.owner + "/" + repo.github.name } });
    refused(owner.append("publications", other), 2, "invariant_error", ref + " is not the delivery destination");
  }
  git(repo.work, "push", "-q", "origin", "HEAD:refs/heads/backup");
  refused(owner.append("publications", pushEvent(repo, owner, { precondition: { head_oid: b, body_sha256: null, state: null, observed_at: nowIso() } })), 4, "identity_mismatch", "a push elsewhere never supplies the expected OID");
  ok(owner.check("frozen"), "the destination is still expected absent");
});

// ---------------------------------------------------------------------------
// F4 / N4 / V3: validation evidence and content identity (5.6)

function receiptRepo() {
  return makeRepo({ files: { "README.md": "readme\n", "src/app.js": "export const v = 1;\n", "pnpm-lock.yaml": "lockfileVersion: 9\n", ".agent/delivery-policy.json": "{\"lanes\":[]}\n" } });
}

function writeReceipt(repo, owner, overrides = {}) {
  const ledger = owner.ledger();
  const receipt = {
    baseOid: ledger.repo.diff_base_oid,
    candidateOid: ledger.candidate.oid,
    dependency: null,
    exitCode: 0,
    lane: "affected",
    lockfileHash: sha(fs.readFileSync(path.join(repo.work, "pnpm-lock.yaml"))),
    policyHash: sha(fs.readFileSync(path.join(repo.work, ".agent", "delivery-policy.json"))),
    ...overrides,
  };
  const file = writeJson(path.join(repo.inputs, "receipt-" + randomUUID() + ".json"), receipt);
  const identity = { baseOid: receipt.baseOid, candidateOid: receipt.candidateOid, dependency: receipt.dependency, lane: receipt.lane, lockfileHash: receipt.lockfileHash, policyHash: receipt.policyHash };
  return { file, receipt, record: commandValidation(repo, { kind: "receipt", command: null, log: null, oid: receipt.candidateOid, exit_code: receipt.exitCode, result: receipt.exitCode === 0 ? "pass" : "fail", receipt: { path: file, sha256: sha(fs.readFileSync(file)), adapter: "ncdmb-validation-receipt-v1", identity } }) };
}

function completeCommit(owner, evidence) {
  return owner.release("complete", { next: null, completion: completion(owner, evidence), blocker: null });
}

test("F4 a valid receipt is reused as completion evidence without a rerun", () => {
  const repo = receiptRepo();
  const owner = initDelivery(repo, { endpoint: "commit" });
  deliverToFrozen(repo, owner);
  const { record } = writeReceipt(repo, owner);
  ok(owner.append("validation", record));
  ok(completeCommit(owner, ["validation:" + record.id]));
  assert.equal(owner.ledger().measurements.validation_reruns, 0);
});

test("F4 a missing or tampered receipt is unavailable evidence, never a pass", () => {
  const tampered = receiptRepo();
  const owner = initDelivery(tampered, { endpoint: "commit" });
  deliverToFrozen(tampered, owner);
  const { file, record } = writeReceipt(tampered, owner);
  ok(owner.append("validation", record));
  fs.appendFileSync(file, " ");
  refused(completeCommit(owner, ["validation:" + record.id]), 2, "invariant_error");
  fs.rmSync(file);
  refused(completeCommit(owner, ["validation:" + record.id]), 2, "invariant_error");
  const wrongHash = writeReceipt(tampered, owner);
  refused(owner.append("validation", { ...wrongHash.record, receipt: { ...wrongHash.record.receipt, sha256: "0".repeat(64) } }), 4, "identity_mismatch");
});

test("F4 a receipt for the wrong candidate, base, lockfile or policy is unavailable", () => {
  const cases = {
    candidate: (repo, owner) => writeReceipt(repo, owner, { candidateOid: owner.ledger().candidate.baseline_oid }),
    base: (repo, owner) => writeReceipt(repo, owner, { baseOid: owner.ledger().candidate.oid }),
    lockfile: (repo, owner) => {
      const receipt = writeReceipt(repo, owner);
      fs.writeFileSync(path.join(repo.work, "pnpm-lock.yaml"), "lockfileVersion: 10\n");
      git(repo.work, "update-index", "--assume-unchanged", "pnpm-lock.yaml");
      return receipt;
    },
    policy: (repo, owner) => writeReceipt(repo, owner, { policyHash: "1".repeat(64) }),
  };
  for (const [name, make] of Object.entries(cases)) {
    const repo = receiptRepo();
    const owner = initDelivery(repo, { endpoint: "commit" });
    deliverToFrozen(repo, owner);
    const { record } = make(repo, owner);
    const appended = owner.append("validation", record);
    if (appended.status === 0) {
      const result = refused(completeCommit(owner, ["validation:" + record.id]), 2, "invariant_error", name);
      assert.match(result.message, /candidate|base|lockfile|policy/i, name);
    } else {
      refused(appended, 4, "identity_mismatch", name);
    }
  }
});

test("F4 an unsupported dependency in a receipt is unavailable", () => {
  const repo = receiptRepo();
  const owner = initDelivery(repo, { endpoint: "commit" });
  deliverToFrozen(repo, owner);
  const { record } = writeReceipt(repo, owner, { dependency: { name: "shared", oid: "a".repeat(40) } });
  ok(owner.append("validation", record));
  const result = refused(completeCommit(owner, ["validation:" + record.id]), 2, "invariant_error");
  assert.match(result.message, /dependency/);
});

test("N4 a wrong-OID receipt cannot satisfy an exact-OID completion", () => {
  const repo = receiptRepo();
  const owner = initDelivery(repo, { endpoint: "commit" });
  const a = deliverToFrozen(repo, owner);
  const { record } = writeReceipt(repo, owner);
  ok(owner.append("validation", record));
  ok(owner.owned("begin-change"));
  const b = commit(repo, { "src/app.js": "export const v = 3;\n" });
  ok(owner.freeze(b));
  assert.notEqual(a, b);
  refused(completeCommit(owner, ["validation:" + record.id]), 2, "invariant_error");
});

test("F4 committed-candidate evidence is refused from a dirty checkout", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  deliverToFrozen(repo, owner);
  const manifest = manifestFile(repo, owner, [entry(repo, "src/app.js")]);
  const digest = contentId(repo, manifest).input_fingerprint;
  fs.writeFileSync(path.join(repo.work, "README.md"), "dirty\n");
  refused(owner.append("validation", commandValidation(repo, { oid: owner.ledger().candidate.oid, content_manifest: manifest.source, input_fingerprint: digest })), 4, "identity_mismatch");
});

test("F4 old evidence stays visible after replacement and is never relabeled onto the new candidate", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "commit" });
  deliverToFrozen(repo, owner);
  const first = recordGate(repo, owner, ["src/app.js"]);
  ok(owner.owned("begin-change"));
  commit(repo, { "src/app.js": "export const v = 3;\n" });
  ok(owner.freeze(git(repo.work, "rev-parse", "HEAD")));
  const second = recordGate(repo, owner, ["src/app.js"]);
  assert.deepEqual(owner.ledger().validation.map((item) => item.id), [first.id, second.id]);
  assert.deepEqual(owner.ledger().validation[0], first);
  refused(completeCommit(owner, ["validation:" + first.id]), 2, "invariant_error");
  ok(completeCommit(owner, ["validation:" + second.id]));
});

test("F4/N4 unchanged-content reuse is recorded as reuse, not as a fabricated execution", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "commit" });
  const a = deliverToFrozen(repo, owner);
  const gate = recordGate(repo, owner, ["src/app.js"]);
  ok(owner.owned("begin-change"));
  git(repo.work, "commit", "-q", "--allow-empty", "-m", "reword only");
  const b = git(repo.work, "rev-parse", "HEAD");
  ok(owner.freeze(b));
  const manifest = manifestFile(repo, owner, [entry(repo, "src/app.js")]);
  const reuse = commandValidation(repo, { oid: b, content_manifest: manifest.source, reused_from: gate.id, reuse: { source_id: gate.id, source_oid: a, target_oid: b, unchanged_inputs: [], reason: "identical tree" }, log: gate.log });
  refused(owner.append("validation", { ...reuse, input_fingerprint: gate.input_fingerprint }), 2, "invariant_error", "a reuse record is not an execution");
  ok(owner.append("validation", reuse));
  assert.equal(owner.ledger().measurements.validation_reruns, 0);
  ok(completeCommit(owner, ["validation:" + reuse.id]));
});

test("N4 changed inputs reject reuse", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "commit" });
  const a = deliverToFrozen(repo, owner);
  const gate = recordGate(repo, owner, ["src/app.js"]);
  ok(owner.owned("begin-change"));
  const b = commit(repo, { "src/app.js": "export const v = 3;\n" });
  ok(owner.freeze(b));
  const manifest = manifestFile(repo, owner, [entry(repo, "src/app.js")]);
  const reuse = commandValidation(repo, { oid: b, content_manifest: manifest.source, reused_from: gate.id, reuse: { source_id: gate.id, source_oid: a, target_oid: b, unchanged_inputs: [], reason: "claimed unchanged" }, log: gate.log });
  refused(owner.append("validation", reuse), 4, "identity_mismatch");
  const lockfile = path.join(repo.inputs, "lock.yaml");
  fs.writeFileSync(lockfile, "v1\n");
  const stale = { path: lockfile, sha256: sha("v0\n") };
  const sameContent = manifestFile(repo, owner, [entry(repo, "src/app.js")]);
  const withInputs = commandValidation(repo, { oid: b, content_manifest: sameContent.source, reused_from: gate.id, reuse: { source_id: gate.id, source_oid: a, target_oid: b, unchanged_inputs: [stale], reason: "claimed unchanged" }, log: gate.log });
  refused(owner.append("validation", withInputs), 4, "identity_mismatch");
});

test("N4 local-only review, fixed disposition and a requested audit validate without a commit", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "local", bootstrap: { audit_policy: { required: true, state: "pending", reason: "the task doc requires a live check" } } });
  const head = git(repo.work, "rev-parse", "HEAD");
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 2;\n");
  const first = recordFocused(repo, owner, ["src/app.js"]);
  const reviewed = review(owner, { candidate_oid: null, content_id: first.content_id, content_manifest: first.manifest.source, verdict: "pass-with-fixes", findings: [finding({ id: "f1" })], cycle_id: "c1", cycle_kind: "implementation_review" });
  ok(owner.append("reviews", reviewed));
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 3;\n");
  const final = recordFocused(repo, owner, ["src/app.js"]);
  const disposed = { ...reviewed, id: "rev-disposed", supersedes_id: reviewed.id, findings: [{ ...reviewed.findings[0], disposition: "fixed", fix_content_id: final.content_id, fix_content_manifest: final.manifest.source }] };
  ok(owner.append("reviews", disposed));
  const audit = { id: "audit-1", mode: "ui", runtime: "claude", model: null, verdict: "PASS", report: "/tmp/audit/report.md", oid: null, content_id: final.content_id, content_manifest: final.manifest.source, at: nowIso(), role_run_id: null };
  ok(owner.append("audits", audit));
  ok(owner.update({ audit_policy: { state: "complete" } }));
  const done = { endpoint: "local", reached_at: nowIso(), candidate_oid: null, content_id: final.content_id, content_manifest: final.manifest.source, evidence_ids: ["validation:" + final.item.id, "reviews:" + reviewed.id, "audits:" + audit.id], limitations: ["local-only endpoint: no commit, push or PR"] };
  ok(owner.release("complete", { next: null, completion: done, blocker: null }));
  assert.equal(git(repo.work, "rev-parse", "HEAD"), head);
  assert.equal(owner.ledger().candidate.oid, null);
});

test("N4/V3 content identity changes deterministically with content, mode, deletion, symlink target, Unicode/newline paths and inputs", () => {
  const repo = makeRepo({ files: { "README.md": "readme\n", "src/app.js": "export const v = 1;\n", "src/gone.js": "bye\n", "src/tool.sh": "echo\n" } });
  const owner = initDelivery(repo, { endpoint: "local" });
  const idFor = (files, options) => contentId(repo, manifestFile(repo, owner, files, options)).content_id;
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 2;\n");
  const base = idFor([entry(repo, "src/app.js")]);
  assert.equal(idFor([entry(repo, "src/app.js")]), base, "identical inputs give an identical id");
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 3;\n");
  const content = idFor([entry(repo, "src/app.js")]);
  assert.notEqual(content, base);
  fs.chmodSync(path.join(repo.work, "src/tool.sh"), 0o755);
  const mode = idFor([entry(repo, "src/app.js"), entry(repo, "src/tool.sh")]);
  fs.rmSync(path.join(repo.work, "src/gone.js"));
  const deletion = idFor([entry(repo, "src/app.js"), entry(repo, "src/tool.sh"), entry(repo, "src/gone.js", { state: "deleted" })]);
  fs.symlinkSync("app.js", path.join(repo.work, "src/link"));
  const link = idFor([entry(repo, "src/app.js"), entry(repo, "src/tool.sh"), entry(repo, "src/gone.js", { state: "deleted" }), entry(repo, "src/link")]);
  fs.rmSync(path.join(repo.work, "src/link"));
  fs.symlinkSync("tool.sh", path.join(repo.work, "src/link"));
  const retarget = idFor([entry(repo, "src/app.js"), entry(repo, "src/tool.sh"), entry(repo, "src/gone.js", { state: "deleted" }), entry(repo, "src/link")]);
  fs.writeFileSync(path.join(repo.work, "src/ünï\ncode.txt"), "u\n");
  const unicode = idFor([entry(repo, "src/app.js"), entry(repo, "src/tool.sh"), entry(repo, "src/gone.js", { state: "deleted" }), entry(repo, "src/link"), entry(repo, "src/ünï\ncode.txt")]);
  const files = [entry(repo, "src/app.js"), entry(repo, "src/tool.sh"), entry(repo, "src/gone.js", { state: "deleted" }), entry(repo, "src/link"), entry(repo, "src/ünï\ncode.txt")];
  const input1 = idFor(files, { inputs: [{ name: "dependency:shared", value: "a".repeat(40) }] });
  const input2 = idFor(files, { inputs: [{ name: "dependency:shared", value: "b".repeat(40) }] });
  const ids = [base, content, mode, deletion, link, retarget, unicode, input1, input2];
  assert.equal(new Set(ids).size, ids.length, "every change produces a distinct identity");
  refused(run(["content-manifest", "--repo", repo.work, "--manifest-file", manifestFile(repo, owner, [...files, { path: "src/app.js", mode: "100755", state: "present", sha256: files[0].sha256 }].slice(1)).file]), 4, "identity_mismatch", "a wrong mode refuses");
});

test("N4/V3 unrelated changes are excluded explicitly; an omitted changed path or a listed-and-excluded path refuses", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "local" });
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 2;\n");
  fs.writeFileSync(path.join(repo.work, "README.md"), "unrelated edit\n");
  fs.writeFileSync(path.join(repo.work, "scratch.txt"), "untracked\n");
  refused(run(["content-manifest", "--repo", repo.work, "--manifest-file", manifestFile(repo, owner, [entry(repo, "src/app.js")]).file]), 4, "identity_mismatch");
  contentId(repo, manifestFile(repo, owner, [entry(repo, "src/app.js")], { excluded: ["README.md", "scratch.txt"] }));
  refused(run(["content-manifest", "--repo", repo.work, "--manifest-file", manifestFile(repo, owner, [entry(repo, "src/app.js"), entry(repo, "README.md")], { excluded: ["README.md", "scratch.txt"] }).file]), 2, "invariant_error");
  refused(run(["content-manifest", "--repo", repo.work, "--manifest-file", manifestFile(repo, owner, [entry(repo, "src/app.js"), { path: "../escape", mode: "100644", state: "present", sha256: "a".repeat(64) }], { excluded: ["README.md", "scratch.txt"] }).file]), 2, "invariant_error");
});

test("V3 baseline-to-committed changes stay represented with a clean index and worktree", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  commit(repo, { "src/app.js": "export const v = 2;\n", "src/new.js": "new\n" });
  assert.equal(git(repo.work, "status", "--porcelain"), "");
  contentId(repo, manifestFile(repo, owner, [entry(repo, "src/app.js"), entry(repo, "src/new.js")]));
  refused(run(["content-manifest", "--repo", repo.work, "--manifest-file", manifestFile(repo, owner, []).file]), 4, "identity_mismatch");
});

test("V3 equivalent manifest formatting gives the same canonical ID but its own file hash", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "local" });
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 2;\n");
  fs.writeFileSync(path.join(repo.work, "src/b.js"), "b\n");
  const compact = manifestFile(repo, owner, [entry(repo, "src/app.js"), entry(repo, "src/b.js")]);
  const pretty = manifestFile(repo, owner, [entry(repo, "src/b.js"), entry(repo, "src/app.js")], { pretty: true });
  const one = contentId(repo, compact);
  const two = contentId(repo, pretty);
  assert.equal(one.content_id, two.content_id);
  assert.notEqual(one.manifest.sha256, two.manifest.sha256);
});

test("V3 a caller-supplied wrong baseline refuses", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "local" });
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 2;\n");
  const wrong = manifestFile(repo, owner, [entry(repo, "src/app.js")], { baseline: "c".repeat(40) });
  refused(run(["content-manifest", "--repo", repo.work, "--manifest-file", wrong.file]), 2, "invariant_error");
});

test("V3 a completed command cannot submit an arbitrary fingerprint; rerun counting follows the canonical digest", async () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "local" });
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 2;\n");
  const manifest = manifestFile(repo, owner, [entry(repo, "src/app.js")]);
  const { content_id, input_fingerprint } = contentId(repo, manifest);
  refused(owner.append("validation", commandValidation(repo, { scope: "focused", content_id, content_manifest: manifest.source, input_fingerprint: "e".repeat(64) })), 2, "invariant_error");
  const empty = manifestFile(repo, owner, []);
  const emptyId = (await import(pathToHelper())).manifestDigest(empty.manifest);
  refused(owner.append("validation", commandValidation(repo, { scope: "focused", content_id: "sha256:" + emptyId, content_manifest: empty.source, input_fingerprint: emptyId })), 4, "identity_mismatch", "a manifest that omits the changed file is not this content");
  refused(owner.append("validation", commandValidation(repo, { scope: "focused", content_id, content_manifest: manifest.source, input_fingerprint: null })), 2, "invariant_error", "a missing fingerprint is rejected, not counted as unchanged");
  const pretty = manifestFile(repo, owner, [entry(repo, "src/app.js")], { pretty: true });
  ok(owner.append("validation", commandValidation(repo, { scope: "focused", content_id, content_manifest: manifest.source, input_fingerprint })));
  ok(owner.append("validation", commandValidation(repo, { scope: "focused", content_id, content_manifest: pretty.source, input_fingerprint })));
  assert.equal(owner.ledger().measurements.validation_reruns, 1, "equivalent manifests share the canonical digest");
});

// ---------------------------------------------------------------------------
// F6 / N7: publication records (5.7)

// A completed draft-PR delivery, then an authorized review_round owner with
// a frozen two-thread findings batch.
function reviewRound(repo, { dispositions = ["fixed", "rejected"] } = {}) {
  const owner = initDelivery(repo);
  const delivered = draftPrDelivery(repo, owner);
  ok(owner.release("complete", { next: nextStep("review_round", "review", { authorization_required: true }), completion: completion(owner, ["validation:" + delivered.gate.id, "publications:" + delivered.push.id, "publications:" + delivered.prCreate.id]), blocker: null }));
  const reviewer = new Session(repo, "codex");
  ok(reviewer.claim("review_round", { grantFile: input(repo, "grant", grant("review_round", { wording: '"address the review findings on the PR"' })) }));
  const threads = [
    { thread_graphql_id: "PRRT_one", root_comment_database_id: "1001", path: "src/app.js", line: 1 },
    { thread_graphql_id: "PRRT_two", root_comment_database_id: "1002", path: "README.md", line: 1 },
  ];
  const batch = batchFile(repo, reviewer, threads);
  const findings = threads.map((thread, position) =>
    finding({ id: "f" + (position + 1), source_id: thread.root_comment_database_id, thread_id: thread.thread_graphql_id, disposition: dispositions[position], reason: dispositions[position] === "rejected" ? "the behavior is intended" : null, fix_oid: dispositions[position] === "fixed" ? delivered.oid : null }),
  );
  const batchReview = review(reviewer, { source: "codex-bot", verdict: "pass-with-fixes", findings, batch });
  ok(reviewer.append("reviews", batchReview));
  return { owner, reviewer, delivered, threads, batch, batchReview };
}

function bodyFile(repo, text) {
  const file = path.join(repo.inputs, "reply-" + randomUUID() + ".md");
  fs.writeFileSync(file, text);
  return { file, sha256: sha(Buffer.from(text, "utf8")) };
}

function replyEvent(repo, owner, batch, thread, body, overrides = {}) {
  const ledger = owner.ledger();
  return {
    id: "pub-" + randomUUID(),
    operation_id: "reply-" + randomUUID(),
    step: "prepared",
    kind: "reply",
    at: nowIso(),
    candidate_oid: ledger.candidate.oid,
    target: { host: "github.com", repository: ledger.pr.repository, pr_number: ledger.pr.number, pr_url: ledger.pr.url, root_comment_database_id: thread.root_comment_database_id, thread_graphql_id: thread.thread_graphql_id },
    intended: { body_file: body.file, body_sha256: body.sha256 },
    precondition: { head_oid: ledger.pr.head, body_sha256: null, state: "OPEN", observed_at: nowIso() },
    batch_id: batch.id,
    observed: null,
    error: null,
    ...overrides,
  };
}

function verifiedReply(event, overrides = {}) {
  return step(event, "verified", { observed: observedFor(event, { object_id: "5001", url: event.target.pr_url + "#discussion_r5001", body_sha256: event.intended.body_sha256, ...overrides }) });
}

function resolveEvent(owner, batch, thread, replyOperation) {
  const ledger = owner.ledger();
  return {
    id: "pub-" + randomUUID(),
    operation_id: "resolve-" + randomUUID(),
    step: "prepared",
    kind: "resolve",
    at: nowIso(),
    candidate_oid: ledger.candidate.oid,
    target: { host: "github.com", repository: ledger.pr.repository, pr_number: ledger.pr.number, pr_url: ledger.pr.url, thread_graphql_id: thread.thread_graphql_id },
    intended: { resolved: true, reply_operation_id: replyOperation },
    precondition: { head_oid: ledger.pr.head, body_sha256: null, state: "OPEN", observed_at: nowIso() },
    batch_id: batch.id,
    observed: null,
    error: null,
  };
}

test("F6 a wrong thread with an identical body is rejected; reply, root and thread IDs cannot be interchanged", () => {
  const repo = makeRepo();
  const { reviewer, threads, batch } = reviewRound(repo);
  const body = bodyFile(repo, "Fixed in the latest push.");
  refused(reviewer.append("publications", replyEvent(repo, reviewer, batch, { ...threads[1], root_comment_database_id: threads[0].root_comment_database_id }, body)), 4, "identity_mismatch", "root of thread one on thread two");
  refused(reviewer.append("publications", replyEvent(repo, reviewer, batch, { thread_graphql_id: threads[0].root_comment_database_id, root_comment_database_id: threads[0].thread_graphql_id }, body)), 4, "identity_mismatch", "swapped IDs");
  refused(reviewer.append("publications", replyEvent(repo, reviewer, batch, { thread_graphql_id: "PRRT_elsewhere", root_comment_database_id: "9999" }, body)), 4, "identity_mismatch", "a thread outside the batch");
  const prepared = replyEvent(repo, reviewer, batch, threads[0], body);
  ok(reviewer.append("publications", prepared));
  refused(reviewer.append("publications", verifiedReply(prepared, { target: { ...prepared.target, thread_graphql_id: threads[1].thread_graphql_id } })), 4, "identity_mismatch", "a read-back on another thread");
  refused(reviewer.append("publications", verifiedReply(prepared, { target: { ...prepared.target, root_comment_database_id: "5001" } })), 4, "identity_mismatch", "a reply ID in place of the root ID");
  ok(reviewer.append("publications", verifiedReply(prepared)));
});

test("F6/N7 an uncertain POST followed by read-back causes no duplicate, and identity must be established", () => {
  const repo = makeRepo();
  const { reviewer, threads, batch } = reviewRound(repo);
  const body = bodyFile(repo, "Rejected: intended behavior.");
  const prepared = replyEvent(repo, reviewer, batch, threads[1], body);
  ok(reviewer.append("publications", prepared));
  refused(reviewer.append("publications", step(prepared, "uncertain")), 2, "invariant_error", "uncertain needs an explanation");
  ok(reviewer.append("publications", step(prepared, "uncertain", { error: "the POST timed out" })));
  refused(reviewer.append("publications", replyEvent(repo, reviewer, batch, threads[1], body)), 2, "invariant_error", "no new operation while the same reply is unresolved");
  refused(reviewer.append("publications", verifiedReply(prepared, { object_id: null })), 4, "identity_mismatch", "a matching body without an object identity stays blocked");
  ok(reviewer.append("publications", verifiedReply(prepared)));
  refused(reviewer.append("publications", replyEvent(repo, reviewer, batch, threads[1], body)), 2, "invariant_error", "a verified reply is never recreated");
  assert.equal(reviewer.ledger().publications.filter((event) => event.kind === "reply" && event.step === "verified").length, 1);
});

test("F6/N7 a reply that succeeds while resolution fails retries only the resolution", () => {
  const repo = makeRepo();
  const { reviewer, threads, batch } = reviewRound(repo);
  const prepared = replyEvent(repo, reviewer, batch, threads[0], bodyFile(repo, "Fixed."));
  ok(reviewer.append("publications", prepared));
  ok(reviewer.append("publications", verifiedReply(prepared)));
  const resolve = resolveEvent(reviewer, batch, threads[0], prepared.operation_id);
  ok(reviewer.append("publications", resolve));
  ok(reviewer.append("publications", step(resolve, "failed", { error: "GraphQL 502" })));
  refused(reviewer.append("publications", replyEvent(repo, reviewer, batch, threads[0], bodyFile(repo, "Fixed."))), 2, "invariant_error");
  const retry = resolveEvent(reviewer, batch, threads[0], prepared.operation_id);
  ok(reviewer.append("publications", retry));
  ok(reviewer.append("publications", step(retry, "verified", { observed: observedFor(retry, { resolved: true }) })));
  const rejectedReply = replyEvent(repo, reviewer, batch, threads[1], bodyFile(repo, "Intended."));
  ok(reviewer.append("publications", rejectedReply));
  ok(reviewer.append("publications", verifiedReply(rejectedReply, { object_id: "5002" })));
  refused(reviewer.append("publications", resolveEvent(reviewer, batch, threads[1], rejectedReply.operation_id)), 2, "invariant_error", "a rejected thread stays unresolved");
});

test("F6 incoming head or body edits stop stale publication", () => {
  const repo = makeRepo();
  const { reviewer, threads, batch, delivered } = reviewRound(repo);
  const moved = replyEvent(repo, reviewer, batch, threads[0], bodyFile(repo, "Fixed."), { precondition: { head_oid: reviewer.ledger().candidate.baseline_oid, body_sha256: null, state: "OPEN", observed_at: nowIso() } });
  refused(reviewer.append("publications", moved), 4, "identity_mismatch");
  const current = path.join(repo.inputs, "current-body.md");
  fs.writeFileSync(current, "edited by someone else\n");
  const summary = path.join(repo.inputs, "summary.md");
  fs.writeFileSync(summary, "new summary\n");
  refused(run(["summary-body", "--repo", repo.work, "--current-body-file", current, "--summary-file", summary, "--expected-current-sha256", "0".repeat(64)]), 4, "identity_mismatch");
  const body = summaryBody(repo, reviewer, "Updated summary.");
  const bodyEvent = { id: "pub-" + randomUUID(), operation_id: "body-" + randomUUID(), step: "prepared", kind: "pr_body", at: nowIso(), candidate_oid: delivered.oid, target: { host: "github.com", repository: delivered.pr.repository, pr_number: delivered.pr.number, pr_url: delivered.pr.url }, intended: { body_file: body.bodyFile, body_sha256: body.body_sha256 }, precondition: { head_oid: delivered.oid, body_sha256: body.current_body_sha256, state: "OPEN", observed_at: nowIso() }, batch_id: null, observed: null, error: null };
  ok(reviewer.append("publications", bodyEvent));
  refused(reviewer.append("publications", step(bodyEvent, "verified", { observed: observedFor(bodyEvent, { oid: delivered.oid, body_sha256: "9".repeat(64) }) })), 4, "identity_mismatch", "a raced body is a mismatch, not verified");
  ok(reviewer.append("publications", step(bodyEvent, "mismatch", { error: "the body changed during the write", observed: observedFor(bodyEvent, { oid: delivered.oid, body_sha256: "9".repeat(64) }) })));
});

test("F6 Markdown with quotes, newlines, backticks and shell substitutions round-trips literally", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const canary = path.join(repo.dir, "canary");
  const tick = "`";
  const text = `Said "quoted" and 'single'.\n\n${tick}code${tick} and ${tick.repeat(3)}\nblock\n${tick.repeat(3)}\n$(touch ${canary}) and ${tick}touch ${canary}${tick} and \${HOME}\n`;
  const result = summaryBody(repo, owner, text, "Intro paragraph.\n");
  assert.ok(result.body.includes(text.replace(/\n+$/, "")));
  assert.equal(result.body_sha256, sha(fs.readFileSync(result.bodyFile)));
  assert.equal(fs.existsSync(canary), false, "no substitution ran");
  const reply = bodyFile(repo, text);
  assert.equal(reply.sha256, sha(fs.readFileSync(reply.file)));
});

test("N7 table-driven validity and refusal per publication kind", () => {
  const repo = makeRepo();
  const { reviewer, threads, batch, delivered } = reviewRound(repo);
  const pr = delivered.pr;
  const body = summaryBody(repo, reviewer, "Summary.");
  const replyBody = bodyFile(repo, "ok");
  const prTarget = { host: "github.com", repository: pr.repository, pr_number: pr.number, pr_url: pr.url };
  const kinds = {
    pr_body: { kind: "pr_body", target: prTarget, intended: { body_file: body.bodyFile, body_sha256: body.body_sha256 }, precondition: { head_oid: pr.head, body_sha256: body.current_body_sha256, state: "OPEN", observed_at: nowIso() } },
    reply: { kind: "reply", target: { ...prTarget, root_comment_database_id: threads[0].root_comment_database_id, thread_graphql_id: threads[0].thread_graphql_id }, intended: { body_file: replyBody.file, body_sha256: replyBody.sha256 }, batch_id: batch.id },
  };
  for (const [name, fields] of Object.entries(kinds)) {
    const event = { id: `pub-${randomUUID()}`, operation_id: `${name}-${randomUUID()}`, step: "prepared", at: nowIso(), candidate_oid: delivered.oid, precondition: { head_oid: pr.head, body_sha256: null, state: "OPEN", observed_at: nowIso() }, batch_id: null, observed: null, error: null, ...fields };
    const missing = { ...event, target: { ...event.target } };
    delete missing.target.pr_url;
    refused(reviewer.append("publications", missing), 2, "schema_error", `${name} without pr_url`);
    const wrongKind = { ...event, kind: name === "reply" ? "resolve" : "pr_state" };
    refused(reviewer.append("publications", wrongKind), 2, "schema_error", `${name} with another kind's intended shape`);
    ok(reviewer.append("publications", event), name);
  }
  const push = pushEvent(repo, reviewer);
  const noRef = { ...push, target: { ...push.target } };
  delete noRef.target.ref;
  refused(reviewer.append("publications", noRef), 2, "schema_error");
  refused(reviewer.append("publications", { ...push, intended: {} }), 2, "schema_error");
  refused(reviewer.append("publications", resolveEvent(reviewer, batch, threads[0], "missing-op")), 2, "invariant_error");
  const createAgain = { ...delivered.prCreate, id: "pub-x", operation_id: "create-again", step: "prepared", observed: null };
  refused(reviewer.append("publications", createAgain), 2, "invariant_error", "a PR is already recorded");
});

test("N7 a wrong target with a correct body is refused", () => {
  const repo = makeRepo();
  const { reviewer, threads, batch } = reviewRound(repo);
  const event = replyEvent(repo, reviewer, batch, threads[0], bodyFile(repo, "Fixed."));
  refused(reviewer.append("publications", { ...event, target: { ...event.target, pr_number: event.target.pr_number + 1 } }), 4, "identity_mismatch");
  refused(reviewer.append("publications", { ...event, target: { ...event.target, repository: "acme/other" } }), 4, "identity_mismatch");
  refused(reviewer.append("publications", { ...event, intended: { ...event.intended, body_sha256: "a".repeat(64) } }), 4, "identity_mismatch");
});

test("N7/V5 altered identity or candidate between operation steps fails", () => {
  const repo = makeRepo();
  const { reviewer, threads, batch } = reviewRound(repo);
  const prepared = replyEvent(repo, reviewer, batch, threads[0], bodyFile(repo, "Fixed."));
  ok(reviewer.append("publications", prepared));
  refused(reviewer.append("publications", { ...verifiedReply(prepared), candidate_oid: reviewer.ledger().candidate.baseline_oid }), 2, "invariant_error");
  refused(reviewer.append("publications", { ...verifiedReply(prepared), target: { ...prepared.target, pr_url: `${prepared.target.pr_url}x` } }), 2, "invariant_error");
  refused(reviewer.append("publications", { ...verifiedReply(prepared), precondition: { ...prepared.precondition, head_oid: null } }), 2, "invariant_error");
  refused(reviewer.append("publications", step(prepared, "prepared")), 2, "invariant_error", "one prepared step per operation");
  ok(reviewer.append("publications", verifiedReply(prepared)));
  refused(reviewer.append("publications", step(prepared, "failed", { error: "late" })), 2, "invariant_error", "nothing follows a terminal step");
});

test("N7 an incomplete snapshot cannot back publication", () => {
  const repo = makeRepo();
  const { reviewer, threads } = reviewRound(repo);
  const partial = batchFile(repo, reviewer, threads, { complete: false });
  ok(reviewer.append("reviews", review(reviewer, { source: "codex-bot", findings: [finding({ thread_id: threads[0].thread_graphql_id, disposition: "informational" })], batch: partial })));
  refused(reviewer.append("publications", replyEvent(repo, reviewer, partial, threads[0], bodyFile(repo, "Noted."))), 2, "invariant_error");
  const partialReview = reviewer.ledger().reviews.find((entry) => entry.batch?.id === partial.id);
  const swapped = batchFile(repo, reviewer, threads, { complete: true, id: partial.id });
  refused(reviewer.append("reviews", { ...partialReview, id: "rev-swap", supersedes_id: partialReview.id, batch: swapped }), 2, "invariant_error", "a successor cannot swap in another snapshot");
});

test("N7/F15 summary markers: duplicated, unmatched or foreign blocks stop; bytes outside the block are preserved", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const id = owner.ledger().delivery_id;
  const start = `<!-- agent-delivery-summary:${id}:start -->`;
  const end = `<!-- agent-delivery-summary:${id}:end -->`;
  const prefix = "Intro  with trailing spaces  \r\n\n";
  const suffix = "\n\n## Reviewer notes\nkeep me exactly\n";
  const first = summaryBody(repo, owner, "v1 summary", `${prefix}${start}\nold\n${end}${suffix}`);
  assert.equal(first.action, "replaced");
  assert.equal(first.body, `${prefix}${start}\nv1 summary\n${end}${suffix}`);
  const again = summaryBody(repo, owner, "v1 summary", first.body);
  assert.equal(again.body, first.body, "a stable update is idempotent");
  const appended = summaryBody(repo, owner, "fresh", "Human-written body.");
  assert.equal(appended.action, "appended");
  assert.ok(appended.body.startsWith(`Human-written body.\n\n${start}`));
  const bad = (current) => {
    const currentFile = path.join(repo.inputs, `bad-${randomUUID()}.md`);
    fs.writeFileSync(currentFile, current);
    const summaryFile = path.join(repo.inputs, `s-${randomUUID()}.md`);
    fs.writeFileSync(summaryFile, "x");
    return run(["summary-body", "--repo", repo.work, "--current-body-file", currentFile, "--summary-file", summaryFile]);
  };
  refused(bad(`${start}\na\n${end}\n${start}\nb\n${end}`), 2, "invariant_error", "duplicate pair");
  refused(bad(`${start}\nno end`), 2, "invariant_error", "unmatched start");
  refused(bad(`${end}\n${start}`), 2, "invariant_error", "reversed pair");
  refused(bad("<!-- agent-delivery-summary:other-delivery:start -->\nx\n<!-- agent-delivery-summary:other-delivery:end -->"), 2, "invariant_error", "another delivery's block");
});

test("N7 a non-GitHub push fabricates no GitHub identity", () => {
  const repo = makeRepo({ remote: "plain" });
  const owner = initDelivery(repo, { endpoint: "push" });
  deliverToFrozen(repo, owner);
  const push = pushEvent(repo, owner);
  assert.equal(push.target.host, null);
  refused(owner.append("publications", { ...push, target: { ...push.target, host: "github.com", repository: "acme/widget" } }), 4, "identity_mismatch");
  ok(owner.append("publications", push));
});

// ---------------------------------------------------------------------------
// F5 / N3 / V4: phases, claims, grants and endpoint authorization (6)

function completeDelivery(repo, owner, next = null) {
  const delivered = draftPrDelivery(repo, owner);
  const result = owner.release("complete", { next, completion: completion(owner, [`validation:${delivered.gate.id}`, `publications:${delivered.push.id}`, `publications:${delivered.prCreate.id}`]), blocker: null });
  return { delivered, result };
}

test("F5 the draft default and explicit ready, local, commit and push endpoint limits", () => {
  const draft = makeRepo();
  const drafter = initDelivery(draft);
  deliverToFrozen(draft, drafter);
  pushCandidate(draft, drafter);
  const body = summaryBody(draft, drafter, "Summary.");
  const ledger = drafter.ledger();
  const create = (isDraft) => ({
    id: `pub-${randomUUID()}`,
    operation_id: `create-${randomUUID()}`,
    step: "prepared",
    kind: "pr_create",
    at: nowIso(),
    candidate_oid: ledger.candidate.oid,
    target: { host: "github.com", repository: `${draft.github.owner}/${draft.github.name}`, pr_number: null, pr_url: null },
    intended: { head_repository: { ...draft.github }, head_branch: draft.branch, base: "main", draft: isDraft, body_file: body.bodyFile, body_sha256: body.body_sha256 },
    precondition: { head_oid: ledger.candidate.oid, body_sha256: null, state: null, observed_at: nowIso() },
    batch_id: null,
    observed: null,
    error: null,
  });
  refused(drafter.append("publications", create(false)), 2, "invariant_error", "a ready PR needs ready_pr");
  ok(drafter.append("publications", create(true)));

  const ready = makeRepo();
  const readier = initDelivery(ready, { endpoint: "ready_pr" });
  deliverToFrozen(ready, readier);
  pushCandidate(ready, readier);
  const readyBody = summaryBody(ready, readier, "Summary.");
  const readyLedger = readier.ledger();
  ok(readier.append("publications", { ...create(false), target: { host: "github.com", repository: `${ready.github.owner}/${ready.github.name}`, pr_number: null, pr_url: null }, candidate_oid: readyLedger.candidate.oid, intended: { head_repository: { ...ready.github }, head_branch: ready.branch, base: "main", draft: false, body_file: readyBody.bodyFile, body_sha256: readyBody.body_sha256 }, precondition: { head_oid: readyLedger.candidate.oid, body_sha256: null, state: null, observed_at: nowIso() } }));

  for (const endpoint of ["local", "commit"]) {
    const repo = makeRepo();
    const owner = initDelivery(repo, { endpoint });
    deliverToFrozen(repo, owner);
    refused(owner.append("publications", pushEvent(repo, owner)), 2, "invariant_error", `${endpoint} forbids a push`);
  }
  const pushOnly = makeRepo();
  const pusher = initDelivery(pushOnly, { endpoint: "push" });
  deliverToFrozen(pushOnly, pusher);
  pushCandidate(pushOnly, pusher);
  const pushBody = summaryBody(pushOnly, pusher, "x");
  const pushLedger = pusher.ledger();
  refused(pusher.append("publications", { ...create(true), target: { host: "github.com", repository: `${pushOnly.github.owner}/${pushOnly.github.name}`, pr_number: null, pr_url: null }, candidate_oid: pushLedger.candidate.oid, intended: { head_repository: { ...pushOnly.github }, head_branch: pushOnly.branch, base: "main", draft: true, body_file: pushBody.bodyFile, body_sha256: pushBody.body_sha256 }, precondition: { head_oid: pushLedger.candidate.oid, body_sha256: null, state: null, observed_at: nowIso() } }), 2, "invariant_error", "push forbids a PR");
});

test("F5/N3 a missing remote prevents the PR endpoint, records a limitation, and completes only with recorded narrower authority", () => {
  const repo = makeRepo({ remote: null });
  const owner = initDelivery(repo, { endpoint: "draft_pr" });
  const ledger = owner.ledger();
  assert.equal(ledger.limitations[0].kind, "publication_unavailable");
  assert.equal(ledger.authorization.endpoint, "draft_pr", "the limitation does not narrow the authorized endpoint");
  deliverToFrozen(repo, owner);
  refused(owner.append("publications", pushEvent(repo, owner)), 2, undefined, "no remote to push to");
  const gate = recordGate(repo, owner, ["src/app.js"]);
  refused(owner.release("complete", { next: null, completion: completion(owner, [`validation:${gate.id}`], { endpoint: "commit" }), blocker: null }), 2, "invariant_error", "no narrower authority yet");
  refused(owner.release("complete", { next: null, completion: completion(owner, [`validation:${gate.id}`]), blocker: null }), 2, "invariant_error", "insufficient endpoint evidence");
  ok(owner.authorize(grant("endpoint", { endpoint: "commit", wording: '"commit locally is fine; there is no remote"' })));
  refused(owner.release("complete", { next: null, completion: completion(owner, [`validation:${gate.id}`], { endpoint: "draft_pr" }), blocker: null }), 2, "invariant_error", "only the recorded endpoint may complete");
  ok(owner.release("complete", { next: null, completion: completion(owner, [`validation:${gate.id}`], { endpoint: "commit" }), blocker: null }));

  const blocked = makeRepo({ remote: null });
  const stuck = initDelivery(blocked, { endpoint: "draft_pr" });
  ok(stuck.release("blocked", { next: nextStep("delivery", "bootstrap"), completion: null, blocker: { reason: "no remote for the authorized PR endpoint", resume_phase: "delivery", resume_checkpoint: "bootstrap", required_action: "add a remote or authorize a narrower endpoint" } }));
  assert.equal(stuck.ledger().phase, "blocked");
});

test("F5 an advisory next never triggers posting, and observe never remediates", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { authorization: { monitoring: "observe", grants: [grant("monitor_observe", { wording: '"watch the PR, do not fix anything"' })] } });
  const { delivered } = (() => {
    const result = completeDelivery(repo, owner, nextStep("watch", null));
    ok(result.result);
    return result;
  })();
  const suggestion = new Session(repo, "codex");
  refused(suggestion.claim("review_round"), 2, "invariant_error", "no review_round grant");
  const watcher = new Session(repo, "codex");
  ok(watcher.claim("watch"));
  assert.equal(watcher.ledger().checkpoint, null);
  refused(watcher.owned("begin-change"), 2, "invariant_error");
  refused(watcher.update({ checkpoint: "implement" }), 2, "invariant_error");
  refused(watcher.freeze(delivered.oid), 2, "invariant_error");
  refused(watcher.reconcile({ case: "interrupted_commit", reason: "r", source: "s", grant_id: null, expected: { candidate_oid: delivered.oid, working_head_oid: delivered.oid }, observed: { oid: delivered.oid, commit_evidence: { prior_head: delivered.oid, reason: "r", source: "s", intended_paths: ["src"], excluded_paths: [] } }, evidence_paths: [] }), 2, "invariant_error", "reconcile cannot remediate under observe");
  refused(watcher.append("publications", pushEvent(repo, watcher, { precondition: { head_oid: delivered.oid, body_sha256: null, state: null, observed_at: nowIso() } })), 2, "invariant_error");
  const observation = sessionRecord(watcher, { phase: "watch" });
  ok(watcher.append("sessions", observation));
  ok(watcher.release("complete", { next: null, completion: completion(watcher, [`sessions:${observation.id}`], { limitations: ["user stop: quiet for ten minutes"] }), blocker: null }));
  refused(new Session(repo, "claude").claim("watch"), 2, "invariant_error", "a completed watch does not restart on its old grant");
});

test("F5/N3 the same-session exception is recorded and the helper creates no task or other file", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const before = snapshotTree(repo.dir);
  ok(owner.recordContext({ policy: { skill_pack_oid: null, skill_sources: [], session_mode: "same_session" } }, '"keep going in this session"'));
  ok(owner.release("handoff", { next: nextStep("delivery", "bootstrap", { brief: "continue in the same session" }), completion: null, blocker: null }));
  const after = snapshotTree(repo.dir);
  const changed = Object.keys(after).filter((file) => after[file] !== before[file]);
  const created = Object.keys(after).filter((file) => !(file in before));
  const allowed = (file) => file.includes(`${path.sep}.agent${path.sep}deliveries${path.sep}`) || file.includes("agent-delivery-locks") || file.startsWith(`inputs${path.sep}`);
  assert.ok([...changed, ...created].every(allowed), [...changed, ...created].join(", "));
  assert.equal(owner.ledger().policy.session_mode, "same_session");
});

test("F5/N3 interrupted-claim and completed-delivery reentry", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  ok(owner.update({ checkpoint: "validate" }));
  const fresh = new Session(repo, "codex");
  refused(fresh.claim("delivery"), 3, "owner_conflict", "an interrupted owner stays claimed");
  ok(fresh.claim("delivery", { force: true, grantFile: input(repo, "grant", grant("takeover")) }));
  assert.equal(fresh.ledger().phase, "delivery");
  assert.equal(fresh.ledger().checkpoint, "validate", "takeover preserves the interrupted checkpoint");

  const done = makeRepo();
  const finisher = initDelivery(done);
  ok(completeDelivery(done, finisher).result);
  refused(new Session(done, "codex").claim("delivery"), 2, "invariant_error", "a completed delivery is not reopened");
  const reviewer = new Session(done, "codex");
  ok(reviewer.claim("review_round", { grantFile: input(done, "grant", grant("review_round")) }));
  assert.equal(reviewer.ledger().checkpoint, "review");
  assert.equal(reviewer.ledger().phase, "review_round");
});

test("N3 the consumed brief survives claim", () => {
  const repo = makeRepo();
  ok(run(initArgs(repo, { bootstrap: { brief: "Implement FE-42 exactly; exclusions in the task doc." } })));
  const owner = new Session(repo, "codex");
  const claimed = ok(owner.claim());
  assert.equal(claimed.data.consumed_next.brief, "Implement FE-42 exactly; exclusions in the task doc.");
  assert.equal(owner.ledger().next, null);
  assert.equal(owner.ledger().history.at(-1).detail.consumed_next.brief, "Implement FE-42 exactly; exclusions in the task doc.");
});

test("N3 blocked resumes its phase and checkpoint; wrong-phase reentry is rejected", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  ok(owner.update({ checkpoint: "validate" }));
  refused(owner.release("blocked", { next: nextStep("delivery", "review"), completion: null, blocker: { reason: "CI down", resume_phase: "delivery", resume_checkpoint: "validate", required_action: "rerun" } }), 2, "invariant_error");
  ok(owner.release("blocked", { next: nextStep("delivery", "validate"), completion: null, blocker: { reason: "CI down", resume_phase: "delivery", resume_checkpoint: "validate", required_action: "rerun the gate" } }));
  const wrong = new Session(repo, "codex");
  refused(wrong.claim("review_round", { grantFile: input(repo, "grant", grant("review_round")) }), 2, "invariant_error");
  refused(wrong.claim("watch"), 2, "invariant_error");
  const resumed = new Session(repo, "codex");
  ok(resumed.claim("delivery"));
  assert.equal(resumed.ledger().checkpoint, "validate");
  assert.equal(resumed.ledger().blocker, null);

  const handoff = makeRepo();
  const first = initDelivery(handoff);
  ok(first.update({ checkpoint: "implement" }));
  refused(first.release("handoff", { next: nextStep("delivery", "review"), completion: null, blocker: null }), 2, "invariant_error", "handoff names the unfinished checkpoint");
  ok(first.release("handoff", { next: nextStep("delivery", "implement"), completion: null, blocker: null }));
  refused(new Session(handoff, "codex").claim("review_round", { grantFile: input(handoff, "grant", grant("review_round")) }), 2, "invariant_error", "wrong-phase reentry");
});

test("N3 same-phase takeover preserves state and historical completion survives handoff", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  ok(completeDelivery(repo, owner).result);
  const completed = owner.ledger().completion;
  const reviewer = new Session(repo, "codex");
  ok(reviewer.claim("review_round", { grantFile: input(repo, "grant", grant("review_round")) }));
  ok(reviewer.release("handoff", { next: nextStep("review_round", "review"), completion: null, blocker: null }));
  assert.deepEqual(reviewer.ledger().completion, completed);
  const next = new Session(repo, "claude");
  ok(next.claim("review_round"), "a same-phase handoff resumes under its grant");
  assert.equal(next.ledger().checkpoint, "review");
  const takeover = new Session(repo, "codex");
  ok(takeover.claim("review_round", { force: true, grantFile: input(repo, "grant", grant("takeover")) }));
  assert.equal(takeover.ledger().phase, "review_round");
  assert.deepEqual(takeover.ledger().completion, completed);
});

test("N3 insufficient endpoint evidence rejects complete", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const oid = deliverToFrozen(repo, owner);
  const gate = recordGate(repo, owner, ["src/app.js"]);
  refused(owner.release("complete", { next: null, completion: completion(owner, []), blocker: null }), 2, "invariant_error", "no gate");
  refused(owner.release("complete", { next: null, completion: completion(owner, [`validation:${gate.id}`]), blocker: null }), 2, "invariant_error", "no push");
  const push = pushCandidate(repo, owner);
  const verified = owner.ledger().publications.find((event) => event.operation_id === push.operation_id && event.step === "verified");
  refused(owner.release("complete", { next: null, completion: completion(owner, [`validation:${gate.id}`, `publications:${verified.id}`]), blocker: null }), 2, "invariant_error", "no PR");
  const focusedOid = recordGate(repo, owner, ["src/app.js"], { scope: "focused" });
  refused(owner.release("complete", { next: null, completion: completion(owner, [`validation:${focusedOid.id}`, `publications:${verified.id}`]), blocker: null }), 2, "invariant_error", "a focused check is not the final gate");
  const failing = review(owner, { verdict: "fail" });
  ok(owner.append("reviews", failing));
  refused(owner.release("complete", { next: null, completion: completion(owner, [`validation:${gate.id}`, `publications:${verified.id}`, `reviews:${failing.id}`]), blocker: null }), 2, "invariant_error", "a failing review never satisfies completion");
  const skipped = commandValidation(repo, { oid, result: "skipped", exit_code: null, log: null, reason: "not run" });
  ok(owner.append("validation", skipped));
  refused(owner.release("complete", { next: null, completion: completion(owner, [`validation:${skipped.id}`, `publications:${verified.id}`]), blocker: null }), 2, "invariant_error", "skipped is never a pass");
});

test("N3 reply-only completion makes no commit", () => {
  const repo = makeRepo();
  const { reviewer, threads, batch, batchReview, delivered } = reviewRound(repo, { dispositions: ["rejected", "rejected"] });
  const head = git(repo.work, "rev-parse", "HEAD");
  for (const thread of threads) {
    const prepared = replyEvent(repo, reviewer, batch, thread, bodyFile(repo, `Not changing ${thread.path}.`));
    ok(reviewer.append("publications", prepared));
    ok(reviewer.append("publications", verifiedReply(prepared, { object_id: `r-${thread.root_comment_database_id}` })));
  }
  ok(reviewer.release("complete", { next: null, completion: completion(reviewer, [`validation:${delivered.gate.id}`, `reviews:${batchReview.id}`]), blocker: null }));
  assert.equal(git(repo.work, "rev-parse", "HEAD"), head);
  assert.equal(reviewer.ledger().candidate.oid, delivered.oid);
});

test("N3/F5 already-authorized watch work survives delivery completion", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { authorization: { monitoring: "observe", grants: [grant("monitor_observe")] } });
  const delivered = draftPrDelivery(repo, owner);
  const evidence = [`validation:${delivered.gate.id}`, `publications:${delivered.push.id}`, `publications:${delivered.prCreate.id}`];
  refused(owner.release("complete", { next: null, completion: completion(owner, evidence), blocker: null }), 2, "invariant_error", "the authorized watch is not dropped");
  refused(owner.release("complete", { next: nextStep("review_round", "review", { authorization_required: true }), completion: completion(owner, evidence), blocker: null }), 2, "invariant_error", "nor replaced by an unauthorized suggestion");
  ok(owner.release("complete", { next: nextStep("watch", null), completion: completion(owner, evidence), blocker: null }));
  ok(new Session(repo, "codex").claim("watch"));
});

test("V4 a new findings grant and its claim commit atomically; a failed claim writes neither", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  ok(completeDelivery(repo, owner).result);
  const findings = grant("review_round");
  fs.writeFileSync(repo.taskDoc, "# Task\n\nchanged\n");
  const before = fs.readFileSync(repo.ledgerPath, "utf8");
  refused(new Session(repo, "codex").claim("review_round", { grantFile: input(repo, "grant", findings) }), 4, "identity_mismatch");
  assert.equal(fs.readFileSync(repo.ledgerPath, "utf8"), before, "neither grant nor owner was written");
  fs.writeFileSync(repo.taskDoc, "# Task\n\nDo the thing.\n");
  const reviewer = new Session(repo, "codex");
  ok(reviewer.claim("review_round", { grantFile: input(repo, "grant", findings) }));
  const ledger = reviewer.ledger();
  assert.ok(ledger.authorization.grants.some((entry) => entry.id === findings.id));
  assert.equal(ledger.history.at(-1).detail.grant_id, findings.id);
  assert.equal(ledger.history.at(-1).operation, "claim");
});

test("V4 a duplicate grant ID with altered scope fails; an identical grant is a no-op", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const merge = grant("merge");
  ok(owner.authorize(merge));
  assert.equal(owner.ledger().authorization.merge, true);
  assert.equal(ok(owner.authorize(merge)).changed, false);
  refused(owner.authorize({ ...merge, scope: "monitor_remediate" }), 2, "invariant_error");
  refused(owner.authorize({ ...merge, id: "g-endpoint", scope: "endpoint", endpoint: null }), 2, "invariant_error");
});

test("V4 forced takeover cannot start a new phase", () => {
  const repo = makeRepo();
  initDelivery(repo);
  refused(new Session(repo, "codex").claim("review_round", { force: true, grantFile: input(repo, "grant", grant("takeover")) }), 2, "invariant_error");
  refused(new Session(repo, "codex").claim("delivery", { force: true, grantFile: input(repo, "grant", grant("review_round")) }), 2, "invariant_error", "a takeover needs a takeover grant");
  const fresh = makeRepo();
  ok(run(initArgs(fresh)));
  const before = fs.readFileSync(fresh.ledgerPath, "utf8");
  for (const value of [grant("endpoint", { endpoint: "ready_pr" }), grant("monitor_remediate")]) {
    refused(new Session(fresh, "codex").claim("delivery", { grantFile: input(fresh, "grant", value) }), 2, "invariant_error", "grants go through authorize");
  }
  assert.equal(fs.readFileSync(fresh.ledgerPath, "utf8"), before);
});

test("V4 each reconcile case writes only its permitted fields and refuses unrelated keys", () => {
  const always = new Set(["revision", "updated_at", "updated_by", "history"]);
  const changedPaths = (before, after) => {
    const out = [];
    const walk = (a, b, prefix) => {
      if (JSON.stringify(a) === JSON.stringify(b)) return;
      if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[key], b[key], prefix ? `${prefix}.${key}` : key);
      } else out.push(prefix);
    };
    walk(before, after, "");
    return out.filter((entry) => !always.has(entry.split(".")[0]));
  };
  const repo = makeRepo();
  const dep = dependencyRepo(repo);
  const owner = initDelivery(repo, { bootstrap: { dependencies: [dependencyRecord(dep)] } });
  const head = owner.ledger().candidate.working_head_oid;
  const expected = { candidate_oid: null, working_head_oid: head };
  const base = { reason: "reconcile", source: "owner", grant_id: null, evidence_paths: [] };
  refused(owner.reconcile({ ...base, case: "source_refresh", expected, observed: { kind: "task_doc", source: sourceOf(repo.taskDoc), authorization: { merge: true } } }), 2, "schema_error", "extra observed keys");
  refused(owner.reconcile({ ...base, case: "source_refresh", expected: { ...expected, working_head_oid: "f".repeat(40) }, observed: { kind: "task_doc", source: sourceOf(repo.taskDoc) } }), 4, "identity_mismatch", "expected must match the ledger");
  refused(owner.reconcile({ ...base, case: "source_refresh", grant_id: "no-such-grant", expected, observed: { kind: "task_doc", source: sourceOf(repo.taskDoc) } }), 2, "invariant_error", "grant_id must resolve");
  refused(owner.reconcile({ ...base, case: "remote_adoption", expected, observed: { remote_baseline: { remote_name: "origin", ref: "refs/heads/other", oid: head, observed_at: nowIso() }, pr: null } }), 4, "identity_mismatch", "never an unrelated destination");

  fs.writeFileSync(repo.taskDoc, "# Task\n\nrefined\n");
  let before = owner.ledger();
  ok(owner.reconcile({ ...base, case: "source_refresh", expected, observed: { kind: "task_doc", source: sourceOf(repo.taskDoc) } }));
  assert.deepEqual(changedPaths(before, owner.ledger()), ["sources.task_docs"]);

  git(repo.work, "push", "-q", "origin", `HEAD:refs/heads/${repo.branch}`);
  before = owner.ledger();
  ok(owner.reconcile({ ...base, case: "remote_adoption", expected, observed: { remote_baseline: { remote_name: "origin", ref: `refs/heads/${repo.branch}`, oid: head, observed_at: nowIso() }, pr: null } }));
  assert.deepEqual(changedPaths(before, owner.ledger()), ["candidate.remote_baseline"]);

  fs.writeFileSync(path.join(dep.output, "index.js"), "rebuilt\n");
  before = owner.ledger();
  ok(owner.reconcile({ ...base, case: "dependency_refresh", expected, observed: { dependencies: [dependencyRecord(dep)] } }));
  assert.deepEqual(changedPaths(before, owner.ledger()), ["candidate.dependencies"]);

  const oid = commit(repo, { "src/app.js": "export const v = 2;\n" });
  before = owner.ledger();
  ok(owner.reconcile({ ...base, case: "interrupted_commit", expected, observed: { oid, commit_evidence: { prior_head: head, reason: "authorized", source: "owner", intended_paths: ["src"], excluded_paths: [] } } }));
  assert.deepEqual(changedPaths(before, owner.ledger()).sort(), ["candidate.generation", "candidate.oid", "candidate.state", "candidate.working_head_oid"]);

  const prepared = pushEvent(repo, owner, { precondition: { head_oid: head, body_sha256: null, state: null, observed_at: nowIso() } });
  ok(owner.append("publications", prepared));
  git(repo.work, "push", "-q", "origin", `HEAD:refs/heads/${repo.branch}`);
  before = owner.ledger();
  ok(owner.reconcile({ ...base, case: "interrupted_push", expected: { candidate_oid: oid, working_head_oid: oid }, observed: { event: step(prepared, "verified", { observed: observedFor(prepared, { oid }) }) } }));
  assert.deepEqual(changedPaths(before, owner.ledger()), ["publications"]);
  refused(owner.reconcile({ ...base, case: "interrupted_push", expected: { candidate_oid: oid, working_head_oid: oid }, observed: { event: step(prepared, "verified", { observed: observedFor(prepared, { oid }) }) } }), 2, "invariant_error", "the push already ended");
});

function sourceOf(file) {
  return { path: file, sha256: sha(fs.readFileSync(file)) };
}

// ---------------------------------------------------------------------------
// F7 / N8: inline fallback and required independence (7, 11)

test("F7/N8 inline review and audit fallback are recorded before canonical roles exist", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "commit", bootstrap: { audit_policy: { required: true, state: "pending", reason: "the prompt asked for a live check" } } });
  deliverToFrozen(repo, owner);
  const reviewRun = roleRun(owner, { role: "reviewer", mode: "implementation" });
  const auditRun = roleRun(owner, { role: "auditor", mode: "ui", requested_tier: "standard", result_summary: "inline audit-ui" });
  ok(owner.append("role_runs", reviewRun));
  ok(owner.append("role_runs", auditRun));
  refused(owner.append("role_runs", roleRun(owner, { fallback_reason: null })), 2, "invariant_error", "inline execution records why");
  const inlineReview = review(owner, { source: "inline", runtime: "claude" });
  ok(owner.append("reviews", inlineReview));
  const audit = { id: "audit-inline", mode: "ui", runtime: "claude", model: null, verdict: "PASS", report: "/tmp/audit/report.md", oid: owner.ledger().candidate.oid, content_id: null, content_manifest: null, at: nowIso(), role_run_id: auditRun.id };
  ok(owner.append("audits", audit));
  ok(owner.update({ audit_policy: { state: "complete" } }));
  const gate = recordGate(repo, owner, ["src/app.js"]);
  ok(owner.release("complete", { next: null, completion: completion(owner, [`validation:${gate.id}`, `reviews:${inlineReview.id}`, `audits:${audit.id}`]), blocker: null }));
  const ledger = owner.ledger();
  assert.deepEqual(ledger.defect_shapes, []);
  assert.equal(ledger.sources.spec_check.verdict, "not_run");
  assert.equal(ledger.review_bound, null);
});

test("F7/N8 an unavailable required independent review is a blocked gate, never a silent self-review", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "commit" });
  deliverToFrozen(repo, owner);
  refused(owner.append("role_runs", roleRun(owner, { fallback_reason: "independence_required", status: "complete" })), 2, "invariant_error");
  const blockedRun = roleRun(owner, { fallback_reason: "independence_required", status: "blocked", block_reason: "missing_capability", result_summary: "no approved independent reviewer is available" });
  ok(owner.append("role_runs", blockedRun));
  refused(owner.append("role_runs", { ...blockedRun, id: "run-relabel", supersedes_id: blockedRun.id, fallback_reason: "role_unavailable", status: "complete", block_reason: null }), 2, "invariant_error", "a successor cannot relabel the blocked gate");
  refused(owner.append("role_runs", { ...blockedRun, id: "run-complete", supersedes_id: blockedRun.id, status: "complete" }), 2, "invariant_error", "nor mark it complete");
  const selfReview = review(owner, { source: "inline" });
  ok(owner.append("reviews", selfReview), "a supplementary self-review may be recorded");
  const gate = recordGate(repo, owner, ["src/app.js"]);
  const blocked = refused(owner.release("complete", { next: null, completion: completion(owner, [`validation:${gate.id}`, `reviews:${selfReview.id}`]), blocker: null }), 2, "invariant_error");
  assert.match(blocked.message, /independent review/);
  ok(owner.release("blocked", { next: nextStep("delivery", "bootstrap"), completion: null, blocker: { reason: "the required independent review is unavailable", resume_phase: "delivery", resume_checkpoint: "bootstrap", required_action: "obtain a supported independent review" } }));
});

test("F7 a failed audit is never accepted as merely a role failure", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "commit", bootstrap: { audit_policy: { required: true, state: "pending", reason: "rollout audit required" } } });
  deliverToFrozen(repo, owner);
  const auditRun = roleRun(owner, { role: "auditor", mode: "ui", execution: "delegated", fallback_reason: null, status: "error", result_summary: "the auditor crashed after reporting" });
  ok(owner.append("role_runs", auditRun));
  const failed = { id: "audit-fail", mode: "ui", runtime: "codex", model: null, verdict: "FAIL", report: "/tmp/audit/report.md", oid: owner.ledger().candidate.oid, content_id: null, content_manifest: null, at: nowIso(), role_run_id: auditRun.id };
  ok(owner.append("audits", failed));
  refused(owner.append("audits", { ...failed, id: "audit-relabel", supersedes_id: failed.id, verdict: "BLOCKED" }), 2, "invariant_error");
  refused(owner.update({ audit_policy: { required: false, reason: "skip it" } }), 2, "invariant_error", "a required audit is not waived by patch");
  ok(owner.update({ audit_policy: { state: "complete" } }));
  const gate = recordGate(repo, owner, ["src/app.js"]);
  refused(owner.release("complete", { next: null, completion: completion(owner, [`validation:${gate.id}`, `audits:${failed.id}`]), blocker: null }), 2, "invariant_error");
  refused(owner.release("complete", { next: null, completion: completion(owner, [`validation:${gate.id}`]), blocker: null }), 2, "invariant_error", "a required audit needs its PASS cited");
});

test("N8 no heavy-command wrapper means a recorded limitation, not an installation", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const homeBefore = snapshotTree(HOME);
  ok(owner.append("limitations", limitation({ kind: "heavy_command_wrapper_unavailable", reason: "the repository has no heavy-command wrapper; heavy work is serialized in the owner and host-wide enforcement is unavailable", affects: ["validation"] })));
  assert.deepEqual(snapshotTree(HOME), homeBefore, "nothing was installed or configured");
  assert.equal(owner.ledger().limitations[0].kind, "heavy_command_wrapper_unavailable");
});

// ---------------------------------------------------------------------------
// F15 / V6 / V7: skill routing, R1 scope and explicit normal paths (11, 13)

test("F15 nested skills share one claim; a second claim by the same session is refused", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const claimId = owner.claimId;
  deliverToFrozen(repo, owner);
  recordGate(repo, owner, ["src/app.js"]);
  pushCandidate(repo, owner);
  assert.equal(owner.ledger().owner.claim_id, claimId, "validation, review and publication reuse the delivery claim");
  const nested = new Session(repo, owner.runtime, owner.session);
  refused(nested.claim("delivery"), 3, "owner_conflict", "a nested skill never claims again");
  const claims = owner.ledger().history.filter((event) => event.operation === "claim");
  assert.equal(claims.length, 1);
});

test("F15 standalone, no-ledger and report-only requests stay usable without creating a ledger", () => {
  const repo = makeRepo();
  const resolved = ok(run(["path", "--repo", repo.work])).data;
  assert.equal(resolved.exists, false);
  const missing = refused(run(["show", "--repo", repo.work]), 1, "io_error");
  assert.match(missing.message, /no ledger/);
  assert.equal(fs.existsSync(path.join(repo.work, ".agent")), false);
  const address = fs.readFileSync(path.join(root, "skills", "address-review-findings", "SKILL.md"), "utf8");
  assert.match(address, /ledger_unavailable/);
  assert.match(address, /report-only request stays read-only/i);
});

test("F15 local-only work and reply-only rounds make no commit: no helper command can commit, push or write GitHub", () => {
  const source = fs.readFileSync(HELPER, "utf8");
  const mutating = /git\([^;]*?\[\s*"(commit|push|add|fetch|stash|reset|update-ref|checkout|switch|merge|rebase|tag|branch|rm|mv|apply|am|cherry-pick|revert|gc|prune|worktree", "(add|remove|prune))"/;
  assert.doesNotMatch(source, mutating);
  const directGit = [...source.matchAll(/spawnSync\("git", \[([^\]]*)\]/g)].map((match) => match[1]);
  assert.deepEqual(directGit.map((args) => args.includes('"ls-remote"') || args.includes("...args")), directGit.map(() => true), "direct git spawns are the wrapper and read-only ls-remote only");
  const ghCallsInSource = [...source.matchAll(/spawnSync\("gh", \[([^\]]*)\]/g)].map((match) => match[1]);
  assert.equal(ghCallsInSource.length, 1);
  assert.match(ghCallsInSource[0], /"--method", "GET"/);
});

test("V6 the R1 implementation and authorized usability follow-up stay within delivery files", () => {
  const allowed = [
    "skills/task-doc-delivery-loop/scripts/delivery-ledger.mjs",
    "skills/task-doc-delivery-loop/references/delivery-ledger.md",
    "skills/task-doc-delivery-loop/references/delivery-examples.md",
    "skills/task-doc-delivery-loop/references/delivery-ledger.schema.json",
    "skills/task-doc-delivery-loop/references/authorization.md",
    "skills/task-doc-delivery-loop/references/validation.md",
    "skills/task-doc-delivery-loop/SKILL.md",
    "skills/address-review-findings/SKILL.md",
    "skills/publish-branch/SKILL.md",
    "skills/publish-branch/references/github-transport.md",
    "skills/publish-branch/references/ledger-handoff.md",
    "skills/monitor-pr-review/SKILL.md",
    "tests/delivery-ledger.test.mjs",
    "tests/skills-portability.test.mjs",
  ];
  const base = spawnSync("git", ["merge-base", "HEAD", "origin/main"], { cwd: root, encoding: "utf8" });
  if (base.status !== 0) return;
  const committed = spawnSync("git", ["diff", "--name-only", base.stdout.trim()], { cwd: root, encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  const untracked = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  const outside = [...committed, ...untracked].filter((file) => !allowed.includes(file));
  assert.deepEqual(outside, []);
});

test("V6 the suite needs no memory or runtime-configuration writes", () => {
  assert.ok(HOME.startsWith(SANDBOX), "every helper run uses a disposable HOME");
  const homeFiles = Object.keys(snapshotTree(HOME)).filter((file) => !["global-excludes", ".gitconfig"].includes(file));
  assert.deepEqual(homeFiles.filter((file) => /\.claude|\.codex|\.gemini|memory/i.test(file)), []);
});

test("V7 qualified completion references resolve only through their collection", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "commit" });
  deliverToFrozen(repo, owner);
  const shared = "evidence-1";
  const gate = recordGate(repo, owner, ["src/app.js"], { id: shared });
  ok(owner.append("reviews", review(owner, { id: shared, verdict: "fail", findings: [finding({ disposition: "pending" })] })));
  refused(owner.release("complete", { next: null, completion: completion(owner, [shared]), blocker: null }), 2, "schema_error", "an unqualified reference");
  refused(owner.release("complete", { next: null, completion: completion(owner, [`audits:${shared}`]), blocker: null }), 2, "invariant_error", "a missing qualified reference");
  refused(owner.release("complete", { next: null, completion: completion(owner, [`reviews:${shared}`, `validation:${shared}`]), blocker: null }), 2, "invariant_error", "the review with pending findings is evaluated as a review");
  refused(owner.release("complete", { next: null, completion: completion(owner, [`validation:${gate.id}`]), blocker: null }), 2, "invariant_error", "omitting the review does not resolve its pending findings");
});

test("R1 follow-up: generated initialization files are usable and never invent grants or overwrite files", () => {
  const repo = makeRepo();
  const before = git(repo.work, "status", "--porcelain");
  const output = path.join(repo.inputs, "prepared");
  const args = ["prepare-init", "--repo", repo.work, "--endpoint", "commit", "--brief", "Implement the approved task", "--remote", "origin", "--instruction", repo.taskDoc, "--output-dir", output];
  const prepared = ok(run(args)).data;
  const bootstrap = JSON.parse(fs.readFileSync(prepared.bootstrap_file));
  assert.equal(bootstrap.instructions[0].sha256, sha(fs.readFileSync(repo.taskDoc)));
  assert.ok(bootstrap.policy.skill_sources.length >= 5);
  assert.deepEqual(JSON.parse(fs.readFileSync(prepared.authorization_file)).grants, []);
  assert.equal(fs.existsSync(repo.ledgerPath), false);
  assert.equal(git(repo.work, "status", "--porcelain"), before);
  refused(run(args), 1, "io_error");
  ok(run(["init", "--repo", repo.work, "--runtime", "codex", "--session", "generated", "--task-doc", repo.taskDoc, "--base", repo.base, "--endpoint", "commit", "--authorization-file", prepared.authorization_file, "--bootstrap-file", prepared.bootstrap_file]));
  const local = makeRepo({ remote: null });
  const localOutput = ok(run(["prepare-init", "--repo", local.work, "--endpoint", "local", "--brief", "Local task", "--no-remote", "--same-session", "--output-dir", path.join(local.inputs, "prepared")])).data;
  const localBootstrap = JSON.parse(fs.readFileSync(localOutput.bootstrap_file));
  assert.equal(localBootstrap.remote_name, null);
  assert.equal(localBootstrap.policy.session_mode, "same_session");
  assert.equal(localBootstrap.github, null);
  git(local.work, "remote", "add", "origin", "https://gitlab.example/acme/widget.git");
  const otherHost = ok(run(["prepare-init", "--repo", local.work, "--endpoint", "push", "--brief", "Push task", "--remote", "origin", "--output-dir", path.join(local.inputs, "other-host")])).data;
  assert.equal(JSON.parse(fs.readFileSync(otherHost.bootstrap_file)).github, null, "a Git-shaped URL alone does not identify GitHub");
  refused(run(["prepare-init", "--repo", local.work, "--endpoint", "local", "--brief", "Local task", "--no-remote", "--output-dir", path.join(local.work, "generated")]), 1, "argument_error");
});

test("R1 follow-up: generated manifests cover committed, dirty, deleted, executable and symlink content", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "local" });
  commit(repo, { "src/app.js": "export const v = 2;\n" });
  fs.rmSync(path.join(repo.work, "README.md"));
  fs.writeFileSync(path.join(repo.work, "run task\nü.sh"), "#!/bin/sh\n", { mode: 0o755 });
  fs.symlinkSync("src/app.js", path.join(repo.work, "shortcut"));
  fs.writeFileSync(path.join(repo.work, "unrelated.txt"), "leave untouched");
  const file = path.join(repo.inputs, "generated-manifest.json");
  const args = ["content-manifest", "--repo", repo.work, "--output-file", file, "--exclude-path", "unrelated.txt"];
  refused(run(args), 2, "invariant_error");
  ok(owner.append("decisions", { id: "scope", text: "exclude `unrelated.txt`", source: "user scope" }));
  const before = owner.ledger().revision;
  const result = ok(run(args)).data;
  const manifest = JSON.parse(fs.readFileSync(file));
  assert.deepEqual(manifest.files.map((entry) => entry.path).sort(), ["README.md", "run task\nü.sh", "shortcut", "src/app.js"].sort());
  assert.equal(manifest.files.find((entry) => entry.path === "README.md").state, "deleted");
  assert.equal(manifest.files.find((entry) => entry.path === "shortcut").mode, "120000");
  assert.equal(manifest.files.find((entry) => entry.path.startsWith("run task")).mode, "100755");
  const checked = ok(run(["content-manifest", "--repo", repo.work, "--manifest-file", file])).data;
  assert.deepEqual(result, checked);
  assert.equal(owner.ledger().revision, before);
  refused(run(args), 1, "io_error");
  refused(run(["content-manifest", "--repo", repo.work, "--output-file", path.join(repo.work, "new.json")]), 1, "argument_error");
  const alias = path.join(repo.inputs, "repo-alias");
  fs.symlinkSync(repo.work, alias);
  refused(run(["content-manifest", "--repo", repo.work, "--output-file", path.join(alias, "new.json")]), 1, "argument_error");
});

test("R1 follow-up: failed and pending reviews block completion even when omitted, until dispositioned", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const { gate, push, prCreate } = draftPrDelivery(repo, owner);
  const failed = review(owner, { verdict: "fail", findings: [finding()] });
  ok(owner.append("reviews", failed));
  const release = () => owner.release("complete", { next: null, blocker: null, completion: completion(owner, [`validation:${gate.id}`, `publications:${push.id}`, `publications:${prCreate.id}`]) });
  refused(release(), 2, "invariant_error");
  const pending = { ...failed, id: randomUUID(), supersedes_id: failed.id, verdict: "pass-with-fixes" };
  ok(owner.append("reviews", pending));
  refused(release(), 2, "invariant_error");
  ok(owner.append("reviews", { ...pending, id: randomUUID(), supersedes_id: pending.id, findings: pending.findings.map((item) => ({ ...item, disposition: "rejected", classification: "invalid", reason: "verified against the approved requirement" })) }));
  ok(release());
});

test("R1 follow-up: a PR delivery requires cited review evidence or an explicit waiver", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const { gate, push, prCreate } = draftPrDelivery(repo, owner);
  const evidence = [`validation:${gate.id}`, `publications:${push.id}`, `publications:${prCreate.id}`];
  const release = () => owner.release("complete", { next: null, blocker: null, completion: completion(owner, evidence, { evidence_ids: evidence }) });
  refused(release(), 2, "invariant_error");
  ok(owner.authorize(grant("review_waiver", { wording: "Skip implementation review for this delivery; repository policy permits this exception." })));
  ok(release());
});

test("R1 follow-up: precommit review and audit apply to identical committed content", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "commit", bootstrap: { audit_policy: { required: true, state: "pending", reason: "requested" } } });
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 2;\n");
  const manifest = manifestFile(repo, owner, [entry(repo, "src/app.js")]);
  const identity = contentId(repo, manifest);
  const reviewed = review(owner, { content_id: identity.content_id, content_manifest: manifest.source });
  const audit = { id: randomUUID(), mode: "ui", runtime: "codex", model: null, verdict: "PASS", report: "verified UI", oid: null, content_id: identity.content_id, content_manifest: manifest.source, at: nowIso(), role_run_id: null };
  ok(owner.append("reviews", reviewed));
  ok(owner.append("audits", audit));
  ok(owner.update({ audit_policy: { required: true, state: "complete", reason: "audit passed" } }));
  const oid = commit(repo, { "src/app.js": "export const v = 2;\n" });
  ok(owner.freeze(oid));
  const gate = recordGate(repo, owner, ["src/app.js"]);
  ok(owner.release("complete", { next: null, blocker: null, completion: completion(owner, [`validation:${gate.id}`, `reviews:${reviewed.id}`, `audits:${audit.id}`]) }));
  assert.equal(owner.ledger().reviews[0].candidate_oid, null, "the original review identity is retained");
});

test("R1 follow-up: content changes and missing manifests cannot reuse a precommit review", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "commit" });
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 2;\n");
  const manifest = manifestFile(repo, owner, [entry(repo, "src/app.js")]);
  const identity = contentId(repo, manifest);
  const reviewed = review(owner, { content_id: identity.content_id, content_manifest: manifest.source });
  ok(owner.append("reviews", reviewed));
  deliverToFrozen(repo, owner, { "src/app.js": "export const v = 3;\n" });
  const gate = recordGate(repo, owner, ["src/app.js"]);
  const release = () => owner.release("complete", { next: null, blocker: null, completion: completion(owner, [`validation:${gate.id}`, `reviews:${reviewed.id}`]) });
  refused(release(), 2, "invariant_error");
  fs.rmSync(manifest.file);
  refused(release(), 1, "io_error");
});

test("R1 follow-up: dependency refresh invalidates precommit review and audit evidence", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo, { endpoint: "commit" });
  fs.writeFileSync(path.join(repo.work, "src/app.js"), "export const v = 2;\n");
  const manifest = manifestFile(repo, owner, [entry(repo, "src/app.js")]);
  const identity = contentId(repo, manifest);
  const reviewed = review(owner, { content_id: identity.content_id, content_manifest: manifest.source });
  const audit = { id: randomUUID(), mode: "ui", runtime: "codex", model: null, verdict: "PASS", report: "verified UI", oid: null, content_id: identity.content_id, content_manifest: manifest.source, at: nowIso(), role_run_id: null };
  ok(owner.append("reviews", reviewed));
  ok(owner.append("audits", audit));
  const dependency = dependencyRepo(repo);
  ok(owner.recordContext({ dependencies: [dependencyRecord(dependency)] }));
  deliverToFrozen(repo, owner);
  const gate = recordGate(repo, owner, ["src/app.js"]);
  for (const ref of [`reviews:${reviewed.id}`, `audits:${audit.id}`]) {
    const result = owner.release("complete", { next: null, blocker: null, completion: completion(owner, [`validation:${gate.id}`, ref]) });
    const error = refused(result, 2, "invariant_error");
    assert.match(error.message, /invalidated/);
  }
});

test("R1 follow-up: incomplete empty batches cannot complete a reply-free review round", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const { delivered, result } = completeDelivery(repo, owner);
  ok(result);
  const reviewer = new Session(repo, "codex");
  ok(reviewer.claim("review_round", { grantFile: input(repo, "grant", grant("review_round")) }));
  const batch = batchFile(repo, reviewer, [], { complete: false });
  const reviewed = review(reviewer, { batch });
  ok(reviewer.append("reviews", reviewed));
  refused(reviewer.release("complete", { next: null, blocker: null, completion: completion(reviewer, [`validation:${delivered.gate.id}`, `reviews:${reviewed.id}`]) }), 2, "invariant_error");
});

test("R1 follow-up: numeric GitHub root IDs are normalized without rewriting the batch", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  ok(completeDelivery(repo, owner).result);
  const reviewer = new Session(repo, "codex");
  ok(reviewer.claim("review_round", { grantFile: input(repo, "grant", grant("review_round")) }));
  const batch = batchFile(repo, reviewer, [{ thread_graphql_id: "thread-1", root_comment_database_id: 12345 }]);
  ok(reviewer.append("reviews", review(reviewer, { batch, findings: [finding({ thread_id: "thread-1", classification: "invalid", disposition: "rejected", reason: "not a defect" })] })));
  const bodyFile = path.join(repo.inputs, "numeric-reply.md");
  fs.writeFileSync(bodyFile, "The behavior matches the requirement.");
  const body = { file: bodyFile, sha256: sha(fs.readFileSync(bodyFile)) };
  ok(reviewer.append("publications", replyEvent(repo, reviewer, batch, { thread_graphql_id: "thread-1", root_comment_database_id: "12345" }, body)));
  assert.equal(sha(fs.readFileSync(batch.path)), batch.sha256);
  assert.equal(JSON.parse(fs.readFileSync(batch.path)).threads[0].root_comment_database_id, 12345);
});

test("R1 follow-up: naming a dotted filename does not authorize its dirty prefix", () => {
  const repo = makeRepo();
  fs.writeFileSync(path.join(repo.work, "src/config"), "unrelated");
  fs.writeFileSync(path.join(repo.work, "src/config.json"), "{}");
  refused(run(initArgs(repo, { bootstrap: { decisions: [{ id: "dirty_scope", text: "include src/config.json", source: "user scope" }] } })), 2, "invariant_error");
  ok(run(initArgs(repo, { bootstrap: { decisions: [{ id: "dirty_scope", text: "include `src/config.json`; exclude `src/config`", source: "user scope" }] } })));
});

test("R1 review batch: snapshots must identify the reviewed commit and current PR head", () => {
  const repo = makeRepo();
  const { reviewer } = reviewRound(repo);
  const oldHead = reviewer.ledger().candidate.baseline_oid;
  const stale = batchFile(repo, reviewer, [], { head: oldHead });
  refused(reviewer.append("reviews", review(reviewer, { batch: stale })), 4, "identity_mismatch", "old snapshot on the current review");
  refused(reviewer.append("reviews", review(reviewer, { candidate_oid: oldHead, batch: stale })), 4, "identity_mismatch", "old snapshot and review on the current PR");
  const current = batchFile(repo, reviewer, []);
  refused(reviewer.append("reviews", review(reviewer, { mode: "doc", candidate_oid: null, batch: current })), 4, "identity_mismatch", "a batch must identify its reviewed commit");
  ok(reviewer.append("reviews", review(reviewer, { batch: current })));
});

test("R1 review batch: a later round cannot reuse an earlier batch or its successors", () => {
  const repo = makeRepo();
  const { reviewer, delivered, batchReview } = reviewRound(repo);
  const finish = (owner, reviewed) => owner.release("complete", {
    next: null, blocker: null,
    completion: completion(owner, [`validation:${delivered.gate.id}`, `reviews:${reviewed.id}`]),
  });
  ok(finish(reviewer, batchReview));
  const next = new Session(repo, "codex");
  ok(next.claim("review_round", { grantFile: input(repo, "grant", grant("review_round")) }));
  refused(finish(next, batchReview), 2, "invariant_error", "a new grant needs its own findings batch");
  const successor = { ...batchReview, id: randomUUID(), supersedes_id: batchReview.id };
  ok(next.append("reviews", successor));
  refused(finish(next, successor), 2, "invariant_error", "a new disposition cannot refresh the old snapshot");
  const copied = { ...batchReview, id: randomUUID() };
  ok(next.append("reviews", copied));
  refused(finish(next, copied), 2, "invariant_error", "a new review ID cannot refresh the old batch");
  const fresh = review(next, { batch: batchFile(repo, next, []) });
  ok(next.append("reviews", fresh));
  ok(finish(next, fresh), "a new complete empty snapshot is valid");
});

test("R1 review batch: unfinished rounds keep their batch across handoff, blocking and takeover", () => {
  const repo = makeRepo();
  const { reviewer, delivered, batchReview } = reviewRound(repo);
  ok(reviewer.release("handoff", { next: nextStep("review_round", "review"), completion: null, blocker: null }));
  const resumed = new Session(repo, "claude");
  ok(resumed.claim("review_round"));
  ok(resumed.release("blocked", {
    next: nextStep("review_round", "review"), completion: null,
    blocker: { reason: "GitHub unavailable", resume_phase: "review_round", resume_checkpoint: "review", required_action: "retry the read" },
  }));
  const unblocked = new Session(repo, "codex");
  ok(unblocked.claim("review_round"));
  const takeover = new Session(repo, "claude");
  ok(takeover.claim("review_round", { force: true, grantFile: input(repo, "grant", grant("takeover")) }));
  ok(takeover.release("complete", {
    next: null, blocker: null,
    completion: completion(takeover, [`validation:${delivered.gate.id}`, `reviews:${batchReview.id}`]),
  }));
});

test("R1 review batch: disposition successors retain the reviewed head after a fix is pushed", () => {
  const repo = makeRepo();
  const { reviewer, delivered, batchReview } = reviewRound(repo, { dispositions: ["pending", "rejected"] });
  ok(reviewer.owned("begin-change"));
  const fixedOid = deliverToFrozen(repo, reviewer, { "src/app.js": "export const v = 3;\n" });
  const gate = recordGate(repo, reviewer, ["src/app.js"]);
  pushCandidate(repo, reviewer, { precondition: delivered.oid });
  const pr = prRecord(repo, reviewer);
  ghPull(repo, pr);
  ok(reviewer.recordContext({ pr }));
  const successor = {
    ...batchReview, id: randomUUID(), supersedes_id: batchReview.id,
    findings: batchReview.findings.map((item) => item.disposition === "pending" ? { ...item, disposition: "fixed", fix_oid: fixedOid } : item),
  };
  ok(reviewer.append("reviews", successor), "the original snapshot remains valid for dispositions");
  ok(reviewer.release("complete", {
    next: null, blocker: null,
    completion: completion(reviewer, [`validation:${gate.id}`, `reviews:${successor.id}`]),
  }));
});

test("R1 completion: PR body evidence must describe the final candidate", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const delivered = draftPrDelivery(repo, owner);
  let currentBody = fs.readFileSync(delivered.prCreate.intended.body_file, "utf8");
  const prepareBody = (summary) => {
    const pr = owner.ledger().pr;
    const body = summaryBody(repo, owner, summary, currentBody);
    const prepared = {
      id: randomUUID(), operation_id: randomUUID(), step: "prepared", kind: "pr_body", at: nowIso(), candidate_oid: pr.head,
      target: { host: pr.host, repository: pr.repository, pr_number: pr.number, pr_url: pr.url },
      intended: { body_file: body.bodyFile, body_sha256: body.body_sha256 },
      precondition: { head_oid: pr.head, body_sha256: body.current_body_sha256, state: "OPEN", observed_at: nowIso() },
      batch_id: null, observed: null, error: null,
    };
    ok(owner.append("publications", prepared));
    currentBody = body.body;
    return prepared;
  };
  const verifyBody = (prepared) => {
    const verified = step(prepared, "verified", { observed: observedFor(prepared, { oid: prepared.candidate_oid, body_sha256: prepared.intended.body_sha256 }) });
    ok(owner.append("publications", verified));
    return verified;
  };
  const oldBody = verifyBody(prepareBody("Candidate A passed validation."));
  ok(owner.owned("begin-change"));
  deliverToFrozen(repo, owner, { "src/app.js": "export const v = 3;\n" });
  const gate = recordGate(repo, owner, ["src/app.js"]);
  const reviewed = review(owner);
  ok(owner.append("reviews", reviewed));
  const pushed = pushCandidate(repo, owner, { precondition: delivered.oid });
  const pr = prRecord(repo, owner);
  ghPull(repo, pr);
  ok(owner.recordContext({ pr }));
  const finish = (body) => owner.release("complete", {
    next: null, blocker: null,
    completion: completion(owner, [`validation:${gate.id}`, `reviews:${reviewed.id}`, `publications:${pushed.id}`, `publications:${body.id}`]),
  });
  for (const stale of [delivered.prCreate, oldBody]) {
    const error = refused(finish(stale), 2, "invariant_error", "a verified body for A cannot complete delivery of B");
    assert.match(error.message, /PR body.*final candidate/);
  }
  const fresh = prepareBody("Candidate B passed validation.");
  refused(finish(fresh), 2, "invariant_error", "the replacement body still requires verification");
  verifyBody(fresh);
  ok(finish(fresh), "a verified body for B completes the delivery");
});

test("R1 completion: each observe-only watch needs an observation from that watch", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  const earlierSession = sessionRecord(owner);
  ok(owner.append("sessions", earlierSession));
  const { delivered, result } = completeDelivery(repo, owner);
  ok(result);
  const watcher = new Session(repo, "codex");
  ok(watcher.claim("watch", { grantFile: input(repo, "grant", grant("monitor_observe")) }));
  const finish = (actor, refs) => actor.release("complete", {
    next: null, blocker: null, completion: completion(actor, refs, { limitations: ["user stop"] }),
  });
  for (const refs of [[], [`sessions:${earlierSession.id}`], [`validation:${delivered.gate.id}`]]) {
    const error = refused(finish(watcher, refs), 2, "invariant_error", "delivery evidence does not establish that a watch ran");
    assert.match(error.message, /observation.*current watch/);
  }
  const observation = sessionRecord(watcher, { phase: "watch" });
  ok(watcher.append("sessions", observation));
  ok(finish(watcher, [`sessions:${observation.id}`]));
  const next = new Session(repo, "claude");
  ok(next.claim("watch", { grantFile: input(repo, "grant", grant("monitor_observe")) }));
  refused(finish(next, [`sessions:${observation.id}`]), 2, "invariant_error", "a completed watch does not supply the next watch's observation");
  const fresh = sessionRecord(next, { phase: "watch" });
  ok(next.append("sessions", fresh));
  ok(finish(next, [`sessions:${fresh.id}`]));
});

test("R1 completion: an unfinished watch retains observations through owner changes", () => {
  const repo = makeRepo();
  const owner = initDelivery(repo);
  ok(completeDelivery(repo, owner).result);
  const watcher = new Session(repo, "codex");
  ok(watcher.claim("watch", { grantFile: input(repo, "grant", grant("monitor_observe")) }));
  const observation = sessionRecord(watcher, { phase: "watch" });
  ok(watcher.append("sessions", observation));
  ok(watcher.release("handoff", { next: nextStep("watch", null), completion: null, blocker: null }));
  const resumed = new Session(repo, "claude");
  ok(resumed.claim("watch"));
  ok(resumed.release("blocked", {
    next: nextStep("watch", null), completion: null,
    blocker: { reason: "GitHub unavailable", resume_phase: "watch", resume_checkpoint: null, required_action: "retry the read" },
  }));
  const unblocked = new Session(repo, "codex");
  ok(unblocked.claim("watch"));
  const takeover = new Session(repo, "claude");
  ok(takeover.claim("watch", { force: true, grantFile: input(repo, "grant", grant("takeover")) }));
  ok(takeover.release("complete", {
    next: null, blocker: null,
    completion: completion(takeover, [`sessions:${observation.id}`], { limitations: ["user stop"] }),
  }));
});

describe("delivery ledger R1 acceptance", { concurrency: Math.max(2, Math.min(6, os.availableParallelism?.() ?? 4)) }, () => {
  for (const { name, fn } of suite) serialTest(name, fn);
});
