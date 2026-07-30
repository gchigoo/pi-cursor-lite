#!/usr/bin/env node
/**
 * Verify the security-maintained Connect Node fork before publication.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { cwd } from "node:process";

const ROOT = cwd();
const FORK_DIR = resolve(ROOT, "packages/connect-node");
const UPSTREAM_HASHES_PATH = resolve(FORK_DIR, "upstream-dist.sha256.json");
const NPM_CLI = process.env.npm_execpath
  ?? resolve(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");

function runNpm(args, options) {
  return execFileSync(process.execPath, [NPM_CLI, ...args], options);
}

function spawnNpm(args, options) {
  return spawnSync(process.execPath, [NPM_CLI, ...args], options);
}

function fail(message) {
  throw new Error(`FAIL: ${message}`);
}

function filesUnder(root) {
  const result = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else result.push(relative(root, path).replaceAll("\\", "/"));
    }
  };
  visit(root);
  return result.sort();
}

const manifest = JSON.parse(readFileSync(join(FORK_DIR, "package.json"), "utf8"));
if (manifest.name !== "@gchigoo/connect-node") fail(`unexpected package name ${manifest.name}`);
if (manifest.version !== "1.7.1") fail(`unexpected fork version ${manifest.version}`);
if (manifest.dependencies?.undici !== "6.27.0") {
  fail(`undici must be pinned to 6.27.0, got ${manifest.dependencies?.undici}`);
}
if (manifest.peerDependencies?.["@connectrpc/connect"] !== "1.7.0") {
  fail("Connect peer dependency must remain compatible with upstream 1.7.0");
}
for (const evidenceFile of ["LICENSE", "NOTICE", "README.md", "upstream-dist.sha256.json"]) {
  if (!existsSync(join(FORK_DIR, evidenceFile))) fail(`${evidenceFile} is missing`);
}

const upstreamHashes = JSON.parse(readFileSync(UPSTREAM_HASHES_PATH, "utf8"));
if (upstreamHashes.package !== "@connectrpc/connect-node" || upstreamHashes.version !== "1.7.0") {
  fail("frozen upstream hash manifest must identify @connectrpc/connect-node@1.7.0");
}
if (upstreamHashes.tarballIntegrity !== "sha512-6vaPIkG/NyhxlYgytLoR9KYbPhczEboFB2OYWkA9qvUz1K7efXfeGrlRxoLtpa+r8VxyIOw73w5ktNe743nD+A==") {
  fail("frozen upstream tarball integrity is unexpected");
}

const forkDist = resolve(FORK_DIR, "dist");
const forkFiles = filesUnder(forkDist).map((file) => `dist/${file}`);
const upstreamFiles = Object.keys(upstreamHashes.files ?? {}).sort();
if (JSON.stringify(forkFiles) !== JSON.stringify(upstreamFiles)) {
  fail("fork dist file list differs from the frozen upstream 1.7.0 manifest");
}
for (const file of forkFiles) {
  const actual = createHash("sha256").update(readFileSync(join(FORK_DIR, file))).digest("hex");
  if (actual !== upstreamHashes.files[file]) fail(`compiled upstream file changed: ${file}`);
}
console.log(`PASS: ${forkFiles.length} dist files match frozen upstream 1.7.0 SHA-256 hashes`);

const tempDir = mkdtempSync(join(tmpdir(), "connect-node-fork-test-"));
let tarballPath;
try {
  const packOutput = runNpm(["pack", "--json", "--ignore-scripts"], {
    cwd: FORK_DIR,
    encoding: "utf8",
  });
  const pack = JSON.parse(packOutput)[0];
  tarballPath = resolve(FORK_DIR, pack.filename);
  if (pack.size > 200 * 1024) fail(`tarball ${pack.size} bytes exceeds 200 KiB budget`);
  if (pack.entryCount > 60) fail(`${pack.entryCount} files exceeds 60-file budget`);
  console.log(`PASS: packed ${basename(tarballPath)} (${pack.entryCount} files, ${pack.size} bytes)`);

  writeFileSync(join(tempDir, "package.json"), `${JSON.stringify({
    name: "connect-node-fork-consumer",
    version: "1.0.0",
    private: true,
  }, null, 2)}\n`);
  runNpm([
    "install",
    tarballPath,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ], { cwd: tempDir, encoding: "utf8", stdio: "pipe" });

  const tree = runNpm(["ls", "undici", "--all"], {
    cwd: tempDir,
    encoding: "utf8",
  });
  if (!tree.includes("undici@6.27.0")) fail(`consumer tree is not pinned to undici@6.27.0:\n${tree}`);
  if (tree.includes("undici@5.")) fail(`consumer tree still contains Undici 5:\n${tree}`);
  console.log("PASS: standalone consumer resolves only undici@6.27.0");

  for (const [mode, args] of [
    ["ESM", ["--input-type=module", "--eval", "const m=await import('@gchigoo/connect-node'); if(typeof m.createConnectTransport!=='function') process.exit(2)"]],
    ["CJS", ["--eval", "const m=require('@gchigoo/connect-node'); if(typeof m.createConnectTransport!=='function') process.exit(2)"]],
  ]) {
    execFileSync(process.execPath, args, { cwd: tempDir, encoding: "utf8", stdio: "pipe" });
    console.log(`PASS: ${mode} package export loads`);
  }

  const audit = spawnNpm(["audit", "--omit=dev", "--json"], {
    cwd: tempDir,
    encoding: "utf8",
  });
  const auditResult = JSON.parse(audit.stdout || "{}");
  const vulnerabilities = auditResult.metadata?.vulnerabilities;
  if (audit.status !== 0 || vulnerabilities?.total !== 0) {
    fail(`standalone consumer audit is not clean: ${JSON.stringify(vulnerabilities)}`);
  }
  console.log("PASS: standalone consumer production audit has 0 vulnerabilities");
} finally {
  if (tarballPath) rmSync(tarballPath, { force: true });
  rmSync(tempDir, { recursive: true, force: true });
}
