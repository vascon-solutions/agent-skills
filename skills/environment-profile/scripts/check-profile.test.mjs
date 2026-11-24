import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { REQUIRED_SECTIONS, checkProfile, findSecretLike, main, scanFolder } from "./check-profile.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const template = fs.readFileSync(path.join(here, "..", "templates", "environment-profile.md"), "utf8");
const today = new Date("2030-01-15T12:00:00Z");

function profile({ front = {}, sections = REQUIRED_SECTIONS, extra = "" } = {}) {
  const fields = {
    "env-profile": "1",
    project: "demo-app",
    environment: "dev",
    classification: "test",
    "last-verified": "2030-01-14",
    "verified-by": "audit run 2030-01-14",
    ...front,
  };
  const head = Object.entries(fields)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  const body = sections.map((section) => `## ${section}\n\nNone.\n`).join("\n");
  return `---\n${head}\n---\n\n# Demo DEV profile\n\n${body}\n${extra}\n`;
}

const rules = (result) => result.errors.map((error) => error.rule);

test("a complete profile with references only passes", () => {
  const extra = [
    "| Member | member@example.test | web | checkout | local-file: memberPassword |",
    'PW="$(jq -er .staffPassword ~/.config/demo-app/dev.json)"',
    "Mail sandbox: https://mail.example.test (basic auth, keys `mailUser` and `mail_password`)",
    "Sign in with the password from `local-file: staffPassword`.",
    "export SEED_MEMBER_PASSWORD=\"$(jq -r .memberPassword ~/.config/demo-app/dev.json)\"",
    `TOKEN="$(jq '{email: "staff@example.test", password: .staffPassword, portal: "staff"}' ~/.config/demo-app/dev.json)"`,
    "Pipe the password with `--password-stdin`. Mail takes basic auth with `curl -K -`.",
    "The session lasts `ACCESS_TOKEN_TTL=3600` seconds.",
    "| Persona | Password |\n| --- | --- |\n| staff | local-file: staffPassword |",
  ].join("\n");
  const result = checkProfile(profile({ extra }), { today });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test("missing or reordered sections fail", () => {
  const missing = checkProfile(profile({ sections: REQUIRED_SECTIONS.filter((s) => s !== "Sessions") }), { today });
  assert.ok(missing.errors.some((error) => /Sessions/.test(error.message)));
  const swapped = [...REQUIRED_SECTIONS];
  [swapped[1], swapped[2]] = [swapped[2], swapped[1]];
  const reordered = checkProfile(profile({ sections: swapped }), { today });
  assert.ok(reordered.errors.some((error) => /out of order/.test(error.message)));
});

test("numbered headings still count as the required sections", () => {
  const numbered = REQUIRED_SECTIONS.map((section, index) => `${index + 1}. ${section}`);
  assert.deepEqual(checkProfile(profile({ sections: numbered }), { today }).errors, []);
});

test("production and unknown classifications are refused", () => {
  assert.ok(rules(checkProfile(profile({ front: { classification: "production" } }), { today })).includes("production"));
  assert.ok(rules(checkProfile(profile({ front: { environment: "prod" } }), { today })).includes("production"));
  assert.ok(rules(checkProfile(profile({ front: { classification: "live" } }), { today })).includes("front-matter"));
});

test("placeholders and stale verification are reported", () => {
  assert.ok(rules(checkProfile(profile({ front: { project: "<project-slug>" } }), { today })).includes("front-matter"));
  const stale = checkProfile(profile({ front: { "last-verified": "2029-10-01" } }), { today });
  assert.deepEqual(stale.errors, []);
  assert.equal(stale.warnings[0].rule, "stale");
  for (const unusable of ["2030-03-01", "2030-13-45"]) {
    const result = checkProfile(profile({ front: { "last-verified": unusable } }), { today });
    assert.ok(rules(result).includes("front-matter"), `${unusable} accepted`);
  }
});

test("secret-looking values are rejected without echoing them", () => {
  const cases = [
    ["credential-literal", "The member password is `Tr0ub4dor-Example`."],
    ["credential-literal", '{"email": "staff@example.test", "password": "Tr0ub4dor-Example"}'],
    ["url-credentials", "Open https://mailer:Tr0ub4dor-Example@mail.example.test/ to read mail."],
    ["jwt", "Token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJlLXZhbHVl"],
    ["bearer-token", "Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345"],
    ["credential-assignment", "SEED_MEMBER_PASSWORD=Tr0ub4dor-Example"],
    ["credential-assignment", 'export APP_PASSWORD="Tr0ub4dor-Example"'],
    ["credential-plain", "- Password: Tr0ub4dor-Example"],
    ["credential-column", "| Persona | Password |\n| --- | --- |\n| staff | Tr0ub4dor-Example |"],
    ["query-secret", "https://app.example.test/verify?token=abcdef0123456789"],
  ];
  for (const [rule, line] of cases) {
    const result = checkProfile(profile({ extra: line }), { today });
    assert.ok(rules(result).includes(rule), `${rule} not detected`);
    assert.ok(result.errors.every((error) => !error.message.includes("Tr0ub4dor")));
  }
});

test("placeholder credentials in URLs and plain http to localhost are allowed", () => {
  const extra = "https://<user>:<pass>@mail.example.test is never used; local runs use http://localhost:8025 or http://[::1]:8025.";
  assert.deepEqual(checkProfile(profile({ extra }), { today }).errors, []);
  assert.ok(rules(checkProfile(profile({ extra: "API: http://api.example.test" }), { today })).includes("https"));
});

test("the shipped template has every section and nothing secret-like", () => {
  assert.deepEqual(findSecretLike(template), []);
  const result = checkProfile(template, { today });
  assert.ok(result.errors.every((error) => error.rule === "front-matter"), JSON.stringify(result.errors));
});

test("scan counts credential values by key name and never prints them", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "env-profile-scan-"));
  const valuesFile = path.join(dir, "..", `${path.basename(dir)}-values.json`);
  try {
    const secret = "Tr0ub4dor&Example";
    const basicHeader = Buffer.from(`mailer:${secret}`).toString("base64");
    fs.mkdirSync(path.join(dir, ".playwright-cli"));
    fs.writeFileSync(path.join(dir, ".playwright-cli", "snap.yml"), `textbox "Password": ${secret}\n`);
    fs.writeFileSync(path.join(dir, "console.log"), `GET https://mail.example.test/?p=${encodeURIComponent(secret)}\n`);
    fs.writeFileSync(path.join(dir, "requests.log"), `Authorization: Basic ${basicHeader}\n`);
    fs.writeFileSync(path.join(dir, "report.md"), "clean\n");
    fs.writeFileSync(valuesFile, JSON.stringify({ memberPassword: secret, staffPassword: "password", mailUser: "mailer" }));

    const { findings, skipped } = scanFolder(dir, JSON.parse(fs.readFileSync(valuesFile, "utf8")));
    assert.deepEqual(
      findings.map((finding) => [finding.file, finding.key]).sort(),
      [
        [".playwright-cli/snap.yml", "memberPassword"],
        ["console.log", "memberPassword"],
        ["requests.log", "basic-auth:mailUser+memberPassword"],
      ],
    );
    assert.deepEqual(skipped, ["staffPassword", "mailUser"]);

    const lines = [];
    const sink = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
    assert.equal(main(["scan", dir, "--values", valuesFile], sink), 1);
    for (const form of [secret, encodeURIComponent(secret), basicHeader]) {
      assert.ok(lines.every((line) => !line.includes(form)));
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(valuesFile, { force: true });
  }
});

test("profile mode flags a known credential value by key", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "env-profile-values-"));
  try {
    const file = path.join(dir, "dev.md");
    const valuesFile = path.join(dir, "values.json");
    fs.writeFileSync(file, profile({ extra: "Mail login note: Zebra-Example-42" }));
    fs.writeFileSync(valuesFile, JSON.stringify({ note: "demo", created: "2030-01-14", mailPassword: "Zebra-Example-42" }));
    const lines = [];
    const sink = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
    assert.equal(main(["profile", file, "--values", valuesFile], sink), 1);
    assert.ok(lines.some((line) => /credential-value: contains the value of key mailPassword/.test(line)));
    assert.ok(lines.every((line) => !line.includes("Zebra-Example-42")));
    assert.ok(lines.every((line) => !/key (note|created)/.test(line)), "metadata keys are not credentials");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a malformed credentials file is reported without quoting its content", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "env-profile-malformed-"));
  try {
    const valuesFile = path.join(dir, "values.json");
    fs.writeFileSync(valuesFile, '{"mailPassword": Zebra-Example-42}');
    const lines = [];
    const sink = { log: (line) => lines.push(line), error: (line) => lines.push(line) };
    assert.equal(main(["scan", dir, "--values", valuesFile], sink), 2);
    assert.ok(lines.length > 0);
    assert.ok(lines.every((line) => !line.includes("Zebra")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
