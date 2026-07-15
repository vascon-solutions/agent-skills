import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { startApiAuditFixture } from "./fixtures/api-audit-fixture.mjs";

const contracts = path.resolve(new URL("./fixtures/contracts", import.meta.url).pathname);

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, options); let stdout = ""; let stderr = "";
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk)); child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

test("contract forward-test fixtures have paired bounded inventories", () => {
  for (const stem of ["swagger-2", "openapi-3", "openapi-3.1", "unresolved-external-ref"]) {
    const source = [".json", ".yaml"].map((ext) => path.join(contracts, `${stem}${ext}`)).find(fs.existsSync);
    assert.ok(source, stem);
    const expected = JSON.parse(fs.readFileSync(path.join(contracts, `${stem}.expected.json`), "utf8"));
    assert.ok(["2.0", "3.0.3", "3.1.0"].includes(expected.version));
    assert.ok(Array.isArray(expected.operations));
    assert.ok(Array.isArray(expected.unresolvedReferences));
  }
});

test("Hurl runs a sequential redacted create-to-retrieve journey", async () => {
  const fixture = await startApiAuditFixture();
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "audit-hurl-"));
  const scenario = path.join(workspace, "journey.hurl");
  const content = `POST {{base_url}}/login\nContent-Type: application/json\n\n{"actor":"auditor"}\nHTTP 200\n[Captures]\ntoken: jsonpath "$.token" redact\n\nPOST {{base_url}}/items\nAuthorization: Bearer {{token}}\nIdempotency-Key: stable-create-1\nContent-Type: application/json\n\n{"name":"audit item"}\nHTTP 201\n[Captures]\nitem_id: jsonpath "$.id"\n\nGET {{base_url}}/items/{{item_id}}\nAuthorization: Bearer {{token}}\nHTTP 200\n[Asserts]\njsonpath "$.name" == "audit item"\n\nPOST {{base_url}}/items\nAuthorization: Bearer {{token}}\nContent-Type: application/json\n\n{}\nHTTP 422\n`;
  fs.writeFileSync(scenario, content, { mode: 0o600 });
  try {
    const result = await runCommand("hurl", ["--test", "--jobs", "1", "--no-output", "--variable", `base_url=${fixture.baseUrl}`, scenario], { cwd: workspace });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    for (const text of [result.stdout, result.stderr, fs.readFileSync(scenario, "utf8")]) assert.doesNotMatch(text, new RegExp(fixture.token));
    assert.equal(fixture.createdCount("stable-create-1"), 1);
  } finally { await fixture.close(); }
});

test("fixture supports polling, transient safe reads, and idempotent reconciliation", async () => {
  const fixture = await startApiAuditFixture();
  try {
    const headers = { authorization: `Bearer ${fixture.token}`, "content-type": "application/json", "idempotency-key": "reconcile-1" };
    const first = await fetch(`${fixture.baseUrl}/items`, { method: "POST", headers, body: '{"name":"once"}' });
    const second = await fetch(`${fixture.baseUrl}/items`, { method: "POST", headers, body: '{"name":"once"}' });
    assert.equal((await first.json()).id, (await second.json()).id);
    assert.equal(fixture.createdCount("reconcile-1"), 1);

    const job = await fetch(`${fixture.baseUrl}/jobs`, { method: "POST", headers, body: "{}" });
    const location = job.headers.get("location");
    assert.equal((await fetch(`${fixture.baseUrl}${location}`, { headers })).status, 202);
    assert.equal((await fetch(`${fixture.baseUrl}${location}`, { headers })).status, 200);
    assert.equal((await fetch(`${fixture.baseUrl}/transient`, { headers })).status, 503);
    assert.equal((await fetch(`${fixture.baseUrl}/transient`, { headers })).status, 200);
  } finally { await fixture.close(); }
});

test("curl fallback starts hardened, avoids redirects, and keeps secrets out of argv", async () => {
  const fixture = await startApiAuditFixture();
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-curl-"));
  const config = path.join(configDir, "request.conf");
  fs.writeFileSync(config, `header = "Authorization: Bearer ${fixture.token}"\n`, { mode: 0o600 });
  const args = ["--disable", "--proto", "=http,https", "--proto-redir", "=http,https", "--config", config, "--silent", "--show-error", "--output", "/dev/null", "--write-out", "%{http_code}", `${fixture.baseUrl}/redirect/same`];
  try {
    assert.equal(args[0], "--disable"); assert.equal(args.includes("--location"), false);
    assert.doesNotMatch(args.join(" "), new RegExp(fixture.token));
    const result = await runCommand("curl", args);
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, "302");
  } finally { await fixture.close(); fs.rmSync(configDir, { recursive: true, force: true }); }
});
