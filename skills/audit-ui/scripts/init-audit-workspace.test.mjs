import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { assertWorkspaceSafe, runCli } from "./init-audit-workspace.mjs";

const script = new URL("./init-audit-workspace.mjs", import.meta.url);

function tempDir(prefix = "audit-ui-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function run(args, options = {}) {
  return spawnSync(process.execPath, [script.pathname, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...options.env },
  });
}

function requiredArgs(root, overrides = []) {
  return [
    "--feature",
    "Direct Order",
    "--mode",
    "journey",
    "--artifact-root",
    root,
    "--timestamp",
    "20260715T120000Z",
    ...overrides,
  ];
}

test("creates a deterministic workspace with templates and output folders", () => {
  const root = tempDir();
  const result = run(requiredArgs(root));

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout.trim().split("\n").length, 1);
  const output = JSON.parse(result.stdout);
  assert.equal(output.featureSlug, "direct-order");
  assert.equal(output.mode, "journey");
  assert.equal(output.timestamp, "20260715T120000Z");
  assert.equal(
    output.workspace,
    path.join(root, "direct-order", "20260715T120000Z")
  );
  for (const entry of [
    "audit-brief.md",
    "report.md",
    "screenshots",
    "traces",
    "downloads",
    "logs",
  ]) {
    assert.equal(fs.existsSync(path.join(output.workspace, entry)), true, entry);
  }
  assert.match(fs.readFileSync(path.join(output.workspace, "audit-brief.md"), "utf8"), /Audit Brief/);
  assert.match(fs.readFileSync(path.join(output.workspace, "report.md"), "utf8"), /Audit Report/);
});

test("uses numeric collision suffixes without overwriting", () => {
  const root = tempDir();
  const first = JSON.parse(run(requiredArgs(root)).stdout);
  fs.writeFileSync(path.join(first.workspace, "sentinel.txt"), "keep");
  const secondResult = run(requiredArgs(root));

  assert.equal(secondResult.status, 0, secondResult.stderr);
  const second = JSON.parse(secondResult.stdout);
  assert.equal(second.workspace, `${first.workspace}-2`);
  assert.equal(fs.readFileSync(path.join(first.workspace, "sentinel.txt"), "utf8"), "keep");
});

test("normalizes feature text and uses the fallback slug", () => {
  const root = tempDir();
  const result = run([
    "--feature",
    " !!! ",
    "--mode",
    "focused",
    "--artifact-root",
    root,
    "--timestamp",
    "20260715T120000Z",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).featureSlug, "ui-audit");
});

test("rejects invalid mode and timestamp", () => {
  const root = tempDir();
  const mode = run(requiredArgs(root, ["--mode", "deep"]));
  assert.equal(mode.status, 2);
  assert.match(mode.stderr, /mode/i);

  const timestamp = run([
    "--feature",
    "Demo",
    "--mode",
    "focused",
    "--artifact-root",
    root,
    "--timestamp",
    "2026-07-15",
  ]);
  assert.equal(timestamp.status, 2);
  assert.match(timestamp.stderr, /timestamp/i);
});

test("rejects workspaces inside or containing the tested repository", () => {
  const repo = tempDir("tested-repo-");
  const insideRoot = path.join(repo, "artifacts");
  const inside = run(requiredArgs(insideRoot, ["--tested-repo", repo]));
  assert.equal(inside.status, 2);
  assert.match(inside.stderr, /unsafe/i);

  const existingWorkspace = tempDir("existing-workspace-");
  const nestedRepo = path.join(existingWorkspace, "repo");
  fs.mkdirSync(nestedRepo);
  assert.throws(
    () => assertWorkspaceSafe(existingWorkspace, nestedRepo),
    /unsafe/i
  );
});

test("rejects ancestor-root slug collisions and symlinked overlap", () => {
  const root = tempDir("artifact-parent-");
  const testedRepo = path.join(root, "direct-order");
  fs.mkdirSync(testedRepo);
  const collision = run(requiredArgs(root, ["--tested-repo", testedRepo]));
  assert.equal(collision.status, 2);

  const repo = tempDir("symlink-repo-");
  const realArtifacts = path.join(repo, "artifacts");
  fs.mkdirSync(realArtifacts);
  const linkParent = tempDir("symlink-parent-");
  const linkedRoot = path.join(linkParent, "linked-artifacts");
  fs.symlinkSync(realArtifacts, linkedRoot);
  const symlinked = run(requiredArgs(linkedRoot, ["--tested-repo", repo]));
  assert.equal(symlinked.status, 2);
  assert.match(symlinked.stderr, /unsafe/i);
});

test("uses HOME for the default artifact root", () => {
  const home = tempDir("audit-home-");
  const result = run(
    [
      "--feature",
      "Demo",
      "--mode",
      "rollout",
      "--timestamp",
      "20260715T120000Z",
    ],
    { env: { HOME: home } }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    JSON.parse(result.stdout).workspace,
    path.join(home, "agent-artifacts", "ui-audits", "demo", "20260715T120000Z")
  );
});

test("returns three when initialization fails unexpectedly", async () => {
  let stdout = "";
  let stderr = "";
  const code = await runCli(
    ["--feature", "Demo", "--mode", "focused"],
    {
      initializeWorkspace: async () => {
        throw new Error("filesystem failed");
      },
      stdout: { write: (value) => (stdout += value) },
      stderr: { write: (value) => (stderr += value) },
    }
  );
  assert.equal(code, 3);
  assert.equal(stdout, "");
  assert.match(stderr, /initialization failure/i);
});
