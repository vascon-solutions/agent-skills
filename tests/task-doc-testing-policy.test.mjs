import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("task-doc and delivery-loop resolve one shared testing policy", () => {
  const taskDoc = read("skills", "task-doc", "SKILL.md");
  const deliveryLoop = read("skills", "task-doc-delivery-loop", "SKILL.md");

  assert.match(taskDoc, /references\/default-testing-policy\.md/);
  assert.match(deliveryLoop, /\.\.\/task-doc\/references\/default-testing-policy\.md/);
  assert.match(taskDoc, /repository contract[\s\S]*repository instructions[\s\S]*skill default/i);
  assert.match(deliveryLoop, /repository contract[\s\S]*repository instructions[\s\S]*skill default/i);
  assert.doesNotMatch(deliveryLoop, /test-driven-development/);
  assert.doesNotMatch(deliveryLoop, /tests first for behavior changes/i);
});

test("the shared default keeps permanent tests tied to durable risk", () => {
  const policy = read("skills", "task-doc", "references", "default-testing-policy.md");

  assert.match(policy, /name the risk|risk it protects/i);
  assert.match(policy, /auth[\s\S]*business[\s\S]*API[\s\S]*workflow[\s\S]*error recovery/i);
  assert.match(policy, /presentation[\s\S]*acceptance/i);
  assert.match(policy, /bug fixes[\s\S]*critical/i);
  assert.match(policy, /nearest existing affected test file/i);
});

test("delivery-loop does not outsource advertised validation to git hooks", () => {
  const deliveryLoop = read("skills", "task-doc-delivery-loop", "SKILL.md");

  assert.match(deliveryLoop, /run advertised validation[\s\S]*active process/i);
  assert.match(deliveryLoop, /do not assume[\s\S]*hooks/i);
});
