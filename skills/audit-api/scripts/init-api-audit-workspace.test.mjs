import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const script = new URL("./init-api-audit-workspace.mjs", import.meta.url);
const tempDir = (prefix = "audit-api-test-") => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const run = (args, env = {}) => spawnSync(process.execPath, [script.pathname, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
const args = (root, extra = []) => ["--feature", "Spin endpoints", "--mode", "journey", "--artifact-root", root, "--timestamp", "20260715T120000Z", ...extra];

test("creates deterministic API evidence workspace and templates", () => {
  const root = tempDir();
  const result = run(args(root));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim().split("\n").length, 1);
  const output = JSON.parse(result.stdout);
  assert.equal(output.featureSlug, "spin-endpoints");
  assert.equal(output.mode, "journey");
  for (const entry of ["contracts", "scenarios", "evidence", "logs", "audit-brief.md", "report.md"]) {
    assert.equal(fs.existsSync(path.join(output.workspace, entry)), true, entry);
  }
});

test("uses collision suffixes and API fallback slug", () => {
  const root = tempDir();
  const first = JSON.parse(run(args(root)).stdout);
  fs.writeFileSync(path.join(first.workspace, "sentinel"), "keep");
  const second = JSON.parse(run(args(root)).stdout);
  assert.equal(second.workspace, `${first.workspace}-2`);
  assert.equal(fs.readFileSync(path.join(first.workspace, "sentinel"), "utf8"), "keep");
  const fallback = run(["--feature", "!!!", "--mode", "focused", "--artifact-root", root, "--timestamp", "20260715T130000Z"]);
  assert.equal(JSON.parse(fallback.stdout).featureSlug, "api-audit");
});

test("supports all modes and rejects invalid mode or timestamp", () => {
  const root = tempDir();
  for (const mode of ["focused", "journey", "rollout"]) {
    assert.equal(run(["--feature", mode, "--mode", mode, "--artifact-root", root, "--timestamp", `20260715T12000${mode.length}Z`]).status, 0);
  }
  assert.equal(run(args(root, ["--mode", "deep"])).status, 2);
  assert.equal(run(["--feature", "x", "--mode", "focused", "--artifact-root", root, "--timestamp", "2026-07-15"]).status, 2);
});

test("rejects repository overlap in either direction and through symlinks", () => {
  const repo = tempDir("api-repo-");
  assert.equal(run(args(path.join(repo, "artifacts"), ["--tested-repo", repo])).status, 2);

  const workspaceRoot = tempDir("api-root-");
  const nestedRepo = path.join(workspaceRoot, "spin-endpoints");
  fs.mkdirSync(nestedRepo);
  assert.equal(run(args(workspaceRoot, ["--tested-repo", nestedRepo])).status, 2);

  const real = path.join(repo, "artifacts"); fs.mkdirSync(real);
  const links = tempDir("api-links-"); const link = path.join(links, "linked"); fs.symlinkSync(real, link);
  assert.equal(run(args(link, ["--tested-repo", repo])).status, 2);
});

test("uses HOME default and exit three for unexpected initialization failure", async () => {
  const home = tempDir("api-home-");
  const result = run(["--feature", "Demo", "--mode", "focused", "--timestamp", "20260715T120000Z"], { HOME: home });
  assert.equal(JSON.parse(result.stdout).workspace, path.join(home, "agent-artifacts", "api-audits", "demo", "20260715T120000Z"));

  const { runCli } = await import("./init-api-audit-workspace.mjs");
  let stderr = "";
  const code = await runCli(["--feature", "Demo", "--mode", "focused"], {
    initializeWorkspace: () => { throw new Error("boom"); },
    stdout: { write() {} }, stderr: { write: (value) => (stderr += value) },
  });
  assert.equal(code, 3);
  assert.match(stderr, /initialization failure/i);
});
