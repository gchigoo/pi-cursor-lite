---
doc_type: issue-analysis
issue: 2026-07-28-runtime-audit-remediation
status: confirmed
root_cause_type: logic
related:
  - runtime-audit-remediation-report.md
tags:
  - runtime
  - audit-remediation
---

# 运行时审计整改根因分析

## 1. 问题定位

| 关键位置 | 说明 |
|---|---|
| `src/sdk-adapter.ts:57-69` | 中止后只丢弃 delta，仍等待 `run.wait()`；固定 SDK 的 `Run` 实际提供 `cancel()`。 |
| `src/sdk-adapter.ts:67-89` | 不检查 `RunResult.status/error`，无条件转换成 finished。 |
| `src/catalog.ts:27`、`src/sdk-adapter.ts:42` | Pi 侧 synthetic `auto` 未映射，直接作为 Cursor model ID。 |
| `package-lock.json:533-540,4585-4586` | Cursor SDK 的 Connect 1.x 网络层锁到有通告的 `undici@5.29.0`；当前 Cursor SDK 1.0.24 已是最新版。 |
| `package.json:24` | `test:pi-load` 指向不存在文件。 |
| `scripts/test-packed.mjs:49-52` | 缺包文件仅打印错误，不产生非零退出码。 |
| `src/context.ts:22-49` | XML 包络只转义 attribute，正文未编码。 |
| `scripts/smoke-agent.mjs:67-77` | canary 仅 includes 哨兵并检查“有任意变化”，没有精确断言 diff。 |

## 2. 失败路径还原

**正常路径**：Pi 传入模型、上下文和 AbortSignal → 适配器创建 Cursor Run → 正确流式返回；中止时取消 Run；终态按 finished/error/cancelled 映射；验证脚本对缺陷返回非零。

**失败路径**：

1. 中止只使 delta callback return，底层 Run 继续到 `wait()` 结束；agent 模式可能继续执行工具。
2. SDK 返回 error/cancelled 时仍被转换为 finished，外层发出 `done/stop`。
3. 用户选择文档推荐的 `auto` 时，适配器不执行 `auto → default` 转换；项目的 SDK smoke 使用 `default`。
4. npm 按 Connect 1.x 范围解析出旧 undici；上游当前无可直接升级的 Cursor SDK 版本。
5. 三个验证脚本分别因目标缺失或断言/退出语义不足产生硬失败或假阳性。
6. 上下文正文可包含与包络相同的关闭标签，从数据区逃逸到结构区。

**分叉点**：`src/sdk-adapter.ts:57-89` 是生产运行时主分叉；其余问题分别发生在 ID 适配、依赖解析、正文编码和验证断言处。

## 3. 根因

**根因类型**：逻辑错误为主，兼有数据格式和配置/依赖解析问题。

**根因描述**：当前实现只覆盖 Cursor Run 的 happy path，端口模型没有表达 SDK 失败详情，也没有把 Pi 的取消生命周期桥接到 SDK；Pi 展示模型 ID 与 Cursor canonical ID 混用。验证层则缺少“失败必须非零、改动必须精确”的统一门禁。上下文采用 XML 样式分隔符却只转义 attribute。依赖风险来自最新 Cursor SDK 仍固定在 Connect 1.x，而 npm 为其解析了存在通告的 undici 5.x。

**是否有多个根因**：是。运行时生命周期/终态是主根因；模型别名、依赖解析、包络编码和脚本断言是四个独立次根因。

## 4. 影响面

- **影响范围**：所有 cursor-lite 请求的中止与终态；`auto` 默认入口；所有传往 Cursor 的历史消息；发布/load/live smoke 门禁。
- **潜在受害模块**：`sdk-adapter`、`stream`、`catalog`、`context`、package install/load 和 agent-mode smoke。
- **数据完整性风险**：有。中止失效可能使 agent 模式继续写工作区；smoke 假阳性可能放过额外修改。
- **严重程度复核**：维持整体 P0；它来自中止语义。依赖风险维持 P1，但修复需用 override 后的完整测试约束兼容性。

## 5. 修复方案

### 方案 A：最小直接整改（推荐）
- **做什么**：为当前 Run 注册 abort listener 并调用 `cancel()`；扩展端口终态并正确映射；在 SDK 边界做 `auto → default`；用 npm override 将 Connect 1.x 唯一使用的 Headers polyfill 提升到已修复的 `undici@6.27.0`；对 XML 正文统一转义；补真正使用 Pi `loadExtensions()` 的 load test；修复 packed/agent smoke 断言；添加单元测试。
- **优点**：逐条对应 8 个 finding，改动集中，保留当前架构与公开 Pi 模型 ID。
- **缺点 / 风险**：undici 跨 major override 需要全量离线测试与 package/load 验证；Cursor 的真实联网行为仍需凭证 smoke 才能最终确认。
- **影响面**：预计修改 `src/sdk-port.ts`、`src/sdk-adapter.ts`、`src/context.ts`、相关测试、三个 scripts、`package.json` 与 lockfile。

### 方案 B：扩大边界重构
- **做什么**：重建可注入的 Cursor Agent lifecycle abstraction；改用长度前缀/JSON 上下文协议；把三个 smoke fixture 抽成共享框架；对 Cursor SDK/Connect 依赖做本地 fork。
- **优点**：类型和测试隔离更强，未来扩展状态更容易。
- **缺点 / 风险**：明显扩大范围，引入维护 fork 和新抽象，远超本次 8 条审计发现。
- **影响面**：会新增多个运行时模块和测试基础设施，发布风险更高。

### 推荐方案

**已批准方案 A**。owner 于 2026-07-28 确认该方案。它直接修复所有已确认问题，避免把定点整改扩成架构重写；对唯一高风险点 undici override 使用类型检查、41+ 单测、Pi load、packed install 和 npm audit 共同验收。
