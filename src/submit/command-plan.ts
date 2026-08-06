import type { Stack } from "../types.ts";
import { baseBranchForLayer } from "./base-branch.ts";
import { submitBodyPath } from "./paths.ts";
import type {
  SubmitCommandPlan,
  SubmitLayerCommand,
  SubmitLayerState,
} from "./types.ts";

interface CreateLayerCommandOptions {
  trunk: string;
  layerNames: readonly string[];
  layer: SubmitLayerState;
  layerIndex: number;
  bodyPath: string;
  title: string;
}

function createLayerCommand({
  trunk,
  layerNames,
  layer,
  layerIndex,
  bodyPath,
  title,
}: CreateLayerCommandOptions): SubmitLayerCommand {
  return {
    layerName: layer.layerName,
    action: "create",
    pullRequestNumber: null,
    argv: [
      "gh",
      "pr",
      "create",
      "--base",
      baseBranchForLayer(trunk, layerNames, layerIndex),
      "--head",
      layer.layerName,
      "--title",
      title,
      "--body-file",
      bodyPath,
      "--draft",
    ],
  };
}

function editLayerCommand(
  layer: SubmitLayerState,
  bodyPath: string,
  title: string,
): SubmitLayerCommand {
  const { pullRequest } = layer;
  if (pullRequest === null) {
    throw new TypeError("pull request is missing");
  }
  return {
    layerName: layer.layerName,
    action: "edit",
    pullRequestNumber: pullRequest.number,
    argv: [
      "gh",
      "pr",
      "edit",
      String(pullRequest.number),
      "--title",
      title,
      "--body-file",
      bodyPath,
    ],
  };
}

interface LayerCommandOptions {
  stack: Stack;
  layerNames: readonly string[];
  layer: SubmitLayerState;
  index: number;
  absoluteGitDir: string;
}

function buildLayerCommand({
  stack,
  layerNames,
  layer,
  index,
  absoluteGitDir,
}: LayerCommandOptions): SubmitLayerCommand {
  const { title } = layer.draft;
  if (title === null) {
    throw new TypeError(
      `draft title for layer "${layer.layerName}" is missing`,
    );
  }
  const bodyPath = submitBodyPath(absoluteGitDir, layer.layerName);
  if (layer.pullRequest === null) {
    return createLayerCommand({
      trunk: stack.trunk,
      layerNames,
      layer,
      layerIndex: index,
      bodyPath,
      title,
    });
  }
  return editLayerCommand(layer, bodyPath, title);
}

export function buildSubmitCommandPlan(
  stack: Stack,
  layers: readonly SubmitLayerState[],
  absoluteGitDir: string,
): SubmitCommandPlan {
  const layerNames = stack.layers.map((layer) => layer.name);
  if (
    layers.length !== layerNames.length ||
    layers.some((layer, index) => layer.layerName !== layerNames[index])
  ) {
    throw new TypeError("submit layer state is missing or out of order");
  }

  const commands = layers.map((layer, index) =>
    buildLayerCommand({ stack, layerNames, layer, index, absoluteGitDir }),
  );

  return {
    push: ["gh", "stack", "push"],
    layers: commands,
    link: ["gh", "stack", "link", ...layerNames],
  };
}
