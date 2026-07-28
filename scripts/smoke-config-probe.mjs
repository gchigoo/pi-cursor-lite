#!/usr/bin/env node
/**
 * smoke-config-probe.mjs — Probe whether ambient hooks/subagents are loaded by default.
 *
 * Places a .cursor/hooks.json with a detectable side effect, runs a plan-mode
 * agent, and checks whether the hook executed.
 */
import { Agent, JsonlLocalAgentStore } from "@cursor/sdk";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { cwd, chdir } from "node:process";

const KEY = process.env.CURSOR_API_KEY;
if (!KEY) {
  console.log("BLOCKED: CURSOR_API_KEY required");
  process.exit(2);
}

const originalCwd = cwd();
const tempDir = mkdtempSync(join(tmpdir(), "pi-cursor-lite-probe-"));
const storeDir = mkdtempSync(join(tmpdir(), "pi-cursor-lite-store-"));
const probeFile = join(tempDir, "HOOK_PROBE_RESULT.txt");
let exitCode = 0;

try {
  chdir(tempDir);

  // Init git repo
  execSync("git init", { stdio: "pipe" });
  execSync('git config user.email "smoke@test"', { stdio: "pipe" });
  execSync('git config user.name "Smoke Test"', { stdio: "pipe" });
  writeFileSync("README.md", "# Test Fixture\n");

  // Place a .cursor/hooks.json that writes to a probe file on beforeShellExecution
  const hooksDir = join(tempDir, ".cursor");
  mkdirSync(hooksDir, { recursive: true });
  writeFileSync(join(hooksDir, "hooks.json"), JSON.stringify({
    version: 1,
    hooks: {
      beforeShellExecution: [
        {
          command: process.platform === "win32"
            ? `cmd /c "echo HOOK_EXECUTED > ${probeFile}"`
            : `sh -c 'echo HOOK_EXECUTED > "${probeFile}"'`
        }
      ]
    }
  }));

  // Place a subagent definition
  mkdirSync(join(hooksDir, "agents"), { recursive: true });
  writeFileSync(join(hooksDir, "agents", "probe-agent.md"), "# Probe Agent\nSmoke test probe.");

  writeFileSync("README.md", "# Test Fixture\n");
  execSync("git add . && git commit -m init", { stdio: "pipe" });

  // Run agent-mode one-shot with a harmless shell command to trigger hooks
  await Agent.prompt(
    "Run a shell command: echo hello",
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

  // Check if the hook executed
  if (existsSync(probeFile)) {
    const content = readFileSync(probeFile, "utf-8").trim();
    console.log(`RESULT: Hooks ARE loaded by default (probe file contains: "${content}")`);
    console.log("ACTION: README must disclose that project/user .cursor/hooks.json will execute");
  } else {
    console.log("RESULT: Hooks NOT loaded by default");
    console.log("ACTION: README can state that ambient hooks are disabled");
  }

  // Also check if subagents were loaded (harder to detect; just note)
  console.log("INFO: Subagent probe files placed but auto-detection requires tool call inspection");

} catch (err) {
  console.error("PROBE ERROR:", err.message);
  exitCode = 1;
} finally {
  chdir(originalCwd);
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  try { rmSync(storeDir, { recursive: true, force: true }); } catch {}
}

process.exit(exitCode);
