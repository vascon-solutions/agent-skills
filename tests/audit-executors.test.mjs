import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { startApiAuditFixture } from "./fixtures/api-audit-fixture.mjs";
import { executableVersionAtLeast } from "./helpers/executable-available.mjs";

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
    for (const operation of expected.operations) {
      assert.equal(typeof operation.method, "string");
      assert.equal(typeof operation.path, "string");
      assert.equal(Object.hasOwn(operation, "effectiveServer"), true);
      assert.deepEqual(Object.keys(operation.request).sort(), ["contentTypes", "schema"]);
      assert.ok(operation.responses.length > 0);
      for (const response of operation.responses) {
        assert.deepEqual(Object.keys(response).sort(), ["contentTypes", "schema", "status"]);
      }
    }
  }
});

test("Hurl runs a sequential redacted create-to-retrieve journey", {
  skip: executableVersionAtLeast("hurl", "6.1.0")
    ? false
    : "Hurl 6.1 or newer is unavailable; curl fallback coverage remains active.",
}, async () => {
  const fixture = await startApiAuditFixture();
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "audit-hurl-"));
  const scenario = path.join(workspace, "journey.hurl");
  const content = `POST {{base_url}}/login\nX-Audit-Secret: {{actor_password}}\nContent-Type: application/json\n\n{"actor":"auditor"}\nHTTP 200\n[Captures]\ntoken: jsonpath "$.token" redact\n\nPOST {{base_url}}/items\nAuthorization: Bearer {{token}}\nIdempotency-Key: stable-create-1\nContent-Type: application/json\n\n{"name":"audit item"}\nHTTP 201\n[Captures]\nitem_id: jsonpath "$.id"\n\nGET {{base_url}}/items/{{item_id}}\nAuthorization: Bearer {{token}}\nHTTP 200\n[Asserts]\njsonpath "$.name" == "audit item"\n\nPOST {{base_url}}/items\nAuthorization: Bearer {{token}}\nContent-Type: application/json\n\n{}\nHTTP 422\n`;
  fs.writeFileSync(scenario, content, { mode: 0o600 });
  try {
    const args = ["--test", "--jobs", "1", "--no-output", "--variable", `base_url=${fixture.baseUrl}`, scenario];
    assert.doesNotMatch(args.join(" "), new RegExp(fixture.staticSecret));
    const result = await runCommand("hurl", args, { cwd: workspace, env: { ...process.env, HURL_SECRET_actor_password: fixture.staticSecret } });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    for (const file of fs.readdirSync(workspace)) {
      const filePath = path.join(workspace, file);
      if (fs.statSync(filePath).isFile()) {
        const durable = fs.readFileSync(filePath, "utf8");
        assert.doesNotMatch(durable, new RegExp(fixture.token));
        assert.doesNotMatch(durable, new RegExp(fixture.staticSecret));
      }
    }
    for (const text of [result.stdout, result.stderr]) {
      assert.doesNotMatch(text, new RegExp(fixture.token));
      assert.doesNotMatch(text, new RegExp(fixture.staticSecret));
    }
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

test("curl fallback covers auth, persistence, validation, polling, and reconciliation", async () => {
  const fixture = await startApiAuditFixture();
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "audit-curl-journey-"));
  let sequence = 0;
  const request = async ({ url, method = "GET", configText, body }) => {
    const id = ++sequence;
    const config = path.join(workspace, `${id}.conf`);
    const output = path.join(workspace, `${id}.body`);
    fs.writeFileSync(config, configText, { mode: 0o600 });
    const args = ["--disable", "--proto", "=http,https", "--proto-redir", "=http,https", "--config", config, "--silent", "--show-error", "--output", output, "--write-out", "%{http_code}", "--request", method];
    if (body !== undefined) {
      const bodyFile = path.join(workspace, `${id}.request.json`);
      fs.writeFileSync(bodyFile, body, { mode: 0o600 });
      args.push("--data-binary", `@${bodyFile}`);
    }
    args.push(url);
    assert.equal(args[0], "--disable");
    assert.equal(args.includes("--location"), false);
    assert.doesNotMatch(args.join(" "), new RegExp(fixture.staticSecret));
    assert.doesNotMatch(args.join(" "), new RegExp(fixture.token));
    const result = await runCommand("curl", args);
    assert.equal(result.status, 0, result.stderr);
    return { status: Number(result.stdout), body: JSON.parse(fs.readFileSync(output, "utf8")) };
  };

  try {
    const login = await request({
      url: `${fixture.baseUrl}/login`, method: "POST", body: '{"actor":"auditor"}',
      configText: `header = "X-Audit-Secret: ${fixture.staticSecret}"\nheader = "Content-Type: application/json"\n`,
    });
    assert.equal(login.status, 200); assert.equal(login.body.token, fixture.token);
    const auth = `header = "Authorization: Bearer ${login.body.token}"\nheader = "Content-Type: application/json"\n`;
    const createConfig = `${auth}header = "Idempotency-Key: curl-reconcile-1"\n`;
    const created = await request({ url: `${fixture.baseUrl}/items`, method: "POST", body: '{"name":"curl item"}', configText: createConfig });
    const reconciled = await request({ url: `${fixture.baseUrl}/items`, method: "POST", body: '{"name":"curl item"}', configText: createConfig });
    assert.equal(created.status, 201); assert.equal(reconciled.body.id, created.body.id);
    assert.equal(fixture.createdCount("curl-reconcile-1"), 1);
    const retrieved = await request({ url: `${fixture.baseUrl}/items/${created.body.id}`, configText: auth });
    assert.equal(retrieved.status, 200); assert.equal(retrieved.body.name, "curl item");
    assert.equal((await request({ url: `${fixture.baseUrl}/items`, method: "POST", body: "{}", configText: auth })).status, 422);

    const ambiguousKey = "curl-ambiguous-1";
    const ambiguousConfig = path.join(workspace, "ambiguous.conf");
    const ambiguousBody = path.join(workspace, "ambiguous.request.json");
    fs.writeFileSync(ambiguousConfig, `${auth}header = "Idempotency-Key: ${ambiguousKey}"\n`, { mode: 0o600 });
    fs.writeFileSync(ambiguousBody, '{"name":"ambiguous item"}', { mode: 0o600 });
    const ambiguousArgs = ["--disable", "--proto", "=http,https", "--proto-redir", "=http,https", "--config", ambiguousConfig, "--silent", "--show-error", "--output", path.join(workspace, "ambiguous.body"), "--request", "POST", "--data-binary", `@${ambiguousBody}`, `${fixture.baseUrl}/items/ambiguous`];
    const ambiguous = await runCommand("curl", ambiguousArgs);
    assert.notEqual(ambiguous.status, 0);
    const reconciledAfterAmbiguity = await request({ url: `${fixture.baseUrl}/items/by-key/${ambiguousKey}`, configText: auth });
    assert.equal(reconciledAfterAmbiguity.status, 200);
    assert.equal(reconciledAfterAmbiguity.body.name, "ambiguous item");
    assert.equal(fixture.createdCount(ambiguousKey), 1);

    const job = await request({ url: `${fixture.baseUrl}/jobs`, method: "POST", body: "{}", configText: auth });
    assert.equal(job.status, 202);
    assert.equal((await request({ url: `${fixture.baseUrl}/jobs/${job.body.id}`, configText: auth })).status, 202);
    assert.equal((await request({ url: `${fixture.baseUrl}/jobs/${job.body.id}`, configText: auth })).status, 200);
  } finally {
    await fixture.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  }
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
