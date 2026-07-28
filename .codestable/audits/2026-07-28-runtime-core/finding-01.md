---
doc_type: audit-finding
audit: 2026-07-28-runtime-core
finding_id: bug-01
nature: bug
severity: P0
confidence: high
suggested_action: cs-issue
status: open
---

# Finding 01：中止请求不会取消 Cursor Run

## 速答

Pi 的中止信号只停止接收增量，未调用 Cursor SDK 的 `run.cancel()`；在 `agent` 模式下，用户中止后 Agent 仍可能继续执行并修改文件。

## 关键证据

- `src/sdk-adapter.ts:57` — 信号中止后仅从 `onDelta` 回调返回，没有停止底层 Run。
- `src/sdk-adapter.ts:67-69` — 代码仍等待 `run.wait()` 完成，之后才把结果标记为 aborted。
- `node_modules/@cursor/sdk/dist/esm/run.d.ts:46` — 当前固定版本的 `Run` 明确提供 `cancel(): Promise<void>`，实现未调用。

## 影响

用户主动中止长任务或危险操作时，界面不再展示增量，但 Cursor Local Agent 可能继续消耗资源；在 `PI_CURSOR_MODE=agent` 下还可能继续改动工作区，破坏用户对“中止”的安全预期。

## 修复方向

监听 `AbortSignal` 并及时调用当前 Run 的取消能力，同时处理创建 Run 前后发生中止的竞态。

## 建议动作

`cs-issue`，因为这是可确认的中止语义错误，并涉及 agent 模式的文件修改安全。
