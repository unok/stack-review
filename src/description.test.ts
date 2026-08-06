import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  descriptionBaselinePath,
  descriptionDraftPath,
  emptyDescriptionTemplate,
  fetchPullRequestDescription,
  formatDescriptionBaseline,
  parseDescriptionDraft,
  parsePullRequestViewResult,
  readOrCreateDescriptionDraft,
} from "./description.ts";
import type { CommandRunner } from "./exec.ts";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "stack-review-description-"));
  temporaryDirectories.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("description paths", () => {
  describe("success", () => {
    it("encodes a slash in a branch name into one safe file name", () => {
      expect(descriptionDraftPath("/repo/.git", "refactor/foo")).toBe(
        "/repo/.git/stack-review/descriptions/refactor%2Ffoo.md",
      );
      expect(descriptionBaselinePath("/repo/.git", "refactor/foo")).toBe(
        "/repo/.git/stack-review/baseline/refactor%2Ffoo.md",
      );
    });
  });
});

describe("parseDescriptionDraft", () => {
  describe("success", () => {
    it("separates a title and body", () => {
      expect(
        parseDescriptionDraft("# Add descriptions\nFirst line\nSecond line\n"),
      ).toEqual({
        title: "Add descriptions",
        body: "First line\nSecond line\n",
      });
    });

    it("marks the empty template title as unfilled", () => {
      expect(parseDescriptionDraft(emptyDescriptionTemplate())).toEqual({
        title: null,
        body: "",
      });
    });

    it("parses a Japanese title", () => {
      expect(parseDescriptionDraft("# タイトル\n\n本文")).toEqual({
        title: "タイトル",
        body: "\n本文",
      });
    });

    it("marks a whitespace-only title as unfilled", () => {
      expect(parseDescriptionDraft("#    \n")).toEqual({
        title: null,
        body: "",
      });
    });

    it("trims whitespace around a title", () => {
      expect(parseDescriptionDraft("#   タイトル   \n")).toEqual({
        title: "タイトル",
        body: "",
      });
    });

    it("preserves blank lines around the body", () => {
      expect(parseDescriptionDraft("# タイトル\n\n本文\n\n")).toEqual({
        title: "タイトル",
        body: "\n本文\n\n",
      });
    });
  });

  describe("failure", () => {
    it("rejects a draft whose first line is not a heading", () => {
      expect(() => parseDescriptionDraft("Add descriptions\nbody\n")).toThrow(
        "draft の 1 行目は '# ' 見出しにしてください",
      );
    });
  });
});

describe("readOrCreateDescriptionDraft", () => {
  describe("success", () => {
    it("creates an empty template only when the draft is missing", async () => {
      const gitDirectory = await temporaryDirectory();
      const created = await readOrCreateDescriptionDraft(gitDirectory, "core");

      await expect(readFile(created.path, "utf8")).resolves.toBe("# \n");
      expect(created.draft.title).toBeNull();

      await writeFile(created.path, "# Existing\nBody\n", "utf8");
      await expect(
        readOrCreateDescriptionDraft(gitDirectory, "core"),
      ).resolves.toEqual({
        path: created.path,
        draft: { title: "Existing", body: "Body\n" },
      });
    });
  });
});

describe("parsePullRequestViewResult", () => {
  describe("success", () => {
    it("parses an existing pull request", () => {
      expect(
        parsePullRequestViewResult({
          stdout: JSON.stringify({
            number: 42,
            title: "Title",
            body: "Body",
            url: "https://github.com/acme/repo/pull/42",
          }),
          stderr: "",
          exitCode: 0,
        }),
      ).toEqual({
        number: 42,
        title: "Title",
        body: "Body",
        url: "https://github.com/acme/repo/pull/42",
      });
    });

    it("returns null for gh's no-pull-request failure", () => {
      expect(
        parsePullRequestViewResult({
          stdout: "",
          stderr: 'no pull requests found for branch "core"',
          exitCode: 1,
        }),
      ).toBeNull();
    });
  });

  describe("failure", () => {
    it("throws for a repository lookup failure", () => {
      expect(() =>
        parsePullRequestViewResult({
          stdout: "",
          stderr: [
            "GraphQL: Could not resolve to a Repository",
            "with the name 'unok/does-not-exist'.",
          ].join(" "),
          exitCode: 1,
        }),
      ).toThrow(
        "gh pr view exited with code 1: GraphQL: Could not resolve to a Repository",
      );
    });
  });
});

describe("fetch pull request description", () => {
  describe("success", () => {
    it("uses gh pr view for the branch", async () => {
      const run = vi.fn<CommandRunner>().mockResolvedValue({
        stdout: "",
        stderr: 'no pull requests found for branch "refactor/foo"',
        exitCode: 1,
      });

      await expect(
        fetchPullRequestDescription(run, "refactor/foo"),
      ).resolves.toBeNull();
      expect(run).toHaveBeenCalledWith([
        "gh",
        "pr",
        "view",
        "refactor/foo",
        "--json",
        "number,title,body,url",
      ]);
    });
  });
});

describe("formatDescriptionBaseline", () => {
  describe("success", () => {
    it("writes the existing PR title and body in draft format", () => {
      expect(
        formatDescriptionBaseline({
          number: 42,
          title: "Existing title",
          body: "Existing body\n",
          url: "https://github.com/acme/repo/pull/42",
        }),
      ).toBe("# Existing title\nExisting body\n");
    });

    it("uses an empty file when the branch has no PR", () => {
      expect(formatDescriptionBaseline(null)).toBe("");
    });
  });
});
