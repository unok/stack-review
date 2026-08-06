import {
  isRecord,
  parseJsonObject,
  requireRecord,
  requireString,
} from "./helpers.ts";
import type { TabCreateResult, WorkspaceCreateResult } from "./types.ts";

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
}

function workspaceIdFrom(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return;
  }
  return nonEmptyString(value.workspace_id);
}

export function recoverWorkspaceId(output: string): string | undefined {
  let root: unknown;
  try {
    root = JSON.parse(output);
  } catch {
    return;
  }
  if (!(isRecord(root) && isRecord(root.result))) {
    return;
  }
  const { workspace, root_pane: rootPane } = root.result;
  return workspaceIdFrom(workspace) ?? workspaceIdFrom(rootPane);
}

export function parseWorkspaceCreateOutput(
  output: string,
): WorkspaceCreateResult {
  const context = "herdr workspace create output";
  const root = parseJsonObject(output, "herdr workspace create");
  const result = requireRecord(root, "result", context);
  const workspace = requireRecord(result, "workspace", `${context}.result`);
  const tab = requireRecord(result, "tab", `${context}.result`);
  const rootPane = requireRecord(result, "root_pane", `${context}.result`);

  return {
    workspaceId: requireString(
      workspace,
      "workspace_id",
      `${context}.result.workspace`,
    ),
    tabId: requireString(tab, "tab_id", `${context}.result.tab`),
    paneId: requireString(rootPane, "pane_id", `${context}.result.root_pane`),
  };
}

export function parseTabCreateOutput(output: string): TabCreateResult {
  const context = "herdr tab create output";
  const root = parseJsonObject(output, "herdr tab create");
  const result = requireRecord(root, "result", context);
  const tab = requireRecord(result, "tab", `${context}.result`);
  const rootPane = requireRecord(result, "root_pane", `${context}.result`);

  return {
    tabId: requireString(tab, "tab_id", `${context}.result.tab`),
    paneId: requireString(rootPane, "pane_id", `${context}.result.root_pane`),
  };
}
