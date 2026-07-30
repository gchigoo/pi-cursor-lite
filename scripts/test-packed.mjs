#!/usr/bin/env node
/**
 * test-packed.mjs — Verify the packed tarball can be installed with expected files.
 */
import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { cwd, env } from "node:process";
import { tmpdir } from "node:os";

const ROOT = cwd();

// 1. npm pack
console.log("Packing...");
const packOutput = execSync("npm pack --json", { cwd: ROOT, encoding: "utf-8" });
const packInfo = JSON.parse(packOutput);
const tarball = packInfo[0];
console.log(`Packed: ${tarball.filename} (${tarball.size} bytes, ${tarball.entryCount} entries)`);
const tarballPath = resolve(ROOT, tarball.filename);
let tempDir;

try {
  // Check budget
  const MAX_FILES = 14;
  const MAX_SIZE = 150 * 1024; // 150 KiB
  if (tarball.entryCount > MAX_FILES) {
    throw new Error(`FAIL: ${tarball.entryCount} entries exceeds budget of ${MAX_FILES}`);
  }
  if (tarball.size > MAX_SIZE) {
    throw new Error(`FAIL: ${tarball.size} bytes exceeds budget of ${MAX_SIZE} (${(tarball.size / 1024).toFixed(1)} KiB)`);
  }
  console.log(`PASS: ${tarball.entryCount} files, ${(tarball.size / 1024).toFixed(1)} KiB (budget: ${MAX_FILES} files, ${(MAX_SIZE / 1024).toFixed(0)} KiB)`);

  // 2. Install in temp dir
  tempDir = mkdtempSync(join(tmpdir(), "pi-cursor-lite-test-"));
  execSync(
    // Avoid auto-installing Pi's host peer while retaining SDK dependencies that are
    // also declared as peers by ConnectRPC. npm --omit=peer incorrectly omits protobuf.
    `npm install "${tarballPath}" --ignore-scripts --no-audit --no-fund --legacy-peer-deps`,
    { cwd: tempDir, encoding: "utf-8", stdio: "pipe" },
  );

  // Verify package.json
  const pkgPath = join(tempDir, "node_modules", "pi-cursor-lite", "package.json");
  if (!existsSync(pkgPath)) {
    console.error("FAIL: package not installed correctly");
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  console.log(`PASS: installed as ${pkg.name}@${pkg.version}`);

  // Verify files exist
  const srcIndex = join(tempDir, "node_modules", "pi-cursor-lite", "src", "index.ts");
  const readme = join(tempDir, "node_modules", "pi-cursor-lite", "README.md");
  const chineseReadme = join(tempDir, "node_modules", "pi-cursor-lite", "README.zh-CN.md");
  const license = join(tempDir, "node_modules", "pi-cursor-lite", "LICENSE");
  const missingFiles = [
    [srcIndex, "src/index.ts"],
    [readme, "README.md"],
    [chineseReadme, "README.zh-CN.md"],
    [license, "LICENSE"],
  ].filter(([path]) => !existsSync(path));
  if (missingFiles.length > 0) {
    throw new Error(`FAIL: packed files missing: ${missingFiles.map(([, name]) => name).join(", ")}`);
  }
  console.log("PASS: source, bilingual READMEs, and LICENSE present");

  // Verify the alias and dedup contract from the consumer install root. Package-level
  // overrides do not propagate, so the repository's own lock and audit are insufficient.
  if (pkg.dependencies?.["@connectrpc/connect-node"] !== "npm:@gchigoo/connect-node@1.7.1") {
    throw new Error("FAIL: packed main package does not declare the patched Connect Node alias");
  }
  const consumerLock = JSON.parse(readFileSync(join(tempDir, "package-lock.json"), "utf-8"));
  const connectNodeEntries = Object.entries(consumerLock.packages ?? {})
    .filter(([path]) => path.endsWith("node_modules/@connectrpc/connect-node"));
  if (connectNodeEntries.length !== 1) {
    throw new Error(`FAIL: Cursor SDK must deduplicate to one Connect Node node; got ${connectNodeEntries.length}`);
  }
  const [[connectNodePath, connectNodeLock]] = connectNodeEntries;
  if (connectNodePath !== "node_modules/@connectrpc/connect-node"
    || connectNodeLock.name !== "@gchigoo/connect-node"
    || connectNodeLock.version !== "1.7.1"
    || !connectNodeLock.resolved?.includes("/@gchigoo/connect-node/-/connect-node-1.7.1.tgz")) {
    throw new Error(`FAIL: unexpected patched Connect Node lock entry: ${JSON.stringify({ connectNodePath, connectNodeLock })}`);
  }
  const installedConnectNode = JSON.parse(readFileSync(
    join(tempDir, "node_modules", "@connectrpc", "connect-node", "package.json"),
    "utf-8",
  ));
  if (installedConnectNode.name !== "@gchigoo/connect-node" || installedConnectNode.version !== "1.7.1") {
    throw new Error(`FAIL: installed alias target is ${installedConnectNode.name}@${installedConnectNode.version}`);
  }
  const cursorSdkLock = consumerLock.packages?.["node_modules/@cursor/sdk"];
  if (cursorSdkLock?.dependencies?.["@connectrpc/connect-node"] !== "^1.6.1") {
    throw new Error("FAIL: unexpected Cursor SDK Connect Node dependency contract");
  }
  console.log("PASS: Cursor SDK deduplicates to @gchigoo/connect-node@1.7.1");

  const dependencyTree = JSON.parse(execSync("npm ls undici --all --json", {
    cwd: tempDir,
    encoding: "utf-8",
    stdio: "pipe",
  }));
  const undiciVersions = new Set();
  const collectVersions = (node) => {
    for (const [name, dependency] of Object.entries(node?.dependencies ?? {})) {
      if (name === "undici" && typeof dependency?.version === "string") {
        undiciVersions.add(dependency.version);
      }
      collectVersions(dependency);
    }
  };
  collectVersions(dependencyTree);
  if (undiciVersions.size !== 1 || !undiciVersions.has("6.27.0")) {
    throw new Error(`FAIL: packed consumer must resolve only undici@6.27.0; got ${[...undiciVersions].join(", ") || "none"}`);
  }
  console.log("PASS: packed consumer resolves only undici@6.27.0");

  let auditOutput;
  try {
    auditOutput = execSync("npm audit --omit=dev --json", {
      cwd: tempDir,
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch (error) {
    auditOutput = error.stdout?.toString?.() ?? "{}";
  }
  const audit = JSON.parse(auditOutput);
  if (audit.metadata?.vulnerabilities?.total !== 0) {
    throw new Error(`FAIL: packed consumer production audit found vulnerabilities: ${JSON.stringify(audit.metadata?.vulnerabilities)}`);
  }
  console.log("PASS: packed consumer production audit has 0 vulnerabilities");

  // Load the installed entry through Pi's real extension loader.
  const loadOutput = execFileSync(
    process.execPath,
    [join(ROOT, "scripts", "test-pi-load.mjs"), srcIndex],
    { cwd: ROOT, encoding: "utf-8" },
  );
  console.log(loadOutput.trim());
} finally {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  rmSync(tarballPath, { force: true });
}
