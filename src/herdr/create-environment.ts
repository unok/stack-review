import type { PreparedLayerDescription } from "../description.ts";
import type { CommandRunner } from "../exec.ts";
import type { Layer } from "../types.ts";
import { destroyReviewEnvironment } from "./destroy-environment.ts";
import { runSuccessful } from "./helpers.ts";
import { buildReviewWorkspaceLabel } from "./labels.ts";
import {
  createLayerTabs,
  launchLayerEnvironments,
} from "./layer-environments.ts";
import { parseWorkspaceCreateOutput, recoverWorkspaceId } from "./responses.ts";
import {
  DEFAULT_SESSION_DISCOVERY_INTERVAL_MS,
  DEFAULT_SESSION_DISCOVERY_TIMEOUT_MS,
  defaultTimer,
  requirePositiveNumber,
} from "./session-discovery.ts";
import type {
  ReviewEnvironment,
  ReviewEnvironmentOptions,
  SessionDiscoveryTimer,
  WorkspaceCreateResult,
} from "./types.ts";

type CreateReviewEnvironmentParameters = [
  run: CommandRunner,
  repositoryRoot: string,
  repositoryName: string,
  layers: readonly Layer[],
  descriptions: readonly PreparedLayerDescription[],
  options?: ReviewEnvironmentOptions,
];

interface PopulateReviewEnvironmentOptions {
  run: CommandRunner;
  repositoryRoot: string;
  layers: readonly Layer[];
  descriptions: readonly PreparedLayerDescription[];
  workspace: WorkspaceCreateResult;
  intervalMs: number;
  timeoutMs: number;
  timer: SessionDiscoveryTimer;
}

async function createWorkspace(
  run: CommandRunner,
  repositoryRoot: string,
  repositoryName: string,
): Promise<WorkspaceCreateResult> {
  const output = await runSuccessful(run, [
    "herdr",
    "workspace",
    "create",
    "--cwd",
    repositoryRoot,
    "--no-focus",
    "--label",
    buildReviewWorkspaceLabel(repositoryName),
  ]);
  try {
    return parseWorkspaceCreateOutput(output);
  } catch (error: unknown) {
    const workspaceId = recoverWorkspaceId(output);
    if (workspaceId !== undefined) {
      await destroyReviewEnvironment(run, workspaceId).catch(() => undefined);
    }
    throw error;
  }
}

async function populateReviewEnvironment({
  run,
  repositoryRoot,
  layers,
  descriptions,
  workspace,
  intervalMs,
  timeoutMs,
  timer,
}: PopulateReviewEnvironmentOptions): Promise<ReviewEnvironment> {
  await runSuccessful(run, [
    "herdr",
    "tab",
    "rename",
    workspace.tabId,
    "control",
  ]);
  const createdTabs = await createLayerTabs({
    run,
    workspaceId: workspace.workspaceId,
    repositoryRoot,
    layers,
    descriptions,
  });
  const reviewLayers = await launchLayerEnvironments({
    run,
    createdTabs,
    repositoryRoot,
    intervalMs,
    timeoutMs,
    timer,
  });
  await runSuccessful(run, [
    "herdr",
    "workspace",
    "focus",
    workspace.workspaceId,
  ]);
  await runSuccessful(run, ["herdr", "tab", "focus", workspace.tabId]);
  return {
    workspaceId: workspace.workspaceId,
    controlTabId: workspace.tabId,
    controlPaneId: workspace.paneId,
    layers: reviewLayers,
  };
}

/**
 * @param repositoryRoot Git のトップレベル。Hunk の repoRoot または cwd と照合する。
 */
export async function createReviewEnvironment(
  ...parameters: CreateReviewEnvironmentParameters
): Promise<ReviewEnvironment> {
  const [
    run,
    repositoryRoot,
    repositoryName,
    layers,
    descriptions,
    options = {},
  ] = parameters;
  const intervalMs =
    options.sessionDiscoveryIntervalMs ?? DEFAULT_SESSION_DISCOVERY_INTERVAL_MS;
  const timeoutMs =
    options.sessionDiscoveryTimeoutMs ?? DEFAULT_SESSION_DISCOVERY_TIMEOUT_MS;
  requirePositiveNumber(intervalMs, "session discovery interval");
  requirePositiveNumber(timeoutMs, "session discovery timeout");
  const timer = options.timer ?? defaultTimer;
  const workspace = await createWorkspace(run, repositoryRoot, repositoryName);

  try {
    return await populateReviewEnvironment({
      run,
      repositoryRoot,
      layers,
      descriptions,
      workspace,
      intervalMs,
      timeoutMs,
      timer,
    });
  } catch (error: unknown) {
    // 構築失敗の原因を失わないため、後始末のエラーは上書きしない。
    await destroyReviewEnvironment(run, workspace.workspaceId).catch(
      () => undefined,
    );
    throw error;
  }
}
