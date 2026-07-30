---
doc_type: approval-report
unit: 2026-07-28-publish-github-npm
status: approved
reason: release-0.1.1-approved
approvals:
  github-create-push: approved
  npm-publish: approved
  local-uninstall-install: approved
  github-repository-visibility: approved
  npm-distribution-security-strategy: approved
  connect-node-fork-publish: approved
  release-0.1.1: approved
approval_groups: {}
created_at: 2026-07-28
---

# Approval Report

## Decision History

- 2026-07-28：owner 授权创建/推送 public GitHub、发布 npm 包，并在发布后把 Pi 从本地 source 切换到 npm source。
- 2026-07-28：GitHub 与 npm `pi-cursor-lite@0.1.0` 发布成功；Pi 已切换到 npm source。
- 2026-07-28：普通消费端 audit 暴露 `undici@5.29.0` 的 1 high + 3 moderate；goal 因 overrides 不传播而停止。
- 2026-07-29：owner 决定不等待上游、不接受风险，在本项目内直接修复。
- 2026-07-29：owner 批准 public npm publish `@gchigoo/connect-node@1.7.1`，但明确不同时授权主包发布、deprecate 或 GitHub push。
- 2026-07-29：scoped fork 发布成功并在 public registry 可见；主包 0.1.1 alias/dedupe、packed consumer audit、64 tests 和完整 prepublish gate 通过。
- 2026-07-29：独立 Grok 4.5 High review 发现两个测试可信度缺口，均完成 focused closure；代码 review 状态为 passed。
- 2026-07-29：owner 批准完整 0.1.1 release sequence：scoped commit/push、主包 publish、0.1.0 deprecate、本机 Pi 切换与验收。

## Decision

owner 已批准完整的 `pi-cursor-lite@0.1.1` release sequence：

1. 创建 scoped commit 并 push 到 GitHub main，使 fork provenance 可公开审计。
2. public npm publish `pi-cursor-lite@0.1.1`。
3. deprecate vulnerable `pi-cursor-lite@0.1.0`。
4. 本机 Pi 从 0.1.0 切换到 0.1.1，并执行 registry/consumer/Pi 验收。

## Selected Strategy

维护 Apache-2.0 的 Connect Node 兼容 fork：

- `@gchigoo/connect-node@1.7.1` 基于 upstream 1.7.0。
- 53 个 runtime/type dist 文件不修改；依赖改为固定 `undici@6.27.0`。
- 主包声明 `@connectrpc/connect-node: npm:@gchigoo/connect-node@1.7.1`，Cursor SDK 的 `^1.6.1` 依赖去重到该安全节点。
- 不重新分发专有许可的 Cursor SDK，不使用消费者 override 或可绕过的 install guard。

## Completed Authorized Action

- Public npm package：`@gchigoo/connect-node@1.7.1`
- Registry dependency：`undici@6.27.0`
- Published integrity：`sha512-BDz/myN2AoBwimOz81gmilRQ+FhpgDs5j0vrKrtAlqscfES/wVS1e77eOqJZAw8bHsZ31MA4/89qwXXM3hQgrg==`

## Verification Evidence

- 53 个 fork dist 文件匹配官方 1.7.0 tarball 的冻结 SHA-256 清单。
- fork tarball：57 files / 30,791 bytes；独立 ESM/CJS load 与 production audit=0。
- 普通 packed consumer 中只有一个 Connect Node 节点，目标为 `@gchigoo/connect-node@1.7.1`。
- consumer 只解析 `undici@6.27.0`，production audit=0，Pi packed load 通过。
- `npm run prepublishOnly`：64 tests、typecheck、boundaries、manifest、source/packed load、fork checks 和两层 audit 全部通过。
- 独立 Grok review + focused closure：passed；报告为 `publish-github-npm-review.md`。

## Authorized Actions

- scoped commit 并 push GitHub main
- public npm publish `pi-cursor-lite@0.1.1`
- deprecate vulnerable `pi-cursor-lite@0.1.0`
- 本机 Pi 切换到 0.1.1 并执行 registry/consumer/Pi 验收

## Risks And Tradeoffs

- 当前无 `CURSOR_API_KEY`，未执行本轮 shell/Agent live smoke；owner 已在 shell issue completion 接受该 residual risk。
- macOS/Linux shell 仍为平台注入测试，没有真实 runner evidence。
- npm publish、deprecate 和 GitHub push 不可由普通代码回滚；若 0.1.1 有问题只能发布后续版本。

## Execution Order

严格按 commit/push → provenance 核验 → main publish → 0.1.0 deprecate → 本机切换与验收执行；任一步失败立即停止。
