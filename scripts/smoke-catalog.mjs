#!/usr/bin/env node
/**
 * smoke-catalog.mjs — Verify Cursor SDK model catalog.
 */
import { Cursor } from "@cursor/sdk";

const KEY = process.env.CURSOR_API_KEY;
if (!KEY) {
  console.log("BLOCKED: CURSOR_API_KEY required");
  process.exit(2);
}

try {
  const models = await Cursor.models.list({ apiKey: KEY });
  console.log(`PASS: ${models.length} models discovered`);

  // Verify canonical ids
  const ids = models.map((m) => m.id);
  const uniq = new Set(ids);
  if (ids.length !== uniq.size) {
    console.log("FAIL: duplicate model ids found");
    process.exit(1);
  }

  // List models
  console.log("\nCanonical models:");
  for (const m of models) {
    console.log(`  ${m.id} — ${m.displayName}`);
  }

  // Verify "default" (auto) model exists
  const hasDefault = models.some((m) => m.id === "default");
  if (!hasDefault) {
    console.log("\nWARN: no 'default' model found (auto routing may not work)");
  }

  console.log("\nPASS: catalog smoke passed");
} catch (err) {
  console.error("FAIL:", err.message);
  process.exit(1);
}
