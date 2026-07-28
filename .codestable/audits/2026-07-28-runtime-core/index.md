---
doc_type: audit-index
audit: 2026-07-28-runtime-core
scope: src、test 与相关 scripts 的运行时核心代码
dimensions:
  - bug
  - security
  - performance
  - maintainability
created: 2026-07-28
status: active
total_findings: 8
---

# runtime-core 审计报告

## 范围

扫描 `src/*.ts`、`test/*.test.ts` 与 `scripts/*.mjs`，检查 Bug、安全、性能和可维护性；按用户确认，不检查架构偏离。

## 总评

共发现 8 条：Bug 5 条、安全 2 条、可维护性 1 条，性能维度未发现值得单列的问题；严重度为 P0 1 条、P1 5 条、P2 2 条。最优先的是请求中止未调用 Cursor Run 的取消能力：在 `agent` 模式下，用户中止后本地 Agent 仍可能继续执行和修改文件。离线类型检查与 41 个测试均通过，但现有测试未覆盖若干关键运行时状态和发布脚本失败语义。

## 发现清单

| # | 性质 | 严重度 | 置信度 | 标题 | 文件 |
|---|---|---|---|---|---|
| 1 | bug | P0 | high | 中止请求不会取消 Cursor Run | [finding-01.md](finding-01.md) |
| 2 | bug | P1 | high | SDK error/cancelled 被当作成功 | [finding-02.md](finding-02.md) |
| 3 | bug | P1 | medium | `auto` 模型 ID 未映射到 SDK 的 `default` | [finding-03.md](finding-03.md) |
| 4 | security | P1 | medium | 运行时依赖 undici 5.29.0 存在已知漏洞 | [finding-04.md](finding-04.md) |
| 5 | bug | P1 | high | `test:pi-load` 指向不存在的脚本 | [finding-05.md](finding-05.md) |
| 6 | bug | P1 | high | 打包验证缺文件时仍可能返回成功 | [finding-06.md](finding-06.md) |
| 7 | security | P2 | medium | XML 上下文分隔符可被消息内容伪造 | [finding-07.md](finding-07.md) |
| 8 | maintainability | P2 | high | agent smoke 未验证承诺的精确 diff | [finding-08.md](finding-08.md) |

## 按维度分布

| 性质 | P0 | P1 | P2 | 合计 |
|---|---|---|---|---|
| bug | 1 | 4 | 0 | 5 |
| security | 0 | 1 | 1 | 2 |
| performance | 0 | 0 | 0 | 0 |
| maintainability | 0 | 0 | 1 | 1 |
| arch-drift | 0 | 0 | 0 | 0 |
| **合计** | **1** | **5** | **2** | **8** |

## 下一步建议

- **P0 立刻修**：Finding 01，建议开 `cs-issue`，确保中止会真正停止 Cursor Run。
- **P1 本迭代修**：Finding 02–06；优先处理运行状态映射与依赖漏洞，再修复失效的发布验证命令。
- **P2 有空再看**：Finding 07–08，收紧上下文分隔符并提高 agent smoke 的判定精度。
