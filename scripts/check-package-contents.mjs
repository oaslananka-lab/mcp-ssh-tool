#!/usr/bin/env node
import { execSync } from "node:child_process";

const rawOutput = execSync("npm pack --dry-run --json", {
  encoding: "utf8",
  shell: true,
});

const parsed = JSON.parse(rawOutput);
const packResult = Array.isArray(parsed) ? parsed[0] : parsed;
const files = Array.isArray(packResult?.files) ? packResult.files : [];
const filePaths = files
  .map((entry) => (typeof entry?.path === "string" ? entry.path : ""))
  .filter(Boolean);

const forbiddenPatterns = [
  /^test\//,
  /^coverage\//,
  /^test-results\//,
  /^\.github\//,
  /^\.changeset\//,
];
const leakedPaths = filePaths.filter((filePath) =>
  forbiddenPatterns.some((pattern) => pattern.test(filePath)),
);

if (leakedPaths.length > 0) {
  console.error("Unexpected files would be published to npm:");
  for (const filePath of leakedPaths) {
    console.error(` - ${filePath}`);
  }
  process.exit(1);
}

console.log(`Package dry-run looks clean (${filePaths.length} files).`);
