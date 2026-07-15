import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { executableAvailable } from "./helpers/executable-available.mjs";

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
