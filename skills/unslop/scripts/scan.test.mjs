import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseArgs, parseStagedDiff, runCli, scanStaged, scanText } from "./scan.mjs";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rules = (text, options) => scanText(text, options).hits.map((hit) => hit.rule);

test("flags the mechanical catalog rules", () => {
  const text = [
    "Great question! This delves into what serves as the bedrock of the design — the cache.",
    "Let me check the cache first.",
    "In order to proceed, we could potentially leverage the flywheel and/or the nexus.",
    "**Performance:** performance was improved by the cache -> 2x faster.",
    "Not just faster, but also “simpler”. I hope this helps!",
  ].join("\n");
  const found = new Set(rules(text));
  for (const rule of [
    "no-sycophancy", "no-narration", "no-ai-vocab", "no-em-dash", "plain-is", "no-metaphor-noun", "no-filler",
    "no-hedge-stack", "no-slash-or", "bold-leadin-only", "active-voice", "no-arrow-speak", "no-not-just",
    "straight-quotes", "no-chatbot",
  ]) {
    assert.ok(found.has(rule), rule);
  }
});

test("reports the line of each hit", () => {
  const result = scanText("clean line\n\nWe utilize caching.\n");
  assert.deepEqual(result.hits.map((hit) => [hit.line, hit.rule, hit.snippet]), [[3, "no-ai-vocab", "utilize"]]);
});

test("ignores fenced code, inline code, and URLs", () => {
  const text = [
    "Run `npm run build -- --watch` and see https://example.com/a—b/“docs” for details.",
    "```",
    "Let me delve -> leverage “quoted” and/or",
    "```",
    "The build passes.",
  ].join("\n");
  assert.deepEqual(rules(text), []);
});

test("code delimiters follow CommonMark lengths", () => {
  assert.deepEqual(rules("a ``leverage `x` more`` b"), []);
  assert.deepEqual(rules("````\n```\nleverage\n```\n````\nclean"), []);
  assert.deepEqual(rules("~~~\n```\nleverage\n~~~\nclean"), []);
  assert.deepEqual(rules("```\nleverage\n````\nclean"), []);
  assert.deepEqual(rules("```\nleverage\n``` trailing\nleverage\n```"), []);
  assert.deepEqual(rules("`unclosed leverage"), ["no-ai-vocab"]);
});

test("narration fires at the start of a line, bullet, or sentence", () => {
  assert.deepEqual(rules("- Let me check the cache."), ["no-narration"]);
  assert.deepEqual(rules("Done. Now I'll run the tests."), ["no-narration"]);
  assert.deepEqual(rules("The cache lets me skip the fetch."), []);
});

test("emoji is flagged only in headings and bullets", () => {
  assert.deepEqual(rules("## Results 🚀"), ["no-decorative-emoji"]);
  assert.deepEqual(rules("The 🚀 icon is part of the product copy."), []);
});

test("long sentences and budgets are measured across wrapped lines", () => {
  const long = "This sentence keeps going across a wrapped commit body line so that the word count\nclimbs well past the configured limit for one idea per sentence in a report.";
  const result = scanText(long, { maxWords: 20 });
  assert.equal(result.hits.length, 1);
  assert.equal(result.hits[0].rule, "one-idea");
  assert.equal(result.hits[0].line, 1);
  assert.deepEqual(rules("Short. Also short.", { maxWords: 20 }), []);
  const budget = scanText("one two three four five.", { budget: 3 });
  assert.deepEqual(budget.hits.map((hit) => [hit.rule, hit.line]), [["surface-budget", 0]]);
  assert.equal(budget.words, 5);
});

test("tables are skipped for sentence length", () => {
  const row = `| ${"word ".repeat(40)} |`;
  assert.deepEqual(rules(`${row}\n${row}`, { maxWords: 10 }), []);
});

test("sentences start on their first content line, including staged additions", () => {
  for (const ending of [".", "!", "?", ""]) {
    const content = `Short.\n   This sentence has more than five words${ending}`;
    const result = scanText(content, { maxWords: 5 });
    assert.deepEqual(result.hits.map((hit) => [hit.line, hit.rule]), [[2, "one-idea"]]);
    const diff = "+++ b/body.md\n@@ -1,0 +2 @@\n+   This sentence has more than five words\n";
    const staged = scanStaged(diff, () => content, { maxWords: 5 });
    assert.deepEqual(staged[0].hits.map((hit) => [hit.line, hit.rule]), [[2, "one-idea"]]);
  }
});

const scanner = path.join(skillRoot, "scripts/scan.mjs");
const temporaryDirectory = (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "unslop-scan-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
};
const git = (cwd, ...args) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
};

test("staged CLI scans Git paths with spaces, Unicode, and escaped characters", (t) => {
  const cwd = temporaryDirectory(t);
  git(cwd, "init", "--quiet");
  const names = ["a b.md", "café.md", 'a"b.md', "a\\b.md", "a\tb.md", "a\nb.md"];
  for (const name of names) fs.writeFileSync(path.join(cwd, name), "We leverage it.\n");
  git(cwd, "add", "--", ...names);
  for (const quotePath of ["true", "false"]) {
    git(cwd, "config", "core.quotePath", quotePath);
    const result = spawnSync(process.execPath, [scanner, "--staged", "--json"], { cwd, encoding: "utf8" });
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const scans = JSON.parse(result.stdout);
    assert.deepEqual(scans.map((scan) => scan.file).sort(), [...names].sort());
    for (const scan of scans) {
      assert.deepEqual(scan.hits.map((hit) => [hit.line, hit.rule]), [[1, "no-ai-vocab"]]);
    }
  }
});

test("staged CLI reports Git failures as errors, not clean scans", (t) => {
  const cwd = temporaryDirectory(t);
  const checkFailure = () => {
    const result = spawnSync(process.execPath, [scanner, "--staged"], { cwd, encoding: "utf8" });
    assert.equal(result.status, 2, result.stdout);
    assert.match(result.stderr, /git diff/i);
    assert.equal(result.stdout, "");
  };
  checkFailure();
  git(cwd, "init", "--quiet");
  fs.writeFileSync(path.join(cwd, ".git/index"), "invalid index");
  checkFailure();
});

test("staged CLI reports unreadable index content as an error", () => {
  const errors = [];
  const output = [];
  const status = runCli(["--staged"], {
    stdout: (text) => output.push(text),
    stderr: (text) => errors.push(text),
    readStagedDiff: () => "+++ b/body.md\n@@ -0,0 +1 @@\n+We leverage it.\n",
    readStagedFile: () => { throw new Error("git show failed: index blob unavailable"); },
  });
  assert.equal(status, 2);
  assert.match(errors[0], /index blob unavailable/);
  assert.deepEqual(output, []);
});

test("parses staged diffs into added text lines with new-file numbers", () => {
  const diff = [
    "diff --git a/notes.md b/notes.md",
    "--- a/notes.md",
    "+++ b/notes.md",
    "@@ -3,2 +3,3 @@",
    " kept",
    "-removed",
    "+We leverage it.",
    "+plain",
    "diff --git a/app.ts b/app.ts",
    "--- a/app.ts",
    "+++ b/app.ts",
    "@@ -1 +1 @@",
    "+const x = 'leverage';",
  ].join("\n");
  const files = parseStagedDiff(diff);
  assert.deepEqual([...files.keys()], ["notes.md"]);
  assert.deepEqual(files.get("notes.md"), [{ line: 4, text: "We leverage it." }, { line: 5, text: "plain" }]);
});

test("staged mode scans the full index file and keeps only added-line hits", () => {
  const diff = "+++ b/body.md\n@@ -2,0 +3,2 @@\n+leverage inside fence\n+```\n@@ -6 +8 @@\n+Feel free to ask.\n";
  const content = "intro\n```\nleverage inside fence\n```\nWe leverage the old line.\nclean\n\nFeel free to ask.\n";
  const results = scanStaged(diff, () => content, { maxWords: 30, budget: 0 });
  assert.deepEqual(results.map((result) => result.hits.map((hit) => [hit.line, hit.rule])), [[[8, "no-chatbot"]]]);
});

test("cli reports staged hits by file line and sets exit codes", () => {
  const out = [];
  const diff = "+++ b/body.md\n@@ -0,0 +1,2 @@\n+clean\n+Feel free to ask.\n";
  const status = runCli(["--staged"], { stdout: (text) => out.push(text), readStagedDiff: () => diff, readStagedFile: () => "clean\nFeel free to ask.\n" });
  assert.equal(status, 1);
  assert.match(out.join("\n"), /^body\.md:2: no-chatbot/m);
  const clean = runCli(["--stdin"], { stdout: () => {}, readStdin: () => "The tests pass." });
  assert.equal(clean, 0);
  const errors = [];
  assert.equal(runCli(["--bogus"], { stderr: (text) => errors.push(text) }), 2);
  assert.match(errors[0], /unknown option/);
  assert.equal(runCli([], { stdout: () => {} }), 2);
});

test("parseArgs validates numeric options", () => {
  assert.equal(parseArgs(["--max-words", "12", "a.md"]).maxWords, 12);
  assert.throws(() => parseArgs(["--max-words", "2", "a.md"]));
  assert.throws(() => parseArgs(["--budget", "-1", "a.md"]));
});

test("frontmatter is skipped", () => {
  assert.deepEqual(rules("---\nname: x\ndescription: we leverage things\n---\n\nClean body."), []);
});

test("the skill's own prose is clean", () => {
  for (const file of ["SKILL.md", "references/surfaces.md"]) {
    const result = scanText(fs.readFileSync(path.join(skillRoot, file), "utf8"), { file });
    assert.deepEqual(result.hits, [], file);
  }
});
