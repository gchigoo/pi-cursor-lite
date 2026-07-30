import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { win32 } from "node:path";

export type CursorRuntimeShell = {
  kind: "bash" | "zsh" | "sh" | "powershell";
  executable: string;
  platform: NodeJS.Platform;
  windowsGitBash: boolean;
};

type ResolveShellOptions = {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  exists?: (path: string) => boolean;
  lookup?: (command: string, platform: NodeJS.Platform) => string[];
};

const SUPPORTED_SHELLS = new Set(["bash", "zsh", "sh", "pwsh", "powershell"]);

/** Resolve a shell that Cursor's local terminal executor supports. */
export function resolveCursorRuntimeShell(options: ResolveShellOptions = {}): CursorRuntimeShell {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const exists = options.exists ?? existsSync;
  const lookup = options.lookup ?? lookupExecutables;

  if (platform === "win32") {
    return resolveWindowsShell(env, exists, lookup, platform);
  }
  return resolvePosixShell(env, exists, lookup, platform);
}

function resolveWindowsShell(
  env: NodeJS.ProcessEnv,
  exists: (path: string) => boolean,
  lookup: (command: string, platform: NodeJS.Platform) => string[],
  platform: NodeJS.Platform,
): CursorRuntimeShell {
  const bashCandidates: string[] = [];
  const add = (candidate: string | undefined) => {
    if (candidate && win32.isAbsolute(candidate)) bashCandidates.push(win32.normalize(candidate));
  };
  const addInstallRoot = (root: string | undefined) => {
    if (!root || !win32.isAbsolute(root)) return;
    add(win32.join(root, "bin", "bash.exe"));
    add(win32.join(root, "usr", "bin", "bash.exe"));
  };
  const addExePath = (value: string | undefined) => {
    if (!value || !win32.isAbsolute(value)) return;
    const normalized = win32.normalize(value);
    const name = win32.basename(normalized).toLowerCase();
    if (name === "bash.exe") add(normalized);
    else if (name === "bin") add(win32.join(normalized, "bash.exe"));
    else addInstallRoot(normalized);
  };

  let existingPowerShell: string | undefined;
  if (isSupportedShell(env.SHELL, platform, exists)) {
    const name = shellName(env.SHELL!);
    if (name === "pwsh" || name === "powershell") existingPowerShell = env.SHELL;
    if (name === "bash") add(env.SHELL);
  }
  addExePath(env.EXEPATH);
  add(env.CLAUDE_CODE_GIT_BASH_PATH);

  if (env.MSYSTEM_PREFIX && win32.isAbsolute(env.MSYSTEM_PREFIX)) {
    add(win32.join(env.MSYSTEM_PREFIX, "bin", "bash.exe"));
    if (env.SHELL?.startsWith("/usr/")) {
      add(win32.join(env.MSYSTEM_PREFIX, env.SHELL.slice("/usr/".length)));
    }
  }

  const configSite = env.CONFIG_SITE?.replaceAll("/", "\\");
  const configSuffix = "\\etc\\config.site";
  if (configSite?.toLowerCase().endsWith(configSuffix)) {
    addInstallRoot(configSite.slice(0, -configSuffix.length));
  }

  let gitBash = firstExisting(bashCandidates, exists);
  if (!gitBash) {
    for (const gitExecutable of lookup("git", platform)) {
      addInstallRoot(gitInstallRoot(gitExecutable));
    }
    gitBash = firstExisting(bashCandidates, exists);
  }
  if (!gitBash) {
    addInstallRoot("C:\\Program Files\\Git");
    addInstallRoot("C:\\Program Files (x86)\\Git");
    gitBash = firstExisting(bashCandidates, exists);
  }
  if (gitBash) {
    return { kind: "bash", executable: gitBash, platform, windowsGitBash: true };
  }

  if (existingPowerShell) {
    return { kind: "powershell", executable: existingPowerShell, platform, windowsGitBash: false };
  }
  for (const command of ["pwsh", "powershell"]) {
    const executable = firstExisting(lookup(command, platform), exists);
    if (executable) {
      return { kind: "powershell", executable, platform, windowsGitBash: false };
    }
  }

  throw new Error("No supported shell found. Install Git Bash or PowerShell (pwsh).");
}

function resolvePosixShell(
  env: NodeJS.ProcessEnv,
  exists: (path: string) => boolean,
  lookup: (command: string, platform: NodeJS.Platform) => string[],
  platform: NodeJS.Platform,
): CursorRuntimeShell {
  if (isSupportedShell(env.SHELL, platform, exists)) {
    return posixShell(env.SHELL!, platform);
  }

  const commands = platform === "darwin"
    ? ["zsh", "bash", "pwsh", "sh"]
    : ["bash", "zsh", "pwsh", "sh"];
  for (const command of commands) {
    const executable = firstExisting(lookup(command, platform), exists);
    if (executable) return posixShell(executable, platform);
  }

  const defaults = platform === "darwin"
    ? ["/bin/zsh", "/bin/bash", "/bin/sh"]
    : ["/bin/bash", "/usr/bin/bash", "/bin/zsh", "/usr/bin/zsh", "/bin/sh", "/usr/bin/sh"];
  const executable = firstExisting(defaults, exists);
  if (executable) return posixShell(executable, platform);

  throw new Error(`No supported shell found for ${platform}. Install sh, bash, zsh, or pwsh.`);
}

function posixShell(executable: string, platform: NodeJS.Platform): CursorRuntimeShell {
  const name = shellName(executable);
  const kind = name === "zsh" || name === "bash" || name === "sh"
    ? name
    : "powershell";
  return {
    kind,
    executable,
    platform,
    windowsGitBash: false,
  };
}

function isSupportedShell(
  executable: string | undefined,
  platform: NodeJS.Platform,
  exists: (path: string) => boolean,
  required?: "bash",
): boolean {
  if (!executable || !exists(executable)) return false;
  const name = shellName(executable);
  return SUPPORTED_SHELLS.has(name) && (!required || name === required) &&
    (platform !== "win32" || win32.isAbsolute(executable));
}

function shellName(executable: string): string {
  return executable.split(/[\\/]/).at(-1)!.toLowerCase().replace(/\.exe$/, "");
}

function gitInstallRoot(gitExecutable: string): string | undefined {
  const normalized = win32.normalize(gitExecutable);
  const lower = normalized.toLowerCase();
  for (const marker of [
    "\\cmd\\git.exe",
    "\\mingw64\\bin\\git.exe",
    "\\mingw32\\bin\\git.exe",
    "\\usr\\bin\\git.exe",
    "\\bin\\git.exe",
  ]) {
    const index = lower.lastIndexOf(marker);
    if (index > 0) return normalized.slice(0, index);
  }
  return undefined;
}

function firstExisting(candidates: string[], exists: (path: string) => boolean): string | undefined {
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (!seen.has(key) && exists(candidate)) return candidate;
    seen.add(key);
  }
  return undefined;
}

function lookupExecutables(command: string, platform: NodeJS.Platform): string[] {
  const finder = platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(finder, [command], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0 || !result.stdout) return [];
  return result.stdout.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
}

let environmentQueue: Promise<void> = Promise.resolve();

/** Apply the selected shell only while Cursor initializes its terminal executor. */
export async function withCursorShellEnvironment<T>(
  shell: CursorRuntimeShell,
  action: () => Promise<T>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<T> {
  const previous = environmentQueue;
  let release!: () => void;
  environmentQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;

  const snapshot = new Map<string, string | undefined>();
  const set = (key: string, value: string | undefined) => {
    snapshot.set(key, env[key]);
    if (value === undefined) delete env[key];
    else env[key] = value;
  };

  try {
    set("SHELL", shell.executable);
    if (shell.platform === "win32") {
      if (shell.windowsGitBash) {
        set("EXEPATH", shell.executable);
      } else {
        set("MSYSTEM", undefined);
        set("EXEPATH", undefined);
      }
    }
    return await action();
  } finally {
    for (const [key, value] of snapshot) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
    release();
  }
}
