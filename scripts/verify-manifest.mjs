#!/usr/bin/env node
/**
 * verify-manifest.mjs — Assert package.json has correct fields.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";

const ROOT = cwd();
const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
const connectNodeFork = JSON.parse(readFileSync(
  resolve(ROOT, "packages/connect-node/package.json"),
  "utf-8",
));

let errors = [];

function check(condition, msg) {
  if (!condition) errors.push(msg);
}

check(pkg.name === "pi-cursor-lite", `name: expected "pi-cursor-lite", got "${pkg.name}"`);
check(pkg.version === "0.1.1", `version: expected "0.1.1", got "${pkg.version}"`);
check(pkg.type === "module", `type: expected "module", got "${pkg.type}"`);
check(pkg.private === false, "private: must be false for npm publishing");
check(pkg.pi?.extensions?.includes?.("./src/index.ts"), "pi.extensions: must include ./src/index.ts");
check(pkg.files?.includes?.("src"), "files: must include src");
check(pkg.files?.includes?.("README.md"), "files: must include README.md");
check(pkg.files?.includes?.("README.zh-CN.md"), "files: must include README.zh-CN.md");
check(pkg.files?.includes?.("LICENSE"), "files: must include LICENSE");
check(pkg.license === "MIT", "license: must be MIT");
check(pkg.author?.name === "Gchigoo", "author.name: must be Gchigoo");
check(pkg.repository?.url === "git+https://github.com/gchigoo/pi-cursor-lite.git", "repository.url: must target gchigoo/pi-cursor-lite");
check(pkg.publishConfig?.access === "public", "publishConfig.access: must be public");

// engines
const nodeMin = pkg.engines?.node;
check(nodeMin, "engines.node: must be specified");
if (nodeMin) {
  check(!nodeMin.startsWith("<"), `engines.node: "${nodeMin}" looks too low`);
}

// Dependencies
check(pkg.dependencies?.["@cursor/sdk"] === "1.0.24", "dependencies: must have @cursor/sdk@1.0.24 pinned");
check(
  pkg.dependencies?.["@connectrpc/connect-node"] === "npm:@gchigoo/connect-node@1.7.1",
  "dependencies: must alias @connectrpc/connect-node to @gchigoo/connect-node@1.7.1",
);
check(!pkg.overrides, "overrides: remove non-propagating root override after aliasing the patched package");

// Security-maintained Connect Node fork
check(connectNodeFork.name === "@gchigoo/connect-node", "connect-node fork: unexpected package name");
check(connectNodeFork.version === "1.7.1", "connect-node fork: expected version 1.7.1");
check(connectNodeFork.dependencies?.undici === "6.27.0", "connect-node fork: undici must be pinned to 6.27.0");
check(
  connectNodeFork.peerDependencies?.["@connectrpc/connect"] === "1.7.0",
  "connect-node fork: @connectrpc/connect peer must remain 1.7.0",
);
check(connectNodeFork.publishConfig?.access === "public", "connect-node fork: publishConfig.access must be public");

// Peer deps
check(pkg.peerDependencies?.["@earendil-works/pi-coding-agent"], "peerDependencies: must have @earendil-works/pi-coding-agent");

// Dev deps for type checking
check(pkg.devDependencies?.["@earendil-works/pi-coding-agent"] === "0.81.1", "devDependencies: @earendil-works/pi-coding-agent must be 0.81.1");
check(pkg.devDependencies?.["typescript"], "devDependencies: must have typescript");
check(pkg.devDependencies?.["vitest"], "devDependencies: must have vitest");

if (errors.length > 0) {
  console.error("MANIFEST VIOLATIONS:");
  for (const err of errors) console.error("  -", err);
  process.exit(1);
}

if (pkg.scripts?.typecheck && pkg.scripts?.test) {
  console.log("OK: package manifest valid");
} else {
  console.log("OK: package manifest valid (scripts not fully verified)");
}
