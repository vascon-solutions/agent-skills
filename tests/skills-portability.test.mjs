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

test("CI monitoring authorization is read-only by default", () => {
  const readme = read("README.md");

  assert.match(readme, /read-only by default/i);
  assert.match(readme, /\$monitor-ci/);
  assert.match(readme, /Nx Cloud self-healing/i);
  assert.match(readme, /owning distribution[\s\S]*incompatible/i);
});

test("delivery policy is proportional", () => {
  const loop = read("skills", "task-doc-delivery-loop", "SKILL.md");
  const implementation = loop.split("### Checkpoint 2: Focused Implementation")[1].split("### Checkpoint 3: Report-Only Review")[0];
  const review = loop.split("### Checkpoint 3: Report-Only Review")[1].split("### Checkpoint 4: Publish and CI")[0];

  assert.match(loop, /four checkpoints/i);
  assert.match(loop, /exit code zero.*authoritative|first green/i);
  assert.match(loop, /retained log.*before.*rerun/i);
  assert.match(loop, /immutable candidate/i);
  assert.match(loop, /push-only/i);
  assert.match(loop, /monitoring.*explicit/i);
  assert.doesNotMatch(loop, /ready PR[\s\S]*invoke `monitor-pr-review`/i);
  assert.match(loop, /named durable risk|durable-risk/i);
  assert.match(loop, /presentation/i);
  assert.match(loop, /dependency synchronization[\s\S]*does not.*(?:merge|cherry-pick|import)/i);
  assert.match(loop, /CI.*(?:omits|missing)[\s\S]*required local lane|remote.*cannot waive/i);
  assert.match(loop, /complete failure evidence[\s\S]*selected failed job[\s\S]*complete scope/i);
  assert.match(implementation, /stage only intended files[\s\S]*immutable candidate[\s\S]*candidate gate[\s\S]*exact.*OID/i);
  assert.match(review, /replacement.*candidate[\s\S]*invalidat.*evidence[\s\S]*candidate gate/i);
});

test("report-only review consumes validation evidence without execution", () => {
  const review = read("skills", "review-implementation", "SKILL.md");

  assert.match(review, /must not.*tests.*type-checks.*builds.*linters.*installs.*servers.*browsers/i);
  assert.match(review, /consume.*validation evidence/i);
  assert.match(review, /read-only Git.*status.*diff.*log/i);
});

test("one-shot GitHub operations are bounded", () => {
  const address = read("skills", "address-review-findings", "SKILL.md");
  const monitor = read("skills", "monitor-pr-review", "SKILL.md");
  const publish = read("skills", "publish-branch", "SKILL.md");
  const loop = read("skills", "task-doc-delivery-loop", "SKILL.md");
  const loopReviewPrompt = loop.split("## Subagent Review Prompt")[1].split("## Final Report")[0];

  assert.match(address, /one frozen.*batch/i);
  assert.match(address, /one final.*snapshot.*stop/i);
  assert.match(address, /invalid.*unclear.*leave unresolved/i);
  assert.match(monitor, /explicit/i);
  assert.doesNotMatch(loop, /automatically.*monitor-pr-review/i);
  assert.match(publish, /exact.*candidate OID/i);
  assert.match(publish, /must not.*format|push-only/i);
  assert.match(`${address}\n${publish}`, /(?:body-file|file-backed|non-interpolating)[\s\S]*read-back/i);
  assert.match(publish, /candidate_oid/i);
  assert.match(publish, /remote_ref_oid/i);
  assert.match(publish, /candidate mode.*remote ref OID.*candidate OID/i);
  assert.doesNotMatch(loopReviewPrompt, /actionable PR comments/i);
  assert.match(address, /out_of_scope[\s\S]*already_resolved/i);
  assert.match(monitor, /out_of_scope[\s\S]*already_resolved/i);
  assert.match(loop, /out_of_scope[\s\S]*already_resolved/i);
  assert.doesNotMatch(monitor, /`out of scope`|`already resolved`/i);
  assert.match(monitor, /explicit.*watch.*PR review/i);
  assert.match(address, /informational.*leave unresolved/i);
  assert.match(address, /supply.*diff.*validation evidence/i);
  assert.match(loop, /Push, PR[\s\S]*publish-branch[\s\S]*immutable candidate mode/i);
  assert.match(loop, /hand.*candidate OID.*gate evidence.*publish-branch/i);
  for (const skill of [address, monitor, publish]) {
    assert.match(skill, /read-back mismatch.*edit.*existing.*never.*second/i);
  }
});

test("ongoing PR review monitoring is distinct from one-shot remediation", () => {
  const monitor = read("skills", "monitor-pr-review", "SKILL.md");
  const address = read("skills", "address-review-findings", "SKILL.md");
  const loop = read("skills", "task-doc-delivery-loop", "SKILL.md");
  const readme = read("README.md");

  assert.match(monitor, /^description: Use when .*monitoring.*babysitting.*keep watching.*quiet/m);
  assert.match(monitor, /explicitly invoked.*draft PR/i);
  assert.match(monitor, /quiet_complete[\s\S]*not.*review.*finished/i);
  assert.match(address, /^description: Use when a current batch/m);
  assert.match(address, /monitor-pr-review/);
  assert.match(loop, /ready PR does not itself authorize `monitor-pr-review`/i);
  assert.match(loop, /draft PR[\s\S]*explicit/i);
  assert.doesNotMatch(`${monitor}\n${readme}`, /task-doc-delivery-loop.*delegates automatically/i);
});

test("PR review monitoring preserves lifecycle safety contracts", () => {
  const monitor = read("skills", "monitor-pr-review", "SKILL.md");
  const loop = read("skills", "task-doc-delivery-loop", "SKILL.md");
  const publishSection = monitor.split("## Publish, Reply, Resolve")[1].split("## Quiet Window")[0];

  assert.match(monitor, /current session[\s\S]*Do not delegate/i);
  assert.match(monitor, /handled substantive review event[\s\S]*pushed remediation commit/i);
  assert.match(monitor, /final complete snapshot[\s\S]*resets the window/i);
  assert.match(publishSection, /reply succeeds[\s\S]*resolve/i);
  assert.match(publishSection, /reply_sent: true[\s\S]*retry only resolution[\s\S]*never duplicate/i);
  assert.match(monitor, /quiet_complete/);
  assert.match(monitor, /waiting_for_reviewer/);
  assert.match(monitor, /waiting_for_user/);
  assert.match(monitor, /blocked/);
  assert.match(monitor, /externally_terminated/);
  assert.match(loop, /quiet_complete[\s\S]*waiting_for_reviewer[\s\S]*waiting_for_user[\s\S]*blocked[\s\S]*externally_terminated/);
  assert.match(monitor, /pr_url:/);
  assert.match(monitor, /pr_is_draft:/);
  assert.match(monitor, /cycle_count:/);
  assert.match(monitor, /monitor start time[\s\S]*final activity checkpoint/i);
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

test("GitHub issue intake preserves evidence, approval, and handoff contracts", () => {
  const skill = read("skills", "github-issue-intake", "SKILL.md");
  const template = read("skills", "github-issue-intake", "references", "issue-template.md");
  const metadata = read("skills", "github-issue-intake", "agents", "openai.yaml");

  assert.match(skill, /^description: Use when .*bug.*improvement.*GitHub issue/m);
  assert.match(skill, /open and closed issues/i);
  assert.match(skill, /verified[\s\S]*reported[\s\S]*inferred/i);
  assert.match(skill, /independently assignable[\s\S]*separate issue drafts/i);
  assert.match(skill, /exact title[\s\S]*exact body[\s\S]*explicit approval/i);
  assert.match(skill, /small\/fix[\s\S]*Do not offer task-doc creation/i);
  assert.match(skill, /task doc now[\s\S]*assignee[\s\S]*deliberat/i);
  assert.match(skill, /Do not mention a task-doc path, branch, or PR before it exists/i);
  assert.match(skill, /just create it[\s\S]*not approval[\s\S]*Stop after the preview/i);
  assert.match(skill, /does not exist[\s\S]*exclude it[\s\S]*Do not preserve it as `planned`, `intended`/i);
  assert.match(skill, /Do not combine independent outcomes because the user requested one issue/i);
  assert.match(skill, /Do not invent acceptance criteria or implementation requirements/i);
  assert.match(skill, /Always read `references\/issue-template\.md` as the required-content contract/i);
  assert.match(skill, /Propose assignees, milestones, or project placement only when the user requests them or provides explicit direction/i);
  assert.match(template, /^## Problem$/m);
  assert.match(template, /^## Current code evidence$/m);
  assert.match(template, /^## Acceptance criteria$/m);
  assert.match(template, /^## Excluded$/m);
  assert.match(metadata, /\$github-issue-intake/);
});
