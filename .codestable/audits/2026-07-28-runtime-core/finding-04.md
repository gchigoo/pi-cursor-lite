---
doc_type: audit-finding
audit: 2026-07-28-runtime-core
finding_id: security-04
nature: security
severity: P1
confidence: medium
suggested_action: cs-issue
status: open
---

# Finding 04：运行时依赖 undici 5.29.0 存在已知漏洞

## 速答

固定的 `@cursor/sdk@1.0.24` 经 `@connectrpc/connect-node` 引入 `undici@5.29.0`，当前 npm 审计报告包含资源耗尽、请求/响应走私等已知漏洞。

## 关键证据

- `package.json:33` — 生产依赖固定为 `@cursor/sdk@1.0.24`。
- `package-lock.json:533-540` — `@connectrpc/connect-node` 依赖 `undici ^5.28.4`。
- `package-lock.json:4585-4586` — 实际锁定版本为 `undici 5.29.0`。
- 审计命令 `npm audit --omit=dev --json` — 返回退出码 1，报告 3 个受影响包；`undici` 汇总严重度为 high，当前解析下 `fixAvailable: false`。

## 影响

该依赖位于 Cursor SDK 的生产网络栈。部分通告依赖特定 HTTP/WebSocket 行为，项目是否走到所有易受攻击路径尚未确认，因此置信度为 medium；但运行时依赖不能忽略。

## 修复方向

确认 Cursor SDK 的可升级版本或上游修复计划，并在升级前评估可安全使用的依赖覆盖策略。

## 建议动作

`cs-issue`，因为这是已被依赖审计识别的生产依赖风险。
