import { describe, expect, it } from "vitest";
import {
  resolveCursorRuntimeShell,
  withCursorShellEnvironment,
  type CursorRuntimeShell,
} from "../src/runtime-shell.js";

function fakeExists(...paths: string[]) {
  const existing = new Set(paths.map(normalize));
  return (path: string) => existing.has(normalize(path));
}

function normalize(path: string): string {
  return path.replaceAll("/", "\\").toLowerCase();
}

function fakeLookup(entries: Record<string, string[]>) {
  return (command: string) => entries[command] ?? [];
}

describe("resolveCursorRuntimeShell", () => {
  it("resolves Git Bash from an MSYS prefix outside Program Files", () => {
    const executable = "D:\\Software\\Git\\usr\\bin\\bash.exe";
    const shell = resolveCursorRuntimeShell({
      platform: "win32",
      env: {
        MSYSTEM: "MINGW64",
        MSYSTEM_PREFIX: "D:/Software/Git/usr",
        SHELL: "/usr/bin/bash.exe",
      },
      exists: fakeExists(executable),
      lookup: fakeLookup({}),
    });

    expect(shell).toEqual({
      kind: "bash",
      executable,
      platform: "win32",
      windowsGitBash: true,
    });
  });

  it("derives a portable Git Bash location from where.exe git", () => {
    const executable = "E:\\PortableGit\\bin\\bash.exe";
    const shell = resolveCursorRuntimeShell({
      platform: "win32",
      env: { MSYSTEM: "MINGW64", SHELL: "/usr/bin/bash.exe" },
      exists: fakeExists(executable),
      lookup: fakeLookup({ git: ["E:\\PortableGit\\mingw64\\bin\\git.exe"] }),
    });

    expect(shell.executable).toBe(executable);
    expect(shell.windowsGitBash).toBe(true);
  });

  it("falls back to pwsh on Windows when Git Bash is unavailable", () => {
    const executable = "C:\\Tools\\PowerShell\\pwsh.exe";
    const shell = resolveCursorRuntimeShell({
      platform: "win32",
      env: { MSYSTEM: "MINGW64", SHELL: "/usr/bin/bash.exe" },
      exists: fakeExists(executable),
      lookup: fakeLookup({ pwsh: [executable] }),
    });

    expect(shell).toEqual({
      kind: "powershell",
      executable,
      platform: "win32",
      windowsGitBash: false,
    });
  });

  it("keeps a valid zsh on macOS", () => {
    const shell = resolveCursorRuntimeShell({
      platform: "darwin",
      env: { SHELL: "/opt/homebrew/bin/zsh" },
      exists: fakeExists("/opt/homebrew/bin/zsh"),
      lookup: fakeLookup({}),
    });

    expect(shell.kind).toBe("zsh");
    expect(shell.executable).toBe("/opt/homebrew/bin/zsh");
  });

  it("falls back from an unsupported Linux shell to bash", () => {
    const shell = resolveCursorRuntimeShell({
      platform: "linux",
      env: { SHELL: "/usr/bin/fish" },
      exists: fakeExists("/usr/bin/fish", "/usr/local/bin/bash"),
      lookup: fakeLookup({ bash: ["/usr/local/bin/bash"] }),
    });

    expect(shell.kind).toBe("bash");
    expect(shell.executable).toBe("/usr/local/bin/bash");
  });

  it("keeps POSIX sh on a minimal Linux installation", () => {
    const shell = resolveCursorRuntimeShell({
      platform: "linux",
      env: { SHELL: "/bin/sh" },
      exists: fakeExists("/bin/sh"),
      lookup: fakeLookup({}),
    });

    expect(shell.kind).toBe("sh");
    expect(shell.executable).toBe("/bin/sh");
  });

  it("fails before entering the SDK when no supported shell exists", () => {
    expect(() => resolveCursorRuntimeShell({
      platform: "linux",
      env: {},
      exists: () => false,
      lookup: fakeLookup({}),
    })).toThrow("No supported shell found for linux");
  });
});

describe("withCursorShellEnvironment", () => {
  it("temporarily selects PowerShell and restores the MSYS environment", async () => {
    const env: NodeJS.ProcessEnv = {
      SHELL: "/usr/bin/bash.exe",
      MSYSTEM: "MINGW64",
      EXEPATH: "D:\\Missing\\Git\\bin",
    };
    const shell: CursorRuntimeShell = {
      kind: "powershell",
      executable: "C:\\Tools\\pwsh.exe",
      platform: "win32",
      windowsGitBash: false,
    };

    await expect(withCursorShellEnvironment(shell, async () => {
      expect(env).toMatchObject({ SHELL: shell.executable });
      expect(env.MSYSTEM).toBeUndefined();
      expect(env.EXEPATH).toBeUndefined();
      throw new Error("probe");
    }, env)).rejects.toThrow("probe");

    expect(env).toEqual({
      SHELL: "/usr/bin/bash.exe",
      MSYSTEM: "MINGW64",
      EXEPATH: "D:\\Missing\\Git\\bin",
    });
  });

  it("temporarily supplies Cursor SDK with the resolved Git Bash path", async () => {
    const env: NodeJS.ProcessEnv = { MSYSTEM: "MINGW64" };
    const shell: CursorRuntimeShell = {
      kind: "bash",
      executable: "D:\\Software\\Git\\usr\\bin\\bash.exe",
      platform: "win32",
      windowsGitBash: true,
    };

    await withCursorShellEnvironment(shell, async () => {
      expect(env.SHELL).toBe(shell.executable);
      expect(env.EXEPATH).toBe(shell.executable);
      expect(env.MSYSTEM).toBe("MINGW64");
    }, env);

    expect(env).toEqual({ MSYSTEM: "MINGW64" });
  });

  it("serializes concurrent shell environment changes", async () => {
    const env: NodeJS.ProcessEnv = { SHELL: "/bin/original" };
    const firstShell: CursorRuntimeShell = {
      kind: "bash",
      executable: "/bin/bash",
      platform: "linux",
      windowsGitBash: false,
    };
    const secondShell: CursorRuntimeShell = {
      kind: "zsh",
      executable: "/bin/zsh",
      platform: "darwin",
      windowsGitBash: false,
    };
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let firstEntered!: () => void;
    const entered = new Promise<void>((resolve) => { firstEntered = resolve; });

    const first = withCursorShellEnvironment(firstShell, async () => {
      events.push(`first:${env.SHELL}`);
      firstEntered();
      await firstGate;
    }, env);
    await entered;
    const second = withCursorShellEnvironment(secondShell, async () => {
      events.push(`second:${env.SHELL}`);
    }, env);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).toEqual(["first:/bin/bash"]);
    releaseFirst();
    await Promise.all([first, second]);

    expect(events).toEqual(["first:/bin/bash", "second:/bin/zsh"]);
    expect(env).toEqual({ SHELL: "/bin/original" });
  });
});
