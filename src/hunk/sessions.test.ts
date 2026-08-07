import { describe, expect, it } from "vitest";

import type { HunkSession } from "../types.ts";
import { findNewHunkSession } from "./index.ts";

function vcsSession(sessionId: string, repoRoot = "/repo"): HunkSession {
  return {
    sessionId,
    repoRoot,
    cwd: repoRoot,
    title: `repo main...${sessionId}`,
    fileCount: 1,
  };
}

function fileCompareSession(sessionId: string, cwd = "/repo"): HunkSession {
  return {
    sessionId,
    repoRoot: null,
    cwd,
    title: "baseline.md ↔ draft.md",
    fileCount: 1,
  };
}

describe("findNewHunkSession", () => {
  describe("success", () => {
    it("captures a VCS session whose repoRoot matches", () => {
      expect(
        findNewHunkSession(
          [vcsSession("existing")],
          [vcsSession("existing"), vcsSession("new")],
          "/repo",
        ),
      ).toEqual(vcsSession("new"));
    });

    it("captures a file compare session whose cwd matches", () => {
      expect(
        findNewHunkSession(
          [vcsSession("existing")],
          [vcsSession("existing"), fileCompareSession("new")],
          "/repo",
        ),
      ).toEqual(fileCompareSession("new"));
    });

    it("ignores a file compare session whose cwd belongs to another project", () => {
      expect(
        findNewHunkSession(
          [vcsSession("existing")],
          [
            vcsSession("existing"),
            fileCompareSession("unrelated", "/other-repo"),
          ],
          "/repo",
        ),
      ).toBeNull();
    });
  });
});

describe("findNewHunkSession", () => {
  describe("success", () => {
    it("returns null when no session was added", () => {
      expect(
        findNewHunkSession(
          [vcsSession("existing")],
          [vcsSession("existing")],
          "/repo",
        ),
      ).toBeNull();
    });

    it("ignores a session added at the same time in another repository", () => {
      expect(
        findNewHunkSession(
          [vcsSession("existing")],
          [
            vcsSession("existing"),
            vcsSession("target", "/repo"),
            vcsSession("unrelated", "/other-repo"),
          ],
          "/repo",
        ),
      ).toEqual(vcsSession("target"));
    });
  });
});

describe("findNewHunkSession", () => {
  describe("failure", () => {
    it("rejects an ambiguous launch that added multiple sessions", () => {
      expect(() =>
        findNewHunkSession(
          [],
          [vcsSession("new-1"), vcsSession("new-2")],
          "/repo",
        ),
      ).toThrow("expected one new Hunk session, found 2");
    });
  });
});
