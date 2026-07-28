---
doc_type: audit-finding
audit: 2026-07-28-runtime-core
finding_id: maintainability-08
nature: maintainability
severity: P2
confidence: high
suggested_action: cs-refactor
status: open
---

# Finding 08：agent smoke 未验证承诺的精确 diff

## 速答

agent smoke 声称验证“精确 diff”，实际只检查 canary 内容包含哨兵且工作树发生任意变化，额外或危险修改也可能通过。

## 关键证据

- `scripts/smoke-agent.mjs:4-6` — 文件注释声明会验证 exact diff。
- `scripts/smoke-agent.mjs:67` — canary 校验使用 `includes`，不是精确内容匹配。
- `scripts/smoke-agent.mjs:75-77` — 只检查前后 status 不相等，没有断言唯一变化是 `canary.txt`。

## 影响

SDK 或 Agent 若同时修改 README、配置或其他文件，该安全 canary 仍可能 PASS，削弱 agent 模式回归测试的可信度。

## 修复方向

对规范化后的 `git diff` 和未跟踪文件清单做精确断言，并要求 canary 文件内容完全相等。

## 建议动作

`cs-refactor`，因为生产行为不变，目标是提升验证脚本的准确性和可维护性。
