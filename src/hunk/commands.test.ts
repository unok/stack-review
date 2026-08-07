import { describe, expect, it } from "vitest";

import {
  buildHunkDiffArgv,
  buildHunkDiffCommand,
  buildHunkFileDiffArgv,
  buildHunkFileDiffCommand,
} from "./index.ts";

describe("buildHunkDiffArgv", () => {
  describe("success", () => {
    it("builds a shell-free hunk diff command", () => {
      expect(buildHunkDiffArgv("base..layer")).toEqual([
        "hunk",
        "diff",
        "base..layer",
      ]);
    });
  });
});

describe("buildHunkDiffCommand", () => {
  describe("success", () => {
    it("leaves a slash in a branch name unquoted", () => {
      expect(buildHunkDiffCommand("base..refactor/foo")).toBe(
        "hunk diff base..refactor/foo",
      );
    });

    it("quotes spaces and quotation marks for a POSIX shell", () => {
      expect(buildHunkDiffCommand(`base..feature "quoted" 'owner'`)).toBe(
        `hunk diff 'base..feature "quoted" '"'"'owner'"'"''`,
      );
    });
  });
});

describe("two-file Hunk diff command", () => {
  describe("success", () => {
    it("builds an argv with concrete baseline and draft paths", () => {
      expect(
        buildHunkFileDiffArgv("/repo/.git/baseline.md", "/repo/.git/draft.md"),
      ).toEqual([
        "hunk",
        "diff",
        "/repo/.git/baseline.md",
        "/repo/.git/draft.md",
      ]);
    });

    it("quotes file paths for the herdr pane shell", () => {
      expect(
        buildHunkFileDiffCommand(
          "/repo/work tree/baseline.md",
          "/repo/work tree/draft.md",
        ),
      ).toBe(
        "hunk diff '/repo/work tree/baseline.md' '/repo/work tree/draft.md'",
      );
    });
  });
});
