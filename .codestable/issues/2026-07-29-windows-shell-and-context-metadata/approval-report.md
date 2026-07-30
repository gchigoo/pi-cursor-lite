---
doc_type: approval-report
unit: 2026-07-29-windows-shell-and-context-metadata
status: approved
reason: fix-completion-approved
approvals:
  issue-report: approved
  issue-fix-plan: approved
  code-review-local-only: approved
  issue-fix-completion: approved
approval_groups: {}
created_at: 2026-07-29
---

# Approval Report

## Decision History

- 2026-07-29：根据用户提供的 Windows Git Bash 崩溃日志和 128k 上下文元数据现象创建问题报告草案。
- 2026-07-29：owner 要求 Windows shell 策略先发现用户实际安装的 Git Bash，无法发现时回退到 `pwsh`；报告已按反馈修订。
- 2026-07-29：owner 确认修订后的问题报告，批准进入根因分析。
- 2026-07-29：完成代码与 SDK 失败路径分析，形成三种修复方案并推荐方案 A。
- 2026-07-29：owner 批准方案 A，并要求 shell 探测同时覆盖 Windows、macOS 和 Linux；analysis 已据此确认。
- 2026-07-29：实现和 `npm run prepublishOnly` 验证完成；独立 Task agent 不可用，OCR 未配置 endpoint，申请 local-only code review 降级。
- 2026-07-29：owner 明确批准 local-only code review。
- 2026-07-29：本地对抗式审查发现并修复最小 Linux POSIX sh 缺口；64 项测试及完整 prepublish gate 复验通过，review 状态为 passed。
- 2026-07-29：owner 批准 fix completion，本 issue 完成。

## Decision

owner 已确认本轮修复完成。

## Completion Basis

实现、完整验证和 owner 授权的 local-only code review 均已完成；issue fix completion gate 已通过。

## Context

- Windows 支持实际 Git Bash 探测以及 pwsh/Windows PowerShell 回退。
- macOS 支持有效 shell、zsh/bash/pwsh/POSIX sh；Linux 支持有效 shell、bash/zsh/pwsh/POSIX sh。
- 模型上下文使用 200k fallback，以及 GPT 272k、Grok 256k、Kimi 262k。
- `CODESTABLE_ALLOW_SELF_REVIEW_FALLBACK=1 npm run prepublishOnly` 已通过：64 项测试、typecheck、边界、manifest、Pi load、packed install/load、生产依赖 audit 全部成功。
- `windows-shell-and-context-metadata-review.md`：`status: passed`、`reviewer: self`。

## Outcome

- Issue 状态：completed
- Code review：passed
- Blocking / important findings：none
- 后续动作：按需提交 scoped changes；发布与部署不在本次批准范围内。

## Risks And Tradeoffs

- 当前环境没有 `CURSOR_API_KEY`，未执行真实 Cursor Agent live smoke。
- macOS/Linux 为平台注入单元测试，未在真实 runner 上验证。
- local-only review 缺少独立 reviewer，已由 owner 明确批准降级。

## Non-Automatic Actions

确认完成不会自动 commit、发布或部署，也不会读取真实 API key。

## Completion

本 issue 已闭环。
