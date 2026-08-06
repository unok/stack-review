import { describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../exec.ts";
import type { HunkSession } from "../types.ts";
import { expectedCreateEnvironmentCommands } from "./create-environment-fixtures.ts";
import { createReviewEnvironment } from "./index.ts";
import {
  hunkSession,
  isCommand,
  layers,
  repositoryRoot,
  sessionList,
  success,
  tabCreateOutput,
  workspaceCreateOutput,
} from "./test-helpers.ts";

function createRunner() {
  let nextTabNumber = 2;
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
      startedSessions.push(
        hunkSession(`session-${startedSessions.length + 1}`),
      );
      return Promise.resolve(success());
    }
    if (isCommand(argv, "hunk")) {
      return Promise.resolve(sessionList(startedSessions));
    }
    return Promise.resolve(success());
  });
}

describe("createReviewEnvironment", () => {
  describe("success", () => {
    it("creates three layer tabs, starts Hunk, and focuses control", async () => {
      const run = createRunner();

      await expect(
        createReviewEnvironment(run, repositoryRoot, "stack-review", layers),
      ).resolves.toEqual({
        workspaceId: "wB",
        controlTabId: "wB:t1",
        controlPaneId: "wB:p1",
        layers: [
          {
            layerNumber: 1,
            layerName: "core",
            tabId: "wB:t2",
            paneId: "wB:p2",
            sessionId: "session-1",
          },
          {
            layerNumber: 2,
            layerName: "hunk-session",
            tabId: "wB:t3",
            paneId: "wB:p3",
            sessionId: "session-2",
          },
          {
            layerNumber: 3,
            layerName: "herdr-layout",
            tabId: "wB:t4",
            paneId: "wB:p4",
            sessionId: "session-3",
          },
        ],
      });
      expect(run.mock.calls.map(([argv]) => argv)).toEqual(
        expectedCreateEnvironmentCommands,
      );
    });
  });
});
