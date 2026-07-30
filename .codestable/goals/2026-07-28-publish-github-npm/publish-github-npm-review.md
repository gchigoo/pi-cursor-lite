---
doc_type: goal-review
goal: publish-github-npm
status: passed
reviewer: subagent
reviewed: 2026-07-29
round: 1
lane_a_state: completed
lane_a_ref: "pi-cli:xai/grok-4.5:release-review-20260729"
lane_a_reason: "独立 Grok 4.5 High 只读审查完整 0.1.1 worktree diff"
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "OCR CLI 无可用 LLM endpoint；本轮由真实异构 Grok reviewer 覆盖独立 gate"
---

# publish-github-npm 代码审查报告

## 1. Scope And Inputs

- Goal: `.codestable/goals/2026-07-28-publish-github-npm/goal.md`
- Security decision: `.codestable/goals/2026-07-28-publish-github-npm/approval-report.md`
- Shell issue: `.codestable/issues/2026-07-29-windows-shell-and-context-metadata/`
- Implementation evidence: 当前完整 worktree diff、fork registry metadata、packed consumer tree/audit、`npm run prepublishOnly`
- Diff basis: `HEAD` (`d8a861f`) 到当前 unstaged/untracked worktree
- Review mode: initial + focused-closure
- Baseline dirty files: goal iteration 004 与状态文件原为既有 dirty；本轮恢复同一 goal 后其内容已成为当前发布状态证据

### Independent Review

- Detection: 可通过 Pi CLI 启动独立 `xai/grok-4.5` high reviewer
- 环节 A 独立隔离 Task agent: heterogeneous-agent + completed
- 环节 B OCR CLI: unavailable
- OCR severity mapping: High→blocking/important, Medium→nit/suggestion, Low→discarded
- Merge policy: Grok findings 已逐条对照仓库和真实 npm 安装事实核验；两个 gate 缺口完成 focused closure
- Gate effect: 代码实现通过；外部 commit/push/main publish 仍受 goal owner-stop 控制

## 2. Diff Summary

- 新增：跨平台 shell resolver/tests、Windows issue 产物、`packages/connect-node/` fork、fork verification script、goal iterations 004/005
- 修改：SDK adapter、catalog metadata/tests、package manifest/lock、packed/manifest gates、双语 README、goal 状态与授权记录
- 删除：none
- 未跟踪 / staged：新增 source、tests、fork 和流程产物均未跟踪；无 staged 变更
- 风险热点：进程环境临界区、npm alias/dedupe、第三方 fork 来源与许可、真实消费端 audit、发布顺序

## 3. Adversarial Pass

- 假设的生产 bug：开发根 audit 假绿，普通消费者仍安装 Undici 5；或 fork provenance gate 实际自己与自己比较。
- 主动攻击过的反例：shrinkwrap 不传播、只 bundle Connect Node 导致 SDK 另装官方节点、alias 未 dedupe、`--omit=peer` 误删 protobuf、fork dist 漂移、最小 Linux 仅 POSIX sh、并发环境恢复、SDK executor 初始化时序。
- 结果：Grok 发现 fork 自比和 alias/dedupe 断言不足，均已关闭；`--omit=peer` 问题由真实 packed load 暴露并改用 `--legacy-peer-deps` 保留 SDK 运行依赖。

## 4. Findings

### blocking

none

### important

none

### nit

none

### suggestion

- commit/push 后再发布主包，确保 `@gchigoo/connect-node` 公共 provenance URL 指向与已发布 tarball 一致的源码。

### learning

- npm dependency 自身的 overrides 和 shrinkwrap 都不能证明普通消费端安全；必须在干净消费根检查 lock/tree/audit。
- npm `--omit=peer` 可能省略同时由普通 dependency 和 peer dependency 约束的 protobuf；packed load 应使用 `--legacy-peer-deps` 仅避免宿主 peer 自动安装。

### praise

- 安全 fork 只修改 permissive Connect Node package metadata，不重新分发专有 Cursor SDK。
- fork tarball 小于 31 KiB，保持 53 个运行时/类型文件与 upstream 1.7.0 一致。

## 5. Test And QA Focus

- QA 必须重点复核：registry alias、单一 Connect Node node、Undici 6.27.0、consumer audit=0、Pi packed load、自定义 Git Bash 与 pwsh fallback。
- Evidence residual risks / gate warnings：无 `CURSOR_API_KEY`，未执行本轮真实 Cursor Agent smoke；macOS/Linux 仍为注入式平台测试。
- 建议新增或加强的测试：有凭证时在 Windows 自定义 Git Bash 和无 Git Bash/pwsh 环境运行 live smoke。
- 不能靠 review 完全确认的点：Cursor SDK 后续版本是否改变 executor 初始化时序或 Connect Node semver contract。

## 6. Residual Risk

- fork 已发布，但其仓库路径在 commit/push 前尚未公开；这是发布顺序 blocker，不是未修代码 finding。
- `pi-cursor-lite@0.1.1` publish、`0.1.0` deprecate、GitHub push 和本机安装尚未授权/执行。
- shell 环境临界区仍会短暂修改进程级环境；已有串行与 `finally` 恢复测试。

## 7. Verdict

- Status: passed
- Next: goal release owner-stop；先 commit/push provenance，再发布主包、deprecate 0.1.0 并做终端功能验收

## 8. Focused Closure

- Closed findings: REV-001（fork provenance 自比）、REV-003（alias/dedupe 断言不足）
- Attributed delta: `packages/connect-node/upstream-dist.sha256.json`、`scripts/test-connect-node-fork.mjs:21-81`、`scripts/test-packed.mjs:70-117`
- Targeted verification: `npm run test:connect-node-fork`、`npm run test:packed`、`npm run prepublishOnly` 全部通过；published fork dry-run shasum/integrity 与 registry 发布输出一致
- Classification: 仅测试、hash evidence 与 gate 强化；未改变运行时行为、公开 API、安全架构或并发语义
