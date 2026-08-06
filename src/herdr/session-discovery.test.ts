import { describe, expect, it, vi } from "vitest";

import type { CommandResult, CommandRunner } from "../exec.ts";
import type { Layer } from "../types.ts";
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

const DELAYED_INTERVAL_MS = 250;
const DELAYED_TIMEOUT_MS = 1000;
const MISMATCH_INTERVAL_MS = 100;
const MISMATCH_TIMEOUT_MS = 200;
const EXPECTED_MISMATCH_LIST_COUNT = 4;
const TIMEOUT_INTERVAL_MS = 200;
const TIMEOUT_MS = 500;
const FINAL_RETRY_DELAY_MS = 100;
const CLOSE_WORKSPACE_COMMAND = ["herdr", "workspace", "close", "wB"];

function createSessionRunner(listSessions: () => CommandResult): CommandRunner {
  return vi.fn<CommandRunner>((argv) => {
    if (isCommand(argv, "herdr", "workspace", "create")) {
      return Promise.resolve(success(workspaceCreateOutput()));
    }
    if (isCommand(argv, "herdr", "tab", "create")) {
      return Promise.resolve(success(tabCreateOutput(2)));
    }
    if (isCommand(argv, "hunk")) {
      return Promise.resolve(listSessions());
    }
    return Promise.resolve(success());
  });
}

function createDelayedSessionAttempt() {
  const run = vi
    .fn<CommandRunner>()
    .mockResolvedValueOnce(success(workspaceCreateOutput()))
    .mockResolvedValueOnce(success())
    .mockResolvedValueOnce(success(tabCreateOutput(2)))
    .mockResolvedValueOnce(sessionList([]))
    .mockResolvedValueOnce(success())
    .mockResolvedValueOnce(sessionList([]))
    .mockResolvedValueOnce(sessionList([hunkSession("delayed")]))
    .mockResolvedValueOnce(success())
    .mockResolvedValueOnce(success());
  const sleep = vi.fn(() => Promise.resolve());
  const environment = createReviewEnvironment(
    run,
    repositoryRoot,
    "stack-review",
    [layers[0] as Layer],
    {
      sessionDiscoveryIntervalMs: DELAYED_INTERVAL_MS,
      sessionDiscoveryTimeoutMs: DELAYED_TIMEOUT_MS,
      timer: { sleep },
    },
  );
  return { environment, sleep };
}

function createMismatchedSessionAttempt() {
  const subdirectory = `${repositoryRoot}/src`;
  const state = { sessionListCount: 0 };
  const run = createSessionRunner(() => {
    state.sessionListCount += 1;
    if (state.sessionListCount === 1) {
      return sessionList([]);
    }
    return sessionList([hunkSession("at-git-root", repositoryRoot)]);
  });
  const sleep = vi.fn(() => Promise.resolve());
  const environment = createReviewEnvironment(
    run,
    subdirectory,
    "stack-review",
    [layers[0] as Layer],
    {
      sessionDiscoveryIntervalMs: MISMATCH_INTERVAL_MS,
      sessionDiscoveryTimeoutMs: MISMATCH_TIMEOUT_MS,
      timer: { sleep },
    },
  );
  return { environment, run, state };
}

function createTimedOutSessionAttempt() {
  const run = createSessionRunner(() => sessionList([]));
  const sleep = vi.fn(() => Promise.resolve());
  const environment = createReviewEnvironment(
    run,
    repositoryRoot,
    "stack-review",
    [layers[0] as Layer],
    {
      sessionDiscoveryIntervalMs: TIMEOUT_INTERVAL_MS,
      sessionDiscoveryTimeoutMs: TIMEOUT_MS,
      timer: { sleep },
    },
  );
  return { environment, run, sleep };
}

describe("createReviewEnvironment", () => {
  describe("success", () => {
    it("retries until a delayed Hunk session appears", async () => {
      const { environment, sleep } = createDelayedSessionAttempt();

      await expect(environment).resolves.toMatchObject({
        layers: [{ sessionId: "delayed" }],
      });
      expect(sleep).toHaveBeenCalledOnce();
      expect(sleep).toHaveBeenCalledWith(DELAYED_INTERVAL_MS);
    });
  });

  describe("failure", () => {
    it("does not capture a session whose repoRoot differs from repositoryRoot", async () => {
      const { environment, run, state } = createMismatchedSessionAttempt();

      await expect(environment).rejects.toThrow(
        `Hunk session for layer "core" did not appear within ${MISMATCH_TIMEOUT_MS} ms`,
      );
      expect(state.sessionListCount).toBe(EXPECTED_MISMATCH_LIST_COUNT);
      expect(run).toHaveBeenLastCalledWith(CLOSE_WORKSPACE_COMMAND);
    });

    it("closes the partial workspace when session discovery times out", async () => {
      const { environment, run, sleep } = createTimedOutSessionAttempt();

      await expect(environment).rejects.toThrow(
        `Hunk session for layer "core" did not appear within ${TIMEOUT_MS} ms`,
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
