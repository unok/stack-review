import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  fetchPullRequestDescription,
  readOrCreateDescriptionDraft,
} from "../description.ts";
import type { CommandRunner } from "../exec.ts";
import { getRepositoryPaths, getStackView } from "../repo.ts";
import type { Layer } from "../types.ts";
import { buildSubmitCommandPlan } from "./command-plan.ts";
import { executeSubmitPlan } from "./execute-plan.ts";
import { findUnfilledLayerNames, submitBodyPath } from "./paths.ts";
import type { SubmitLayerState, SubmitResult } from "./types.ts";

async function readDrafts(
  layers: readonly Layer[],
  absoluteGitDir: string,
): Promise<SubmitLayerState[]> {
  const drafts: SubmitLayerState[] = [];
  for (const layer of layers) {
    const { draft } = await readOrCreateDescriptionDraft(
      absoluteGitDir,
      layer.name,
    );
    drafts.push({ layerName: layer.name, draft, pullRequest: null });
  }
  return drafts;
}

async function loadPullRequests(
  run: CommandRunner,
  layers: SubmitLayerState[],
): Promise<Map<number, string>> {
  const urls = new Map<number, string>();
  for (const layer of layers) {
    layer.pullRequest = await fetchPullRequestDescription(run, layer.layerName);
    if (layer.pullRequest !== null) {
      urls.set(layer.pullRequest.number, layer.pullRequest.url);
    }
  }
  return urls;
}

async function writeBodies(
  layers: readonly SubmitLayerState[],
  absoluteGitDir: string,
): Promise<void> {
  for (const layer of layers) {
    const path = submitBodyPath(absoluteGitDir, layer.layerName);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, layer.draft.body, "utf8");
  }
}

export async function submitStack(run: CommandRunner): Promise<SubmitResult> {
  const stackView = await getStackView(run);
  if (stackView.kind === "not-in-stack") {
    throw new Error(stackView.message);
  }
  if (stackView.stack.layers.length === 0) {
    throw new Error("スタックにレイヤーがありません");
  }

  const repository = await getRepositoryPaths(run);
  const drafts = await readDrafts(
    stackView.stack.layers,
    repository.absoluteGitDir,
  );
  const unfilled = findUnfilledLayerNames(drafts);
  if (unfilled.length > 0) {
    return { kind: "unfilled", layerNames: unfilled };
  }

  const existingUrls = await loadPullRequests(run, drafts);
  const plan = buildSubmitCommandPlan(
    stackView.stack,
    drafts,
    repository.absoluteGitDir,
  );
  await writeBodies(drafts, repository.absoluteGitDir);
  return executeSubmitPlan(run, plan, existingUrls);
}
