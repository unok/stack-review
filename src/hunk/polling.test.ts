import { afterEach, describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../exec.ts";
import type { ReviewNote } from "../types.ts";
import { ReviewNoteStore, startReviewNotePolling } from "./index.ts";

const NOTE_LINE = 12;
const POLL_INTERVAL_MS = 500;
const EXPECTED_POLL_COUNT = 3;
const AFTER_STOP_WAIT_MS = 2000;

function note(body: string): ReviewNote {
  return {
    filePath: "src/hunk.ts",
    line: 12,
    body,
    layerName: "hunk-session",
    side: "new",
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("startReviewNotePolling", () => {
  describe("success", () => {
    it("updates at the requested interval, preserves notes, and stops", async () => {
      vi.useFakeTimers();
      const run = vi
        .fn<CommandRunner>()
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            comments: [
              {
                filePath: "src/hunk.ts",
                newRange: [NOTE_LINE, NOTE_LINE],
                body: "polled note",
              },
            ],
          }),
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValue({
          stdout: "",
          stderr: "No active session matches sessionId session-1",
          exitCode: 1,
        });
      const store = new ReviewNoteStore();
      const poller = startReviewNotePolling(
        [{ layerName: "hunk-session", sessionId: "session-1" }],
        store,
        run,
        { intervalMs: POLL_INTERVAL_MS },
      );

      expect(run).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(run).toHaveBeenCalledTimes(1);
      expect(store.get("hunk-session")).toEqual({
        sessionAlive: true,
        notes: [note("polled note")],
      });

      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(store.get("hunk-session")).toEqual({
        sessionAlive: false,
        notes: [note("polled note")],
      });

      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(run).toHaveBeenCalledTimes(EXPECTED_POLL_COUNT);

      poller.stop();
      await vi.advanceTimersByTimeAsync(AFTER_STOP_WAIT_MS);
      expect(run).toHaveBeenCalledTimes(EXPECTED_POLL_COUNT);
    });
  });
});

describe("startReviewNotePolling", () => {
  describe("success", () => {
    it("stores notes under snapshotName while fetching with layerName", async () => {
      const run = vi.fn<CommandRunner>().mockResolvedValue({
        stdout: JSON.stringify({
          comments: [
            {
              filePath: "description.md",
              newRange: [1, 1],
              body: "description note",
            },
          ],
        }),
        stderr: "",
        exitCode: 0,
      });
      const store = new ReviewNoteStore();
      const poller = startReviewNotePolling(
        [
          {
            layerName: "core",
            sessionId: "session-1",
            snapshotName: "core:description",
          },
        ],
        store,
        run,
      );

      await poller.pollNow();

      expect(run).toHaveBeenCalledWith([
        "hunk",
        "session",
        "comment",
        "list",
        "session-1",
        "--type",
        "user",
        "--json",
      ]);
      expect(store.get("core:description")).toEqual({
        sessionAlive: true,
        notes: [
          {
            filePath: "description.md",
            line: 1,
            body: "description note",
            layerName: "core",
            side: "new",
          },
        ],
      });
      expect(store.get("core")).toBeUndefined();
      poller.stop();
    });
  });
});
