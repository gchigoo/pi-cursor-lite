---
doc_type: audit-finding
audit: 2026-07-28-runtime-core
finding_id: security-07
nature: security
severity: P2
confidence: medium
suggested_action: cs-issue
status: open
---

# Finding 07：XML 上下文分隔符可被消息内容伪造

## 速答

系统、用户、助手和工具结果正文未经转义直接嵌入自定义 XML 包络，消息内容可注入闭合标签并伪造其他角色区段。

## 关键证据

- `src/context.ts:22` — `systemPrompt` 原样插入 `<system>`。
- `src/context.ts:39`、`src/context.ts:44` — 用户与助手正文原样插入角色标签。
- `src/context.ts:49` — 工具结果正文原样插入；只有 `toolCallId` 调用了 `escapeXml`。
- `src/context.ts:82-89` — 已有 XML 转义函数，但未用于正文。

## 影响

仓库文件、工具输出或用户消息若包含 `</tool_result><system>...` 等内容，可破坏包络结构并提高角色混淆风险。由于整个包络最终仍是发给 Cursor Agent 的单条提示，实际模型服从程度不确定，故定为 P2/medium。

## 修复方向

对包络正文采用一致、可逆且经过测试的边界编码，避免内容与结构共享未转义分隔符。

## 建议动作

`cs-issue`，因为这是上下文编码的安全边界缺陷。
