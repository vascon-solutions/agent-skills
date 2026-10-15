#!/usr/bin/env node
// Claude Code PreToolUse hook for Bash: refuse formatter and linter fix runs that cover the whole tree.
// Fails open: input it cannot read or commands it cannot parse are allowed (see hooks/README.md).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const RUNNER_FLAGS_WITH_VALUE = new Set(["-C", "--dir", "--filter", "-F", "--reporter", "--loglevel", "--workspace-concurrency", "--resume-from"]);
const WRAPPER_FLAGS_WITH_VALUE = {
  env: new Set(["-u", "--unset", "-C", "--chdir", "-a", "--argv0", "-P", "--env0-from", "--quoting-style", "-S", "--split-string"]),
  exec: new Set(["-a"]),
  time: new Set(["-f", "--format", "-o", "--output"]),
  nohup: new Set(),
  command: new Set(),
};
const PNPM_BUILTINS = new Set([
  "add", "audit", "bin", "config", "create", "dedupe", "deploy", "env", "fetch", "i", "import", "init", "install", "install-test", "it",
  "licenses", "link", "list", "ln", "ls", "outdated", "pack", "patch", "patch-commit", "prune", "publish", "rb", "rebuild", "remove", "rm",
  "root", "server", "setup", "store", "un", "uninstall", "unlink", "up", "update", "upgrade", "why", "help",
]);
const VALUE_OPTIONS = {
  biome: new Set(["--config-path", "--max-diagnostics", "--reporter", "--log-level", "--log-kind", "--diagnostic-level", "--colors", "--stdin-file-path", "--vcs-root", "--vcs-client-kind", "--files-max-size", "--since", "--only", "--skip", "--indent-style", "--indent-width", "--line-width", "--line-ending"]),
  eslint: new Set(["-c", "--config", "--ext", "--rulesdir", "--parser", "--parser-options", "--resolve-plugins-relative-to", "-f", "--format", "-o", "--output-file", "--ignore-path", "--ignore-pattern", "--max-warnings", "--cache-location", "--cache-strategy", "--rule", "--plugin", "--env", "--global", "--report-unused-disable-directives-severity", "--flag", "--fix-type"]),
  prettier: new Set(["--config", "--ignore-path", "--plugin", "--parser", "--log-level", "--cache-location", "--cache-strategy", "--stdin-filepath", "--end-of-line", "--print-width", "--tab-width", "--trailing-comma", "--quote-props", "--arrow-parens", "--prose-wrap", "--html-whitespace-sensitivity", "--embedded-language-formatting", "--object-wrap", "--experimental-operator-position", "--config-precedence", "--cursor-offset", "--range-start", "--range-end"]),
  ultracite: new Set([]),
};

class Unparseable extends Error {}

// Keeps each segment's words and following operator (&& || ; | & or newline). Anything needing real shell
// evaluation (substitution, subshells, groups, here-documents) throws Unparseable.
export function segments(command) {
  const result = [];
  let words = [];
  let word = "";
  let inWord = false;
  let redirectionTarget = false;
  const endWord = () => {
    if (inWord) {
      if (redirectionTarget) redirectionTarget = false;
      else words.push(word);
    }
    word = "";
    inWord = false;
  };
  const endSegment = (operator = null) => {
    endWord();
    if (redirectionTarget) throw new Unparseable("redirection without target");
    if (words.length > 0) result.push({ words, operator });
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
      const operator = (char === "&" || char === "|") && next === char ? char + command[++index] : char;
      endSegment(operator);
    } else if (char === " " || char === "\t") {
      endWord();
    } else if (char === ">" || char === "<") {
      if (!redirectionTarget && inWord && /^\d+$/.test(word)) {
        word = "";
        inWord = false;
      }
      endWord();
      if (redirectionTarget) throw new Unparseable("redirection without target");
      if (next === ">" || next === "&") index += 1;
      // Consume the target through the same quote and escape handling as other words.
      redirectionTarget = true;
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

function readOption(args, index, valued, shortClusters = false) {
  const arg = args[index];
  const equal = arg.indexOf("=");
  if (equal !== -1) return { flags: [arg.slice(0, equal)], value: arg.slice(equal + 1), next: index + 1 };
  if (shortClusters && !arg.startsWith("--")) {
    const flags = [];
    for (let offset = 1; offset < arg.length; offset += 1) {
      const flag = `-${arg[offset]}`;
      flags.push(flag);
      if (valued.has(flag)) {
        const attached = arg.slice(offset + 1);
        return { flags, value: attached || args[index + 1], next: index + (attached ? 1 : 2) };
      }
    }
    return { flags, next: index + 1 };
  }
  return { flags: [arg], value: valued.has(arg) ? args[index + 1] : undefined, next: index + (valued.has(arg) ? 2 : 1) };
}

function workspaceDirectory(dir) {
  if (dir === null) return null;
  let current = path.resolve(dir);
  while (!fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(current);
    if (parent === current) return dir;
    current = parent;
  }
  return current;
}

// Analyses one segment's words; returns {blocked, dir, at}: dir is the effective directory afterwards,
// at is the directory a blocked command runs in.
function analyseWords(words, dir, depth) {
  let index = 0;
  while (index < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[index])) index += 1;
  const wrapper = words[index] ? toolName(words[index]) : null;
  if (Object.hasOwn(WRAPPER_FLAGS_WITH_VALUE, wrapper)) {
    index += 1;
    let runDir = dir;
    let directoryValue;
    let optionsEnded = false;
    while (index < words.length) {
      if (wrapper === "env" && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[index])) {
        index += 1;
      } else if (!optionsEnded && words[index] === "--") {
        optionsEnded = true;
        index += 1;
      } else if (!optionsEnded && words[index].startsWith("-")) {
        const option = readOption(words, index, WRAPPER_FLAGS_WITH_VALUE[wrapper], true);
        if (wrapper === "env" && option.flags.some((flag) => ["-S", "--split-string"].includes(flag))) return { blocked: null, dir };
        if (wrapper === "env" && option.flags.some((flag) => ["-C", "--chdir"].includes(flag))) {
          if (option.value === undefined) return { blocked: null, dir };
          directoryValue = option.value;
        }
        index = option.next;
      } else {
        break;
      }
    }
    if (directoryValue !== undefined) runDir = dir === null ? null : path.resolve(dir, directoryValue);
    const inner = analyseWords(words.slice(index), runDir, depth);
    return { blocked: inner.blocked, dir, at: inner.at };
  }
  const rest = words.slice(index);
  if (rest.length === 0) return { blocked: null, dir };
  const [head, ...args] = rest;
  if (head === "cd") {
    const target = args.find((arg) => !["-L", "-P", "--"].includes(arg));
    if (target === "-" || dir === null) return { blocked: null, dir: null };
    const destination = target === undefined ? os.homedir() : path.resolve(dir, target.replace(/^~(?=$|\/)/, os.homedir()));
    return { blocked: null, dir: destination };
  }
  if (["bash", "sh", "zsh", "eval", "xargs", "sudo"].includes(head)) return { blocked: null, dir };
  if (head === "npx") {
    let position = 0;
    while (position < args.length && args[position].startsWith("-")) position += ["-p", "--package"].includes(args[position]) ? 2 : 1;
    if (position >= args.length) return { blocked: null, dir };
    return { blocked: wholeTree(toolName(args[position]), args.slice(position + 1), dir), dir, at: dir };
  }
  if (head === "pnpm") {
    let runDir = dir;
    let directoryValue;
    let workspaceRoot = false;
    let filtered = false;
    let position = 0;
    const skipOptions = () => {
      while (position < args.length && args[position].startsWith("-")) {
        if (args[position] === "--") {
          position += 1;
          break;
        }
        const option = readOption(args, position, RUNNER_FLAGS_WITH_VALUE);
        if (option.flags.some((flag) => ["-C", "--dir"].includes(flag))) directoryValue = option.value ?? ".";
        if (option.flags.some((flag) => ["-w", "--workspace-root"].includes(flag))) workspaceRoot = true;
        if (option.flags.some((flag) => ["--filter", "-F", "-r", "--recursive"].includes(flag))) filtered = true;
        position = option.next;
      }
    };
    skipOptions();
    const sub = args[position++];
    if (sub === "run" || sub === "run-script") skipOptions();
    if (directoryValue !== undefined) runDir = dir === null ? null : path.resolve(dir, directoryValue);
    if (workspaceRoot) runDir = workspaceDirectory(runDir);
    let tail = args.slice(position);
    if (sub === undefined) return { blocked: null, dir };
    if (["exec", "run", "run-script"].includes(sub) && tail[0] === "--") tail = tail.slice(1);
    if (sub === "exec" || sub === "dlx") {
      if (tail.length === 0) return { blocked: null, dir };
      return { blocked: wholeTree(toolName(tail[0]), tail.slice(1), runDir), dir, at: runDir };
    }
    const script = sub === "run" || sub === "run-script" ? tail[0] : ["t", "tst"].includes(sub) ? "test" : sub;
    const scriptArgs = sub === "run" || sub === "run-script" ? tail.slice(1) : tail;
    if (script === undefined || (sub !== "run" && sub !== "run-script" && PNPM_BUILTINS.has(sub))) return { blocked: null, dir };
    if (filtered || depth >= 3) return { blocked: null, dir };
    const pkg = nearestPackageJson(runDir);
    const body = pkg?.json?.scripts?.[script];
    if (typeof body !== "string") {
      return { blocked: wholeTree(toolName(script), scriptArgs, runDir), dir, at: runDir };
    }
    const forwarded = scriptArgs[0] === "--" ? scriptArgs.slice(1) : scriptArgs;
    const inner = analyseCommand(`${body} ${forwarded.map(quote).join(" ")}`, pkg.dir, depth + 1);
    return { blocked: inner ? `pnpm ${script} (${inner.blocked})` : null, dir, at: runDir };
  }
  return { blocked: wholeTree(toolName(head), args, dir), dir, at: dir };
}

function analyseCommand(command, cwd, depth = 0) {
  let parsed;
  try {
    parsed = segments(command);
  } catch (error) {
    if (error instanceof Unparseable) return null;
    throw error;
  }
  let states = [{ dir: cwd, status: null }];
  let listStart = states;
  let previous = null;
  for (const { words, operator } of parsed) {
    const nextStates = [];
    for (const state of states) {
      if ((previous === "&&" && state.status === false) || (previous === "||" && state.status === true)) {
        nextStates.push(state);
        continue;
      }
      const result = analyseWords(words, state.dir, depth);
      if (result.blocked) return { blocked: result.blocked, at: result.at };
      // Earlier commands can change the filesystem, so every command may succeed or fail.
      // Pipeline commands run in subshells; their cd never changes the parent directory.
      nextStates.push({ dir: previous === "|" || operator === "|" ? state.dir : result.dir, status: true });
      nextStates.push({ dir: state.dir, status: false });
    }
    states = [...new Map(nextStates.map((state) => [JSON.stringify(state), state])).values()];
    if (operator === "&") states = listStart;
    if ([";", "\n", "&"].includes(operator)) listStart = states;
    previous = operator;
  }
  return null;
}

// Returns the hook's JSON output object, or null to allow without a decision.
export function decide(input) {
  if (!input || input.tool_name !== "Bash" || typeof input.tool_input?.command !== "string") return null;
  const cwd = typeof input.cwd === "string" ? input.cwd : process.cwd();
  const result = analyseCommand(input.tool_input.command, cwd);
  if (!result) return null;
  const { blocked } = result;
  const pkg = nearestPackageJson(result.at);
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
