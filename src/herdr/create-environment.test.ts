import { describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../exec.ts";
import type { HunkSession } from "../types.ts";
import { expectedCreateEnvironmentCommands } from "./create-environment-fixtures.ts";
import { createReviewEnvironment } from "./index.ts";
import {
  descriptions,
  fileCompareHunkSession,
  hunkSession,
  isCommand,
  layers,
  repositoryRoot,
  sessionList,
  success,
  tabCreateOutput,
  workspaceCreateOutput,
} from "./test-helpers.ts";

const FIRST_LAYER_TAB_NUMBER = 2;

function createRunner() {
  let nextTabNumber = FIRST_LAYER_TAB_NUMBER;
  const startedSessions: HunkSession[] = [];
  return vi.fn<CommandRunner>((argv) => {
    if (isCommand(argv, "herdr", "workspace", "create")) {
      return Promise.resolve(success(workspaceCreateOutput()));
    }
    if (isCommand(argv, "herdr", "tab", "create")) {
      const output = tabCreateOutput(nextTabNumber);
      nextTabNumber += 1;
      return Promise.resolve(success(output));
    }
    if (isCommand(argv, "herdr", "pane", "run")) {
      const sessionId = `session-${startedSessions.length + 1}`;
      const command = argv[4] ?? "";
      let session = hunkSession(sessionId);
      if (command.startsWith("hunk diff /repo/.git/")) {
        session = fileCompareHunkSession(sessionId);
      }
      startedSessions.push(session);
      return Promise.resolve(success());
    }
    if (isCommand(argv, "hunk")) {
      return Promise.resolve(sessionList(startedSessions));
    }
    return Promise.resolve(success());
  });
}

function createEnvironment(run: CommandRunner) {
  return createReviewEnvironment(
    run,
    repositoryRoot,
    "stack-review",
    layers,
    descriptions,
  );
}

describe("createReviewEnvironment", () => {
  describe("success", () => {
    it("creates three layer tabs, starts Hunk, and focuses control", async () => {
      const run = createRunner();

      await expect(createEnvironment(run)).resolves.toEqual({
        workspaceId: "wB",
        controlTabId: "wB:t1",
        controlPaneId: "wB:p1",
        layers: [
          {
            layerNumber: 1,
            layerName: "core",
            tabId: "wB:t3",
            paneId: "wB:p3",
            sessionId: "session-2",
            descriptionTabId: "wB:t2",
            descriptionPaneId: "wB:p2",
            descriptionSessionId: "session-1",
          },
          {
            layerNumber: 2,
            layerName: "hunk-session",
            tabId: "wB:t5",
            paneId: "wB:p5",
            sessionId: "session-4",
            descriptionTabId: "wB:t4",
            descriptionPaneId: "wB:p4",
            descriptionSessionId: "session-3",
          },
          {
            layerNumber: 3,
            layerName: "herdr-layout",
            tabId: "wB:t7",
            paneId: "wB:p7",
            sessionId: "session-6",
            descriptionTabId: "wB:t6",
            descriptionPaneId: "wB:p6",
            descriptionSessionId: "session-5",
          },
        ],
      });
    });

    it("creates description tabs and sessions before code diffs", async () => {
      const run = createRunner();

      await createEnvironment(run);

      expect(run.mock.calls.map(([argv]) => argv)).toEqual(
        expectedCreateEnvironmentCommands,
      );
    });
  });
});
