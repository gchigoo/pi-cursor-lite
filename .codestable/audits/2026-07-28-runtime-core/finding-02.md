---
doc_type: audit-finding
audit: 2026-07-28-runtime-core
finding_id: bug-02
nature: bug
severity: P1
confidence: high
suggested_action: cs-issue
status: open
---

# Finding 02：SDK error/cancelled 被当作成功

## 速答

适配器没有检查 `run.wait()` 返回的终态，除本地信号中止外一律返回 `finished`，导致 SDK 失败可能被 Pi 展示为成功结束。

## 关键证据

- `node_modules/@cursor/sdk/dist/esm/run.d.ts:6-7` — SDK 终态包括 `finished`、`error` 和 `cancelled`。
- `src/sdk-adapter.ts:67` — 获取 `run.wait()` 结果后未分支检查 `result.status` 或 `result.error`。
- `src/sdk-adapter.ts:89` — 非本地中止路径无条件返回 `status: "finished"`。
- `src/stream.ts:140-143` — 适配器返回 finished 后，外层固定发出 `done/stop`。

## 影响

Cursor 侧明确失败或取消时，用户可能收到空白或残缺响应但状态为成功；错误详情被丢失，也会干扰重试与故障定位。

## 修复方向

显式映射 SDK 的 finished、error、cancelled 三种终态，并保留经脱敏的终端错误信息。

## 建议动作

`cs-issue`，因为这是运行状态映射错误。
