---
doc_type: goal-functional-acceptance
goal: publish-github-npm
status: pass
reviewer_id: "pi-cli:xai/grok-4.5:terminal-acceptance-20260730"
final_iteration: "iterations/007.md"
---

# publish-github-npm 终端功能验收

## Reviewer

- Role: 独立终端功能验收 reviewer
- Model: xAI Grok 4.5 High
- Run: `pi -p --no-session` 只读运行
- Reviewer ref: `pi-cli:xai/grok-4.5:terminal-acceptance-20260730`
- Lifecycle: ephemeral no-session；进程正常结束，无持久 agent 需要关闭

## Scope

按 owner goal 对发布后的可观察终态验收：GitHub source、npm registry、旧版 deprecation、干净消费端安全树、本机 Pi 安装、模型目录和扩展加载。不得修改、安装、发布、deprecate、commit 或 push。

## Acceptance Checks

| 验收项 | 结果 | 功能证据 |
|---|---|---|
| GitHub main 与本地 release commit 一致 | pass | 两者均为 `1600d678713833ae804b075adad1c58bc3d2ccdb`；public repo 包含 `packages/connect-node` |
| npm latest 为主包 0.1.1 | pass | `npm view pi-cursor-lite@latest version` 返回 `0.1.1` |
| vulnerable 0.1.0 已弃用 | pass | registry deprecated message 指出 `undici@5.29.0`，并要求先 remove 旧包再安装 0.1.1 |
| scoped fork public 且安全 | pass | `@gchigoo/connect-node@1.7.1` public，固定 `undici@6.27.0` |
| 干净 registry consumer 安全 | pass | Cursor SDK dedupe 到唯一 fork node；只有 Undici 6.27.0；production audit=0 |
| 本机 Pi 使用安全 npm 版本 | pass | `pi list` 仅列 `npm:pi-cursor-lite@0.1.1`，无项目本地 source |
| Pi 共享 npm root 安全 | pass | 唯一 Connect Node alias，只有 Undici 6.27.0；production audit=0 |
| 模型目录与扩展可用 | pass | `pi --list-models cursor-lite` 显示 `auto / 200K`；Pi extension loader 注册成功 |

## Functional Evidence

- Public GitHub provenance 路径可读，fork manifest 与 registry package identity 对齐。
- 主包 registry 依赖明确 alias 到 fork；不是依靠开发根 override。
- 先卸载 0.1.0 再安装 0.1.1 后，Pi 共享 npm root 清除了旧 lock/hoist 残留。
- 干净 consumer 与真实 Pi root 两条安装路径均得到 0 vulnerabilities。
- Published catalog 的 `auto` 为 200K，证明 context metadata 修复已进入实际安装版本。

## Verdict

**pass** — owner 记录的 GitHub、npm、安全消费树和 Pi 安装终态全部满足。

## Residual Risks

- 当前无 `CURSOR_API_KEY`，未执行本轮真实 Cursor Agent / custom Git Bash smoke；该风险已在 shell issue completion 获 owner 接受。
- macOS/Linux shell 路径为平台注入测试，没有真实 runner evidence。
- 后续 Cursor SDK 若改变 Connect Node semver contract 或 executor 初始化时序，需要重新审查 alias 与 shell 临界区。

## Delivery Record

- GitHub main release commit：`1600d678713833ae804b075adad1c58bc3d2ccdb`
- npm latest：`pi-cursor-lite@0.1.1`
- security fork：`@gchigoo/connect-node@1.7.1`
- deprecated：`pi-cursor-lite@0.1.0`
- installed Pi source：`npm:pi-cursor-lite@0.1.1`
- Final iteration：`iterations/007.md`
