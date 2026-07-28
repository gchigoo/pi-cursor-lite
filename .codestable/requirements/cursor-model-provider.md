---
doc_type: requirement
slug: cursor-model-provider
pitch: 在 Pi 中直接选择 Cursor 模型，同时保持扩展小巧、透明、可审计
status: draft
last_reviewed: 2026-07-23
implemented_by: []
tags: [pi, cursor, model-provider]
---

# 在 Pi 中使用轻量 Cursor 模型 Provider

## 用户故事

- 作为 Pi 用户，我希望通过 `/model` 选择 Cursor 模型，而不安装包含 Cloud、恢复、MCP 等能力的重型扩展。
- 作为担心误改工作区的用户，我希望 Cursor 默认先分析和规划，只有在启动 Pi 进程时显式选择执行模式后才允许它实施改动。
- 作为扩展使用者，我希望代码量和功能边界足够小，能够快速审计、定位问题并完整移除功能；保存到 Pi 的凭证由我通过 `/logout` 选择 Cursor Lite 后单独清除。

## 为什么需要

完整的 Cursor 集成通常同时承担云端运行、会话恢复、工具桥接和复杂界面等职责。只想在 Pi 中调用 Cursor 模型的用户，也要接受较大的安装体积、行为表面和维护成本。

## 怎么解决

安装一个边界清晰的轻量扩展后，用户可以从 Pi 的模型列表选择自己账号可用的 Cursor 模型。扩展默认让 Cursor 先规划，用户显式切换后才使用其执行能力，并对缺少凭证、模型不可用和运行失败给出明确反馈。

## 边界

- 只提供本地 Agent Runtime，不创建或管理 Cursor Cloud 任务；模型推理仍由 Cursor 托管。
- 不提供会话恢复、MCP/Pi 工具桥接、Cursor 原生工具回放和复杂配置界面。
- 使用前必须提供 Cursor SDK API Key；不复用 Cursor Desktop 或 Cursor CLI 的登录状态。
- Cursor 保留自己的 Agent 工具循环和 SDK 默认的本地配置行为，不把工具调用转换成 Pi 原生工具调用；项目/用户 hooks 或 subagents 是否生效以固定 SDK 行为为准，因此 Pi 会话不是 Cursor 工具操作的完整审计日志。
- Pi system prompt、文本历史、文本 tool result 和 Cursor 读取的工作区内容可能发送给 Cursor 托管服务。
- 默认规划模式是进程级行为默认值，不作为恶意工具或外部进程的安全隔离边界。
