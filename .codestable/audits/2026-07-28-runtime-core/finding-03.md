---
doc_type: audit-finding
audit: 2026-07-28-runtime-core
finding_id: bug-03
nature: bug
severity: P1
confidence: medium
suggested_action: cs-issue
status: open
---

# Finding 03：`auto` 模型 ID 未映射到 SDK 的 `default`

## 速答

扩展公开并推荐 `cursor-lite/auto`，但运行时把 `auto` 原样传给 SDK；项目自己的真实 SDK smoke 则统一使用并检查 canonical ID `default`。

## 关键证据

- `src/catalog.ts:27` — Pi 侧静态回退模型 ID 为 `auto`。
- `README.md:24` — 快速开始明确推荐 `/model cursor-lite/auto`。
- `src/sdk-adapter.ts:42` — `input.modelId` 不经映射直接传给 `Agent.create()`。
- `scripts/smoke-catalog.mjs:32`、`scripts/smoke-live.mjs:49`、`scripts/smoke-agent.mjs:45` — SDK 侧 smoke 均将自动路由 ID 视为 `default`。

## 影响

若固定的 Cursor SDK 不接受 `auto` 作为 `default` 的别名，文档推荐的无网络回退模型会在真正发起请求时失败。当前未使用凭证执行付费/联网探针，因此触发结论保持中等置信度。

## 修复方向

明确 Pi 展示 ID 与 Cursor canonical ID 的映射，并增加适配器级测试或受控 live canary。

## 建议动作

`cs-issue`，因为可能影响默认用户路径，但需先用受控探针确认 SDK 是否接受别名。
