import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { formatReviewNotes, saveReviewNotes } from "./notes.ts";
import type { ReviewNote } from "./types.ts";

const temporaryDirectories: string[] = [];
const AUTH_NOTE_LINE = 18;
const FORM_NOTE_LINE = 42;
const AUTH_NOTE_BODY = "fix failure branch";
const FORM_NOTE_BODY = "reject empty input\nadd error message";
const FILE_MODE_RANGE = 0o1000;
const OWNER_READ_WRITE_MODE = 0o600;

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "stack-review-notes-"));
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

function note(
  layerName: string,
  filePath: string,
  line: number,
  body: string,
): ReviewNote {
  return { layerName, filePath, line, body, side: "new" };
}

describe("formatReviewNotes", () => {
  describe("success", () => {
    it("groups notes from multiple layers with file locations and bodies", () => {
      const markdown = formatReviewNotes(
        ["auth-layer", "api-endpoints", "frontend"],
        [
          note("auth-layer", "src/auth.ts", AUTH_NOTE_LINE, AUTH_NOTE_BODY),
          note("frontend", "src/form.tsx", FORM_NOTE_LINE, FORM_NOTE_BODY),
        ],
      );

      expect(markdown).toBe(
        [
          "# レビューメモ",
          "",
          "## auth-layer",
          "",
          `- \`src/auth.ts:${AUTH_NOTE_LINE}\``,
          `  ${AUTH_NOTE_BODY}`,
          "",
          "## frontend",
          "",
          `- \`src/form.tsx:${FORM_NOTE_LINE}\``,
          ...FORM_NOTE_BODY.split("\n").map((line) => `  ${line}`),
          "",
        ].join("\n"),
      );
    });

    it("states explicitly when there are no review notes", () => {
      expect(formatReviewNotes(["auth-layer"], [])).toBe(
        "# レビューメモ\n\n0 件です。\n",
      );
    });
  });
});

describe("saveReviewNotes", () => {
  describe("success", () => {
    it("moves the existing latest file to timestamped history before overwriting", async () => {
      const gitDirectory = await temporaryDirectory();
      const first = await saveReviewNotes(gitDirectory, "first\n");
      const second = await saveReviewNotes(gitDirectory, "second\n", {
        now: () => new Date("2026-08-06T03:04:05.678Z"),
      });

      expect(first.historyPath).toBeNull();
      expect(second.historyPath).toBe(
        join(gitDirectory, "stack-review", "history", "20260806T030405678Z.md"),
      );
      if (second.historyPath === null) {
        throw new Error("expected an archived review note file");
      }
      await expect(readFile(second.latestPath, "utf8")).resolves.toBe(
        "second\n",
      );
      await expect(readFile(second.historyPath, "utf8")).resolves.toBe(
        "first\n",
      );
    });

    it("does not create history when latest does not exist", async () => {
      const gitDirectory = await temporaryDirectory();
      const saved = await saveReviewNotes(gitDirectory, "first\n", {
        now: () => new Date("2026-08-06T03:04:05.678Z"),
      });

      expect(saved.historyPath).toBeNull();
      await expect(
        readdir(join(gitDirectory, "stack-review")),
      ).resolves.toEqual(["latest.md"]);
      await expect(readFile(saved.latestPath, "utf8")).resolves.toBe("first\n");
    });

    it("restricts latest and archived notes to the owner", async () => {
      const gitDirectory = await temporaryDirectory();
      await saveReviewNotes(gitDirectory, "first\n");
      const saved = await saveReviewNotes(gitDirectory, "second\n", {
        now: () => new Date("2026-08-06T03:04:05.678Z"),
      });

      if (saved.historyPath === null) {
        throw new Error("expected an archived review note file");
      }
      const [latestStat, historyStat] = await Promise.all([
        stat(saved.latestPath),
        stat(saved.historyPath),
      ]);
      expect(latestStat.mode % FILE_MODE_RANGE).toBe(OWNER_READ_WRITE_MODE);
      expect(historyStat.mode % FILE_MODE_RANGE).toBe(OWNER_READ_WRITE_MODE);
    });
  });
});
