---
doc_type: feature-design-review
feature: 2026-07-23-cursor-provider-lite
status: passed
review_state: passed
review_reason: ""
reviewer_id: 86cf8d86-8139-4a03-8459-22a7c5003b78
reviewed: 2026-07-23
round: 7
---

# cursor-provider-lite feature design 审查报告

## 1. Scope And Inputs

- Design: `.codestable/features/2026-07-23-cursor-provider-lite/cursor-provider-lite-design.md`
- Checklist: `.codestable/features/2026-07-23-cursor-provider-lite/cursor-provider-lite-checklist.yaml`
- Related docs: `.codestable/requirements/cursor-model-provider.md`、`.codestable/requirements/VISION.md`
- Intent / roadmap / architecture: none
- Code facts: 仓库尚无业务源码；核验 Pi `0.81.1` Provider/stream/auth/extension 类型与文档，以及 `@cursor/sdk@1.0.24` package-root exports、Agent/Run/usage/store 类型和 SDK 文档

### Independent Review

- Status: completed
- Detection: independent-agent
- Provider / agent: `deepseek/deepseek-v4-pro` / `86cf8d86-8139-4a03-8459-22a7c5003b78`
- Read-only control: `--no-tools --no-extensions --no-skills`；审查前后 git porcelain 一致
- Raw output: 已消费，未纳入仓库；结论为“无 blocking，整体可实现、可验证”
- Merge policy: 主 agent 用固定版本 `.d.ts`、官方文档和 design/checklist 逐条核验
- Gate effect: review completed，允许给出最终 verdict

## 2. Design Summary

- Goal: 以 `cursor-lite` Provider 把 Cursor Local Agent 作为 One-shot runtime 接入 Pi `/model`；默认 `plan`，仅进程启动时显式设置 `agent`
- Contracts: model id 保持 Cursor canonical id；Cursor 拥有工具循环；Pi 只映射 text/thinking/final usage；每请求独立 store/Agent/Run；不做 Cloud/resume/MCP bridge/tool replay/复杂 UI
- Steps / checks: S1-S8、C01-C20；热点为 stream 协议、P0-P4 cleanup、packed catalog 和真实 agent canary
- Baseline: checklist YAML validator passed；11 个 validation commands 覆盖 offline、typecheck、packed install、Pi load/unload、catalog、plan/context、agent

## 3. Findings

### blocking

none

### important

- [x] FDR-001 `design §2.1; checklist C04`：`reasoning=false` 与 thinking event 的 TUI 组合需集成证明。
  - Impact: 可能隐藏 thinking，但不影响 Provider 可实现性。
  - Resolution: S3/IT-PI-STREAM 强制验证；若 Pi 过滤，改为 `reasoning=true` 并说明不映射 thinking 参数。

- [x] FDR-002 `requirement 边界; design decision-8/SC-05`：不能声称 ambient hooks/file-based subagents 已关闭。
  - Evidence: SDK 只明确保证未传 `settingSources` 时不加载 ambient MCP。
  - Resolution: requirement/design 已准确披露；S8 增加 disposable poison probe，README 必须与观察一致。

- [x] FDR-003 `design decision-5; checklist C12/C14`：Cursor catalog 不提供 context/output/cost 元数据。
  - Impact: 固定估算可能过早 compact 或过晚上游拒绝，零 cost 可能被误读为免费。
  - Resolution: 为守住轻量 scope，不维护模型数据库；README 醒目标注估算和 `models.json` override。作为整体方案 review 点交用户拍板。

- [x] FDR-004 `requirement 用户故事; SC-11/SC-14; C10`：功能卸载与凭证清除必须分开。
  - Resolution: requirement 已区分；README 必须给出 `/logout` → 选择 `cursor-lite`/Cursor Lite → 验证清除的步骤。

### nit

- [ ] FDR-005 `design §2.1`：`baseUrl` 仅满足 Pi metadata，不参与 SDK transport。保留注释并由 packed integration 证明 Pi 不向该 URL 发请求。
- [ ] FDR-006 `design §2.2 P4`：Windows 文件锁可能超过固定 rm 重试窗口；已有 CLEANUP/residual 契约，implementation 可在不改契约时调重试间隔。

### suggestion

- [ ] FDR-007 保持 `PiContextEnvelopeV1` host notice 简短；首版不要增加 version negotiation 或新 prompt 协议。

### learning / praise

- P0-P4 资源获取表与 primary×cleanup 终态矩阵可复用到其他第三方 Agent adapter。
- “明确不做 + import/call allowlist + packed negative test”有效守住轻量边界。
- Provider id 与 canonical model id 分层、One-shot temp store、卸载与凭证清除分离均清晰可审计。

## 4. User Review Focus

- 需拍板接受：One-shot 每请求重新探索；Cursor 原生工具不进入 Pi tool audit；ambient hooks/subagents 可能按 SDK 默认生效；context/maxTokens/cost 是 Pi 侧估算。
- implementation：只用 package-root public API；terminal 后必须 `end`；P0-P4 cleanup 先于 Pi terminal；不读 Cursor Desktop/CLI 凭证。
- QA：重点复核 thinking probe、ambient config poison probe、packed catalog、cleanup residual；真实 agent 仅在 disposable fixture 运行。
- External gate: 当前环境无 Cursor SDK API Key；CMD-009~011 需 owner 提供 key。缺 key 必须报 `BLOCKED`，不能冒充通过。

## 5. Evidence Confidence Ledger

| Check | Verdict | Class | Basis | Follow-up |
|---|---|---|---|---|
| Acceptance Coverage Matrix | pass | E | 15 scenarios 均有 owner/evidence/command/core 标记 | live gate 需 key |
| DoD Contract | pass | E | design/impl/review/QA/accept 五门齐全 | 后续逐门留证 |
| Step/Check cross refs | pass | E | S1-S8 与 C01-C20 均可回指 | implementation 更新 evidence |
| Roadmap consistency | n/a | C | 无 roadmap | none |
| Module/interface boundaries | pass | E | 固定 Pi/Cursor 公共类型和负向边界 | code review 重验 imports |
| Validation artifacts | pass | E | YAML validator + CMD-001~011 | 执行后记录输出 |

Summary: E=5, C=1, H=0.

## 6. Residual Risks

- 无 key 时不能证明真实 catalog/plan/context/agent；离线测试不能替代 owner live gate。
- plan 不是 sandbox；Cursor hooks/subagents 和原生工具可能产生 Pi 审计之外的副作用。
- 模型窗口、输出上限、价格是 Pi 估算，不是 Cursor 服务端权威元数据。
- SIGKILL/断电和顽固文件锁可能留下含 prompt/代码上下文的 `pi-cursor-lite-*` temp。
- One-shot 每次重新探索，延迟和 token 消耗高于恢复/池化方案。

## 7. Focused Closure

- 最终独立审查后只补充了 thinking/SC-05 probes、README logout 步骤、catalog 顺序和“固定估算”术语及对应 matrix/checklist 映射。
- Classification: non-contract validation/documentation closure；这些只收紧既有证据/表述，未改变 runtime scope、用户行为或外部接口，因此无需新一轮完整独立审查。

## 8. Verdict

- Final status: passed
- Blocking count: 0
- Important findings: 4，均已转为明确 implementation/README gate 或显式轻量取舍
- Recommended next step: 进入用户方案确认；获批后将 design/checklist 置为 active 并执行 S1
