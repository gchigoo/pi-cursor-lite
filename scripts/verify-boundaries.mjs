#!/usr/bin/env node
/**
 * verify-boundaries.mjs — Assert that the extension does not use prohibited APIs.
 */
import { readFileSync } from "node:fs";
import { globSync } from "glob";
import { relative } from "node:path";
import { cwd } from "node:process";

const ROOT = cwd();

const BANNED_PATTERNS = [
  "Agent\\.resume",
  "Agent\\.prompt",
  "mcpServers",
  "customTools",
  "registerTool",
  "registerCommand",
  "registerMessageRenderer",
  "registerEntryRenderer",
  "settingSources",
  "\\bagents\\s*:",
  "@modelcontextprotocol/sdk",
  "\\bcloud\\s*:",
  "\\.cursor[/\\\\]",
  "APPDATA.*Cursor",
  "keytar",
  "keychain",
  "models-store",
];

function checkFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const rel = relative(ROOT, filePath);
  const errors = [];

  for (const pattern of BANNED_PATTERNS) {
    const re = new RegExp(pattern, "gi");
    if (re.test(content)) {
      // Re-run to get match text
      const m = new RegExp(pattern, "gi").exec(content);
      errors.push(`${rel}: banned pattern "${pattern}" matched: "${m?.[0]?.slice(0, 80)}"`);
    }
  }

  return errors;
}

function main() {
  const srcFiles = globSync("src/**/*.ts", { cwd: ROOT, absolute: true });
  const testFiles = globSync("test/**/*.ts", { cwd: ROOT, absolute: true });

  let errors = [];

  for (const file of srcFiles) {
    errors = errors.concat(checkFile(file));
  }
  for (const file of testFiles) {
    errors = errors.concat(checkFile(file));
  }

  if (errors.length > 0) {
    console.error("BOUNDARY VIOLATIONS:");
    for (const err of errors) {
      console.error("  -", err);
    }
    process.exit(1);
  }

  console.log(`OK: ${srcFiles.length} src + ${testFiles.length} test files — no boundary violations`);
}

main();
