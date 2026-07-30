---
doc_type: goal
goal: publish-github-npm
status: complete
---

# 发布 GitHub 与 npm 并切换 Pi 安装来源

## Objective

将当前项目安全地发布到公开 GitHub 仓库和 npm，并让本机 Pi 使用已包含 Windows shell/context 修复、且消费端无已知生产依赖漏洞的 npm 版本。

## Starting Point

- GitHub 与 npm 均已登录账号 `gchigoo`，目标仓库和 npm 包名尚不存在。
- Git 仓库没有首次提交、remote 或根 `.gitignore`，所有文件为 untracked。
- `package.json` 为 `private: true`，缺少 repository/homepage/bugs/license 发布元数据。
- README 目前只有英文；Pi 当前通过项目本地目录加载。

## Acceptance Criteria

1. 公开 GitHub 仓库存在，首次提交使用 `Gchigoo <stan.guo@mail.ru>`，不包含 `.pi/`、`node_modules/`、token、tarball 或本机临时文件。
2. `README.md`（English）和 `README.zh-CN.md`（中文）互相链接，安装命令指向正式 npm 包。
3. npm 后续版本包含 Windows shell/context metadata 修复，可通过 registry 查询和安装。
4. 普通 npm 消费者安装树不再包含易受攻击的 `undici@5.29.0`，生产 audit 为 0。
5. 本机 Pi 安装安全的 npm 版本，模型目录可见 `cursor-lite/auto`。
6. 发布前全部自动化、安全、packed consumer 和独立验收检查通过。

## Non-Goals

- 不读取或暴露任何 token/OTP；认证不足时停下由 owner 在本机处理。
- 不要求消费者配置 root override，也不使用可被 `--ignore-scripts` 绕过的安全 guard。
- 不重新分发专有许可的 Cursor SDK 代码。
- 不扩展 release notes 自动化或 CI。

## Decisions And Assumptions

- owner 已批准 GitHub public、首次 npm publish 和 Pi 安装源切换；见 `approval-report.md`。
- 2026-07-29 owner 明确选择不等待上游，在本项目内直接消除 vulnerable `undici` consumer tree。
- 安全方案维护 Apache-2.0 的 connect-node 补丁包，通过 npm alias 满足 Cursor SDK 的 `^1.6.1` 依赖；不 fork Cursor SDK。
- 双语 README 采用仓库常见结构：English canonical `README.md` + `README.zh-CN.md`。
- Git 仅在本仓设置提交身份，不修改全局配置。

## Current State

Goal 已完成：GitHub main 包含可审计 security fork source；npm latest 为安全的 `pi-cursor-lite@0.1.1`；vulnerable 0.1.0 已 deprecated；本机 Pi 使用 0.1.1，消费端与 Pi 共享 root audit 均为 0。终端验收见 `functional-acceptance.md`。

## Next Action

none；后续 Cursor SDK 升级时复核 alias contract、consumer audit 和 shell executor 初始化时序。
