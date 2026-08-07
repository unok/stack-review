import { describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../exec.ts";
import { fetchReviewNotes, parseReviewNotes } from "./index.ts";

const NEW_RANGE_START_LINE = 2;
const NEW_RANGE_END_LINE = 5;
const OLD_RANGE_START_LINE = 3;
const LIVE_REVIEW_NOTES_OUTPUT = JSON.stringify({
  comments: [
    {
      filePath: "src/live.ts",
      newRange: [NEW_RANGE_START_LINE, NEW_RANGE_END_LINE],
      body: "live note",
    },
  ],
});

describe("parseReviewNotes", () => {
  describe("success", () => {
    it("uses the new-side start line for a newRange comment", () => {
      const output = JSON.stringify({
        comments: [
          {
            filePath: "src/new.ts",
            newRange: [NEW_RANGE_START_LINE, NEW_RANGE_END_LINE],
            body: "new-side note",
          },
        ],
      });

      expect(parseReviewNotes(output, "layer-1")).toEqual([
        {
          filePath: "src/new.ts",
          line: NEW_RANGE_START_LINE,
          body: "new-side note",
          layerName: "layer-1",
          side: "new",
        },
      ]);
    });

    it("uses the old-side start line for an oldRange comment", () => {
      const output = JSON.stringify({
        comments: [
          {
            filePath: "src/old.ts",
            oldRange: [OLD_RANGE_START_LINE, OLD_RANGE_START_LINE],
            body: "old-side note",
          },
        ],
      });

      expect(parseReviewNotes(output, "layer-2")).toEqual([
        {
          filePath: "src/old.ts",
          line: OLD_RANGE_START_LINE,
          body: "old-side note",
          layerName: "layer-2",
          side: "old",
        },
      ]);
    });
  });

  describe("failure", () => {
    it("rejects a range whose start is after its end", () => {
      const output = JSON.stringify({
        comments: [
          {
            filePath: "src/reversed.ts",
            newRange: [NEW_RANGE_END_LINE, NEW_RANGE_START_LINE],
            body: "invalid range",
          },
        ],
      });

      expect(() => parseReviewNotes(output, "layer-1")).toThrow(
        "newRange start must not be after its end",
      );
    });
  });
});

describe("fetchReviewNotes", () => {
  describe("success", () => {
    it("returns review notes for a live session", async () => {
      const run = vi.fn<CommandRunner>().mockResolvedValue({
        stdout: LIVE_REVIEW_NOTES_OUTPUT,
        stderr: "",
        exitCode: 0,
      });

      await expect(fetchReviewNotes(run, "live", "layer")).resolves.toEqual({
        sessionAlive: true,
        notes: [
          {
            filePath: "src/live.ts",
            line: NEW_RANGE_START_LINE,
            body: "live note",
            layerName: "layer",
            side: "new",
          },
        ],
      });
      expect(run).toHaveBeenNthCalledWith(1, [
        "hunk",
        "session",
        "comment",
        "list",
        "live",
        "--type",
        "user",
        "--json",
      ]);
    });
  });

  describe("failure", () => {
    it.each([
      "No active session matches sessionId gone",
      "No active Hunk sessions are registered",
    ])("returns no notes for a disappeared session: %s", async (stderr) => {
      const run = vi
        .fn<CommandRunner>()
        .mockResolvedValue({ stdout: "", stderr, exitCode: 1 });

      await expect(fetchReviewNotes(run, "gone", "layer")).resolves.toEqual({
        sessionAlive: false,
        notes: [],
      });
    });

    it("throws for a non-session command failure", async () => {
      const run = vi.fn<CommandRunner>().mockResolvedValue({
        stdout: "",
        stderr: "permission denied",
        exitCode: 1,
      });

      await expect(fetchReviewNotes(run, "live", "layer")).rejects.toThrow(
        "hunk session comment list exited with code 1: permission denied",
      );
    });
  });
});
