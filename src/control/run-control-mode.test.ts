import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../exec.ts";
import { runControlMode } from "./index.ts";
import { controlState } from "./test-helpers.ts";

const temporaryDirectories: string[] = [];
const CLOSE_WORKSPACE_PROMPT = "レビューワークスペースを閉じますか？";
const CLAUDE_HANDOFF = "下の一行を Claude に渡してください";
const SUBMIT_INSTRUCTION = "stack-review の submit を実行して";

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

function emptyReviewRunner() {
  return vi.fn<CommandRunner>().mockResolvedValue({
    stdout: '{"comments":[]}',
    stderr: "",
    exitCode: 0,
  });
}

async function saveState(gitDirectory: string): Promise<string> {
  const statePath = join(gitDirectory, "control.json");
  await writeFile(
    statePath,
    JSON.stringify(controlState(gitDirectory)),
    "utf8",
  );
  return statePath;
}

async function runInterruptedReview() {
  const gitDirectory = await temporaryDirectory();
  const statePath = await saveState(gitDirectory);
  const run = emptyReviewRunner();
  const promptYesNo = vi.fn(async () => false);
  const stdout = vi
    .spyOn(process.stdout, "write")
    .mockImplementation(() => true);
  await runControlMode(statePath, {
    run,
    waitForReviewEnd: async () => "interrupted",
    promptYesNo,
  });
  return { gitDirectory, statePath, run, promptYesNo, stdout };
}

async function runSubmitReview() {
  const gitDirectory = await temporaryDirectory();
  const state = controlState(gitDirectory);
  const [description] = state.descriptions;
  if (description === undefined) {
    throw new Error("expected a description");
  }
  description.draft = { title: "Auth layer", body: "Body\n" };
  const statePath = join(gitDirectory, "control.json");
  await writeFile(statePath, JSON.stringify(state), "utf8");
  const run = emptyReviewRunner();
  const promptYesNo = vi.fn(async () => false);
  const stdout = vi
    .spyOn(process.stdout, "write")
    .mockImplementation(() => true);
  await runControlMode(statePath, {
    run,
    waitForReviewEnd: async () => "completed",
    promptYesNo,
  });

  return { stdout, promptYesNo };
}

async function runMissingDraftReview() {
  const gitDirectory = await temporaryDirectory();
  const statePath = await saveState(gitDirectory);
  const stdout = vi
    .spyOn(process.stdout, "write")
    .mockImplementation(() => true);
  await runControlMode(statePath, {
    run: emptyReviewRunner(),
    waitForReviewEnd: async () => "completed",
    promptYesNo: async () => false,
  });

  return stdout;
}

describe("runControlMode", () => {
  describe("success", () => {
    it("saves notes but does not show the Claude request after an interruption", async () => {
      const { gitDirectory, statePath, run, promptYesNo, stdout } =
        await runInterruptedReview();
      expect(promptYesNo).toHaveBeenCalledOnce();
      expect(promptYesNo).toHaveBeenCalledWith(CLOSE_WORKSPACE_PROMPT, true);
      expect(
        stdout.mock.calls.map(([text]) => String(text)).join(""),
      ).not.toContain(CLAUDE_HANDOFF);
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
    it("shows the Claude submit request after a completed review without notes", async () => {
      const { stdout, promptYesNo } = await runSubmitReview();
      const output = stdout.mock.calls.map(([text]) => String(text)).join("");
      expect(output).toContain(SUBMIT_INSTRUCTION);
      expect(output).toContain("（xix / 1 layers / draft 全てあり）");
      expect(promptYesNo).toHaveBeenCalledOnce();
      expect(promptYesNo).toHaveBeenCalledWith(CLOSE_WORKSPACE_PROMPT, true);
    });
    it("shows the missing-draft request after a completed review without notes", async () => {
      const stdout = await runMissingDraftReview();
      const output = stdout.mock.calls.map(([text]) => String(text)).join("");
      expect(output).toContain(
        "stack-review の draft を書いてから submit して",
      );
      expect(output).toContain("（xix / 1 layers / draft 未記入 1 件）");
    });
  });
});
