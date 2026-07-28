---
doc_type: audit-finding
audit: 2026-07-28-runtime-core
finding_id: bug-05
nature: bug
severity: P1
confidence: high
suggested_action: cs-issue
status: open
---

# Finding 05：`test:pi-load` 指向不存在的脚本

## 速答

包清单暴露了 `test:pi-load`，但目标文件不存在，命令必然失败。

## 关键证据

- `package.json:24` — 脚本定义为 `node scripts/test-pi-load.mjs`。
- `scripts/` — 实际文件清单没有 `test-pi-load.mjs`。
- 实际执行 `npm run test:pi-load` — Node 返回 `MODULE_NOT_FOUND`，退出码 1。

## 影响

扩展加载验证无法运行；CI 或发布人员若依赖该命令，会在进入真实验证前直接失败。

## 修复方向

补回对应加载测试，或删除/改正失效的脚本入口，并将其纳入标准检查链。

## 建议动作

`cs-issue`，因为这是可稳定复现的命令错误。
