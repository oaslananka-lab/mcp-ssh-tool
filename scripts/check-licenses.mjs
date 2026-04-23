import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockfilePath = path.join(rootDir, "package-lock.json");
const forbiddenLicensePattern = /(^|[^A-Z])(?:AGPL|GPL)(?:[^A-Z]|$)/i;

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function packageNameFromLockPath(lockPath, packageJson) {
  if (packageJson.name) {
    return packageJson.name;
  }

  return lockPath.replace(/^node_modules\//u, "");
}

function normalizeLicense(packageJson) {
  const license = packageJson.license ?? packageJson.licenses;
  if (Array.isArray(license)) {
    return license
      .map((entry) => (typeof entry === "string" ? entry : entry?.type))
      .filter(Boolean)
      .join(" OR ");
  }
  if (typeof license === "object" && license?.type) {
    return license.type;
  }
  return String(license ?? "UNLICENSED");
}

const lockfile = readJson(lockfilePath);
const packages = lockfile.packages ?? {};
const violations = [];
let checked = 0;

for (const [lockPath, metadata] of Object.entries(packages)) {
  if (!lockPath.startsWith("node_modules/") || metadata.dev === true) {
    continue;
  }

  const packageJsonPath = path.join(rootDir, lockPath, "package.json");
  let packageJson;
  try {
    packageJson = readJson(packageJsonPath);
  } catch {
    continue;
  }

  checked++;
  const name = packageNameFromLockPath(lockPath, packageJson);
  const version = packageJson.version ?? metadata.version ?? "unknown";
  const license = normalizeLicense(packageJson);

  if (forbiddenLicensePattern.test(license)) {
    violations.push(`${name}@${version}: ${license}`);
  }
}

if (violations.length > 0) {
  console.error("Forbidden production dependency licenses found:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`Checked ${checked} production dependency licenses; no GPL/AGPL licenses found.`);
