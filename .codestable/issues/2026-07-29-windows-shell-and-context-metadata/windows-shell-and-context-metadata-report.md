---
doc_type: issue-report
issue: 2026-07-29-windows-shell-and-context-metadata
status: confirmed
issue_path: standard
severity: P0
summary: Windows 自定义路径 Git Bash 下 Cursor Local Agent 导致 Pi 进程退出，且模型上下文元数据仍显示为 128k
tags:
  - windows-runtime
  - model-metadata
---

# Windows Shell 与上下文元数据 Issue Report

## 1. 问题现象

在 Windows Git Bash 中通过 pi-cursor-lite 使用 Cursor 模型时，Pi 因未捕获的子进程启动异常直接退出；异常尝试启动不存在的 `C:\Program Files\Git\bin\bash.exe`。同时，除已单独配置的模型外，Pi 中的 Cursor 模型上下文窗口仍显示为默认 128k，与 Cursor 已公开的模型上下文信息不一致。

## 2. 复现步骤

1. 将 Git for Windows 安装在非默认目录（例如 `D:\Software\Git`），并从该 Git Bash 启动 Pi。
2. 选择 pi-cursor-lite 提供的 Cursor 模型并发送请求。
3. 观察到 Pi 以 `spawn C:\Program Files\Git\bin\bash.exe ENOENT` 的 uncaughtException 退出。
4. 打开 `/model` 检查动态发现的模型元数据。
5. 观察到 Composer、GPT 等未单独配置的模型上下文窗口显示为 128k。

复现频率：满足自定义 Git 安装路径且运行环境未向 Cursor SDK 提供可用 Git Bash 路径时稳定复现崩溃；未命中特定映射的模型稳定显示 128k。

## 3. 期望 vs 实际

**期望行为**：pi-cursor-lite 在 Windows 上先探测用户实际安装的 Git Bash 路径；找不到可用 Git Bash 时改用 PowerShell（`pwsh`）运行，而不是尝试固定默认路径或使 Pi 进程退出。模型目录按 Cursor 官方已公开的默认上下文窗口提供准确元数据。

**实际行为**：运行时尝试启动不存在的默认 Git Bash 路径并触发 Pi 进程级退出；模型目录对多数动态模型统一使用 128k fallback。

## 4. 环境信息

- 涉及模块 / 功能：Cursor SDK 本地 Agent 适配、动态模型目录
- 相关文件 / 函数：`src/sdk-adapter.ts`、`src/catalog.ts` 及对应测试
- 运行环境：Windows、Git Bash、自定义 Git for Windows 安装目录、`@cursor/sdk@1.0.24`
- 其他上下文：用户提供的异常中目标路径为 `C:\Program Files\Git\bin\bash.exe`，错误码为 `ENOENT`；Windows shell 策略应优先发现实际 Git Bash，未发现时回退到 `pwsh`；Cursor 官方模型表公开了 200k、256k、262k、272k 等默认上下文值

## 5. 严重程度

**P0** — 一次正常模型请求可导致整个 Pi 进程退出，核心 provider 功能完全不可用；上下文元数据偏小同时造成不必要的提前 compaction。

## 备注

本问题同时覆盖同一用户路径中暴露的 Windows 运行时崩溃与模型元数据漂移。由于涉及 SDK 适配和模型目录两个模块，按 standard 路径进入根因分析，不走快速通道。
