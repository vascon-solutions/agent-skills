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
      else if (entry.isSymbolicLink()) out[path.relative(dir, full)] = `link:${fs.readlinkSync(full)}`;
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

  const upgraded = path.join(SANDBOX, `canonical-${(counter += 1)}`);
  fs.cpSync(path.join(root, "agents"), path.join(upgraded, "agents"), { recursive: true });
  fs.symlinkSync(path.join(root, "skills"), path.join(upgraded, "skills"));
  fs.rmSync(path.join(upgraded, "agents", "watcher.md"));
  write(path.join(upgraded, "agents", "reviewer.md"), read(path.join(upgraded, "agents", "reviewer.md")).replace("You never fix what you find.", "You never fix what you find, even when asked."));
  const configFile = path.join(home, ".codex", "config.toml");
  write(configFile, '[agents.mine]\ndescription = "mine"\nconfig_file = "agents/watcher.toml"\n');
  assert.ok(plan(home, { root: upgraded }).conflicts.some((conflict) => /removed role watcher is still registered by agents\.mine/.test(conflict.reason)));
  fs.rmSync(configFile);
  const modifiedObsolete = path.join(home, ".codex", "agents", "watcher.toml");
  const installedWatcher = read(modifiedObsolete);
  write(modifiedObsolete, `${installedWatcher}# local note\n`);
  assert.match(plan(home, { root: upgraded }).conflicts[0].reason, /removed role watcher was modified/);
  write(modifiedObsolete, installedWatcher);
  const result = install(home, { root: upgraded });
  assert.ok(!fs.existsSync(path.join(home, ".claude", "agents", "watcher.md")));
  assert.ok(!fs.existsSync(modifiedObsolete));
  assert.ok(fs.existsSync(path.join(result.backup_dir, "claude", "agents", "watcher.md")));
  const upgradedManifest = JSON.parse(read(path.join(state, "manifest.json")));
  for (const runtime of ["claude", "codex"]) assert.ok(Object.values(upgradedManifest.installs[runtime].outputs).every((entry) => entry.role !== "watcher"));
  assert.equal(install(home, { root: upgraded }).changed, false);

  const probeHome = tempHome();
  install(probeHome, { versions: { claude: "9.9.9", codex: "0.146.0" } });
  const qualifiedRoot = path.join(SANDBOX, `canonical-${(counter += 1)}`);
  fs.cpSync(path.join(root, "agents"), path.join(qualifiedRoot, "agents"), { recursive: true });
  fs.symlinkSync(path.join(root, "skills"), path.join(qualifiedRoot, "skills"));
  write(path.join(qualifiedRoot, "agents", "runtimes.yaml"), read(path.join(qualifiedRoot, "agents", "runtimes.yaml")).replace('qualified: ["2.1.285"]', 'qualified: ["2.1.285", "9.9.9"]'));
  assert.equal(install(probeHome, { root: qualifiedRoot, versions: { claude: "9.9.9", codex: "0.146.0" } }).changed, true, "metadata-only changes refresh the manifest");
  const refreshed = JSON.parse(read(path.join(probeHome, ".agent-skills", "link-agents", "manifest.json")));
  assert.equal(refreshed.installs.claude.qualified, true);
  assert.equal(refreshed.source_hash, loadCanonical(qualifiedRoot).sourceHash);
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

  const unterminated = tempHome();
  const unterminatedConfig = path.join(unterminated, ".codex", "config.toml");
  write(unterminatedConfig, 'model = "x"');
  install(unterminated, { runtimes: ["codex"], codexAdapter: "registration" });
  install(unterminated, { runtimes: ["codex"] });
  assert.equal(read(unterminatedConfig), 'model = "x"', "a config without a final newline round-trips");

  const large = tempHome();
  write(path.join(large, ".codex", "config.toml"), Array.from({ length: 20000 }, (_, index) => `# line ${index}`).join("\n") + "\n");
  const diff = plan(large, { runtimes: ["codex"], codexAdapter: "registration" }).actions.find((item) => item.kind === "config").diff;
  assert.ok(diff.includes("[agents.auditor]"));
  assert.ok(!diff.includes("# line 0\n"), "unchanged lines are not repeated in the diff");
});

test("unowned files, cross-form names and quoted registrations are conflicts, never overwritten", () => {
  const cases = [
    (home) => write(path.join(home, ".claude", "agents", "auditor.md"), "---\nname: auditor\ndescription: mine\n---\nmine\n"),
    (home) => write(path.join(home, ".claude", "agents", "my-review.md"), "---\nname: reviewer\ndescription: mine\n---\nmine\n"),
    (home) => write(path.join(home, ".codex", "agents", "custom", "mine.toml"), 'name = "scout"\ndescription = "x"\ndeveloper_instructions = "x"\n'),
    (home) => write(path.join(home, ".codex", "config.toml"), '[agents."watcher"]\ndescription = "mine"\n'),
    (home) => write(path.join(home, ".codex", "agents", "broken.toml"), "name = \n"),
    (home) => {
      write(path.join(home, ".codex", "src", "foreign.toml"), 'name = "scout"\ndescription = "x"\ndeveloper_instructions = "x"\n');
      fs.symlinkSync(path.join(home, ".codex", "src", "foreign.toml"), path.join(home, ".codex", "agents", "foreign-scout.toml"));
    },
    (home) => {
      write(path.join(home, ".claude", "shared", "r.md"), "---\nname: reviewer\ndescription: mine\n---\nmine\n");
      fs.symlinkSync(path.join(home, ".claude", "agents"), path.join(home, ".claude", "shared", "back"));
      fs.symlinkSync(path.join(home, ".claude", "shared"), path.join(home, ".claude", "agents", "linked"));
    },
    (home) => {
      const outsideRole = path.join(SANDBOX, `outside-role-${(counter += 1)}.md`);
      write(outsideRole, "---\nname: someone\ndescription: x\n---\nx\n");
      fs.symlinkSync(outsideRole, path.join(home, ".claude", "agents", "outside.md"));
    },
    (home) => fs.copyFileSync(path.join(adoptSource, ".claude", "agents", "auditor.md"), path.join(home, ".claude", "agents", "auditor.md")),
  ];
  const adoptSource = tempHome();
  install(adoptSource);
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

  const adopting = tempHome();
  const adoptedFile = path.join(adopting, ".claude", "agents", "auditor.md");
  fs.copyFileSync(path.join(adoptSource, ".claude", "agents", "auditor.md"), adoptedFile);
  assert.match(plan(adopting).conflicts[0].reason, /pass --adopt/);
  install(adopting, { adopt: [adoptedFile] });
  const adoptedManifest = JSON.parse(read(path.join(adopting, ".agent-skills", "link-agents", "manifest.json")));
  assert.equal(adoptedManifest.installs.claude.outputs[adoptedFile].sha256, sha256(fs.readFileSync(adoptedFile)));
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

test("pilot retirement shows the diff, backs up, and removes only the pilot table, keeping comments and generated markers", () => {
  const home = tempHome();
  const pilotFile = path.join(home, ".codex", "agents", "ui-auditor.toml");
  const configFile = path.join(home, ".codex", "config.toml");
  write(pilotFile, 'developer_instructions = "pilot"\n');
  write(path.join(home, ".claude", "agents", "ui-auditor.md"), "---\nname: ui-auditor\ndescription: pilot\n---\npilot\n");
  write(configFile, 'model = "x"\n\n[agents."ui-auditor"] # pilot\ndescription = "pilot"\nconfig_file = "agents/ui-auditor.toml"\n\n# Projects below are mine\n[projects."/a"]\ntrust_level = "trusted"\n');

  const dry = plan(home, { retirePilots: ["codex:ui-auditor", "claude:ui-auditor"] });
  assert.deepEqual(dry.blocked, []);
  assert.ok(dry.actions.find((item) => item.path === configFile).diff.includes('-[agents."ui-auditor"] # pilot'));
  const result = applyPlan(JSON.parse(JSON.stringify(dry)), { env: ENV });

  assert.equal(read(configFile), 'model = "x"\n\n# Projects below are mine\n[projects."/a"]\ntrust_level = "trusted"\n');
  assert.ok(!fs.existsSync(pilotFile));
  assert.ok(!fs.existsSync(path.join(home, ".claude", "agents", "ui-auditor.md")));
  assert.equal(read(path.join(result.backup_dir, "codex", "agents", "ui-auditor.toml")), 'developer_instructions = "pilot"\n');
  const retired = JSON.parse(read(path.join(home, ".agent-skills", "link-agents", "manifest.json"))).retired_pilots;
  assert.deepEqual(retired.map((item) => `${item.runtime}:${item.name}`).sort(), ["claude:ui-auditor", "codex:ui-auditor"]);

  const registered = tempHome();
  const registeredConfig = path.join(registered, ".codex", "config.toml");
  write(path.join(registered, ".codex", "agents", "ui-auditor.toml"), 'developer_instructions = "pilot"\n');
  write(registeredConfig, 'model = "x"\n\n[agents.ui-auditor]\ndescription = "pilot"\nconfig_file = "agents/ui-auditor.toml"\n');
  install(registered, { runtimes: ["codex"], codexAdapter: "registration" });
  install(registered, { runtimes: ["codex"], codexAdapter: "registration", retirePilots: ["codex:ui-auditor"] });
  assert.equal(install(registered, { runtimes: ["codex"], codexAdapter: "registration" }).changed, false);
  install(registered, { runtimes: ["codex"] });
  assert.equal(read(registeredConfig), 'model = "x"\n');

  const shared = tempHome();
  const sharedFile = path.join(shared, ".codex", "agents", "shared.toml");
  write(sharedFile, 'developer_instructions = "shared"\n');
  write(path.join(shared, ".codex", "config.toml"), '[agents.ui-auditor]\ndescription = "pilot"\nconfig_file = "agents/shared.toml"\n\n[agents.keeper]\ndescription = "mine"\nconfig_file = "agents/shared.toml"\n');
  const kept = plan(shared, { runtimes: ["codex"], retirePilots: ["codex:ui-auditor"] });
  assert.ok(!kept.actions.some((item) => item.path === sharedFile && item.op === "delete"));
  assert.match(kept.notes[0], /still registered by agents\.keeper/);

  const aliased = tempHome();
  const aliasTarget = path.join(aliased, ".codex", "agents", "shared.toml");
  write(aliasTarget, 'developer_instructions = "shared"\n');
  fs.mkdirSync(path.join(aliased, ".codex", "links"));
  fs.symlinkSync(aliasTarget, path.join(aliased, ".codex", "links", "alias.toml"));
  write(path.join(aliased, ".codex", "config.toml"), '[agents.ui-auditor]\ndescription = "pilot"\nconfig_file = "agents/shared.toml"\n\n[agents.keeper]\ndescription = "mine"\nconfig_file = "links/alias.toml"\n');
  const aliasPlan = plan(aliased, { runtimes: ["codex"], retirePilots: ["codex:ui-auditor"] });
  assert.ok(!aliasPlan.actions.some((item) => item.path === aliasTarget && item.op === "delete"), "a symlink alias keeps the shared file");
  assert.match(aliasPlan.notes[0], /still registered by agents\.keeper/);

  const replacement = tempHome();
  install(replacement, { runtimes: ["codex"] });
  write(path.join(replacement, ".codex", "config.toml"), '[agents.ui-auditor]\ndescription = "pilot"\nconfig_file = "agents/auditor.toml"\n');
  const clash = plan(replacement, { runtimes: ["codex"], retirePilots: ["codex:ui-auditor"] });
  assert.ok(clash.blocked.some((reason) => /pilot ui-auditor shares its file with installed role output .*auditor\.toml/.test(reason)));
});

test("malformed config and unknown or unqualified client versions block installation", () => {
  const malformed = tempHome();
  write(path.join(malformed, ".codex", "config.toml"), "[agents\n");
  expectCode(() => plan(malformed), "malformed_toml");
  assert.deepEqual(plan(malformed, { runtimes: ["claude"] }).blocked, [], "a Claude-only plan ignores unrelated Codex configuration");

  const unknown = plan(tempHome(), { versions: { claude: "2.1.285", codex: "not-a-version" } });
  assert.equal(unknown.selections.codex.version, null);
  assert.ok(unknown.blocked.some((reason) => /client version unknown/.test(reason)));

  const unqualified = plan(tempHome(), { allowUnqualified: false, versions: { claude: "9.9.9", codex: "0.146.0" } });
  assert.ok(unqualified.blocked.some((reason) => /claude: agent-file adapter is not qualified for 9\.9\.9/.test(reason)));
  const probePilot = tempHome();
  write(path.join(probePilot, ".claude", "agents", "ui-auditor.md"), "---\nname: ui-auditor\ndescription: pilot\n---\npilot\n");
  const unqualifiedRetire = plan(probePilot, { versions: { claude: "9.9.9", codex: "0.146.0" }, retirePilots: ["claude:ui-auditor"] });
  assert.ok(unqualifiedRetire.blocked.some((reason) => /claude: a pilot can be retired only after its replacement adapter is qualified/.test(reason)));
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
  const failingConfig = path.join(failing, ".codex", "config.toml");
  write(failingConfig, '# mine\nmodel = "x"\n');
  install(failing, { runtimes: ["codex"] });
  const installed = snapshot(failing);
  let backupDir = null;
  expectCode(() => install(failing, { codexAdapter: "registration" }, {
    afterWrite: (item) => {
      if (item.kind === "config") {
        backupDir = JSON.parse(read(path.join(failing, ".agent-skills", "link-agents", "journal.json"))).backup_dir;
        throw new Error("disk full");
      }
    },
  }), "apply_failed");
  assert.equal(read(failingConfig), '# mine\nmodel = "x"\n');
  assert.equal(read(path.join(backupDir, "codex", "config.toml")), '# mine\nmodel = "x"\n');
  const { [path.relative(failing, path.join(backupDir, "codex", "config.toml"))]: _backup, ...afterRollback } = snapshot(failing);
  assert.deepEqual(afterRollback, installed);

  const unrecorded = tempHome();
  const unrecordedClean = snapshot(unrecorded);
  assert.throws(() => install(unrecorded, {}, { beforeManifest: () => { throw Object.assign(new Error("read-only state"), { code: "EROFS" }); } }), /rolled back: read-only state/);
  assert.deepEqual(Object.keys(snapshot(unrecorded)).filter((file) => !file.includes("/backups/")), Object.keys(unrecordedClean));

  const pilots = tempHome();
  const claudePilot = path.join(pilots, ".claude", "agents", "ui-auditor.md");
  write(claudePilot, "---\nname: ui-auditor\ndescription: pilot\n---\npilot\n");
  fs.chmodSync(claudePilot, 0o600);
  const pilotSource = path.join(pilots, ".codex", "pilots", "ui-auditor.toml");
  write(pilotSource, 'developer_instructions = "pilot"\n');
  const codexPilot = path.join(pilots, ".codex", "agents", "ui-auditor.toml");
  fs.symlinkSync(pilotSource, codexPilot);
  write(path.join(pilots, ".codex", "config.toml"), '[agents.ui-auditor]\ndescription = "pilot"\nconfig_file = "agents/ui-auditor.toml"\n');
  assert.throws(() => install(pilots, { retirePilots: ["claude:ui-auditor", "codex:ui-auditor"] }, { beforeManifest: () => { throw new Error("disk full"); } }), /rolled back: disk full/);
  assert.equal(fs.statSync(claudePilot).mode & 0o777, 0o600, "rollback restores the original mode");
  assert.equal(fs.readlinkSync(codexPilot), pilotSource, "rollback restores a symlink as a symlink");

  const linkedConfig = tempHome();
  write(path.join(linkedConfig, "dotfiles", "config.toml"), 'model = "x"\n');
  fs.symlinkSync(path.join(linkedConfig, "dotfiles", "config.toml"), path.join(linkedConfig, ".codex", "config.toml"));
  assert.ok(plan(linkedConfig, { runtimes: ["codex"], codexAdapter: "registration" }).conflicts.some((conflict) => /config\.toml is a symlink/.test(conflict.reason)));

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
  const rerun = cli(["--home", home, "--runtime", "claude", "--claude-version", "2.1.285", "--plan-out", planFile, "--runtime", "codex", "--codex-adapter", "standalone", "--codex-version", "0.146.0", "--allow-unqualified"]);
  assert.equal(rerun.status, 0, rerun.stderr);
  assert.equal(fs.statSync(planFile).mode & 0o777, 0o600);
  const applied = cli(["--apply", "--plan", planFile]);
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(fs.readdirSync(path.join(home, ".claude", "agents")).length, 4);

  const normalHome = path.join(SANDBOX, `normal-home-${(counter += 1)}`);
  fs.mkdirSync(path.join(normalHome, ".claude", "agents"), { recursive: true });
  fs.symlinkSync(path.join(normalHome, "missing-target.md"), path.join(normalHome, ".claude", "agents", "auditor.md"));
  const dangling = spawnSync(CLI, ["--runtime", "claude", "--claude-version", "2.1.285"], { encoding: "utf8", env: { ...ENV, HOME: normalHome, CLAUDE_CONFIG_DIR: path.join(normalHome, ".claude"), CODEX_HOME: path.join(normalHome, ".codex") } });
  assert.match(dangling.stdout, /auditor\.md: destination is a symlink \(possibly dangling\)/);
  assert.equal(fs.readlinkSync(path.join(normalHome, ".claude", "agents", "auditor.md")), path.join(normalHome, "missing-target.md"));

  const bypass = cli(["--runtime", "claude", "--claude-version", "9.9.9", "--allow-unqualified"]);
  assert.equal(bypass.status, 2, "--allow-unqualified never applies to the real home");
  assert.match(bypass.stdout, /applies only to a redirected probe home/);

  const asserted = cli(["--runtime", "claude", "--claude-version", "2.1.285"]);
  assert.equal(asserted.status, 2, "an asserted version cannot qualify a real-home install");
  assert.match(asserted.stdout, /asserted, not detected/);

  const outside = tempHome();
  write(path.join(outside, ".codex", "config.toml"), `[agents.ui-auditor]\ndescription = "pilot"\nconfig_file = ${JSON.stringify(path.join(SENTINEL_HOME, ".codex", "agents", "ui-auditor.toml"))}\n`);
  expectCode(() => plan(outside, { retirePilots: ["codex:ui-auditor"] }), "home_escape");

  const target = path.join(SANDBOX, `link-target-${(counter += 1)}`);
  fs.mkdirSync(path.join(target, "agents"), { recursive: true });
  write(path.join(target, "config.toml"), 'model = "real"\n');
  const linkedHome = path.join(SANDBOX, `home-${(counter += 1)}`);
  fs.mkdirSync(linkedHome);
  fs.symlinkSync(target, path.join(linkedHome, ".codex"));
  expectCode(() => plan(linkedHome, { runtimes: ["codex"] }), "home_escape");
  const linkedFile = tempHome();
  fs.symlinkSync(path.join(target, "config.toml"), path.join(linkedFile, ".codex", "config.toml"));
  expectCode(() => plan(linkedFile, { runtimes: ["codex"] }), "home_escape");
  const recovering = tempHome();
  const outsideAgents = path.join(SANDBOX, `outside-agents-${(counter += 1)}`);
  fs.mkdirSync(outsideAgents);
  let swappedOnce = false;
  expectCode(() => install(recovering, { runtimes: ["codex"] }, {
    afterWrite: (item) => {
      if (swappedOnce) return;
      swappedOnce = true;
      fs.copyFileSync(item.path, path.join(outsideAgents, path.basename(item.path)));
      fs.rmSync(path.dirname(item.path), { recursive: true });
      fs.symlinkSync(outsideAgents, path.dirname(item.path));
    },
  }), "rollback_incomplete");
  assert.deepEqual(fs.readdirSync(outsideAgents), ["auditor.toml"], "rollback never touches a file outside --home");
  const outsideArchive = path.join(SANDBOX, `outside-archive-${(counter += 1)}`);
  fs.mkdirSync(outsideArchive);
  fs.symlinkSync(outsideArchive, path.join(recovering, ".agent-skills", "link-agents", "resolved"));
  const pending = JSON.parse(read(path.join(recovering, ".agent-skills", "link-agents", "journal.json")));
  expectCode(() => resolveInterrupted(recovering, pending.id, ENV), "home_escape");
  assert.deepEqual(fs.readdirSync(outsideArchive), []);

  const swapped = tempHome();
  const swappedPlan = JSON.parse(JSON.stringify(plan(swapped, { runtimes: ["codex"] })));
  fs.rmSync(path.join(swapped, ".codex", "agents"), { recursive: true });
  fs.symlinkSync(path.join(target, "agents"), path.join(swapped, ".codex", "agents"));
  assert.throws(() => applyPlan(swappedPlan, { env: ENV }), (error) => error instanceof RenderError && ["home_escape", "stale_plan"].includes(error.code));
  assert.deepEqual(fs.readdirSync(path.join(target, "agents")), []);
  assert.equal(read(path.join(target, "config.toml")), 'model = "real"\n');
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
  fs.rmSync(path.join(repo, "CLAUDE.md"));
  fs.symlinkSync(path.join(repo, "missing.md"), path.join(repo, "CLAUDE.md"));
  assert.equal(planRepoPointer(repo, root).op, "propose", "a dangling CLAUDE.md link is never replaced");
  assert.match(proposal.diff, /^\+@AGENTS\.md$/m);
});
