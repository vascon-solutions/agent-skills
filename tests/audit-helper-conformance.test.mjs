import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const skills = [
  { name: "audit-ui", probe: "probe-services.mjs", init: "init-audit-workspace.mjs", dirs: ["screenshots", "logs"] },
  { name: "audit-api", probe: "probe-services.mjs", init: "init-api-audit-workspace.mjs", dirs: ["contracts", "evidence"] },
];

function run(script, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args]); let stdout = ""; let stderr = "";
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk)); child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

for (const skill of skills) {
  test(`${skill.name} helpers satisfy shared runtime contract`, async () => {
    const server = http.createServer((request, response) => response.writeHead(request.url === "/ok" ? 200 : 503).end());
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      const probe = await run(path.join(root, "skills", skill.name, "scripts", skill.probe), ["--service", `required=${base}/ok`, "--optional-service", `optional=${base}/down`]);
      assert.equal(probe.status, 0, probe.stderr);
      assert.equal(probe.stdout.trim().split("\n").length, 1);
      const services = JSON.parse(probe.stdout).services;
      assert.deepEqual(services.map(({ required, reachable }) => ({ required, reachable })), [{ required: true, reachable: true }, { required: false, reachable: false }]);
    } finally { await new Promise((resolve) => server.close(resolve)); }

    const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), `${skill.name}-conformance-`));
    const initArgs = ["--feature", "Shared Feature", "--mode", "focused", "--artifact-root", artifacts, "--timestamp", "20260715T140000Z"];
    const first = await run(path.join(root, "skills", skill.name, "scripts", skill.init), initArgs);
    const second = await run(path.join(root, "skills", skill.name, "scripts", skill.init), initArgs);
    assert.equal(first.status, 0, first.stderr); assert.equal(second.status, 0, second.stderr);
    const one = JSON.parse(first.stdout); const two = JSON.parse(second.stdout);
    assert.equal(one.featureSlug, "shared-feature"); assert.equal(two.workspace, `${one.workspace}-2`);
    for (const dir of skill.dirs) assert.equal(fs.existsSync(path.join(one.workspace, dir)), true, dir);
  });
}
