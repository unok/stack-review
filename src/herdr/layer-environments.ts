import type { PreparedLayerDescription } from "../description.ts";
import type { CommandRunner } from "../exec.ts";
import {
  buildHunkDiffCommand,
  buildHunkFileDiffCommand,
  listHunkSessions,
} from "../hunk/index.ts";
import { layerRevisionRange } from "../stack.ts";
import type { Layer } from "../types.ts";
import { runSuccessful } from "./helpers.ts";
import { buildLayerDescriptionTabLabel, buildLayerTabLabel } from "./labels.ts";
import { parseTabCreateOutput } from "./responses.ts";
import { discoverLaunchedSession } from "./session-discovery.ts";
import type {
  ReviewLayerEnvironment,
  SessionDiscoveryTimer,
  TabCreateResult,
} from "./types.ts";

interface CreatedLayerTabs {
  layer: Layer;
  layerNumber: number;
  diff: TabCreateResult;
  description: TabCreateResult;
  descriptionPaths: PreparedLayerDescription;
}

async function createTab(
  run: CommandRunner,
  workspaceId: string,
  repositoryRoot: string,
  label: string,
): Promise<TabCreateResult> {
  const output = await runSuccessful(run, [
    "herdr",
    "tab",
    "create",
    "--workspace",
    workspaceId,
    "--cwd",
    repositoryRoot,
    "--no-focus",
    "--label",
    label,
  ]);
  return parseTabCreateOutput(output);
}

interface LaunchLayerEnvironmentsOptions {
  run: CommandRunner;
  createdTabs: readonly CreatedLayerTabs[];
  repositoryRoot: string;
  intervalMs: number;
  timeoutMs: number;
  timer: SessionDiscoveryTimer;
}

interface CreateLayerTabsOptions {
  run: CommandRunner;
  workspaceId: string;
  repositoryRoot: string;
  layers: readonly Layer[];
  descriptions: readonly PreparedLayerDescription[];
}

export async function createLayerTabs({
  run,
  workspaceId,
  repositoryRoot,
  layers,
  descriptions,
}: CreateLayerTabsOptions): Promise<CreatedLayerTabs[]> {
  const createdTabs: CreatedLayerTabs[] = [];
  for (const [index, layer] of layers.entries()) {
    const layerNumber = index + 1;
    const descriptionPaths = descriptions[index];
    if (
      descriptionPaths === undefined ||
      descriptionPaths.layerName !== layer.name
    ) {
      throw new TypeError(
        `description paths for layer "${layer.name}" are missing or out of order`,
      );
    }
    const description = await createTab(
      run,
      workspaceId,
      repositoryRoot,
      buildLayerDescriptionTabLabel(layerNumber, layer.name),
    );
    const diff = await createTab(
      run,
      workspaceId,
      repositoryRoot,
      buildLayerTabLabel(layerNumber, layer.name),
    );
    createdTabs.push({
      layer,
      layerNumber,
      diff,
      description,
      descriptionPaths,
    });
  }
  return createdTabs;
}

export async function launchLayerEnvironments({
  run,
  createdTabs,
  repositoryRoot,
  intervalMs,
  timeoutMs,
  timer,
}: LaunchLayerEnvironmentsOptions): Promise<ReviewLayerEnvironment[]> {
  const reviewLayers: ReviewLayerEnvironment[] = [];
  for (const created of createdTabs) {
    const beforeDescription = await listHunkSessions(run);
    await runSuccessful(run, [
      "herdr",
      "pane",
      "run",
      created.description.paneId,
      buildHunkFileDiffCommand(
        created.descriptionPaths.baselinePath,
        created.descriptionPaths.draftPath,
      ),
    ]);
    const descriptionSessionId = await discoverLaunchedSession({
      run,
      before: beforeDescription,
      repositoryRoot,
      layerName: `${created.layer.name} desc`,
      intervalMs,
      timeoutMs,
      timer,
    });
    const beforeDiff = await listHunkSessions(run);
    await runSuccessful(run, [
      "herdr",
      "pane",
      "run",
      created.diff.paneId,
      buildHunkDiffCommand(layerRevisionRange(created.layer)),
    ]);
    const sessionId = await discoverLaunchedSession({
      run,
      before: beforeDiff,
      repositoryRoot,
      layerName: created.layer.name,
      intervalMs,
      timeoutMs,
      timer,
    });
    reviewLayers.push({
      layerNumber: created.layerNumber,
      layerName: created.layer.name,
      tabId: created.diff.tabId,
      paneId: created.diff.paneId,
      sessionId,
      descriptionTabId: created.description.tabId,
      descriptionPaneId: created.description.paneId,
      descriptionSessionId,
    });
  }
  return reviewLayers;
}
