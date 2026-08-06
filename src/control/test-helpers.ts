import { join } from "node:path";

import type { ControlScreenState, ControlState } from "./types.ts";

export function controlState(absoluteGitDir: string): ControlState {
  return {
    version: 1,
    repositoryRoot: "/repo/xix",
    absoluteGitDir,
    repositoryName: "xix",
    stack: {
      trunk: "main",
      layers: [
        {
          name: "auth-layer",
          base: "main-commit",
          stats: {
            fileCount: 2,
            additions: 10,
            deletions: 3,
            binaryFileCount: 0,
          },
        },
      ],
    },
    workingTreeStatus: { hasChanges: false, changeCount: 0 },
    descriptions: [
      {
        layerName: "auth-layer",
        draftPath: join(
          absoluteGitDir,
          "stack-review/descriptions/auth-layer.md",
        ),
        baselinePath: join(
          absoluteGitDir,
          "stack-review/baseline/auth-layer.md",
        ),
        draft: { title: null, body: "" },
        pullRequest: null,
      },
    ],
    environment: {
      workspaceId: "workspace-1",
      controlTabId: "tab-1",
      controlPaneId: "pane-1",
      layers: [
        {
          layerNumber: 1,
          layerName: "auth-layer",
          tabId: "tab-2",
          paneId: "pane-2",
          sessionId: "session-1",
          descriptionTabId: "tab-3",
          descriptionPaneId: "pane-3",
          descriptionSessionId: "session-2",
        },
      ],
    },
  };
}

export function screenState(hasChanges = false): ControlScreenState {
  let changeCount = 0;
  if (hasChanges) {
    changeCount = 2;
  }
  return {
    repositoryName: "xix",
    workingTreeStatus: {
      hasChanges,
      changeCount,
    },
    layers: [
      {
        layerNumber: 1,
        layerName: "auth-layer",
        fileCount: 2,
        noteCount: 1,
        sessionAlive: true,
        descriptionFilled: true,
      },
      {
        layerNumber: 2,
        layerName: "api-endpoints",
        fileCount: 5,
        noteCount: 0,
        sessionAlive: true,
        descriptionFilled: false,
      },
      {
        layerNumber: 3,
        layerName: "frontend",
        fileCount: 3,
        noteCount: 2,
        sessionAlive: false,
        descriptionFilled: true,
      },
    ],
  };
}
