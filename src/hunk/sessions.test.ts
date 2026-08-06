import { describe, expect, it } from "vitest";

import type { HunkSession } from "../types.ts";
import { findNewHunkSession, parseHunkSessions } from "./index.ts";

function session(sessionId: string, repoRoot = "/repo"): HunkSession {
  return {
    sessionId,
    repoRoot,
    title: `repo main...${sessionId}`,
    fileCount: 1,
  };
}

describe("parseHunkSessions", () => {
  describe("success", () => {
    it("returns an empty array when there are no sessions", () => {
      expect(parseHunkSessions('{"sessions":[]}')).toEqual([]);
    });

    it("parses the fields used to identify a session", () => {
      const output = JSON.stringify({
        sessions: [
          {
            sessionId: "session-1",
            repoRoot: "/repo",
            title: "repo main...layer1",
            fileCount: 2,
            pid: 123,
          },
        ],
      });

      expect(parseHunkSessions(output)).toEqual([
        {
          sessionId: "session-1",
          repoRoot: "/repo",
          title: "repo main...layer1",
          fileCount: 2,
        },
      ]);
    });
  });
});

describe("findNewHunkSession", () => {
  describe("success", () => {
    it("identifies the one session added after launch", () => {
      expect(
        findNewHunkSession(
          [session("existing")],
          [session("existing"), session("new")],
          "/repo",
        ),
      ).toEqual(session("new"));
    });

    it("returns null when no session was added", () => {
      expect(
        findNewHunkSession(
          [session("existing")],
          [session("existing")],
          "/repo",
        ),
      ).toBeNull();
    });

    it("ignores a session added at the same time in another repository", () => {
      expect(
        findNewHunkSession(
          [session("existing")],
          [
            session("existing"),
            session("target", "/repo"),
            session("unrelated", "/other-repo"),
          ],
          "/repo",
        ),
      ).toEqual(session("target"));
    });
  });

  describe("failure", () => {
    it("rejects an ambiguous launch that added multiple sessions", () => {
      expect(() =>
        findNewHunkSession([], [session("new-1"), session("new-2")], "/repo"),
      ).toThrow("expected one new Hunk session, found 2");
    });
  });
});
