import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lintOnly = process.argv.includes("--lint-only");

const prettierBin = path.join(rootDir, "node_modules", "prettier", "bin", "prettier.cjs");
const eslintBin = path.join(rootDir, "node_modules", "eslint", "bin", "eslint.js");

const formatterPattern = /\.(cjs|cts|js|json|jsonc|jsx|md|mjs|mts|ts|tsx|yaml|yml)$/i;

function toPosixPath(filename) {
  return filename.replace(/\\/g, "/");
}

function listStagedFiles() {
  const output = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
    cwd: rootDir,
    encoding: "utf8",
  });

  return output
    .split(/\r?\n/u)
    .map((file) => file.trim())
    .filter(Boolean)
    .filter((file) => existsSync(path.join(rootDir, file)));
}

function runCommand(command, args) {
  execFileSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
  });
}

const stagedFiles = listStagedFiles();
const formatTargets = lintOnly ? [] : stagedFiles.filter((file) => formatterPattern.test(file));
const lintTargets = stagedFiles.filter((file) => /^(src|test)\/.+\.ts$/u.test(toPosixPath(file)));

if (formatTargets.length > 0) {
  runCommand(process.execPath, [prettierBin, "--write", ...formatTargets]);
  runCommand("git", ["add", "--", ...formatTargets]);
}

if (lintTargets.length > 0) {
  runCommand(process.execPath, [eslintBin, ...lintTargets]);
}
