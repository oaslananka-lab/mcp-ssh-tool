#!/usr/bin/env node
import { execFileSync } from "node:child_process";

function npmExec(args, options = {}) {
  if (process.platform === "win32") {
    return execFileSync("cmd.exe", ["/d", "/s", "/c", "npm", ...args], options);
  }

  return execFileSync("npm", args, options);
}

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
const npmVersion = npmExec(["--version"], {
  encoding: "utf8",
}).trim();
const npmMajor = Number.parseInt(npmVersion.split(".")[0] ?? "0", 10);

const targets = new Map([
  [22, { range: /^10\.9\./, install: null }],
  [24, { range: /^11\.12\./, install: "11.12.1" }],
]);

const target = targets.get(nodeMajor);

if (!target) {
  console.log(`Node ${process.versions.node} with npm ${npmVersion}; no CI npm pin configured.`);
  process.exit(0);
}

if (target.range.test(npmVersion)) {
  console.log(`Using CI npm ${npmVersion} for Node ${process.versions.node}.`);
  process.exit(0);
}

if (!target.install) {
  console.error(
    `Expected npm ${target.range} for Node ${process.versions.node}, found ${npmVersion}.`,
  );
  process.exit(1);
}

console.log(
  `Installing npm ${target.install} for Node ${process.versions.node}; current npm is ${npmVersion}.`,
);
npmExec(["install", "--global", `npm@${target.install}`, "--no-audit", "--no-fund"], {
  stdio: "inherit",
});

const updatedVersion = npmExec(["--version"], {
  encoding: "utf8",
}).trim();

if (!target.range.test(updatedVersion)) {
  console.error(`Expected npm ${target.range} after install, found ${updatedVersion}.`);
  process.exit(1);
}

console.log(`Using CI npm ${updatedVersion} for Node ${process.versions.node}.`);
