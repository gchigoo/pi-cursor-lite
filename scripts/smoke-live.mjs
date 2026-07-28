#!/usr/bin/env node
/**
 * smoke-live.mjs — Run a plan-mode smoke test with real Cursor Agent.
 *
 * Creates a temporary directory, initializes a git repo, runs a one-shot
 * plan-mode agent with a sentinel prompt, and verifies:
 * 1. Response contains the sentinel
 * 2. No files were modified (git porcelain clean)
 * Then cleans up.
 */
import { Agent, JsonlLocalAgentStore } from "@cursor/sdk";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { cwd, chdir } from "node:process";

const KEY = process.env.CURSOR_API_KEY;
if (!KEY) {
  console.log("BLOCKED: CURSOR_API_KEY required");
  process.exit(2);
}

const SENTINEL = "PANGOLIN-CURSOR-LITE-SMOKE-".padEnd(8, "X").slice(0, 8) + Math.random().toString(36).slice(2, 10);

const originalCwd = cwd();
const tempDir = mkdtempSync(join(tmpdir(), "pi-cursor-lite-smoke-"));
const storeDir = mkdtempSync(join(tmpdir(), "pi-cursor-lite-store-"));
let exitCode = 0;

try {
  chdir(tempDir);

  // Init git repo with a file
  execSync("git init", { stdio: "pipe" });
  execSync('git config user.email "smoke@test"', { stdio: "pipe" });
  execSync('git config user.name "Smoke Test"', { stdio: "pipe" });
  writeFileSync("README.md", "# Test Fixture\nThis is a smoke test fixture.\n");
  execSync("git add . && git commit -m init", { stdio: "pipe" });

  // Capture git state BEFORE
  const beforeStatus = execSync("git status --porcelain --untracked-files=all", { encoding: "utf-8" });

  // Run one-shot plan agent using static prompt convenience
  const planResult = await Agent.prompt(
    `Reply with the sentinel "${SENTINEL}" and nothing else. Do not write any files. Just output the sentinel.`,
    {
      apiKey: KEY,
      model: { id: "default" },
      mode: "plan",
      local: {
        cwd: tempDir,
        store: new JsonlLocalAgentStore(storeDir),
      },
    }
  );

  // Check that the sentinel was returned
  const responseText = planResult.result || "";

  // Capture git state AFTER
  const afterStatus = execSync("git status --porcelain --untracked-files=all", { encoding: "utf-8" });

  // Verify
  let pass = true;

  // 1. Plan mode doesn't modify files
  if (beforeStatus !== afterStatus) {
    console.log(`FAIL: git status changed in plan mode`);
    console.log("Before:", JSON.stringify(beforeStatus));
    console.log("After:", JSON.stringify(afterStatus));
    pass = false;
  }

  // 2. Response contains sentinel
  if (!responseText.includes(SENTINEL)) {
    console.log(`FAIL: response doesn't contain sentinel "${SENTINEL}"`);
    console.log("Response:", responseText.slice(0, 200));
    pass = false;
  }

  // 3. Model identity present
  if (planResult.model?.id) {
    console.log(`Model: ${planResult.model.id}`);
  }

  // 4. Usage present
  if (planResult.usage) {
    console.log(`Usage: input=${planResult.usage.inputTokens} output=${planResult.usage.outputTokens} total=${planResult.usage.totalTokens}`);
  }

  if (pass) {
    console.log(`PASS: plan smoke — sentinel "${SENTINEL}" returned, 0 tree changes`);
  } else {
    exitCode = 1;
  }
} catch (err) {
  console.error("FAIL:", err.message);
  exitCode = 1;
} finally {
  chdir(originalCwd);
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  try { rmSync(storeDir, { recursive: true, force: true }); } catch {}
}

process.exit(exitCode);
