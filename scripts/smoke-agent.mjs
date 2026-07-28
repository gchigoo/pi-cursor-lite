#!/usr/bin/env node
/**
 * smoke-agent.mjs — Run an agent-mode canary smoke test in a disposable fixture.
 *
 * Creates a temporary git repo, runs a one-shot agent with a canary edit,
 * verifies the exact diff, then cleans up.
 */
import { Agent, JsonlLocalAgentStore } from "@cursor/sdk";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { cwd, chdir } from "node:process";

const KEY = process.env.CURSOR_API_KEY;
if (!KEY) {
  console.log("BLOCKED: CURSOR_API_KEY required");
  process.exit(2);
}

const CANARY_CONTENT = "SMOKE-AGENT-CANARY-" + Date.now();

const originalCwd = cwd();
const tempDir = mkdtempSync(join(tmpdir(), "pi-cursor-lite-agent-"));
const storeDir = mkdtempSync(join(tmpdir(), "pi-cursor-lite-store-"));
let exitCode = 0;

try {
  chdir(tempDir);

  // Init git repo
  execSync("git init", { stdio: "pipe" });
  execSync('git config user.email "smoke@test"', { stdio: "pipe" });
  execSync('git config user.name "Smoke Test"', { stdio: "pipe" });
  writeFileSync("README.md", "# Test Fixture\n");
  execSync("git add . && git commit -m init", { stdio: "pipe" });

  const beforeStatus = execSync("git status --porcelain=v1 -z --untracked-files=all", { encoding: "utf-8" });

  // Run agent-mode one-shot
  const agentResult = await Agent.prompt(
    `Create a file named "canary.txt" with the exact content "${CANARY_CONTENT}". Nothing else.`,
    {
      apiKey: KEY,
      model: { id: "default" },
      mode: "agent",
      local: {
        cwd: tempDir,
        store: new JsonlLocalAgentStore(storeDir),
      },
    }
  );

  // Verify canary file
  let canaryContent;
  try {
    canaryContent = readFileSync(join(tempDir, "canary.txt"), "utf-8");
  } catch {
    // File doesn't exist
  }

  const afterStatus = execSync("git status --porcelain=v1 -z --untracked-files=all", { encoding: "utf-8" });

  let pass = true;

  // 1. File was created with exactly the requested content
  if (canaryContent !== CANARY_CONTENT) {
    console.log("FAIL: canary.txt content is not exact");
    console.log("Expected:", JSON.stringify(CANARY_CONTENT));
    console.log("Got:", JSON.stringify(canaryContent?.slice(0, 200)));
    pass = false;
  }

  // 2. The only tree change is the expected untracked canary file
  const expectedStatus = "?? canary.txt\0";
  if (beforeStatus !== "") {
    console.log("FAIL: fixture was dirty before agent run:", JSON.stringify(beforeStatus));
    pass = false;
  }
  if (afterStatus !== expectedStatus) {
    console.log("FAIL: agent produced an unexpected tree diff");
    console.log("Expected status:", JSON.stringify(expectedStatus));
    console.log("Got status:", JSON.stringify(afterStatus));
    pass = false;
  }

  // 3. The run itself reached a successful terminal state
  if (agentResult.status !== "finished") {
    console.log("FAIL: agent run did not finish successfully");
    console.log("Status:", agentResult.status);
    console.log("Error:", agentResult.error?.message ?? "none");
    pass = false;
  }

  // 4. Usage present
  if (agentResult.usage) {
    console.log(`Usage: input=${agentResult.usage.inputTokens} output=${agentResult.usage.outputTokens} total=${agentResult.usage.totalTokens}`);
  }

  if (pass) {
    console.log(`PASS: agent smoke — canary.txt created with "${CANARY_CONTENT}", tree modified as expected`);
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
