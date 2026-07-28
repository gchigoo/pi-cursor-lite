---
doc_type: issue-fix
issue: 2026-07-28-runtime-audit-remediation
status: confirmed
path: standard
fix_date: 2026-07-28
related: [runtime-audit-remediation-analysis.md]
tags:
  - runtime
  - security
  - verification
---

# 运行时审计整改修复记录

## 1. 根因摘要

`src/sdk-adapter.ts` 仅实现 Cursor Run happy path，没有把 Pi AbortSignal 桥接到 `Run.cancel()`，也没有区分 SDK 的 `finished/error/cancelled` 终态；Pi synthetic `auto` ID 被直接传给 Cursor。`src/context.ts` 只转义 attribute，正文仍可伪造角色标签。依赖解析、Pi load 入口、packed 失败退出和 agent smoke 断言各自存在独立门禁缺陷。

## 2. 实际采用方案

采用 owner 批准的方案 A：

1. AbortSignal 注册一次性 listener；活动 Run 调用 `cancel()`，并覆盖 signal 在 create/send 前后触发的竞态。wait/cancel 采用首个 SDK 生命周期终态胜出规则，显式 drain loser rejection，避免挂起和迟到 rejection。
2. 端口增加 `error` 终态；Cursor `cancelled` 映射为 `aborted`，取消不支持/失败映射为 `error`，`finished` 保持成功，不再由 stream 二次解释 signal。
3. 在 Cursor SDK 边界将 `auto` 转为 canonical `default`。
4. 对 system/user/assistant/tool-result XML 正文统一转义。
5. 只对 `@connectrpc/connect-node` 的 undici 定向 override 到 6.27.0，保留 Pi 自身 undici 8.5.0。
6. 新增使用 Pi 公共 `discoverAndLoadExtensions()` 的 source load 测试；packed 缺文件改为抛错并非零退出；agent canary 改为精确文件内容和唯一 git status 断言。

## 3. 改动文件清单

- `src/sdk-port.ts`：扩展 Run 终态契约。
- `src/sdk-adapter.ts`：取消桥接、竞态处理、终态映射和 auto ID 映射。
- `src/stream.ts`：SDK error 映射为 Pi error event。
- `src/context.ts`：转义所有 XML 正文。
- `test/sdk-adapter.test.ts`：新增 auto、终态和取消竞态测试。
- `test/stream.test.ts`、`test/context.test.ts`：新增失败终态与标签注入回归测试。
- `scripts/test-pi-load.mjs`：新增 Pi 真实 loader 验证。
- `scripts/test-packed.mjs`：修复缺文件退出语义并缩小临时安装范围。
- `scripts/smoke-agent.mjs`：精确断言 canary 内容和唯一树改动。
- `package.json`、`package-lock.json`：定向解析 `undici@6.27.0`。

未修改分析范围外的源码，也未引入新的运行时抽象。

## 4. 验证结果

- `npm run check`：通过；8 个测试文件、54 个测试通过。
- `npm run verify:boundaries`：通过；9 个 src、8 个 test 文件无边界违规。
- `npm run verify:manifest`：通过。
- `npm run test:pi-load`：通过；Pi loader 成功加载并注册 cursor-lite。
- `npm run test:packed`：通过；11 个文件、11,502 bytes，临时安装和文件检查通过。
- `npm ls undici --all`：Cursor/Connect 使用 overridden 6.27.0；Pi 使用 8.5.0。
- `npm audit --omit=dev --json`：退出码 0，生产依赖 0 个漏洞。
- 三个修改脚本的 `node --check`：通过。
- 无凭证执行 `smoke:agent`：按契约返回 BLOCKED/退出码 2；未读取或使用项目本地凭证。
- issue 文档 YAML 校验：写本记录前 3/3 通过；最终校验见 review/完成 gate。

## 5. 遗留事项

- 真实 Cursor 联网和 agent-mode 精确 diff smoke 需要 owner 显式提供/授权 `CURSOR_API_KEY`；本轮没有读取 `.pi/auth.json` 或使用任何凭证。
- 仓库仍无首次提交，全部文件显示为 untracked，无法提供历史 diff 基线；本记录仅列本 issue 可归因改动。
