---
doc_type: issue-review
issue: 2026-07-29-windows-shell-and-context-metadata
status: passed
reviewer: self
reviewed: 2026-07-29
round: 1
lane_a_state: skipped
lane_a_ref: ""
lane_a_reason: "独立 Task agent 不可用；owner 已批准 code-review-local-only"
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "ocr CLI 已安装，但 ocr llm test 报告没有可用 LLM endpoint 配置"
---

# Windows Shell 与上下文元数据代码审查报告

## 1. Scope And Inputs

- Report: `.codestable/issues/2026-07-29-windows-shell-and-context-metadata/windows-shell-and-context-metadata-report.md`
- Analysis: `.codestable/issues/2026-07-29-windows-shell-and-context-metadata/windows-shell-and-context-metadata-analysis.md`
- Fix note: `.codestable/issues/2026-07-29-windows-shell-and-context-metadata/windows-shell-and-context-metadata-fix-note.md`
- Implementation evidence: fix note、完整 diff、Cursor SDK 1.0.24 shell 初始化源码路径、`npm run prepublishOnly`
- Diff basis: README、`src/catalog.ts`、`src/sdk-adapter.ts`、新增 `src/runtime-shell.ts` 及对应测试
- Review mode: initial
- Baseline dirty files: `.codestable/goals/2026-07-28-publish-github-npm/approval-report.md`、`state.yaml`、`iterations/004.md` 为本 issue 前已存在的无关变更，未纳入审查

### Independent Review

- Detection: 当前宿主无合格独立 Task agent；`ocr` CLI 存在但没有可用 LLM endpoint
- 环节 A 独立隔离 Task agent: local-only + skipped（owner 已批准）
- 环节 B OCR CLI: unavailable
- OCR severity mapping: High→blocking/important, Medium→nit/suggestion, Low→discarded
- Merge policy: owner 授权主 agent 完成逐文件、对抗式和测试充分性审查
- Gate effect: 使用 `reviewer: self`；最终验证以 `CODESTABLE_ALLOW_SELF_REVIEW_FALLBACK=1` 执行

## 2. Diff Summary

- 新增：`src/runtime-shell.ts`、`test/runtime-shell.test.ts`
- 修改：`src/sdk-adapter.ts`、`src/catalog.ts`、`test/catalog.test.ts`、`README.md`、`README.zh-CN.md`
- 删除：none
- 未跟踪 / staged：新增 source、test 与 issue 产物均未跟踪；无 staged 变更
- 风险热点：进程级环境的短临界区、跨平台可执行文件发现、Cursor SDK terminal executor 初始化时序、模型 ID family 匹配

## 3. Adversarial Pass

- 假设的生产 bug：resolver 在非典型平台环境中拒绝 SDK 原本可用的 shell，或环境恢复时序早于 terminal executor 初始化。
- 主动攻击过的反例：
  - 自定义 Git 安装、portable Git、缺失 Git Bash、无效固定路径。
  - macOS zsh、Linux bash、最小化 Linux 仅有 `/bin/sh`。
  - action 抛错、两个请求并发进入不同 shell 环境。
  - GPT/Grok/Kimi variant ID 和未知模型 fallback。
  - 检查 SDK `sendImpl()`：`agent.send()` 在返回前会 await `getExecutor()` 和 executor `run()` 的建立，环境临界区覆盖 terminal executor 初始化。
- 结果：审查中发现最小化 Linux 的 POSIX sh 缺口，已在 `src/runtime-shell.ts:6-19,109-144` 补齐，并新增 `test/runtime-shell.test.ts:97` 回归测试；复验通过。当前无未关闭 finding。

## 4. Findings

### blocking

none

### important

none

### nit

none

### suggestion

none

### learning

- Cursor SDK 的 Windows shell 自动发现依赖未公开环境契约；SDK 升级时需复核 `agent.send()` 内 executor 初始化时序。
- 跨平台 shell 防御不能只覆盖交互式 bash/zsh，最小 Linux 的 POSIX sh 也是有效运行路径。

### praise

- shell 解析通过依赖注入覆盖三类平台，不依赖运行测试的宿主 OS。
- 环境临界区具备并发串行与异常恢复测试。
- 模型映射保持小范围 family 规则，未知模型仍采用保守 fallback。

## 5. Test And QA Focus

- QA 必须重点复核：自定义 Git Bash、无 Git Bash 的 pwsh、macOS zsh、Linux bash/sh、并发请求、无支持 shell 的受控错误。
- Evidence residual risks / gate warnings：真实联网 smoke 因无 `CURSOR_API_KEY` 未执行。
- 建议新增或加强的测试：获得可用凭证及对应平台 runner 后，增加真实 Cursor Local Agent shell smoke。
- 不能靠 review 完全确认的点：Cursor SDK 后续版本是否改变 terminal executor 初始化时机。

## 6. Residual Risk

- PowerShell 回退会短暂修改进程环境；provider 请求之间已串行并在 `finally` 恢复，但同进程其他扩展理论上可能观察到短暂值。
- macOS/Linux 当前只有平台注入单元测试，尚无真实平台 runner 结果。
- 本轮为 owner 批准的 local-only review，缺少独立上下文 reviewer。

## 7. Verdict

- Status: passed
- Next: 回到 `cs-issue` fix 阶段，等待 owner 确认修复完成

## 8. Focused Closure

none；POSIX sh finding 在首次本地审查定稿前已修复并完成全量复验。
