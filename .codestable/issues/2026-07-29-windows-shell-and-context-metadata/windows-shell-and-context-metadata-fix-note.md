---
doc_type: issue-fix
issue: 2026-07-29-windows-shell-and-context-metadata
status: confirmed
path: standard
fix_date: 2026-07-29
related: [windows-shell-and-context-metadata-analysis.md]
tags:
  - windows-runtime
  - cross-platform
  - model-metadata
---

# Shell 探测与上下文元数据修复记录

## 1. 根因摘要

`src/sdk-adapter.ts:80` 原先直接进入 Cursor Local Agent，未补齐 SDK 在 Windows MSYS 环境依赖的 shell hint。`@cursor/sdk@1.0.24` 在 `MSYSTEM` 存在、`EXEPATH` 缺失时会无条件回退到 `C:\Program Files\Git\bin\bash.exe`，该路径不存在时其 spawn error 可越过 Promise 错误边界并终止 Pi。检查 `@cursor/sdk@1.0.26` 后确认上游仍保留相同逻辑。

`src/catalog.ts:8-21` 则只为 Grok 4.5 提供精确上下文窗口，其余模型统一回退到 128k，低于 Cursor 已公开的默认上下文基线。

## 2. 实际采用方案

采用 owner 批准的跨平台方案 A：

1. 新增 `src/runtime-shell.ts`，在进入 SDK terminal executor 前解析受支持的 shell。
2. Windows 优先使用有效环境线索定位 Git Bash，并可从 `where.exe git` 推导自定义或 portable Git 根目录；找不到时依次回退到 `pwsh` 和 Windows PowerShell。
3. macOS 保留有效 `$SHELL`，否则按 zsh、bash、pwsh、POSIX sh 回退；Linux 按 bash、zsh、pwsh、POSIX sh 回退。
4. shell 环境只在 `agent.send()` 初始化 terminal executor 的临界区生效；并发请求通过队列串行，所有环境字段在 `finally` 中恢复。
5. 无可用 shell 时在调用 SDK 前抛出受控错误，避免 SDK 尝试固定不存在路径。
6. 模型默认 fallback 从 128k 调整为 200k；Grok 4.5、Kimi K2.7、GPT-5 系列分别使用 256k、262k、272k。

第一性原则核对：外部行为只改变 shell 选择稳定性与模型元数据；未修改 Cursor Agent 生命周期、模式、凭证、工具桥接或公共 provider API；未引入 worker 子进程等未批准架构。

## 3. 改动文件清单

- `src/runtime-shell.ts`：新增跨平台 shell 解析、Windows Git 安装推导、环境临界区和恢复逻辑。
- `src/sdk-adapter.ts`：在 SDK terminal executor 初始化时应用解析后的 shell。
- `src/catalog.ts`：更新 200k fallback 和已知模型系列映射。
- `test/runtime-shell.test.ts`：覆盖自定义/portable Git Bash、Windows pwsh、macOS、Linux、无 shell、异常恢复和并发串行。
- `test/catalog.test.ts`：覆盖 200k fallback 以及 Grok/Kimi/GPT 精确规则。
- `README.md`、`README.zh-CN.md`：记录跨平台 shell 策略和新上下文元数据。
- `.codestable/issues/2026-07-29-windows-shell-and-context-metadata/`：问题报告、分析、批准状态与本修复记录。

未触碰分析范围外的代码；工作区原有 `.codestable/goals/2026-07-28-publish-github-npm/` 变更未纳入本修复。

## 4. 验证结果

- `npm run prepublishOnly`：通过。
  - TypeScript typecheck 通过。
  - 9 个测试文件、64 项测试全部通过。
  - source/test boundary 检查通过（10 个 source、9 个 test 文件）。
  - package manifest 检查通过。
  - Pi extension load 通过。
  - npm pack、临时安装及 packed Pi load 通过（14 个文件，18.2 KiB）。
  - `npm audit --omit=dev`：0 vulnerabilities。
- Windows 自定义 Git 路径、portable Git 推导、pwsh 回退均有定向单元测试。
- macOS zsh、Linux bash 与最小化 Linux POSIX sh 路径有平台注入测试。
- shell 环境异常恢复和并发串行有定向测试。
- 200k/256k/262k/272k 上下文规则有目录测试。

## 5. 遗留事项

- 当前环境未提供 `CURSOR_API_KEY`，因此未执行真实联网 `smoke:live`；实际 Cursor SDK terminal executor 的跨平台 live 验证仍需有凭证的后续 smoke。
- PowerShell 回退依赖 SDK 在 `agent.send()` 内初始化 terminal executor；该假设已由固定 SDK 源码路径确认，但 SDK 升级时必须回归。
- 环境临界区会短暂修改进程级 shell 字段；provider 内并发已串行且 `finally` 恢复，但同进程其他扩展理论上仍可能在该短窗口观察到临时值。
