#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowDir = path.join(rootDir, ".github", "workflows");
const requiredGuard = "github.repository == 'oaslananka-lab/mcp-ssh-tool'";
const errors = [];

function readWorkflowFiles() {
  if (!fs.existsSync(workflowDir)) {
    return [];
  }

  return fs
    .readdirSync(workflowDir)
    .filter((name) => /\.(ya?ml)$/u.test(name))
    .sort()
    .map((name) => path.join(workflowDir, name));
}

function findJobBlocks(content) {
  const lines = content.split(/\r?\n/u);
  const jobsLine = lines.findIndex((line) => /^jobs:\s*$/u.test(line));
  if (jobsLine === -1) {
    return [];
  }

  const blocks = [];
  let current = null;

  for (let index = jobsLine + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const jobMatch = /^  ([A-Za-z0-9_-]+):\s*(?:#.*)?$/u.exec(line);
    const topLevelMatch = /^[A-Za-z0-9_-]+:\s*$/u.test(line);

    if (topLevelMatch) {
      break;
    }

    if (jobMatch) {
      if (current) {
        current.end = index;
        blocks.push(current);
      }

      current = {
        name: jobMatch[1],
        start: index,
        end: lines.length,
        lines: [],
      };
      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  if (current) {
    blocks.push(current);
  }

  return blocks;
}

for (const filePath of readWorkflowFiles()) {
  const relativePath = path.relative(rootDir, filePath).replaceAll(path.sep, "/");
  const content = fs.readFileSync(filePath, "utf8");

  if (relativePath.endsWith("mirror-source.yml")) {
    errors.push(`${relativePath}: mirror-source workflow must be removed`);
  }

  if (content.includes("github.repository_owner")) {
    errors.push(`${relativePath}: use exact github.repository guards, not github.repository_owner`);
  }

  if (content.includes("github.repository == 'oaslananka/mcp-ssh-tool'")) {
    errors.push(`${relativePath}: personal-repo job guard is not allowed`);
  }

  for (const job of findJobBlocks(content)) {
    const hasGuard = job.lines.some(
      (line) => line.trim().startsWith("if:") && line.includes(requiredGuard),
    );

    if (!hasGuard) {
      errors.push(`${relativePath}: job '${job.name}' is missing exact org repository guard`);
    }
  }
}

if (errors.length > 0) {
  console.error("Workflow guard validation failed:");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log("Workflow guards are org-only.");
