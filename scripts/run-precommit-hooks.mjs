#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const executable = process.platform === "win32" ? "pre-commit.exe" : "pre-commit";
const commandArgs = ["run", ...args];

const result = spawnSync(executable, commandArgs, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error?.code === "ENOENT") {
  console.warn("pre-commit is not installed; skipping .pre-commit-config.yaml hooks.");
  process.exit(0);
}

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
