---
doc_type: issue-report
issue: 2026-07-28-runtime-audit-remediation
status: confirmed
issue_path: standard
severity: P0
summary: 运行时中止与终态语义、默认模型、依赖安全及验证脚本存在八项已确认缺陷
tags:
  - runtime
  - audit-remediation
---

# 运行时审计整改 Issue Report

## 1. 问题现象

审计确认 8 项异常：请求中止后底层 Agent 可能继续运行；SDK 失败终态可能显示成功；推荐的 `auto` 模型与 SDK smoke 使用的自动路由 ID 不一致；生产依赖审计失败；`test:pi-load` 无法启动；打包验证可能误报成功；上下文角色分隔符可被正文伪造；agent smoke 不能排除额外文件改动。

## 2. 复现步骤

1. 打开 `.codestable/audits/2026-07-28-runtime-core/` 中的 8 条 finding，按各自证据路径检查实现。
2. 执行 `npm run test:pi-load`，观察到 `MODULE_NOT_FOUND`。
3. 执行 `npm audit --omit=dev`，观察到生产依赖漏洞并返回非零退出码。
4. 对其余运行时与脚本问题使用受控 fake、静态契约和临时 fixture 复现。

复现频率：确定性代码路径稳定复现；`auto` ID 与依赖漏洞的实际影响需在修复验证中分别用 SDK 契约和依赖解析确认。

## 3. 期望 vs 实际

**期望行为**：中止会停止底层 Run；所有 SDK 终态被正确映射；默认模型 ID 可执行；生产依赖无已知可修复风险；所有验证命令可靠地成功或失败；上下文边界与 agent smoke 不产生假阳性。

**实际行为**：上述八项中至少一项 P0、五项 P1 和两项 P2 不满足期望。

## 4. 环境信息

- 涉及模块 / 功能：Cursor SDK 适配器、Pi 流式桥接、模型目录、上下文包络、发布与 live smoke 脚本
- 相关文件 / 函数：`src/sdk-adapter.ts`、`src/stream.ts`、`src/catalog.ts`、`src/context.ts`、`scripts/*.mjs`、`package.json`
- 运行环境：Node.js v24.15.0，Windows Git Bash，`@cursor/sdk@1.0.24`
- 其他上下文：完整证据见 `.codestable/audits/2026-07-28-runtime-core/index.md`

## 5. 严重程度

**P0** — 中止失效在 agent 模式下可能让用户试图停止的文件修改继续执行；其余问题一并按审计优先级整改。

## 备注

用户已明确选择全部 audit findings 并要求全部修复，因此本报告按已确认的 standard 路径进入根因分析。
