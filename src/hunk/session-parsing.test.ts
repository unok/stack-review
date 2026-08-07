import { describe, expect, it } from "vitest";

import { parseHunkSessions } from "./index.ts";

const INVALID_REPO_ROOT_NUMBER = 42;

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
            inputKind: "vcs",
            title: "stack-review 6a34620..core",
            repoRoot: "/repo",
            cwd: "/repo",
            sourceLabel: "/repo",
            fileCount: 8,
          },
        ],
      });

      expect(parseHunkSessions(output)).toEqual([
        {
          sessionId: "session-1",
          repoRoot: "/repo",
          cwd: "/repo",
          title: "stack-review 6a34620..core",
          fileCount: 8,
        },
      ]);
    });
  });
});

describe("parseHunkSessions", () => {
  describe("success", () => {
    it("normalizes a missing repoRoot key in a file compare session to null", () => {
      const output = JSON.stringify({
        sessions: [
          {
            sessionId: "session-2",
            inputKind: "diff",
            title: "core.md ↔ core.md",
            cwd: "/path/to/repo",
            sourceLabel: "file compare",
            fileCount: 1,
          },
        ],
      });

      expect(parseHunkSessions(output)).toEqual([
        {
          sessionId: "session-2",
          repoRoot: null,
          cwd: "/path/to/repo",
          title: "core.md ↔ core.md",
          fileCount: 1,
        },
      ]);
    });

    it("accepts an explicit repoRoot null", () => {
      const output = JSON.stringify({
        sessions: [
          {
            sessionId: "session-2",
            inputKind: "diff",
            title: "core.md ↔ core.md",
            repoRoot: null,
            cwd: "/path/to/repo",
            sourceLabel: "file compare",
            fileCount: 1,
          },
        ],
      });

      expect(parseHunkSessions(output)[0]?.repoRoot).toBeNull();
    });
  });
});

describe("parseHunkSessions", () => {
  describe("failure", () => {
    it.each(["", INVALID_REPO_ROOT_NUMBER])(
      "rejects invalid repoRoot %j",
      (repoRoot) => {
        const output = JSON.stringify({
          sessions: [
            {
              sessionId: "session-2",
              inputKind: "diff",
              title: "baseline.md ↔ draft.md",
              repoRoot,
              cwd: "/path/to/repo",
              sourceLabel: "file compare",
              fileCount: 1,
            },
          ],
        });

        expect(() => parseHunkSessions(output)).toThrow(
          "repoRoot must be null or a non-empty string",
        );
      },
    );
  });
});
