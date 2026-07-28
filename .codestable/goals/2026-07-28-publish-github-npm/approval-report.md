---
doc_type: approval-report
unit: 2026-07-28-publish-github-npm
status: approved
reason: route-choice
approvals:
  github-create-push: approved
  npm-publish: approved
  local-uninstall-install: approved
  github-repository-visibility: approved
approval_groups: {}
created_at: 2026-07-28
---

# Approval Report

## Decision History

- 2026-07-28：owner 明确授权使用 `gh` 创建/推送 GitHub 仓库、发布 npm 包，并在发布后卸载本地 Pi 包再安装 npm 版本。
- 2026-07-28：owner 选择 Public，批准创建公开仓库 `gchigoo/pi-cursor-lite`。
- 认证预检：`gh` 当前登录账号为 `gchigoo`；npm 当前登录账号为 `gchigoo`。未读取或打印 token。

## Decision Needed

已批准 Public；当前无待决事项。

## Why Now

目标仓库尚不存在；`gh repo create` 必须明确 public 或 private。npm 包名 `pi-cursor-lite` 当前可用，且未加 scope 的 npm 包发布后为 public。

## Context

- 当前仓库没有 remote 和首次提交，所有文件为 untracked。
- 根目录没有 `.gitignore`，必须先排除 `.pi/`、`node_modules/`、tarball、`nul` 等本地资产。
- `package.json` 当前为 `private: true`，发布前必须改为可发布并补 repository/license 元数据。
- README 将采用标准双语结构：`README.md`（English）+ `README.zh-CN.md`（中文），互相链接。
- Git 本地提交身份将设置为 `Gchigoo <stan.guo@mail.ru>`。

## Options

- **Public（推荐）**：GitHub 源码与 public npm 包一致，便于安装、审计和反馈。
- **Private**：GitHub 源码私有，但 npm 包仍是 public；源码可见性与分发可见性不一致。

## Recommendation

选择 **Public**。项目声明 MIT，且目标是发布未加 scope 的 public npm 包。

## Risks And Tradeoffs

首次 push 和 npm publish 都是外部、不可静默回滚的动作。发布前会运行 secret/path 检查、完整测试、`npm pack --dry-run` 和生产依赖审计；如果 npm 要求 OTP/2FA，将停下由 owner 完成认证，不请求在聊天中粘贴 token 或 OTP。

## Non-Automatic Actions

批准不会跳过发布前 secret/path 检查和测试；若 npm 要求 OTP/2FA，仍会停止并请求 owner 在本机完成认证。

## After You Answer

冻结目标后创建 goal 起点报告，完成双语 README、发布元数据和安全基线；验证通过后按已授权顺序执行 GitHub push → npm publish → Pi 本地包卸载 → npm 包安装与模型加载验证。
