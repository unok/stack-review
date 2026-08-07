import { join } from "node:path";

import type { SubmitLayerState } from "./types.ts";

export function submitBodyPath(
  absoluteGitDir: string,
  branchName: string,
): string {
  if (branchName.length === 0) {
    throw new TypeError("branch name must not be empty");
  }
  return join(
    absoluteGitDir,
    "stack-review",
    "body",
    `${encodeURIComponent(branchName)}.md`,
  );
}

export function findUnfilledLayerNames(
  layers: readonly Pick<SubmitLayerState, "layerName" | "draft">[],
): string[] {
  return layers
    .filter((layer) => layer.draft.title === null)
    .map((layer) => layer.layerName);
}
