# pi-cursor-lite

[English](./README.md) | **简体中文**

面向 [Pi](https://github.com/earendil-works/pi) 的轻量级 Cursor 模型 provider：无需引入 Cloud、resume 或 MCP 等重型能力，即可通过 `/model` 使用 Cursor 模型。

每次请求都会创建独立的 **一次性 Cursor Local Agent**：

- Agent 循环与文件访问在本机执行
- 模型推理由 Cursor 托管
- 默认仅使用 `plan` 模式，不修改文件
- 只有在 Pi 进程启动时显式设置 `PI_CURSOR_MODE=agent` 才启用文件编辑

## 快速开始

```bash
# 1. 在 Pi 中安装已发布的 npm 包
pi install npm:pi-cursor-lite@0.1.0

# 2. 设置 Cursor API Key
export CURSOR_API_KEY=sk-cursor-...

# 或在 Pi 内执行 /login，然后选择 cursor-lite

# 3. 选择 Cursor 模型
# 在 Pi 中：/model cursor-lite/auto
```

## 环境要求

- **Node.js** >= 22.19
- **Pi** >= 0.81.1（peer dependency）
- **Cursor SDK API Key** — 从 [cursor.com/settings](https://cursor.com/settings) 获取
- 本扩展**不会**复用 Cursor Desktop 或 Cursor CLI 的登录状态

## 运行模式

| 模式 | 行为 | 启用方式 |
|---|---|---|
| `plan`（默认） | 分析、规划和推理，不修改文件 | 无需配置 |
| `agent` | 完整 Agent 能力，包括文件编辑 | 启动 Pi 前设置 `PI_CURSOR_MODE=agent` |

> **警告：** `agent` 模式允许 Cursor Agent **直接修改当前工作目录中的文件**。启用前请提交或备份工作区。

`plan` 只是行为默认值，**不是安全沙箱**。Cursor Agent 的原生工具和项目级 hook 仍可能执行。

## 发送给 Cursor 的数据

每次请求会向 Cursor 托管服务发送：

- Pi system prompt
- 对话历史（仅文本）
- 工具调用与结果摘要
- Cursor Agent 在运行中读取的文件内容

**V1 不支持图片**，provider 会直接拒绝图片输入。

## Cursor 原生工具与审计缺口

Cursor Agent 在内部运行自己的 read、write、edit、bash、grep 等工具。这些工具调用和结果**不会**出现在 Pi 的工具审计日志中；Pi 只能看到最终文本、thinking stream 和 token usage。

### 环境配置

本扩展不会注入 MCP server、自定义工具或 Cursor agent 定义。此外：

- 未提供 `settingSources`，因此不会加载 `.cursor/mcp.json` 等环境 MCP 配置
- 已通过一次性 fixture poison probe 确认，headless SDK 默认不会加载项目或用户级 `.cursor/hooks.json`
- 不会显式注入 `.cursor/agents/*.md` 文件型 subagent

即便如此，仍建议在使用前检查工作区中的 `.cursor/` 目录。

## Cursor SDK 基础

本扩展基于官方 [Cursor TypeScript SDK 文档](https://cursor.com/cn/docs/sdk/typescript) 和固定版本 `@cursor/sdk@1.0.24` 的公开根导出实现，使用：

- `Cursor.models.list()` 获取账号可用的 canonical model ID
- `Agent.create()` 创建本地一次性 Agent
- `agent.send(..., { onDelta })` 与 `run.wait()` 处理流式输出和终态
- `JsonlLocalAgentStore` 与 `Symbol.asyncDispose` 隔离和清理临时状态

SDK 目录提供 ID、名称、参数和 variant，但不提供 context window 或输出限制；因此 Pi 所需的这些字段由扩展提供保守估值。

## 模型元数据

| 模型 / 字段 | Pi 值 | 来源 / 精度 |
|---|---:|---|
| `grok-4.5` contextWindow | 256000 | Cursor [Models & Pricing](https://cursor.com/cn/docs/models-and-pricing) 的 `256k` |
| `auto` contextWindow | 128000 | Pi 侧保守 fallback，实际路由模型未知 |
| 其他动态模型 contextWindow | 128000 | Pi 侧保守 fallback |
| maxTokens | 16384 | Pi 侧估值 |
| cost | $0 | 未知；显示为零不代表免费 |

### 用户模型覆盖

可在 `~/.pi/agent/models.json` 中使用 Pi 的 `modelOverrides` 覆盖扩展元数据，同时保留动态发现的 Cursor 模型目录：

```json
{
  "providers": {
    "cursor-lite": {
      "modelOverrides": {
        "grok-4.5": {
          "contextWindow": 256000,
          "maxTokens": 16384
        }
      }
    }
  }
}
```

Pi 会在扩展注册和动态模型刷新后应用相同 ID 的覆盖项，因此用户配置优先级最高。打开 `/model` 会重新加载 `models.json`；尚未出现在 Cursor 目录中的 ID 会被忽略。

### Compaction 位置

Context window 与 compaction 策略是两个独立配置。可在 `~/.pi/agent/settings.json` 或项目 `.pi/settings.json` 中设置：

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

当 `contextTokens > contextWindow - reserveTokens` 时，Pi 会自动 compaction。按 Grok 4.5 默认值计算，阈值约为 `239616` tokens；`keepRecentTokens` 控制保留多少未摘要的近期上下文。

## 凭证管理

### 设置 API Key

Pi 标准解析优先级：

1. CLI `--api-key`
2. `auth.json[cursor-lite]`（在 Pi 内执行 `/login` 并选择 `cursor-lite`）
3. `CURSOR_API_KEY` 环境变量
4. `models.json` provider 配置

### 移除凭证

先移除扩展包：

```bash
pi remove npm:pi-cursor-lite
```

再任选一种方式清除凭证：

- 在 Pi 中执行 `/logout`，选择 **Cursor Lite** 或 `cursor-lite`
- 手动编辑 `~/.pi/agent/auth.json`，删除 `cursor-lite` 条目

移除 package 不会自动删除 `auth.json` 中的 API Key。

## V1 限制

- **仅文本** — 图片会被拒绝
- **一次性运行** — 每次请求创建新 Agent，Cursor 侧不保持对话连续性
- **不支持 session resume**
- **无 MCP bridge** — Cursor 工具不会转换成 Pi tool call
- **无 Cloud 支持** — 仅本地 Agent runtime
- **不映射模型参数** — 暂不暴露 thinking effort、temperature 等参数
- **元数据不完整** — Grok 4.5 使用文档值，其他模型限制为估值

## 平台支持

| 平台 | 状态 |
|---|---|
| win32-x64 | 已验证，live smoke 通过 |
| darwin-arm64 | 可安装，未验证 |
| darwin-x64 | 可安装，未验证 |
| linux-arm64 | 可安装，未验证 |
| linux-x64 | 可安装，未验证 |

## 残余风险

1. **临时文件残留：** 崩溃、SIGKILL 或断电后，系统临时目录中的 `pi-cursor-lite-*` 可能残留，其中包含 prompt 和 Agent state。建议定期清理。
2. **环境 hook：** 项目或用户级 `.cursor/hooks.json` 可能在 Agent 运行期间执行而不被 Pi 感知。
3. **无工具审计：** Cursor 内部 shell 和文件写入不会记录到 Pi session history。
4. **元数据漂移：** Cursor 可能在服务端调整模型限制；扩展元数据滞后时，以用户 `modelOverrides` 为准。

## 开发

```bash
npm install
npm run typecheck
npm test
npm run check
```

Live smoke 需要 `CURSOR_API_KEY`：

```bash
CURSOR_API_KEY=sk-cursor-... npm run smoke:live
```

## 许可证

[MIT](./LICENSE) © Gchigoo
