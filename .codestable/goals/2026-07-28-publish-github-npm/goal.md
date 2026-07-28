---
doc_type: goal
goal: publish-github-npm
status: active
---

# 发布 GitHub 与 npm 并切换 Pi 安装来源

## Objective

将当前项目安全地发布到公开 GitHub 仓库 `gchigoo/pi-cursor-lite` 和 npm 包 `pi-cursor-lite@0.1.0`，随后把本机 Pi 从本地目录安装切换到 npm 安装。

## Starting Point

- GitHub 与 npm 均已登录账号 `gchigoo`，目标仓库和 npm 包名尚不存在。
- Git 仓库没有首次提交、remote 或根 `.gitignore`，所有文件为 untracked。
- `package.json` 为 `private: true`，缺少 repository/homepage/bugs/license 发布元数据。
- README 目前只有英文；Pi 当前通过项目本地目录加载。

## Acceptance Criteria

1. 公开 GitHub 仓库存在，首次提交使用 `Gchigoo <stan.guo@mail.ru>`，不包含 `.pi/`、`node_modules/`、token、tarball 或本机临时文件。
2. `README.md`（English）和 `README.zh-CN.md`（中文）互相链接，安装命令指向正式 npm 包。
3. `pi-cursor-lite@0.1.0` 发布后可通过 npm registry 查询和安装。
4. 本机 Pi 卸载本地路径包并安装 `npm:pi-cursor-lite@0.1.0`，模型目录可见 `cursor-lite/auto`。
5. 发布前全部自动化和安全检查通过。

## Non-Goals

- 不改变 provider 功能或版本号。
- 不读取或暴露任何 token/OTP；认证不足时停下由 owner 在本机处理。
- 不进行后续版本发布、release notes 自动化或 CI 扩展。

## Decisions And Assumptions

- owner 已批准 GitHub public、GitHub push、npm publish 和 Pi 安装源切换；见 `approval-report.md`。
- 双语 README 采用仓库常见结构：English canonical `README.md` + `README.zh-CN.md`。
- Git 仅在本仓设置提交身份，不修改全局配置。

## Current State

Goal 已启动，等待建立发布基线。

## Next Action

新增安全 `.gitignore` 与 MIT LICENSE，更新 npm 元数据，完成中英 README 后执行发布前验证。
