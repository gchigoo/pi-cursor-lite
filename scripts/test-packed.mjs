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

// Check budget
const MAX_FILES = 14;
const MAX_SIZE = 150 * 1024; // 150 KiB
if (tarball.entryCount > MAX_FILES) {
  console.error(`FAIL: ${tarball.entryCount} entries exceeds budget of ${MAX_FILES}`);
  process.exit(1);
}
if (tarball.size > MAX_SIZE) {
  console.error(`FAIL: ${tarball.size} bytes exceeds budget of ${MAX_SIZE} (${(tarball.size / 1024).toFixed(1)} KiB)`);
  process.exit(1);
}
console.log(`PASS: ${tarball.entryCount} files, ${(tarball.size / 1024).toFixed(1)} KiB (budget: ${MAX_FILES} files, ${(MAX_SIZE / 1024).toFixed(0)} KiB)`);

// 2. Install in temp dir
const tempDir = mkdtempSync(join(tmpdir(), "pi-cursor-lite-test-"));
try {
  const tarballPath = resolve(ROOT, tarball.filename);
  execSync(
    `npm install "${tarballPath}" --ignore-scripts --no-audit --no-fund --omit=peer`,
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

  // Load the installed entry through Pi's real extension loader.
  const loadOutput = execFileSync(
    process.execPath,
    [join(ROOT, "scripts", "test-pi-load.mjs"), srcIndex],
    { cwd: ROOT, encoding: "utf-8" },
  );
  console.log(loadOutput.trim());
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
