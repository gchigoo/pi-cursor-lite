---
doc_type: issue-analysis
issue: 2026-07-29-windows-shell-and-context-metadata
status: confirmed
root_cause_type: config
related: [windows-shell-and-context-metadata-report.md]
tags:
  - windows-runtime
  - model-metadata
---

# Windows Shell 与上下文元数据根因分析

## 1. 问题定位

| 关键位置 | 说明 |
|---|---|
| `src/sdk-adapter.ts:80` | 直接创建 Cursor Local Agent，未在进入 SDK 前规范化 Windows shell 环境。 |
| `node_modules/@cursor/sdk/dist/esm/357.js:1`（约 offset 994864） | SDK 1.0.24 在 `MSYSTEM` 存在、`EXEPATH` 缺失时只检查两个默认 Git 路径，最后仍无条件返回 `C:\Program Files\Git\bin\bash.exe`。 |
| `src/catalog.ts:8` | 未知模型的上下文窗口固定为 128000。 |
| `src/catalog.ts:16-21` | 只有 `grok-4.5` 有精确映射，其余动态模型全部落到 128k fallback。 |
| `src/catalog.ts:26-32` | `auto` 同样固定使用 128k。 |

补充验证：当前最新 `@cursor/sdk@1.0.26` 仍保留同一默认路径逻辑，因此仅升级依赖不能解决 shell 崩溃。Cursor 官方模型表目前给出的默认上下文基线包括 Composer/多数模型 200k、Grok 4.5 256k、Kimi K2.7 Code 262k、GPT-5 系列 272k。

## 2. 失败路径还原

**正常路径**：Pi 请求 → `createCursorSdkAdapter().run()` → Cursor SDK 根据有效 `EXEPATH` 找到 Git Bash，或在非 MSYS 环境选择 PowerShell → Local Agent 初始化 shell → 返回 Run。

**失败路径**：从自定义目录 Git Bash 启动 Pi → 环境有 `MSYSTEM` 但没有 SDK 可用的 `EXEPATH` → SDK 忽略实际 PATH/Git 位置并返回固定默认路径 → `spawn()` 对不存在的 bash 触发未处理 `error` 事件 → Pi 收到 uncaughtException 并退出。

模型元数据路径：SDK 返回 canonical model ID → `buildModelConfigs()` 调用 `contextWindowFor()` → 除 `grok-4.5` 外均命中 128k fallback → Pi 提前按 128k 阈值 compaction。

**分叉点**：`src/sdk-adapter.ts:80` 未补齐 SDK 依赖的 Windows shell hint；`src/catalog.ts:21` 将所有未知 ID 统一压到过低的 128k。

## 3. 根因

**根因类型**：配置 / 环境，伴随模型元数据缺省策略不完整。

**根因描述**：Cursor SDK 的 Windows Git Bash 自动发现依赖 `EXEPATH`，缺失时错误地假设 Git 安装在 `C:\Program Files\Git`，且其 spawn 错误未被 SDK 转换为可捕获 Promise rejection。pi-cursor-lite 没有在 SDK 边界补齐实际 shell 路径或建立 PowerShell 回退。与此同时，扩展明知 SDK 目录不返回上下文数字，却只维护一个模型特例，其余统一使用早期的 128k 保守值。

**是否有多个根因**：是。主根因是 SDK shell 探测缺陷与 provider 边界缺少防御；次根因是模型上下文映射覆盖不足和 fallback 过低。

## 4. 影响面

- **影响范围**：所有从自定义目录 Git Bash 启动、且 `EXEPATH` 未正确导出的 Windows 用户；macOS/Linux 上无效或非 SDK 支持的 `$SHELL` 也属于同一 shell 边界；128k 则影响 `auto` 和大多数动态模型。
- **潜在受害模块**：Local Agent 创建、shell/文件工具执行、Pi 进程稳定性、模型选择展示、自动 compaction。
- **数据完整性风险**：plan 模式主要是进程和会话中断；agent 模式下异常退出可能留下临时状态或未完成文件修改。
- **严重程度复核**：维持 P0，因为 provider 的正常请求能终止宿主 Pi 进程。

## 5. 修复方案

### 方案 A：跨平台 shell 探测 + 受控回退（已批准）
- **做什么**：增加独立跨平台 shell resolver。Windows 依次验证现有 hint、MSYS/Git 环境线索和 `where.exe`/Git 安装位置，找到后向 SDK 设置真实 `EXEPATH`；找不到 Git Bash 时探测 `pwsh`，再兼容 Windows PowerShell。macOS 优先有效 `$SHELL`，再回退 zsh/bash/pwsh；Linux 优先有效 `$SHELL`，再回退 bash/zsh/pwsh。只在 SDK 初始化 terminal executor 的短临界区内受控应用 shell 环境并串行化，之后恢复；无可用 shell 时返回受控 provider 错误。模型 fallback 提升到官方最低默认值 200k，并为 Grok、Kimi K2.7、GPT-5 系列使用官方精确默认值。
- **优点**：满足自定义 Git Bash、pwsh 回退及 macOS/Linux 防御；不修改第三方包；改动集中且可单测；避免 128k 提前 compaction。
- **缺点 / 风险**：shell 回退需要短暂调整进程环境，必须用互斥和 `finally` 恢复；SDK 后续改变初始化时机时需回归验证。
- **影响面**：新增跨平台 shell resolver 及测试，修改 `sdk-adapter.ts`、`catalog.ts`、模型测试和双语 README。

### 方案 B：只探测 Git Bash，失败时给出 pwsh 启动指引
- **做什么**：找到 Git Bash 就设置 `EXEPATH`；找不到时阻止 SDK 调用并提示用户从 pwsh 重新启动 Pi。上下文元数据同方案 A。
- **优点**：完全不临时修改进程环境，实现最稳妥。
- **缺点 / 风险**：不是自动 pwsh 回退，用户仍需重启，体验较差。
- **影响面**：比方案 A 少一个回退临界区和并发控制。

### 方案 C：将 Cursor SDK Local Agent 移入隔离子进程
- **做什么**：父进程探测 shell后，以独立环境启动 worker，通过 IPC 转发流和取消事件；上下文元数据同方案 A。
- **优点**：shell 环境完全隔离，不污染 Pi 进程。
- **缺点 / 风险**：显著增加 IPC、生命周期、打包和取消语义复杂度，超出轻量 provider 的当前边界。
- **影响面**：SDK 适配器和发布边界需要较大改造。

### 推荐方案

**已批准方案 A**。owner 进一步明确 shell 探测必须覆盖 Windows、macOS 和 Linux。实现保持当前单进程架构，把环境切换限定在 SDK terminal executor 初始化阶段，以互斥和 `finally` 控制副作用；若验证表明 SDK 初始化超出该阶段，则停止并提请降级采用方案 B，而不扩大为子进程重构。
