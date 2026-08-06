import type { CommandResult } from "../exec.ts";
import type { HunkSession, Layer } from "../types.ts";

const HERDR_RESPONSE_KEYS = {
  paneCount: "pane_count",
  paneId: "pane_id",
  rootPane: "root_pane",
  tabCount: "tab_count",
  tabId: "tab_id",
  workspaceId: "workspace_id",
} as const;

export const repositoryRoot = "/repo/stack-review";

export const layers: Layer[] = [
  { name: "core", base: "trunk-commit", stats: null },
  { name: "hunk-session", base: "core-commit", stats: null },
  { name: "herdr-layout", base: "hunk-commit", stats: null },
];

export function success(stdout = ""): CommandResult {
  return { stdout, stderr: "", exitCode: 0 };
}

export function failure(stderr: string): CommandResult {
  return { stdout: "", stderr, exitCode: 1 };
}

export function workspaceCreateOutput(): string {
  return JSON.stringify({
    id: "cli:workspace:create",
    result: {
      [HERDR_RESPONSE_KEYS.rootPane]: {
        [HERDR_RESPONSE_KEYS.paneId]: "wB:p1",
        [HERDR_RESPONSE_KEYS.tabId]: "wB:t1",
        [HERDR_RESPONSE_KEYS.workspaceId]: "wB",
      },
      tab: {
        [HERDR_RESPONSE_KEYS.tabId]: "wB:t1",
        [HERDR_RESPONSE_KEYS.workspaceId]: "wB",
        label: "1",
        number: 1,
        [HERDR_RESPONSE_KEYS.paneCount]: 1,
      },
      workspace: {
        [HERDR_RESPONSE_KEYS.workspaceId]: "wB",
        label: "review: stack-review",
        number: 8,
        [HERDR_RESPONSE_KEYS.tabCount]: 1,
      },
      type: "workspace_created",
    },
  });
}

export function workspaceCreateOutputWithOnlyRootPaneId(): string {
  return JSON.stringify({
    result: {
      [HERDR_RESPONSE_KEYS.rootPane]: {
        [HERDR_RESPONSE_KEYS.workspaceId]: "wB",
      },
    },
  });
}

export function tabCreateOutput(number: number): string {
  return JSON.stringify({
    id: "cli:tab:create",
    result: {
      [HERDR_RESPONSE_KEYS.rootPane]: {
        [HERDR_RESPONSE_KEYS.paneId]: `wB:p${number}`,
        [HERDR_RESPONSE_KEYS.tabId]: `wB:t${number}`,
        [HERDR_RESPONSE_KEYS.workspaceId]: "wB",
      },
      tab: {
        [HERDR_RESPONSE_KEYS.tabId]: `wB:t${number}`,
        [HERDR_RESPONSE_KEYS.workspaceId]: "wB",
        label: `layer${number - 1}`,
        number,
        [HERDR_RESPONSE_KEYS.paneCount]: 1,
      },
      type: "tab_created",
    },
  });
}

export function hunkSession(
  sessionId: string,
  repoRoot = repositoryRoot,
): HunkSession {
  return {
    sessionId,
    repoRoot,
    title: `stack-review ${sessionId}`,
    fileCount: 1,
  };
}

export function sessionList(sessions: readonly HunkSession[]): CommandResult {
  return success(JSON.stringify({ sessions }));
}

export function isCommand(
  argv: readonly string[],
  ...prefix: readonly string[]
): boolean {
  return prefix.every((argument, index) => argv[index] === argument);
}
