// Renderer contract (implementation spec section 10.2): ownership, recovery and
// semantic rendering. Every case installs into a temporary home; the real home
// is replaced by a sentinel directory that must stay untouched.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";
import {
  applyPlan,
  buildPlan,
  claudeSessionDefinition,
  dispatchReference,
  loadCanonical,
  planRepoPointer,
  RenderError,
  resolveInterrupted,
  sha256,
} from "../bin/lib/render-agents.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const CLI = path.join(root, "bin", "link-agents.sh");
const SANDBOX = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "agents render ")));
process.on("exit", () => fs.rmSync(SANDBOX, { recursive: true, force: true }));
const SENTINEL_HOME = path.join(SANDBOX, "real-home");
fs.mkdirSync(SENTINEL_HOME);
const ENV = { ...process.env, HOME: SENTINEL_HOME, CODEX_HOME: path.join(SENTINEL_HOME, ".codex"), CLAUDE_CONFIG_DIR: path.join(SENTINEL_HOME, ".claude") };
const VERSIONS = { claude: "2.1.285", codex: "0.146.0" };
const ROLES = ["auditor", "reviewer", "scout", "watcher"];

let counter = 0;
const tempHome = () => {
  const home = path.join(SANDBOX, `home-${(counter += 1)}`);
  fs.mkdirSync(path.join(home, ".codex", "agents"), { recursive: true });
  fs.mkdirSync(path.join(home, ".claude", "agents"), { recursive: true });
  return home;
};
const read = (file) => fs.readFileSync(file, "utf8");
const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const plan = (home, options = {}) => buildPlan({ home, env: ENV, runtimes: ["claude", "codex"], codexAdapter: "standalone", versions: VERSIONS, allowUnqualified: true, ...options });
const install = (home, options = {}, hooks = {}) => applyPlan(JSON.parse(JSON.stringify(plan(home, options))), { env: ENV, ...hooks });
const snapshot = (dir) => {
  const out = {};
  const walk = (current) => {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[path.relative(dir, full)] = sha256(fs.readFileSync(full));
    }
  };
  walk(dir);
  return out;
};
const frontmatter = (text) => parseYaml(/^---\n([\s\S]*?)\n---\n/.exec(text)[1]);
const expectCode = (fn, code) => assert.throws(fn, (error) => error instanceof RenderError && error.code === code, code);
const cli = (args) => spawnSync(CLI, args, { encoding: "utf8", env: ENV });

const EXPECTED_TOOLS = {
  auditor: ["Read", "Glob", "Grep", "Bash", "Write", "Skill"],
  reviewer: ["Read", "Glob", "Grep", "Bash", "Skill"],
  scout: ["Read", "Glob", "Grep", "Bash"],
  watcher: ["Read", "Bash"],
};
const EXPECTED_MODELS = { auditor: "sonnet", reviewer: "opus", scout: "sonnet", watcher: "haiku" };

test("rendered roles agree semantically with their canonical sources in both runtimes", () => {
  const home = tempHome();
  install(home);
  const canonical = loadCanonical(root);
  assert.deepEqual(canonical.roles.map((role) => role.name), ROLES);
  for (const role of canonical.roles) {
    const claudeText = read(path.join(home, ".claude", "agents", `${role.name}.md`));
    const claude = frontmatter(claudeText);
    assert.equal(claude.name, role.name);
    assert.equal(claude.description, role.description);
    assert.deepEqual(claude.tools.split(", "), EXPECTED_TOOLS[role.name]);
    assert.equal(claude.disallowedTools, "Agent");
    assert.equal(claude.model, EXPECTED_MODELS[role.name]);
    assert.ok(!("effort" in claude), "installed Claude roles pin no effort");

    const codex = parseToml(read(path.join(home, ".codex", "agents", `${role.name}.toml`)));
    assert.deepEqual(Object.keys(codex).sort(), ["description", "developer_instructions", "name"]);
    assert.equal(codex.name, role.name);
    assert.equal(codex.description, role.description);

    for (const [mode, spec] of Object.entries(role.modes)) {
      if (!spec.skill) continue;
      assert.ok(claudeText.includes(`use the Skill tool to load \`${spec.skill}\``), `${role.name}/${mode} Claude load`);
      assert.ok(codex.developer_instructions.includes(`invoke \`$${spec.skill}\``), `${role.name}/${mode} Codex load`);
    }
    for (const text of [claudeText, codex.developer_instructions]) assert.doesNotMatch(text, /\{\{|\}\}/);
  }
  assert.deepEqual(snapshot(SENTINEL_HOME), {});
});

test("canonical validation rejects unresolved placeholders, missing skills, unsupported capabilities and malformed YAML", () => {
  const cases = [
    [(text) => text.replace("{{load_skill:audit-api}}", "load audit-api"), "schema_error"],
    [(text) => text.replace("{{load_skill:audit-api}}", "{{skill_path:audit-api}}"), "unresolved_placeholder"],
    [(text) => text.replace("skill: audit-api", "skill: not-a-skill"), "missing_skill"],
    [(text) => text.replace("capabilities: [read,", "capabilities: [network, read,"), "unsupported_capability"],
    [(text) => text.replace("default_tier: standard", "default_tier: standard\ndefault_tier: deep"), "malformed_yaml"],
  ];
  for (const [mutate, code] of cases) {
    const fixture = path.join(SANDBOX, `canonical-${(counter += 1)}`);
    fs.cpSync(path.join(root, "agents"), path.join(fixture, "agents"), { recursive: true });
    fs.symlinkSync(path.join(root, "skills"), path.join(fixture, "skills"));
    const file = path.join(fixture, "agents", "auditor.md");
    write(file, mutate(read(file)));
    expectCode(() => loadCanonical(fixture), code);
  }
});

test("a repeated apply is a no-op with no backup, and a canonical change updates only owned outputs", () => {
  const home = tempHome();
  const first = install(home);
  assert.equal(first.changed, true);
  const state = path.join(home, ".agent-skills", "link-agents");
  const before = snapshot(home);
  const second = install(home);
  assert.equal(second.changed, false);
  assert.deepEqual(snapshot(home), before);
  assert.ok(!fs.existsSync(path.join(state, "backups")));

  const manifest = JSON.parse(read(path.join(state, "manifest.json")));
  assert.equal(manifest.renderer_version, "1.0.0");
  assert.equal(manifest.source_hash, loadCanonical(root).sourceHash);
  assert.equal(manifest.installs.codex.adapter, "standalone");
  assert.equal(manifest.installs.codex.runtime_version, "0.146.0");
  for (const [file, entry] of Object.entries(manifest.installs.claude.outputs)) assert.equal(entry.sha256, sha256(fs.readFileSync(file)));
});

test("standalone and registration adapters never leave both forms and preserve unrelated TOML bytes", () => {
  const home = tempHome();
  const configFile = path.join(home, ".codex", "config.toml");
  const original = '# keep this comment\nmodel = "gpt-5.5" # inline comment\n\n[projects."/a b"]\ntrust_level = "trusted"\n\n[agents]\nmax_threads = 4\n';
  write(configFile, original);

  install(home);
  assert.equal(read(configFile), original, "standalone install does not edit shared config");

  install(home, { codexAdapter: "registration" });
  const registered = read(configFile);
  assert.ok(registered.startsWith(original));
  const parsed = parseToml(registered);
  assert.equal(parsed.model, "gpt-5.5");
  assert.equal(parsed.agents.max_threads, 4);
  assert.deepEqual(Object.keys(parsed.agents).filter((key) => key !== "max_threads").sort(), ROLES);
  for (const role of ROLES) assert.equal(parsed.agents[role].config_file, path.join(home, ".codex", "agents", `${role}.toml`));

  install(home, { codexAdapter: "standalone" });
  assert.equal(read(configFile), original);
  assert.deepEqual(fs.readdirSync(path.join(home, ".codex", "agents")).sort(), ROLES.map((role) => `${role}.toml`));
});

test("unowned files, cross-form names and quoted registrations are conflicts, never overwritten", () => {
  const cases = [
    (home) => write(path.join(home, ".claude", "agents", "auditor.md"), "---\nname: auditor\ndescription: mine\n---\nmine\n"),
    (home) => write(path.join(home, ".claude", "agents", "my-review.md"), "---\nname: reviewer\ndescription: mine\n---\nmine\n"),
    (home) => write(path.join(home, ".codex", "agents", "custom", "mine.toml"), 'name = "scout"\ndescription = "x"\ndeveloper_instructions = "x"\n'),
    (home) => write(path.join(home, ".codex", "config.toml"), '[agents."watcher"]\ndescription = "mine"\n'),
    (home) => write(path.join(home, ".codex", "agents", "broken.toml"), "name = \n"),
  ];
  for (const arrange of cases) {
    const home = tempHome();
    arrange(home);
    const before = snapshot(home);
    const result = plan(home);
    assert.equal(result.conflicts.length, 1, JSON.stringify(result.conflicts));
    assert.ok(result.blocked.length > 0);
    expectCode(() => applyPlan(JSON.parse(JSON.stringify(result)), { env: ENV }), "blocked");
    assert.deepEqual(snapshot(home), before);
  }
});

test("a modified generated output needs explicit overwrite and is backed up privately", () => {
  const home = tempHome();
  install(home);
  const file = path.join(home, ".claude", "agents", "scout.md");
  write(file, `${read(file)}\nlocal note\n`);
  const modified = read(file);
  assert.match(plan(home).conflicts[0].reason, /modified after installation/);

  const result = install(home, { overwriteModified: [file] });
  assert.equal(result.changed, true);
  const backup = path.join(result.backup_dir, "claude", "agents", "scout.md");
  assert.equal(read(backup), modified);
  assert.equal(fs.statSync(backup).mode & 0o777, 0o600);
  assert.equal(fs.statSync(result.backup_dir).mode & 0o777, 0o700);
  assert.match(path.basename(result.backup_dir), /^\d{4}-\d{2}-\d{2}T[\d-]+Z-[0-9a-f-]{36}$/);
});

test("pilot retirement shows the diff, backs up, and removes a quoted registration without touching other settings", () => {
  const home = tempHome();
  const pilotFile = path.join(home, ".codex", "agents", "ui-auditor.toml");
  const configFile = path.join(home, ".codex", "config.toml");
  write(pilotFile, 'developer_instructions = "pilot"\n');
  write(path.join(home, ".claude", "agents", "ui-auditor.md"), "---\nname: ui-auditor\ndescription: pilot\n---\npilot\n");
  write(configFile, `model = "x"\n\n[agents."ui-auditor"] # pilot\ndescription = "pilot"\nconfig_file = ${JSON.stringify(pilotFile)}\n\n[projects."/a"]\ntrust_level = "trusted"\n`);

  const dry = plan(home, { retirePilots: ["codex:ui-auditor", "claude:ui-auditor"] });
  assert.deepEqual(dry.blocked, []);
  assert.ok(dry.actions.find((item) => item.path === configFile).diff.includes('-[agents."ui-auditor"] # pilot'));
  const result = applyPlan(JSON.parse(JSON.stringify(dry)), { env: ENV });

  assert.deepEqual(JSON.parse(JSON.stringify(parseToml(read(configFile)))), { model: "x", projects: { "/a": { trust_level: "trusted" } } });
  assert.ok(!fs.existsSync(pilotFile));
  assert.ok(!fs.existsSync(path.join(home, ".claude", "agents", "ui-auditor.md")));
  assert.equal(read(path.join(result.backup_dir, "codex", "agents", "ui-auditor.toml")), 'developer_instructions = "pilot"\n');
  const retired = JSON.parse(read(path.join(home, ".agent-skills", "link-agents", "manifest.json"))).retired_pilots;
  assert.deepEqual(retired.map((item) => `${item.runtime}:${item.name}`).sort(), ["claude:ui-auditor", "codex:ui-auditor"]);
});

test("malformed config and unknown or unqualified client versions block installation", () => {
  const malformed = tempHome();
  write(path.join(malformed, ".codex", "config.toml"), "[agents\n");
  expectCode(() => plan(malformed), "malformed_toml");

  const unknown = plan(tempHome(), { versions: { claude: "2.1.285", codex: "not-a-version" } });
  assert.equal(unknown.selections.codex.version, null);
  assert.ok(unknown.blocked.some((reason) => /client version unknown/.test(reason)));

  const unqualified = plan(tempHome(), { allowUnqualified: false, versions: { claude: "9.9.9", codex: "0.146.0" } });
  assert.ok(unqualified.blocked.some((reason) => /claude: agent-file adapter is not qualified for 9\.9\.9/.test(reason)));
  expectCode(() => plan(tempHome(), { runtimes: ["gemini"] }), "unsupported_runtime");
  expectCode(() => plan(tempHome(), { codexAdapter: undefined }), "argument_error");
});

test("a destination changed after the dry run refuses the apply without writing", () => {
  const home = tempHome();
  const configFile = path.join(home, ".codex", "config.toml");
  write(configFile, 'model = "x"\n');
  const dry = JSON.parse(JSON.stringify(plan(home, { codexAdapter: "registration" })));
  write(configFile, 'model = "y"\n');
  const before = snapshot(home);
  expectCode(() => applyPlan(dry, { env: ENV }), "stale_plan");
  assert.deepEqual(snapshot(home), before);
});

test("a failure or concurrent edit mid-install rolls back only this install's unchanged writes", () => {
  const concurrent = tempHome();
  const configFile = path.join(concurrent, ".codex", "config.toml");
  write(configFile, 'model = "x"\n');
  const clean = snapshot(concurrent);
  let first = true;
  expectCode(() => install(concurrent, { runtimes: ["codex"], codexAdapter: "registration" }, {
    afterWrite: () => {
      if (first) write(configFile, 'model = "concurrent"\n');
      first = false;
    },
  }), "concurrent_change");
  assert.deepEqual(snapshot(concurrent), { ...clean, [path.relative(concurrent, configFile)]: sha256('model = "concurrent"\n') });

  const failing = tempHome();
  write(path.join(failing, ".codex", "config.toml"), 'model = "x"\n');
  install(failing, { runtimes: ["codex"] });
  const installed = snapshot(failing);
  let writes = 0;
  expectCode(() => install(failing, { codexAdapter: "registration" }, {
    afterWrite: () => {
      writes += 1;
      if (writes === 3) throw new Error("disk full");
    },
  }), "apply_failed");
  assert.deepEqual(snapshot(failing), installed);

  const edited = tempHome();
  const userFile = path.join(edited, ".claude", "agents", "auditor.md");
  let count = 0;
  expectCode(() => install(edited, {}, {
    afterWrite: () => {
      count += 1;
      if (count === 2) {
        write(userFile, "user edit after install\n");
        throw new Error("later step failed");
      }
    },
  }), "rollback_incomplete");
  assert.equal(read(userFile), "user edit after install\n", "a subsequent user edit is never overwritten");
  const journal = JSON.parse(read(path.join(edited, ".agent-skills", "link-agents", "journal.json")));
  assert.equal(journal.status, "recovery_required");
  assert.deepEqual(journal.unresolved, [userFile]);
});

test("an interrupted install is recorded and blocks the next apply until resolved", () => {
  const home = tempHome();
  const crash = Object.assign(new Error("killed"), { simulateCrash: true });
  assert.throws(() => install(home, {}, { afterWrite: () => { throw crash; } }), /killed/);
  const journalFile = path.join(home, ".agent-skills", "link-agents", "journal.json");
  const journal = JSON.parse(read(journalFile));
  assert.equal(journal.status, "in_progress");
  assert.equal(journal.steps.length, 1);

  expectCode(() => install(home), "interrupted_install");
  expectCode(() => resolveInterrupted(home, "wrong-id", ENV), "argument_error");
  resolveInterrupted(home, journal.id, ENV);
  assert.ok(!fs.existsSync(journalFile));
  fs.rmSync(journal.steps[0].path);
  assert.equal(install(home).changed, true);
});

test("the CLI defaults to a dry run, stays inside --home, and applies only a reviewed plan", () => {
  const home = tempHome();
  const planFile = path.join(home, "plan.json");
  const dry = cli(["--home", home, "--runtime", "claude", "--runtime", "codex", "--codex-adapter", "standalone", "--claude-version", "2.1.285", "--codex-version", "0.146.0", "--allow-unqualified", "--plan-out", planFile]);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /^create .*\.claude\/agents\/auditor\.md$/m);
  assert.deepEqual(fs.readdirSync(path.join(home, ".claude", "agents")), []);

  assert.equal(cli(["--apply"]).status, 64);
  assert.equal(cli(["--apply", "--plan", planFile, "--runtime", "claude"]).status, 64);
  const applied = cli(["--apply", "--plan", planFile]);
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(fs.readdirSync(path.join(home, ".claude", "agents")).length, 4);

  const outside = tempHome();
  write(path.join(outside, ".codex", "config.toml"), `[agents.ui-auditor]\ndescription = "pilot"\nconfig_file = ${JSON.stringify(path.join(SENTINEL_HOME, ".codex", "agents", "ui-auditor.toml"))}\n`);
  expectCode(() => plan(outside, { retirePilots: ["codex:ui-auditor"] }), "home_escape");
  assert.deepEqual(snapshot(SENTINEL_HOME), {});
});

test("the generated dispatch reference and session-local definitions follow the tier map", () => {
  const canonical = loadCanonical(root);
  const reference = path.join(root, "skills", "task-doc-delivery-loop", "references", "role-dispatch.md");
  assert.equal(read(reference), dispatchReference(canonical), "regenerate with bin/link-agents.sh --dispatch-reference");

  const defaults = claudeSessionDefinition(canonical, "reviewer");
  assert.equal(defaults.reviewer.model, "opus");
  assert.ok(!("effort" in defaults.reviewer));
  assert.deepEqual(defaults.reviewer.disallowedTools, ["Agent"]);
  const effortOnly = claudeSessionDefinition(canonical, "reviewer", { effort: "high" });
  assert.equal(effortOnly.reviewer.model, "opus", "an effort-only override keeps the default model");
  assert.equal(effortOnly.reviewer.effort, "high");
  const modelOnly = claudeSessionDefinition(canonical, "reviewer", { model: "sonnet" });
  assert.equal(modelOnly.reviewer.model, "sonnet");
  assert.ok(!("effort" in modelOnly.reviewer), "a model-only override adds no effort");
});

test("repo pointers require AGENTS.md and only propose changes to hand-written files", () => {
  const repo = path.join(SANDBOX, `repo-${(counter += 1)}`);
  fs.mkdirSync(repo);
  expectCode(() => planRepoPointer(repo, root), "missing_agents_md");
  write(path.join(repo, "AGENTS.md"), "# Rules\n");
  assert.equal(planRepoPointer(repo, root).op, "create");
  write(path.join(repo, "CLAUDE.md"), "# Hand-written\n");
  const proposal = planRepoPointer(repo, root);
  assert.equal(proposal.op, "propose");
  assert.match(proposal.diff, /^\+@AGENTS\.md$/m);
});
