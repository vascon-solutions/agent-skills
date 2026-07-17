import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const skillNames = fs
  .readdirSync(path.join(root, "skills"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

test("retired skills are gone from skills/ and unlinked by the link script", () => {
  const retired = ["task-first-implementation", "scaffold-repo-skill"];
  const linker = read("bin", "link-skills.sh");
  const deprecatedBlock = linker.split("DEPRECATED_SKILL_NAMES=")[1].split('"')[1];
  for (const name of retired) {
    assert.ok(!skillNames.includes(name), `${name} should be deleted`);
    assert.match(deprecatedBlock, new RegExp(`^${name}$`, "m"));
  }
});

test("link script preserves copied retired skills and tells users to remove them manually", () => {
  const temporaryHome = fs.mkdtempSync(path.join(os.tmpdir(), "agent-skills-portability-"));
  const copiedSkill = path.join(temporaryHome, ".codex", "skills", "scaffold-repo-skill");
  fs.mkdirSync(copiedSkill, { recursive: true });

  try {
    const result = spawnSync("sh", ["bin/link-skills.sh", root], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, HOME: temporaryHome },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.statSync(copiedSkill).isDirectory(), "copied skill should be preserved");
    assert.match(result.stderr, /scaffold-repo-skill is deprecated but was not removed because it is not a symlink/);
    assert.match(result.stderr, /Remove or rename it manually/);
  } finally {
    fs.rmSync(temporaryHome, { recursive: true, force: true });
  }
});

test("no active skill references retired skills", () => {
  for (const name of skillNames) {
    const skill = read("skills", name, "SKILL.md");
    assert.doesNotMatch(skill, /task-first-implementation|scaffold-repo-skill/, `${name} references a retired skill`);
  }
});

test("external Superpowers skills are referenced only as optional", () => {
  const externals = [
    "receiving-code-review",
    "requesting-code-review",
    "executing-plans",
    "test-driven-development",
    "systematic-debugging",
    "verification-before-completion",
    "writing-plans",
  ];
  for (const name of skillNames) {
    const skill = read("skills", name, "SKILL.md");
    for (const external of externals) {
      for (const line of skill.split("\n")) {
        if (!line.includes(`\`${external}\``)) continue;
        assert.match(line, /if installed|if available|optional/i, `${name} hard-depends on ${external}: ${line.trim()}`);
      }
    }
  }
});

test("repo-skill-scan resolves locations instead of hardcoding them", () => {
  const skill = read("skills", "repo-skill-scan", "SKILL.md");
  const reference = read("skills", "repo-skill-scan", "references", "scaffolding.md");
  assert.match(skill, /active_pack_root/);
  assert.match(skill, /detected_skill_dir/);
  assert.match(skill, /detected_command_dir/);
  assert.match(skill, /For a copied install, do not assume `~\/agent-skills`/);
  assert.match(skill, /ask the user to select the pack/);
  assert.match(skill, /active_pack_root\/bin\/link-skills\.sh/);
  assert.doesNotMatch(reference, /\.agents\/commands\/<name>/, "scaffolding reference hardcodes .agents/commands");
  assert.match(reference, /If the detected command convention has a link script/);
  assert.match(reference, /active_pack_root\/bin\/link-skills\.sh/);
});

test("task-doc-intake hands off to task-doc with authoritative classification", () => {
  const intake = read("skills", "task-doc-intake", "SKILL.md");
  const taskDoc = read("skills", "task-doc", "SKILL.md");
  assert.match(intake, /^description: Use when /m, "intake description should be trigger-form");
  assert.match(intake, /classification is authoritative/);
  assert.match(intake, /HARD-GATE/);
  assert.match(taskDoc, /task-doc-intake/, "task-doc should accept the intake handoff");
  assert.doesNotMatch(intake, /`brainstorming` (is|as) (required|the canonical)/);
});

test("delivery loop documents its GitHub scope with a local fallback", () => {
  const loop = read("skills", "task-doc-delivery-loop", "SKILL.md");
  const metadata = read("skills", "task-doc-delivery-loop", "agents", "openai.yaml");
  assert.match(loop, /draft PR/);
  assert.match(loop, /no remote|non-GitHub/i);
  assert.match(loop, /verified local completion/);
  assert.match(metadata, /draft PR/);
  assert.doesNotMatch(metadata, /ready PR/);
});

test("the pack authoring checklist invokes the current checkout linker", () => {
  const readme = read("README.md");
  const checklist = readme.split("## How To Add a Skill")[1].split("## Contributing")[0];
  assert.match(checklist, /\.\/bin\/link-skills\.sh/);
  assert.doesNotMatch(checklist, /~\/agent-skills\/bin\/link-skills\.sh/);
});

test("publish-branch defaults to inline execution", () => {
  const publish = read("skills", "publish-branch", "SKILL.md");
  assert.match(publish, /inline by default|publish path inline/i);
  assert.doesNotMatch(publish, /Use one mutation-capable worker subagent by default/);
});

test("link script lists every skill directory exactly once", () => {
  const linker = read("bin", "link-skills.sh");
  const activeBlock = linker.split("SKILL_NAMES=")[1].split('"')[1];
  const listed = activeBlock.split("\n").map((line) => line.trim()).filter(Boolean);
  assert.deepEqual([...listed].sort(), [...skillNames].sort(), "SKILL_NAMES must match skills/ directories");
  assert.equal(new Set(listed).size, listed.length, "duplicate entries in SKILL_NAMES");
});
