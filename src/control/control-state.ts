import { readFile } from "node:fs/promises";

import type { ControlState } from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isDiffStats(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.fileCount) &&
    isNonNegativeInteger(value.additions) &&
    isNonNegativeInteger(value.deletions) &&
    isNonNegativeInteger(value.binaryFileCount)
  );
}

function isStack(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.trunk) &&
    Array.isArray(value.layers) &&
    value.layers.every(
      (layer) =>
        isRecord(layer) &&
        isNonEmptyString(layer.name) &&
        isNonEmptyString(layer.base) &&
        (layer.stats === null || isDiffStats(layer.stats)),
    )
  );
}

function isWorkingTreeStatus(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.hasChanges === "boolean" &&
    isNonNegativeInteger(value.changeCount)
  );
}

function isReviewEnvironment(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.workspaceId) &&
    isNonEmptyString(value.controlTabId) &&
    isNonEmptyString(value.controlPaneId) &&
    Array.isArray(value.layers) &&
    value.layers.every(
      (layer) =>
        isRecord(layer) &&
        isPositiveInteger(layer.layerNumber) &&
        isNonEmptyString(layer.layerName) &&
        isNonEmptyString(layer.tabId) &&
        isNonEmptyString(layer.paneId) &&
        isNonEmptyString(layer.sessionId),
    )
  );
}

function isControlState(value: unknown): value is ControlState {
  return (
    isRecord(value) &&
    value.version === 1 &&
    isNonEmptyString(value.repositoryRoot) &&
    isNonEmptyString(value.absoluteGitDir) &&
    isNonEmptyString(value.repositoryName) &&
    isStack(value.stack) &&
    isWorkingTreeStatus(value.workingTreeStatus) &&
    isReviewEnvironment(value.environment)
  );
}

export function parseControlState(input: string): ControlState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (error: unknown) {
    throw new TypeError("control state must be valid JSON", { cause: error });
  }

  if (!isControlState(parsed)) {
    throw new TypeError("control state has an invalid shape");
  }

  return parsed;
}

export async function readControlState(path: string): Promise<ControlState> {
  return parseControlState(await readFile(path, "utf8"));
}
