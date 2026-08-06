import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../exec.ts";
import { runControlMode } from "./index.ts";
import { controlState } from "./test-helpers.ts";

const temporaryDirectories: string[] = [];
const CLOSE_WORKSPACE_PROMPT = "レビューワークスペースを閉じますか？";

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "stack-review-control-"));
  temporaryDirectories.push(path);
  return path;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("runControlMode", () => {
  describe("success", () => {
    it("saves notes but skips the submit prompt after an interruption", async () => {
      const gitDirectory = await temporaryDirectory();
      const statePath = join(gitDirectory, "control.json");
      await writeFile(
        statePath,
        JSON.stringify(controlState(gitDirectory)),
        "utf8",
      );
      const run = vi.fn<CommandRunner>().mockResolvedValue({
        stdout: '{"comments":[]}',
        stderr: "",
        exitCode: 0,
      });
      const runInteractive = vi.fn(async () => 0);
      const promptYesNo = vi.fn(async () => false);
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);

      await runControlMode(statePath, {
        run,
        runInteractive,
        waitForReviewEnd: async () => "interrupted",
        promptYesNo,
      });

      expect(promptYesNo).toHaveBeenCalledOnce();
      expect(promptYesNo).toHaveBeenCalledWith(CLOSE_WORKSPACE_PROMPT, true);
      expect(runInteractive).not.toHaveBeenCalled();
      expect(
        new Set(run.mock.calls.map(([argv]) => argv[4]).filter(Boolean)),
      ).toEqual(new Set(["session-1", "session-2"]));
      await expect(readFile(statePath, "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(
        readFile(join(gitDirectory, "stack-review", "latest.md"), "utf8"),
      ).resolves.toContain("0 件です。");
    });
  });
});
