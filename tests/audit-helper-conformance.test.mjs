import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const skills = [
  { name: "audit-ui", probe: "probe-services.mjs", init: "init-audit-workspace.mjs", dirs: ["screenshots", "logs"], crossOriginReachable: true },
  { name: "audit-api", probe: "probe-services.mjs", init: "init-api-audit-workspace.mjs", dirs: ["contracts", "evidence"], crossOriginReachable: false },
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

    // Neither probe may contact a cross-origin redirect target. The UI probe
    // counts the originating 3xx as reachable; the API probe rejects the hop.
    let redirectedRequests = 0;
    const other = http.createServer((_request, response) => {
      redirectedRequests += 1;
      response.writeHead(200).end();
    });
    await new Promise((resolve) => other.listen(0, "127.0.0.1", resolve));
    const otherBase = `http://127.0.0.1:${other.address().port}`;
    const redirector = http.createServer((request, response) => response.writeHead(302, { location: `${otherBase}/ok` }).end());
    await new Promise((resolve) => redirector.listen(0, "127.0.0.1", resolve));
    const redirectBase = `http://127.0.0.1:${redirector.address().port}`;
    try {
      const crossOrigin = await run(path.join(root, "skills", skill.name, "scripts", skill.probe), ["--service", `app=${redirectBase}/redirect`]);
      assert.equal(crossOrigin.status, skill.crossOriginReachable ? 0 : 1, crossOrigin.stderr);
      assert.equal(JSON.parse(crossOrigin.stdout).services[0].reachable, skill.crossOriginReachable);
      assert.equal(redirectedRequests, 0);
    } finally {
      await new Promise((resolve) => redirector.close(resolve));
      await new Promise((resolve) => other.close(resolve));
    }

    const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), `${skill.name}-conformance-`));
    const initArgs = ["--feature", "Shared Feature", "--mode", "focused", "--artifact-root", artifacts, "--timestamp", "20260715T140000Z"];
    const first = await run(path.join(root, "skills", skill.name, "scripts", skill.init), initArgs);
    const second = await run(path.join(root, "skills", skill.name, "scripts", skill.init), initArgs);
    assert.equal(first.status, 0, first.stderr); assert.equal(second.status, 0, second.stderr);
    const one = JSON.parse(first.stdout); const two = JSON.parse(second.stdout);
    assert.equal(one.featureSlug, "shared-feature"); assert.equal(two.workspace, `${one.workspace}-2`);
    for (const dir of skill.dirs) assert.equal(fs.existsSync(path.join(one.workspace, dir)), true, dir);

    const concurrentArgs = ["--feature", "Concurrent Feature", "--mode", "focused", "--artifact-root", artifacts, "--timestamp", "20260715T150000Z"];
    const concurrent = await Promise.all(Array.from({ length: 8 }, () => run(path.join(root, "skills", skill.name, "scripts", skill.init), concurrentArgs)));
    assert.equal(concurrent.every(({ status }) => status === 0), true, concurrent.map(({ stderr }) => stderr).join("\n"));
    const workspaces = concurrent.map(({ stdout }) => JSON.parse(stdout).workspace);
    assert.equal(new Set(workspaces).size, concurrent.length);
    for (const workspace of workspaces) {
      assert.equal(fs.existsSync(path.join(workspace, "audit-brief.md")), true);
      assert.equal(fs.existsSync(path.join(workspace, "report.md")), true);
    }

    const symlinkParent = fs.mkdtempSync(path.join(os.tmpdir(), `${skill.name}-symlink-`));
    const linkedSkill = path.join(symlinkParent, skill.name);
    fs.symlinkSync(path.join(root, "skills", skill.name), linkedSkill);
    const linkedServer = http.createServer((_request, response) => response.writeHead(200).end());
    await new Promise((resolve) => linkedServer.listen(0, "127.0.0.1", resolve));
    try {
      const linkedBase = `http://127.0.0.1:${linkedServer.address().port}`;
      const linkedProbe = await run(path.join(linkedSkill, "scripts", skill.probe), ["--service", `app=${linkedBase}/ok`]);
      assert.equal(linkedProbe.status, 0, linkedProbe.stderr);
      assert.equal(JSON.parse(linkedProbe.stdout).ok, true);
    } finally {
      await new Promise((resolve) => linkedServer.close(resolve));
    }
    const linkedInit = await run(path.join(linkedSkill, "scripts", skill.init), ["--feature", "Linked Feature", "--mode", "focused", "--artifact-root", artifacts, "--timestamp", "20260715T160000Z"]);
    assert.equal(linkedInit.status, 0, linkedInit.stderr);
    assert.equal(JSON.parse(linkedInit.stdout).featureSlug, "linked-feature");
  });
}
