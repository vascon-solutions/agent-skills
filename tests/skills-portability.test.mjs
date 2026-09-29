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

test("ongoing PR review monitoring is distinct from one-shot remediation", () => {
  const monitor = read("skills", "monitor-pr-review", "SKILL.md");
  const address = read("skills", "address-review-findings", "SKILL.md");
  const loop = read("skills", "task-doc-delivery-loop", "SKILL.md");

  assert.match(monitor, /^description: Use when .*monitoring.*babysitting.*keep watching.*quiet/m);
  assert.match(monitor, /explicitly invoked.*draft PR/i);
  assert.match(monitor, /quiet_complete[\s\S]*not.*review.*finished/i);
  assert.match(address, /^description: Use when a current batch/m);
  assert.match(address, /monitor-pr-review/);
  assert.match(loop, /ready PR[\s\S]*monitor-pr-review/i);
  assert.match(loop, /draft PR[\s\S]*explicit/i);
});

test("PR review monitoring preserves lifecycle safety contracts", () => {
  const entry = read("skills", "monitor-pr-review", "SKILL.md");
  assert.match(entry, /\]\(references\/state-and-timing\.md\)/);
  const monitor = entry + "\n" + read("skills", "monitor-pr-review", "references", "state-and-timing.md");
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
  assert.match(skill, /Always read \[`references\/issue-template\.md`\]\(references\/issue-template\.md\) as the required-content contract/i);
  assert.match(skill, /Propose assignees, milestones, or project placement only when the user requests them or provides explicit direction/i);
  assert.match(template, /^## Problem$/m);
  assert.match(template, /^## Current code evidence$/m);
  assert.match(template, /^## Acceptance criteria$/m);
  assert.match(template, /^## Excluded$/m);
  assert.match(metadata, /\$github-issue-intake/);
});

function walkMarkdown(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walkMarkdown(file) : entry.name.endsWith('.md') ? [file] : [];
  });
}

// Code examples are not links.
function relativeLinks(file) {
  const content = fs.readFileSync(file, 'utf8')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/(`+)[^`]*?\1/g, '');
  return [...content.matchAll(/\]\(([^\s)]+)\)/g)]
    .map(match => match[1])
    .filter(href => !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(href))
    .map(href => ({ href, target: path.resolve(path.dirname(file), decodeURIComponent(href.split('#')[0])) }));
}

test('skill Markdown references resolve, including bare relative paths', () => {
  for (const name of skillNames) {
    const dir = path.join(root, 'skills', name);
    const refs = path.join(dir, 'references');
    const files = [path.join(dir, 'SKILL.md'), ...(fs.existsSync(refs) ? walkMarkdown(refs) : [])];
    for (const file of files) {
      for (const { href, target } of relativeLinks(file)) {
        assert.ok(fs.existsSync(target), `${file}: missing ${href}`);
      }
    }
  }
});

test('every skill reference is reachable from a SKILL.md through Markdown links', () => {
  const reached = new Set();
  const visit = file => {
    if (reached.has(file) || !fs.existsSync(file)) return;
    reached.add(file);
    for (const { target } of relativeLinks(file)) {
      if (target.endsWith('.md')) visit(target);
    }
  };
  for (const name of skillNames) visit(path.join(root, 'skills', name, 'SKILL.md'));
  for (const name of skillNames) {
    const refs = path.join(root, 'skills', name, 'references');
    if (!fs.existsSync(refs)) continue;
    for (const file of walkMarkdown(refs)) {
      assert.ok(reached.has(file), `${path.relative(root, file)}: no SKILL.md links to this reference`);
    }
  }
});

test('installed skill directories exclude draft specs and plans', () => {
  for (const name of skillNames) {
    for (const draftDir of ['specs', 'plans']) {
      assert.ok(!fs.existsSync(path.join(root, 'skills', name, draftDir)), `${name}: ${draftDir} would ship through whole-directory linking`);
    }
  }
});

test('workflow wrapper refresh preserves originals and refuses missing provenance', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-refresh-'));
  const dir = path.join(home, '.agents', 'skills', 'brainstorming');
  const entry = path.join(dir, 'SKILL.md');
  const original = '---\nname: brainstorming\ndescription: Original upstream\n---\nOriginal body\n';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(entry, original);
  const run = (...args) => spawnSync('python3', ['bin/apply-workflow-preferences.py', '--home', home, ...args], { cwd: root, encoding: 'utf8' });
  try {
    assert.equal(run().status, 0);
    const wrapper = fs.readFileSync(entry, 'utf8');
    fs.writeFileSync(entry, wrapper.replace('Default to', 'Stale routing to'));
    assert.equal(run().status, 0);
    assert.match(fs.readFileSync(entry, 'utf8'), /Stale routing/);
    assert.equal(run('--force').status, 0);
    assert.equal(fs.readFileSync(entry, 'utf8'), wrapper);
    assert.equal(fs.readFileSync(path.join(dir, 'superpowers-original.md'), 'utf8'), original);
    fs.writeFileSync(entry, wrapper.replace('routing:v1', 'routing:v0'));
    assert.equal(run().status, 0);
    assert.equal(fs.readFileSync(entry, 'utf8'), wrapper);
    const upgraded = original + 'Upstream update\n';
    fs.writeFileSync(entry, upgraded);
    assert.equal(run().status, 0);
    assert.equal(fs.readFileSync(path.join(dir, 'superpowers-original.md'), 'utf8'), upgraded);
    fs.unlinkSync(path.join(dir, 'superpowers-original.md'));
    assert.notEqual(run('--force').status, 0);
    assert.match(fs.readFileSync(entry, 'utf8'), /owned-workflow-routing/);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test("unslop is linked, cited by publication and delivery, and scans its own prose clean", async () => {
  const linker = read("bin", "link-skills.sh");
  assert.match(linker.split('SKILL_NAMES="')[1].split('"')[0], /^unslop$/m);
  assert.match(read("README.md"), /^\| `unslop` \|/m);
  assert.match(read("skills", "publish-branch", "SKILL.md"), /\.\.\/unslop\/references\/surfaces\.md/);
  assert.match(read("skills", "task-doc-delivery-loop", "SKILL.md"), /`unslop`/);
  const { scanText } = await import("../skills/unslop/scripts/scan.mjs");
  for (const file of ["SKILL.md", "references/surfaces.md"]) {
    assert.deepEqual(scanText(read("skills", "unslop", file), { file }).hits, [], file);
  }
});

test("skill frontmatter scalars that contain ': ' or ' #' are quoted", () => {
  for (const name of skillNames) {
    const frontmatter = read("skills", name, "SKILL.md").split("---")[1] ?? "";
    for (const line of frontmatter.split("\n")) {
      const match = line.match(/^(\w[\w-]*):\s+(.*)$/);
      if (!match) continue;
      const value = match[2];
      if (/^["'>|]/.test(value)) continue;
      assert.ok(!/: | #/.test(value), `${name} ${match[1]} needs quoting: ${value}`);
    }
  }
});

test("R1 skills route delivery state through the ledger helper and one shared authorization table", () => {
  const loop = read("skills", "task-doc-delivery-loop", "SKILL.md");
  const address = read("skills", "address-review-findings", "SKILL.md");
  const publish = read("skills", "publish-branch", "SKILL.md");
  const monitor = read("skills", "monitor-pr-review", "SKILL.md");
  const handoff = read("skills", "publish-branch", "references", "ledger-handoff.md");
  const authorization = read("skills", "task-doc-delivery-loop", "references", "authorization.md");

  assert.ok(fs.existsSync(path.join(root, "skills", "task-doc-delivery-loop", "scripts", "delivery-ledger.mjs")));
  assert.ok(fs.existsSync(path.join(root, "skills", "task-doc-delivery-loop", "references", "delivery-ledger.schema.json")));
  for (const skill of [loop, address, publish, monitor]) assert.match(skill, /references\/authorization\.md/);
  assert.match(loop, /\]\(references\/delivery-ledger\.md\)/);
  assert.match(loop, /One claim covers the whole owner session[\s\S]*never claim again/);
  assert.match(loop, /`not_run` or `skipped`/);
  assert.match(loop, /local-only work, never create a commit/i);
  assert.match(loop, /`freeze` the final intended commit after hooks/);
  assert.match(loop, /`next` is advice and authorizes nothing/);
  assert.match(loop, /Do not launch another CLI, create a task or schedule a monitor/);
  assert.match(loop, /Complete at that narrower endpoint only when the user's instruction permits it/);

  assert.match(address, /\]\(\.\.\/task-doc-delivery-loop\/references\/delivery-ledger\.md\)/);
  assert.match(address, /Never invent a task doc, silently initialize an incomplete delivery, or make ledger adoption a prerequisite/);
  assert.match(address, /`ledger_unavailable`/);
  assert.match(address, /never pair parallel arrays by position/);
  assert.match(address, /prepared publication before the write and verified only after its read-back/);

  assert.match(publish, /\]\(references\/ledger-handoff\.md\)/);
  assert.match(handoff, /Never claim again, and never change the endpoint/);
  assert.match(handoff, /`summary-body`[\s\S]*preserves every other byte/);
  assert.match(handoff, /Without one, the normal standalone flow applies unchanged/);

  assert.match(authorization, /## What A Repository May Override/);
  assert.match(authorization, /cannot create authority to merge, monitor, post or resolve threads, force-push, bypass hooks/);
  assert.match(authorization, /A ready PR does not authorize monitoring/);
});

test("R1 carries the accepted audit-delegation and fresh-reviewer wording with its corrections", () => {
  const loop = read("skills", "task-doc-delivery-loop", "SKILL.md");
  assert.match(loop, /available test personas and secure credential sources/);
  assert.doesNotMatch(loop, /free personas/);
  assert.match(loop, /If the runtime cannot select the role, perform the audit inline and record that limitation/);
  assert.match(loop, /Where repo policy permits another delegated review, use a fresh reviewer with the remediation diff, original findings, claimed dispositions, affected requirements and candidate identity\. Otherwise verify remediation locally and state the independence limit\./);
  assert.match(loop, /self-review is only ever supplementary/);
});

test("R1 validation guidance keeps evidence reuse and rejects a once-per-commit rerun rule", () => {
  const validation = read("skills", "task-doc-delivery-loop", "references", "validation.md");
  assert.match(validation, /There is no once-per-commit rerun rule/);
  assert.match(validation, /run one required final gate per candidate and rerun only checks that are missing or invalidated/);
  assert.match(validation, /Run pushes directly or redirect their output/);
  assert.match(validation, /NUL-delimited Git output/);
  assert.match(validation, /heavy-command wrapper[\s\S]*record that host-wide enforcement is unavailable/);
});

test("the delivery ledger reference documents every helper command", async () => {
  const reference = read("skills", "task-doc-delivery-loop", "references", "delivery-ledger.md");
  const helper = read("skills", "task-doc-delivery-loop", "scripts", "delivery-ledger.mjs");
  const commands = [...helper.split("const COMMANDS = {")[1].split("\n};")[0].matchAll(/^  (?:"([a-z-]+)"|([a-z]+)): \{/gm)].map((match) => match[1] ?? match[2]);
  assert.ok(commands.length >= 20);
  for (const command of commands) assert.match(reference, new RegExp("\\| `" + command + "[ `]"), command);
  assert.match(reference, /\]\(delivery-ledger\.schema\.json\)/);
});

test("R3 review routing preserves spec correctness, shape sweeps and explicit bounded authority", () => {
  // These are executable workflow/authority contracts, not presentation copy.
  const reviewer = read("skills", "review-implementation", "SKILL.md");
  const risks = read("skills", "review-implementation", "references", "risk-classes.md");
  const spec = read("skills", "review-task-docs", "SKILL.md");
  const author = read("skills", "task-doc", "SKILL.md");
  const loop = read("skills", "task-doc-delivery-loop", "SKILL.md");
  const remediation = read("skills", "address-review-findings", "SKILL.md");
  const policy = read("skills", "task-doc-delivery-loop", "references", "review-policy.md");
  assert.match(reviewer, /references\/risk-classes\.md/);
  for (const shape of ["identity-reset", "async-prerequisite", "version-conflict-recovery", "authorization-leak"]) assert.ok(risks.includes(shape));
  assert.match(risks, /distinguish loading, failure and absence/);
  assert.match(risks, /refresh and reset or explicitly reconcile/);
  assert.match(risks, /server-enforced actor, tenant, and object scope/);
  assert.match(risks, /stale-permission, wrong-actor, and denied-transition/);
  assert.match(risks, /user acceptance and separate/);
  assert.match(spec, /current code, upstream shared\/API contracts and repository\s+product rules, not against itself/);
  assert.match(spec, /Implementation review and runtime evidence must still flag later contradictions/);
  for (const verdict of ["revise", "split", "rewrite"]) assert.ok(author.includes('`'+verdict+'`'));
  assert.match(loop, /feature-grade task docs[\s\S]*spec-correctness/);
  assert.match(loop, /zero diff does not permanently make a feature small/);
  for (const text of [loop, remediation]) assert.doesNotMatch(text, /Continue beyond this bound for new critical|Beyond that, continue for critical/);
  assert.match(policy, /Small may\s+use permitted inline review/);
  assert.match(policy, /A remediation\s+extension does not raise `delegated_limit`/);
  assert.match(remediation, /whole intended candidate diff and named equivalent touched paths/);
  assert.match(remediation, /without another permission request/);
});
