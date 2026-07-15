import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  executableAvailable,
  executableVersionAtLeast,
  versionAtLeast,
} from "./helpers/executable-available.mjs";

test("detects present and absent executables without throwing", () => {
  assert.equal(executableAvailable(process.execPath), true);
  assert.equal(
    executableAvailable("definitely-not-an-agent-skills-command", {
      ...process.env,
      PATH: path.dirname(process.execPath),
    }),
    false
  );
});

test("compares semantic versions numerically", () => {
  assert.equal(versionAtLeast("hurl 6.1.0", "6.1.0"), true);
  assert.equal(versionAtLeast("hurl 6.0.9", "6.1.0"), false);
  assert.equal(versionAtLeast("hurl 10.0.0", "6.1.0"), true);
  assert.equal(versionAtLeast("not a version", "6.1.0"), false);
});

test("requires an executable to report the minimum version", () => {
  assert.equal(executableVersionAtLeast(process.execPath, process.versions.node), true);
  assert.equal(
    executableVersionAtLeast("definitely-not-an-agent-skills-command", "6.1.0", {
      ...process.env,
      PATH: path.dirname(process.execPath),
    }),
    false
  );
});
