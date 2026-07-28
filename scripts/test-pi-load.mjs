#!/usr/bin/env node
/**
 * test-pi-load.mjs — Load the source extension through Pi's real extension loader.
 */
import { discoverAndLoadExtensions } from "@earendil-works/pi-coding-agent";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const extensionPath = process.argv[2]
  ? resolve(process.argv[2])
  : join(ROOT, "src", "index.ts");
const result = await discoverAndLoadExtensions(
  [extensionPath],
  ROOT,
  join(ROOT, ".pi-load-empty"),
);

if (result.errors.length > 0) {
  for (const error of result.errors) {
    console.error(`FAIL: ${error.path}: ${error.error}`);
  }
  process.exit(1);
}

if (result.extensions.length !== 1) {
  console.error(`FAIL: expected 1 loaded extension, got ${result.extensions.length}`);
  process.exit(1);
}

const registration = result.runtime.pendingProviderRegistrations.find(
  (entry) => entry.name === "cursor-lite",
);
if (!registration) {
  console.error("FAIL: cursor-lite provider was not registered");
  process.exit(1);
}

const { config } = registration;
if (
  config.api !== "cursor-sdk-local" ||
  config.models?.[0]?.id !== "auto" ||
  typeof config.refreshModels !== "function" ||
  typeof config.streamSimple !== "function"
) {
  console.error("FAIL: cursor-lite provider registration is incomplete");
  process.exit(1);
}

console.log(`PASS: Pi loaded ${extensionPath} and registered cursor-lite`);
