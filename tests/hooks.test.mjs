import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { decide } from "../hooks/block-whole-tree-fixers.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const hook = path.join(root, "hooks", "block-whole-tree-fixers.mjs");

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-hooks-"));
  const write = (relative, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, relative)), { recursive: true });
    fs.writeFileSync(path.join(dir, relative), text);
  };
  write("with-agent/package.json", JSON.stringify({ scripts: { "agent:fix": "node tools/agent-scripts.mjs fix", fix: "ultracite fix", format: "biome format --write .", "lint:fix": "eslint --fix src", "fix:file": "ultracite fix src/a.ts", chain: "pnpm fix", check: "biome check ." } }));
  write("with-agent/src/a.ts", "export const a = 1;\n");
  write("with-agent/apps/web/src/b.ts", "export const b = 1;\n");
  write("plain/package.json", JSON.stringify({ scripts: { fix: "ultracite fix", "lint:fix": "eslint \"{src,apps}/**/*.ts\" --fix" } }));
  write("plain/src/a.ts", "export const a = 1;\n");
  return dir;
}

const run = (command, cwd) => decide({ tool_name: "Bash", tool_input: { command }, cwd });

test("the hook denies whole-tree fixer invocations and allows path-scoped or unparseable ones", () => {
  const dir = fixture();
  const agent = path.join(dir, "with-agent");
  const plain = path.join(dir, "plain");
  try {
    const denied = [
      ["ultracite fix", agent],
      ["pnpm exec ultracite fix", agent],
      ["pnpm dlx ultracite fix", agent],
      ["npx ultracite fix", agent],
      ["npx -y ultracite@latest fix --unsafe", agent],
      ["FOO=1 BAR=2 pnpm exec ultracite fix", agent],
      ["env CI=1 ultracite fix", agent],
      ["ultracite fix .", agent],
      ["biome check --write", agent],
      ["biome format --write .", agent],
      ["biome lint --fix src apps", agent],
      ["pnpm exec biome check --write --reporter json", agent],
      ["npx @biomejs/biome check --write .", agent],
      ["./node_modules/.bin/biome check --write src", agent],
      ["eslint --fix", agent],
      ["eslint --fix src", agent],
      ["eslint 'src/**/*.ts' --fix", agent],
      ["prettier --write .", agent],
      ["prettier -w 'src/**/*.ts'", agent],
      ["prettier --write src --print-width 100", agent],
      ["pnpm fix", agent],
      ["pnpm run fix", agent],
      ["pnpm format", agent],
      ["pnpm lint:fix", agent],
      ["pnpm chain", agent],
      ["cd with-agent && pnpm fix", dir],
      ["cd with-agent; ultracite fix src", dir],
      ["git status && pnpm exec ultracite fix 2>&1 | tail -20", agent],
      ["echo start; biome check --write .", agent],
      ["pnpm -C with-agent fix", dir],
      ["pnpm fix", plain],
      ["pnpm lint:fix", plain],
    ];
    for (const [command, cwd] of denied) {
      const output = run(command, cwd);
      assert.equal(output?.hookSpecificOutput?.permissionDecision, "deny", `${command} in ${path.relative(dir, cwd) || "."}`);
      assert.equal(output.hookSpecificOutput.hookEventName, "PreToolUse");
    }
    const allowed = [
      ["ultracite fix src/a.ts", agent],
      ["pnpm exec ultracite fix src/a.ts apps/web/src/b.ts", agent],
      ["biome check --write src/a.ts", agent],
      ["biome check --write --changed", agent],
      ["biome check --write --staged", agent],
      ["biome check .", agent],
      ["pnpm check", agent],
      ["eslint --fix src/a.ts", agent],
      ["eslint src", agent],
      ["prettier --write src/a.ts", agent],
      ["prettier --check .", agent],
      ["pnpm fix:file", agent],
      ["pnpm fix src/a.ts", agent],
      ["pnpm fix -- src/a.ts", agent],
      ["pnpm agent:fix", agent],
      ["pnpm install", agent],
      ["pnpm --filter web fix", agent],
      ["bash -c 'ultracite fix'", agent],
      ["sh -c \"pnpm fix\"", agent],
      ["eval ultracite fix", agent],
      ["(cd src && ultracite fix)", agent],
      ["echo $(ultracite fix)", agent],
      ["cat <<EOF\nultracite fix\nEOF", agent],
      ["git commit -m 'ultracite fix'", agent],
      ["echo ultracite fix", agent],
      ["rg -n 'biome check --write .' docs", agent],
    ];
    for (const [command, cwd] of allowed) assert.equal(run(command, cwd), null, `${command} should be allowed`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the deny reason points at agent:fix only where the resolved package.json defines it", () => {
  const dir = fixture();
  try {
    const withAgent = run("ultracite fix", path.join(dir, "with-agent")).hookSpecificOutput.permissionDecisionReason;
    assert.match(withAgent, /`pnpm agent:fix`/);
    const plain = run("ultracite fix", path.join(dir, "plain")).hookSpecificOutput.permissionDecisionReason;
    assert.doesNotMatch(plain, /agent:fix/);
    assert.match(plain, /explicit changed paths/);
    const nested = run("pnpm fix", path.join(dir, "with-agent", "apps", "web")).hookSpecificOutput.permissionDecisionReason;
    assert.match(nested, /`pnpm agent:fix`/);
    for (const command of ["cd with-agent && pnpm exec ultracite fix", "pnpm -C with-agent fix"]) {
      assert.match(run(command, dir).hookSpecificOutput.permissionDecisionReason, /`pnpm agent:fix`/, command);
    }
    assert.match(run("cd ../plain && ultracite fix", path.join(dir, "with-agent")).hookSpecificOutput.permissionDecisionReason, /explicit changed paths/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the hook reads Claude Code PreToolUse JSON on stdin and fails open on other input", () => {
  const dir = fixture();
  try {
    const invoke = (input) => spawnSync(process.execPath, [hook], { input, encoding: "utf8" });
    const denied = invoke(JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "pnpm exec ultracite fix" }, cwd: path.join(dir, "with-agent") }));
    assert.equal(denied.status, 0, denied.stderr);
    assert.deepEqual(Object.keys(JSON.parse(denied.stdout).hookSpecificOutput).sort(), ["hookEventName", "permissionDecision", "permissionDecisionReason"]);
    for (const input of [
      JSON.stringify({ tool_name: "Bash", tool_input: { command: "ultracite fix src/a.ts" }, cwd: path.join(dir, "with-agent") }),
      JSON.stringify({ tool_name: "Edit", tool_input: { file_path: "x" }, cwd: dir }),
      "not json",
    ]) {
      const result = invoke(input);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, "");
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
