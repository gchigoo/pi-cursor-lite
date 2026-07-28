---
doc_type: issue-review
issue: 2026-07-28-runtime-audit-remediation
status: passed
reviewer: subagent
reviewed: 2026-07-28
round: 5
lane_a_state: completed
lane_a_ref: 68de4226-d45d-444f-88bf-0f48346cf7d0
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: ocr CLI 未配置可用的 LLM endpoint
---

# runtime-audit-remediation 代码审查报告

## 1. Scope And Inputs

- Issue report: `runtime-audit-remediation-report.md`
- Analysis: `runtime-audit-remediation-analysis.md`
- Implementation evidence: `runtime-audit-remediation-fix-note.md`
- Diff basis: 仓库无首次提交，所有文件 untracked；按 fix-note 和本轮明确文件列表归因
- Review mode: full-rereview
- Baseline dirty files: 仓库全部文件为既有 untracked 基线；`.pi/`、`node_modules/`、tarball 等不归因于本 issue 源码改动

### Independent Review

- Detection: 可用隔离异构 Grok 4.5 High CLI reviewer；以 `--tools read,grep,find,ls` 强制只读。OCR CLI 存在，但 `ocr llm test` 因未配置 endpoint 失败。
- 环节 A 独立隔离 Task agent: heterogeneous-agent + completed，最终 ref `68de4226-d45d-444f-88bf-0f48346cf7d0`
- 环节 B OCR CLI: unavailable
- OCR severity mapping: High→blocking/important，Medium→nit/suggestion，Low→discarded
- Merge policy: 独立 reviewer 结果逐条用源码、SDK 类型和原 finding 核验；material 修正后执行完整独立复审
- Gate effect: none；最终独立复审为 `APPROVED`

## 2. Diff Summary

- 新增：`test/sdk-adapter.test.ts`、`scripts/test-pi-load.mjs`
- 修改：`src/sdk-port.ts`、`src/sdk-adapter.ts`、`src/stream.ts`、`src/context.ts`、`test/stream.test.ts`、`test/context.test.ts`、`scripts/test-packed.mjs`、`scripts/smoke-agent.mjs`、`package.json`、`package-lock.json`
- 删除：none
- 未跟踪 / staged：仓库无提交基线，全部为 untracked；无 staged
- 风险热点：异步取消时序、SDK 终态映射、提示词结构注入、生产网络依赖、发布 smoke 假阳性

## 3. Adversarial Pass

- 假设的生产 bug：wait/cancel 的不同 settle 顺序导致中止挂起、错误误报或 late rejection。
- 主动攻击过的反例：pre-create/pre-send abort、cancel success/failure/unsupported、wait finished/cancelled/error/reject、loser late rejection、signal 在成功结果交付前触发、XML 关闭标签注入、额外 worktree 修改。
- 结果：取消状态机冻结为首个 SDK 生命周期终态胜出，并对 loser rejection 显式 drain；最终 reviewer 无 material finding。

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

- 取消桥接不能只检查 AbortSignal；必须同时定义底层 cancel、Run terminal status 和 late-settle 的优先级。
- npm override 应定向限定到 Connect 依赖，避免影响 Pi 自身独立的 undici 8.x。

### praise

- 新增测试覆盖 send 期间竞态、取消不支持/失败、cancel success + late wait rejection，以及 wait-first 路径。
- stream 不再用 signal 覆盖 adapter 的 definitive terminal result。

## 5. Test And QA Focus

- QA 必须重点复核：`npm run check`、`npm run test:pi-load`、`npm run test:packed`、`npm audit --omit=dev`。
- Evidence pack residual risks / gate warnings：真实 Cursor agent smoke 缺 owner 授权凭证。
- 建议新增或加强的测试：当前取消矩阵和 XML 注入已有针对性单测；有凭证时执行 live agent smoke。
- 不能靠 review 完全确认的点：Cursor 服务端真实 cancel 行为和 agent-mode 文件系统副作用。

## 6. Residual Risk

- `smoke:agent` 需要显式 `CURSOR_API_KEY`；本轮未读取项目 `.pi/auth.json`，因此只验证了无凭证时 BLOCKED/exit 2 契约。该项需在 owner 授权凭证后联网复核。

## 7. Verdict

- Status: passed
- Next: 回到 issue fix 完成 gate，由 owner 确认修复完成；之后可选择 scoped commit。

## 8. Focused Closure

none；生产取消语义发生 material 变化，因此每轮均执行完整独立复审。
