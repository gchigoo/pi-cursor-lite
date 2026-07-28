---
doc_type: audit-finding
audit: 2026-07-28-runtime-core
finding_id: bug-06
nature: bug
severity: P1
confidence: high
suggested_action: cs-issue
status: open
---

# Finding 06：打包验证缺文件时仍可能返回成功

## 速答

`test-packed.mjs` 检测到安装包缺少 `src/index.ts` 或 `README.md` 时只打印 FAIL，不设置失败退出码。

## 关键证据

- `scripts/test-packed.mjs:49-50` — 定义必须存在的两个打包文件。
- `scripts/test-packed.mjs:51-52` — 缺文件分支仅调用 `console.error`，没有 `process.exitCode = 1`、抛错或退出。
- `scripts/test-packed.mjs:53` — 只有两个文件均存在时才打印 PASS，但前两个失败分支仍可自然以 0 退出。

## 影响

发布包遗漏入口或 README 时，自动化可能把带有 `FAIL:` 日志的运行误判为成功，形成发布门禁假阳性。

## 修复方向

让所有失败分支产生非零退出码，并增加针对缺文件场景的自测试。

## 建议动作

`cs-issue`，因为这是发布验证的确定性失败语义错误。
