# pi-cursor-lite

**English** | [简体中文](./README.zh-CN.md)

Lightweight Cursor model provider for [Pi](https://github.com/earendil-works/pi) — use Cursor models via `/model` without heavy Cloud/resume/MCP dependencies.

Each request creates an independent **one-shot Cursor Local Agent** run:
- The Agent loop and file access run on your machine
- Model inference is hosted by Cursor
- Default behavior: **plan only** (no file modifications)
- Explicit `PI_CURSOR_MODE=agent` to enable file editing

## Quick Start

```bash
# 1. Install the published package in Pi
pi install npm:pi-cursor-lite@0.1.1

# 2. Set your Cursor API key
export CURSOR_API_KEY=sk-cursor-...

# Or, inside Pi, run /login and select cursor-lite

# 3. Select a Cursor model
# In Pi: /model cursor-lite/auto
```

## Requirements

- **Node.js** >= 22.19
- **Pi** >= 0.81.1 (peer dependency)
- **Cursor SDK API Key** — obtain from [cursor.com/settings](https://cursor.com/settings)
- This extension does **NOT** reuse Cursor Desktop or Cursor CLI login state

## Dependency Security

`pi-cursor-lite@0.1.1` aliases Cursor SDK's `@connectrpc/connect-node` dependency to the
project-maintained [`@gchigoo/connect-node@1.7.1`](https://github.com/gchigoo/pi-cursor-lite/tree/main/packages/connect-node).
The fork keeps the upstream 1.7.0 runtime and declaration files byte-identical and
replaces vulnerable Undici 5 with pinned `undici@6.27.0`. It is distributed under
the upstream Apache-2.0 license with explicit provenance and modification notices.

The release gate installs the packed main package in a clean consumer root, verifies
that Cursor SDK deduplicates to the patched package, requires only `undici@6.27.0`,
and runs a production `npm audit`. A green audit in this repository alone is not
accepted because dependency-package `overrides` do not propagate to npm consumers.

## Modes

| Mode | Behavior | How to activate |
|------|----------|----------------|
| `plan` (default) | Analyze, plan, and reason — no file modifications | No configuration needed |
| `agent` | Full agent capabilities including file edits | `PI_CURSOR_MODE=agent` at Pi process startup |

**WARNING:** `agent` mode gives the Cursor Agent the ability to **directly modify files** in your working directory. Ensure your work is committed or backed up before switching to agent mode.

`plan` mode is a behavioral default, **not** a security sandbox. The Cursor Agent's native tools and any project-level hooks may still execute.

## Data Sent to Cursor

The following information is sent to Cursor's hosted service with each request:
- Pi system prompt
- Conversation history (text content only)
- Tool call/result summaries
- File contents read by the Cursor Agent during its run

**Images are not supported in V1** — the provider will reject them with an error.

## Cursor Native Tools & Audit Gap

Cursor Agent runs its own tools (read, write, edit, bash, grep, etc.) internally. These tool calls and results are **not** reflected in Pi's tool audit log. Pi only sees the final text output, thinking stream, and token usage.

### Ambient Configuration

This extension does **not** inject MCP servers, custom tools, or Cursor agent definitions. Additionally:
- Ambient MCP servers (`.cursor/mcp.json`, etc.) are **not** loaded because `settingSources` is not provided
- Project/user **hooks** (`.cursor/hooks.json`, `~/.cursor/hooks.json`) are **not** loaded (confirmed by disposable fixture poison probe with `Agent.create` headless SDK)
- File-based subagents (`.cursor/agents/*.md`) are not explicitly injected

Always review `.cursor/` directories in your working tree, even though the headless SDK default appears to disable ambient file-based features.

## Cursor SDK Basis

This extension is implemented against the official [Cursor TypeScript SDK documentation](https://cursor.com/cn/docs/sdk/typescript) and the public root exports of the pinned `@cursor/sdk@1.0.24` package. It uses:

- `Cursor.models.list()` for account-specific canonical model IDs
- `Agent.create()` for a local one-shot agent
- `agent.send(..., { onDelta })` and `run.wait()` for streaming and the terminal result
- `JsonlLocalAgentStore` and `Symbol.asyncDispose` for isolated temporary state

The SDK catalog exposes IDs, names, parameters, and variants, but not context-window or output-limit numbers. Pi still requires those fields, so the extension supplies conservative metadata separately.

### Runtime shell discovery

Before Cursor initializes its local terminal executor, the extension resolves a supported shell:

- **Windows:** use the actual Git Bash found from existing MSYS/Git hints or `where.exe git`; if unavailable, fall back to `pwsh`, then Windows PowerShell
- **macOS:** keep a valid `SHELL`, otherwise try zsh, bash, pwsh, then POSIX sh
- **Linux:** keep a valid `SHELL`, otherwise try bash, zsh, pwsh, then POSIX sh

The selected environment is applied only during terminal-executor initialization, serialized across concurrent requests, and restored in `finally`. If no supported shell exists, the request fails with a provider error instead of attempting a fixed path.

## Model Metadata

| Model / field | Pi value | Source / accuracy |
|---------------|----------|-------------------|
| `auto` contextWindow | 200000 | Conservative fallback based on Cursor's lowest documented default among routed coding models |
| Composer and other discovered models contextWindow | 200000 | Cursor-documented baseline or conservative fallback |
| `grok-4.5` contextWindow | 256000 | Cursor-documented default (`256k`) |
| Kimi K2.7 Code family contextWindow | 262000 | Cursor-documented default (`262k`) |
| GPT-5 family contextWindow | 272000 | Cursor-documented default (`272k`) |
| maxTokens | 16384 | Pi-side estimate only |
| cost | $0 | Unknown — "zero" does **not** mean free |

### User model overrides

Use Pi's `modelOverrides` layer in `~/.pi/agent/models.json` to replace extension defaults without replacing the dynamically discovered Cursor catalog:

```json
{
  "providers": {
    "cursor-lite": {
      "modelOverrides": {
        "grok-4.5": {
          "contextWindow": 256000,
          "maxTokens": 16384
        }
      }
    }
  }
}
```

Pi, not this extension, reads this file and applies matching overrides **after** extension registration and dynamic model refresh. This keeps user configuration as the highest-priority layer. Opening `/model` reloads `models.json`; unknown model IDs are ignored until that ID exists in the Cursor catalog.

### Compaction position

Context size and compaction policy are separate Pi settings. Configure compaction globally in `~/.pi/agent/settings.json` or per project in `.pi/settings.json`:

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

Pi starts automatic compaction when `contextTokens > contextWindow - reserveTokens`. With Grok 4.5's default values above, that is approximately `239616` tokens. `keepRecentTokens` controls how much recent context remains unsummarized.

## Credential Management

### Setting your API key

Priority order (Pi standard resolution):
1. CLI `--api-key` flag
2. `auth.json[cursor-lite]` (inside Pi, run `/login` and select `cursor-lite`)
3. `CURSOR_API_KEY` environment variable
4. `models.json` provider configuration

### Removing credentials

**Step 1:** Remove the extension package:
```bash
pi remove npm:pi-cursor-lite
```

**Step 2:** Clear stored credentials (choose one):
- In Pi: `/logout` → select **Cursor Lite** (or `cursor-lite`)
- Or manually: edit `~/.pi/agent/auth.json` and remove the `cursor-lite` entry

Package removal does **not** automatically delete your API key from `auth.json`.

## Limitations (V1)

- **Text only** — images are rejected
- **One-shot** — each request creates a fresh agent (no conversation continuity on the Cursor side)
- **No session resume** — cannot continue a previous Cursor Agent run
- **No MCP bridge** — Cursor tools don't translate to Pi tool calls
- **No Cloud support** — local agent runtime only
- **No model parameter mapping** — thinking effort, temperature, etc. not exposed
- **Partial metadata** — documented model families use Cursor defaults; unknown model windows use the 200k fallback and output limits remain estimates

## Platform Support

| Platform | Status |
|----------|--------|
| win32-x64 | Verified (live smoke tests pass) |
| darwin-arm64 | Installable — not verified |
| darwin-x64 | Installable — not verified |
| linux-arm64 | Installable — not verified |
| linux-x64 | Installable — not verified |

## Residual Risks

1. **Temp file residue:** On abnormal termination (crash, SIGKILL, power loss), per-request temp directories (`pi-cursor-lite-*` in your OS temp folder) may persist. These contain the prompt and agent state. Cleanup recommendation: `rm -rf $TMPDIR/pi-cursor-lite-*` periodically.
2. **Ambient hooks:** Project or user-level `.cursor/hooks.json` scripts may execute during agent runs without Pi awareness.
3. **No tool audit:** Cursor's internal tool calls (shell, file writes) are not logged in Pi's session history.
4. **Metadata drift:** Cursor may change model limits server-side; user `modelOverrides` take precedence when the bundled metadata lags.

## Development

```bash
npm install
npm run typecheck    # TypeScript compilation check
npm test             # Unit and integration tests
npm run check        # Full offline check (typecheck + test)
```

Live smoke tests require a `CURSOR_API_KEY`:
```bash
CURSOR_API_KEY=sk-cursor-... npm run smoke:live
```

## License

[MIT](./LICENSE) © Gchigoo
