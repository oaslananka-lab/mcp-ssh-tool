import { chmodSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hooksDir = path.join(rootDir, ".githooks");
const executableMode = 0o755;

function isCiEnvironment() {
  return process.env.CI === "true" || process.env.CI === "1";
}

function isGitWorktree() {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: rootDir,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function setExecutableBit(filename) {
  const absolutePath = path.join(hooksDir, filename);
  if (existsSync(absolutePath)) {
    chmodSync(absolutePath, executableMode);
  }
}

if (isCiEnvironment() || !isGitWorktree()) {
  process.exit(0);
}

setExecutableBit("pre-commit");
setExecutableBit("pre-push");

execFileSync("git", ["config", "--local", "core.hooksPath", ".githooks"], {
  cwd: rootDir,
  stdio: "ignore",
});
