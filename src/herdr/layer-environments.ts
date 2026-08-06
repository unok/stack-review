import type { CommandRunner } from "../exec.ts";
import { buildHunkDiffCommand, listHunkSessions } from "../hunk/index.ts";
import { layerRevisionRange } from "../stack.ts";
import type { Layer } from "../types.ts";
import { runSuccessful } from "./helpers.ts";
import { buildLayerTabLabel } from "./labels.ts";
import { parseTabCreateOutput } from "./responses.ts";
import { discoverLaunchedSession } from "./session-discovery.ts";
import type {
  ReviewLayerEnvironment,
  SessionDiscoveryTimer,
  TabCreateResult,
} from "./types.ts";

interface CreatedLayerTab extends TabCreateResult {
  layer: Layer;
  layerNumber: number;
}

interface LaunchLayerEnvironmentsOptions {
  run: CommandRunner;
  createdTabs: readonly CreatedLayerTab[];
  repositoryRoot: string;
  intervalMs: number;
  timeoutMs: number;
  timer: SessionDiscoveryTimer;
}

export async function createLayerTabs(
  run: CommandRunner,
  workspaceId: string,
  repositoryRoot: string,
  layers: readonly Layer[],
): Promise<CreatedLayerTab[]> {
  const createdTabs: CreatedLayerTab[] = [];
  for (const [index, layer] of layers.entries()) {
    const layerNumber = index + 1;
    const tabOutput = await runSuccessful(run, [
      "herdr",
      "tab",
      "create",
      "--workspace",
      workspaceId,
      "--cwd",
      repositoryRoot,
      "--no-focus",
      "--label",
      buildLayerTabLabel(layerNumber, layer.name),
    ]);
    createdTabs.push({
      ...parseTabCreateOutput(tabOutput),
      layer,
      layerNumber,
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
    const before = await listHunkSessions(run);
    await runSuccessful(run, [
      "herdr",
      "pane",
      "run",
      created.paneId,
      buildHunkDiffCommand(layerRevisionRange(created.layer)),
    ]);
    const sessionId = await discoverLaunchedSession({
      run,
      before,
      repositoryRoot,
      layerName: created.layer.name,
      intervalMs,
      timeoutMs,
      timer,
    });
    reviewLayers.push({
      layerNumber: created.layerNumber,
      layerName: created.layer.name,
      tabId: created.tabId,
      paneId: created.paneId,
      sessionId,
    });
  }
  return reviewLayers;
}
