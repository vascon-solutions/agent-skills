import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("API verdict, severity, and production policy match the approved contract", () => {
  const skill = read("skills", "audit-api", "SKILL.md");
  const evidence = read("skills", "audit-api", "references", "evidence-and-verdicts.md");
  const report = read("skills", "audit-api", "assets", "templates", "report.md");
  assert.match(skill, /Production is semantic read-only/);
  assert.match(skill, /selected endpoint surface/);
  assert.match(skill, /focused and journey modes add one safe, useful risk-based negative case/);
  const verdicts = ["`FAIL`", "`PASS`", "`BLOCKED`", "`PARTIAL`"];
  for (let index = 1; index < verdicts.length; index += 1) {
    assert.ok(evidence.indexOf(verdicts[index - 1]) < evidence.indexOf(verdicts[index]));
  }
  assert.doesNotMatch(evidence, /PASS WITH CONCERNS|`critical`|`high`|`medium`|`low`/);
  for (const severity of ["blocker", "major", "moderate", "minor"]) assert.match(evidence, new RegExp("`" + severity + "`"));
  assert.match(report, /PASS \| PARTIAL \| BLOCKED \| FAIL/);
});

test("both skills require controllable service lifecycle and cleanup", () => {
  for (const name of ["audit-ui", "audit-api"]) {
    const skill = read("skills", name, "SKILL.md");
    for (const phrase of ["pre-existing", "foreground", "re-probe", "pkill", "BLOCKED", "interruption cleanup"]) {
      assert.match(skill, new RegExp(phrase, "i"), `${name}: ${phrase}`);
    }
  }
});

test("Hurl guidance uses non-argv static secrets", () => {
  const hurl = read("skills", "audit-api", "references", "hurl-execution.md");
  assert.match(hurl, /HURL_SECRET_actor_password/);
  assert.match(hurl, /0600/);
  assert.doesNotMatch(hurl, /--secret actor_password/);
});
