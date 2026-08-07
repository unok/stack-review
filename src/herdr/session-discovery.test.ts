import { describe, expect, it, vi } from "vitest";

import type { PreparedLayerDescription } from "../description.ts";
import type { CommandResult, CommandRunner } from "../exec.ts";
import type { HunkSession, Layer } from "../types.ts";
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

const DELAYED_INTERVAL_MS = 250;
const DELAYED_TIMEOUT_MS = 1000;
const MISMATCH_INTERVAL_MS = 100;
const MISMATCH_TIMEOUT_MS = 200;
const EXPECTED_MISMATCH_LIST_COUNT = 4;
const TIMEOUT_INTERVAL_MS = 200;
const TIMEOUT_MS = 500;
const FINAL_RETRY_DELAY_MS = 100;
const FIRST_LAYER_TAB_NUMBER = 2;
const DESCRIPTION_DISCOVERY_COUNT = 2;
const CODE_LAUNCH_COUNT = 2;
const CLOSE_WORKSPACE_COMMAND = ["herdr", "workspace", "close", "wB"];

interface SessionRunnerOptions {
  listSessions: () => CommandResult;
  onLaunch?: () => void;
}

function createSessionRunner({
  listSessions,
  onLaunch = () => undefined,
}: SessionRunnerOptions): CommandRunner {
  let nextTabNumber = FIRST_LAYER_TAB_NUMBER;
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
      onLaunch();
    }
    if (isCommand(argv, "hunk")) {
      return Promise.resolve(listSessions());
    }
    return Promise.resolve(success());
  });
}

interface EnvironmentAttemptOptions {
  run: CommandRunner;
  root: string;
  intervalMs: number;
  timeoutMs: number;
  sleep: (delayMs: number) => Promise<void>;
}

function createEnvironmentAttempt({
  run,
  root,
  intervalMs,
  timeoutMs,
  sleep,
}: EnvironmentAttemptOptions) {
  return createReviewEnvironment(
    run,
    root,
    "stack-review",
    [layers[0] as Layer],
    [descriptions[0] as PreparedLayerDescription],
    {
      sessionDiscoveryIntervalMs: intervalMs,
      sessionDiscoveryTimeoutMs: timeoutMs,
      timer: { sleep },
    },
  );
}

describe("createReviewEnvironment", () => {
  describe("success", () => {
    it("retries until a delayed Hunk session appears", async () => {
      let launchedCount = 0;
      let descriptionDiscoveryCount = 0;
      const startedSessions: HunkSession[] = [];
      const run = createSessionRunner({
        listSessions: () => {
          if (launchedCount === 1 && startedSessions.length === 0) {
            descriptionDiscoveryCount += 1;
            if (descriptionDiscoveryCount === DESCRIPTION_DISCOVERY_COUNT) {
              startedSessions.push(fileCompareHunkSession("delayed"));
            }
          }
          return sessionList(startedSessions);
        },
        onLaunch: () => {
          launchedCount += 1;
          if (launchedCount === CODE_LAUNCH_COUNT) {
            startedSessions.push(hunkSession("code"));
          }
        },
      });
      const sleep = vi.fn(() => Promise.resolve());

      await expect(
        createEnvironmentAttempt({
          run,
          root: repositoryRoot,
          intervalMs: DELAYED_INTERVAL_MS,
          timeoutMs: DELAYED_TIMEOUT_MS,
          sleep,
        }),
      ).resolves.toMatchObject({
        layers: [{ descriptionSessionId: "delayed", sessionId: "code" }],
      });
      expect(sleep).toHaveBeenCalledOnce();
      expect(sleep).toHaveBeenCalledWith(DELAYED_INTERVAL_MS);
    });
  });
});

describe("createReviewEnvironment", () => {
  describe("failure", () => {
    it("does not capture a session whose repoRoot differs from repositoryRoot", async () => {
      const subdirectory = `${repositoryRoot}/src`;
      const state = { sessionListCount: 0 };
      const run = createSessionRunner({
        listSessions: () => {
          state.sessionListCount += 1;
          if (state.sessionListCount === 1) {
            return sessionList([]);
          }
          return sessionList([hunkSession("at-git-root", repositoryRoot)]);
        },
      });
      const sleep = vi.fn(() => Promise.resolve());

      await expect(
        createEnvironmentAttempt({
          run,
          root: subdirectory,
          intervalMs: MISMATCH_INTERVAL_MS,
          timeoutMs: MISMATCH_TIMEOUT_MS,
          sleep,
        }),
      ).rejects.toThrow(
        `Hunk session for layer "core desc" did not appear within ${MISMATCH_TIMEOUT_MS} ms`,
      );
      expect(state.sessionListCount).toBe(EXPECTED_MISMATCH_LIST_COUNT);
      expect(run).toHaveBeenLastCalledWith(CLOSE_WORKSPACE_COMMAND);
    });
  });
});

describe("createReviewEnvironment", () => {
  describe("failure", () => {
    it("closes the partial workspace when session discovery times out", async () => {
      const run = createSessionRunner({
        listSessions: () => sessionList([]),
      });
      const sleep = vi.fn(() => Promise.resolve());

      await expect(
        createEnvironmentAttempt({
          run,
          root: repositoryRoot,
          intervalMs: TIMEOUT_INTERVAL_MS,
          timeoutMs: TIMEOUT_MS,
          sleep,
        }),
      ).rejects.toThrow(
        `Hunk session for layer "core desc" did not appear within ${TIMEOUT_MS} ms`,
      );
      expect(sleep.mock.calls).toEqual([
        [TIMEOUT_INTERVAL_MS],
        [TIMEOUT_INTERVAL_MS],
        [FINAL_RETRY_DELAY_MS],
      ]);
      expect(run).toHaveBeenLastCalledWith(CLOSE_WORKSPACE_COMMAND);
    });
  });
});
