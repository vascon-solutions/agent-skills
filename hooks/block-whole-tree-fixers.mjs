#!/usr/bin/env node
// Claude Code PreToolUse hook for Bash: refuse formatter and linter fix runs that cover the whole tree.
// Fails open: input it cannot read or commands it cannot parse are allowed (see hooks/README.md).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const RUNNER_FLAGS_WITH_VALUE = new Set(["-C", "--dir", "--filter", "-F", "--workspace-root", "--reporter", "--loglevel"]);
const PNPM_BUILTINS = new Set([
  "add", "audit", "bin", "config", "create", "dedupe", "deploy", "env", "fetch", "i", "import", "init", "install", "install-test", "it",
  "licenses", "link", "list", "ln", "ls", "outdated", "pack", "patch", "patch-commit", "prune", "publish", "rb", "rebuild", "remove", "rm",
  "root", "server", "setup", "store", "un", "uninstall", "unlink", "up", "update", "upgrade", "why", "help", "start", "test", "t",
]);
const VALUE_OPTIONS = {
  biome: new Set(["--config-path", "--max-diagnostics", "--reporter", "--log-level", "--log-kind", "--diagnostic-level", "--colors", "--stdin-file-path", "--vcs-root", "--vcs-client-kind", "--files-max-size", "--since", "--only", "--skip", "--indent-style", "--indent-width", "--line-width", "--line-ending"]),
  eslint: new Set(["-c", "--config", "--ext", "--rulesdir", "--parser", "--parser-options", "--resolve-plugins-relative-to", "-f", "--format", "-o", "--output-file", "--ignore-path", "--ignore-pattern", "--max-warnings", "--cache-location", "--cache-strategy", "--rule", "--plugin", "--env", "--global", "--report-unused-disable-directives-severity", "--flag", "--fix-type"]),
  prettier: new Set(["--config", "--ignore-path", "--plugin", "--parser", "--log-level", "--cache-location", "--cache-strategy", "--stdin-filepath", "--end-of-line", "--print-width", "--tab-width", "--trailing-comma", "--quote-props", "--arrow-parens", "--prose-wrap", "--html-whitespace-sensitivity", "--embedded-language-formatting", "--object-wrap", "--experimental-operator-position", "--config-precedence", "--cursor-offset", "--range-start", "--range-end"]),
  ultracite: new Set([]),
};

class Unparseable extends Error {}

// Splits a command into segments of words on && || ; | & and newlines. Anything needing real shell
// evaluation (substitution, subshells, groups, here-documents) throws Unparseable.
export function segments(command) {
  const result = [];
  let words = [];
  let word = "";
  let inWord = false;
  const endWord = () => {
    if (inWord) words.push(word);
    word = "";
    inWord = false;
  };
  const endSegment = () => {
    endWord();
    if (words.length > 0) result.push(words);
    words = [];
  };
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    const next = command[index + 1];
    if (char === "'") {
      const close = command.indexOf("'", index + 1);
      if (close === -1) throw new Unparseable("unterminated quote");
      word += command.slice(index + 1, close);
      inWord = true;
      index = close;
    } else if (char === '"') {
      let close = index + 1;
      let value = "";
      while (close < command.length && command[close] !== '"') {
        if (command[close] === "\\" && close + 1 < command.length) {
          value += command[close + 1];
          close += 2;
          continue;
        }
        if (command[close] === "$" || command[close] === "`") throw new Unparseable("expansion inside quotes");
        value += command[close];
        close += 1;
      }
      if (close >= command.length) throw new Unparseable("unterminated quote");
      word += value;
      inWord = true;
      index = close;
    } else if (char === "\\") {
      if (next === "\n") {
        index += 1;
      } else if (next !== undefined) {
        word += next;
        inWord = true;
        index += 1;
      }
    } else if (char === "`" || (char === "$" && (next === "(" || next === "{"))) {
      throw new Unparseable("command or parameter substitution");
    } else if (char === "(" || char === ")" || ((char === "{" || char === "}") && !inWord)) {
      throw new Unparseable("subshell or group");
    } else if (char === "<" && next === "<") {
      throw new Unparseable("here-document");
    } else if (char === "#" && !inWord) {
      const newline = command.indexOf("\n", index);
      if (newline === -1) break;
      index = newline - 1;
    } else if (char === "&" || char === "|" || char === ";" || char === "\n") {
      if ((char === "&" || char === "|") && next === char) index += 1;
      endSegment();
    } else if (char === " " || char === "\t") {
      endWord();
    } else if (char === ">" || char === "<") {
      if (inWord && /^\d+$/.test(word)) {
        word = "";
        inWord = false;
      }
      endWord();
      if (next === ">" || next === "&") index += 1;
      while (command[index + 1] === " ") index += 1;
      let target = "";
      while (index + 1 < command.length && !/[\s;&|]/.test(command[index + 1])) target += command[++index];
      if (!target) throw new Unparseable("redirection without target");
    } else {
      word += char;
      inWord = true;
    }
  }
  endSegment();
  return result;
}

function toolName(word) {
  if (/^@biomejs\/biome(@|$)/.test(word)) return "biome";
  return word.split("/").pop().replace(/@.*$/, "");
}

function pathArgs(tool, args) {
  const values = VALUE_OPTIONS[tool];
  const paths = [];
  let afterDashDash = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (afterDashDash) {
      paths.push(arg);
    } else if (arg === "--") {
      afterDashDash = true;
    } else if (arg.startsWith("-")) {
      if (!arg.includes("=") && values.has(arg)) index += 1;
    } else {
      paths.push(arg);
    }
  }
  return paths;
}

function isDirectory(dir, target) {
  if (dir === null) return false;
  try {
    return fs.statSync(path.resolve(dir, target)).isDirectory();
  } catch {
    return false;
  }
}

const isGlob = (arg) => /[*?[\]{}]/.test(arg);

// Returns a description when the tool invocation is whole-tree, otherwise null.
function wholeTree(tool, args, dir) {
  const has = (...flags) => args.some((arg) => flags.includes(arg) || flags.some((flag) => arg.startsWith(`${flag}=`)));
  if (tool === "ultracite") {
    if (args[0] !== "fix") return null;
    const paths = pathArgs(tool, args.slice(1));
    if (paths.length === 0 || paths.every((arg) => arg === "." || isDirectory(dir, arg))) return "ultracite fix";
    return null;
  }
  if (tool === "biome") {
    if (!["check", "format", "lint"].includes(args[0])) return null;
    if (!has("--write", "--fix", "--apply", "--apply-unsafe")) return null;
    if (has("--staged", "--changed")) return null;
    const paths = pathArgs(tool, args.slice(1));
    if (paths.length === 0 || paths.every((arg) => arg === "." || isDirectory(dir, arg))) return `biome ${args[0]} --write`;
    return null;
  }
  if (tool === "eslint") {
    if (!has("--fix")) return null;
    const paths = pathArgs(tool, args);
    if (paths.length === 0 || paths.every((arg) => arg === "." || isGlob(arg) || isDirectory(dir, arg))) return "eslint --fix";
    return null;
  }
  if (tool === "prettier") {
    if (!has("--write", "-w")) return null;
    const paths = pathArgs(tool, args);
    if (paths.length === 0 || paths.every((arg) => arg === "." || isGlob(arg) || isDirectory(dir, arg))) return "prettier --write";
    return null;
  }
  return null;
}

function nearestPackageJson(dir) {
  if (dir === null) return null;
  let current = path.resolve(dir);
  while (true) {
    const file = path.join(current, "package.json");
    if (fs.existsSync(file)) {
      try {
        return { dir: current, json: JSON.parse(fs.readFileSync(file, "utf8")) };
      } catch {
        return null;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function quote(arg) {
  return /^[A-Za-z0-9_./:=@%+-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`;
}

// Analyses one segment's words; returns {blocked, dir} where dir is the effective directory afterwards.
function analyseWords(words, dir, depth) {
  let index = 0;
  while (index < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[index])) index += 1;
  while (["env", "exec", "nohup", "time", "command"].includes(words[index])) {
    index += 1;
    while (index < words.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[index]) || words[index].startsWith("-"))) index += 1;
  }
  const rest = words.slice(index);
  if (rest.length === 0) return { blocked: null, dir };
  const [head, ...args] = rest;
  if (head === "cd") {
    const target = args.find((arg) => !arg.startsWith("-"));
    if (target === undefined) return { blocked: null, dir: os.homedir() };
    if (target === "-" || dir === null) return { blocked: null, dir: null };
    return { blocked: null, dir: path.resolve(dir, target.replace(/^~(?=$|\/)/, os.homedir())) };
  }
  if (["bash", "sh", "zsh", "eval", "xargs", "sudo"].includes(head)) return { blocked: null, dir };
  if (head === "npx") {
    let position = 0;
    while (position < args.length && args[position].startsWith("-")) position += ["-p", "--package"].includes(args[position]) ? 2 : 1;
    if (position >= args.length) return { blocked: null, dir };
    return { blocked: wholeTree(toolName(args[position]), args.slice(position + 1), dir), dir };
  }
  if (head === "pnpm") {
    let runDir = dir;
    let filtered = false;
    let position = 0;
    while (position < args.length && args[position].startsWith("-")) {
      const flag = args[position];
      if (flag === "-C" || flag === "--dir") runDir = runDir === null ? null : path.resolve(runDir, args[position + 1] ?? ".");
      if (flag === "--filter" || flag === "-F" || flag === "-r" || flag === "--recursive") filtered = true;
      position += RUNNER_FLAGS_WITH_VALUE.has(flag) ? 2 : 1;
    }
    const sub = args[position];
    const tail = args.slice(position + 1);
    if (sub === undefined) return { blocked: null, dir };
    if (sub === "exec" || sub === "dlx") {
      if (tail.length === 0) return { blocked: null, dir };
      return { blocked: wholeTree(toolName(tail[0]), tail.slice(1), runDir), dir };
    }
    const script = sub === "run" || sub === "run-script" ? tail[0] : sub;
    const scriptArgs = sub === "run" || sub === "run-script" ? tail.slice(1) : tail;
    if (script === undefined || (sub !== "run" && sub !== "run-script" && PNPM_BUILTINS.has(sub))) return { blocked: null, dir };
    if (filtered || depth >= 3) return { blocked: null, dir };
    const pkg = nearestPackageJson(runDir);
    const body = pkg?.json?.scripts?.[script];
    if (typeof body !== "string") {
      return { blocked: wholeTree(toolName(script), scriptArgs, runDir), dir };
    }
    const forwarded = scriptArgs[0] === "--" ? scriptArgs.slice(1) : scriptArgs;
    const blocked = analyseCommand(`${body} ${forwarded.map(quote).join(" ")}`, pkg.dir, depth + 1);
    return { blocked: blocked ? `pnpm ${script} (${blocked})` : null, dir };
  }
  return { blocked: wholeTree(toolName(head), args, dir), dir };
}

function analyseCommand(command, cwd, depth = 0) {
  let parsed;
  try {
    parsed = segments(command);
  } catch (error) {
    if (error instanceof Unparseable) return null;
    throw error;
  }
  let dir = cwd;
  for (const words of parsed) {
    const result = analyseWords(words, dir, depth);
    if (result.blocked) return result.blocked;
    dir = result.dir;
  }
  return null;
}

// Returns the hook's JSON output object, or null to allow without a decision.
export function decide(input) {
  if (!input || input.tool_name !== "Bash" || typeof input.tool_input?.command !== "string") return null;
  const cwd = typeof input.cwd === "string" ? input.cwd : process.cwd();
  const blocked = analyseCommand(input.tool_input.command, cwd);
  if (!blocked) return null;
  const pkg = nearestPackageJson(cwd);
  const hasAgentFix = typeof pkg?.json?.scripts?.["agent:fix"] === "string";
  const advice = hasAgentFix
    ? "use `pnpm agent:fix`, which formats only this delivery's changed files"
    : "pass the explicit changed paths (for example from `git diff -z --name-only`) instead of the whole tree";
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `Blocked a whole-tree fixer (${blocked}): it can rewrite files this task does not own. ${advice[0].toUpperCase()}${advice.slice(1)}.`,
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let output = null;
  try {
    output = decide(JSON.parse(fs.readFileSync(0, "utf8")));
  } catch {
    output = null;
  }
  if (output) process.stdout.write(`${JSON.stringify(output)}\n`);
}
