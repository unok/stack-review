import { describe, expect, it } from "vitest";

import { buildHunkDiffArgv, buildHunkDiffCommand } from "./index.ts";

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
