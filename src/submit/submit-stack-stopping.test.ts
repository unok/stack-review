import { afterEach, describe, expect, it, vi } from "vitest";

import type { CommandResult, CommandRunner } from "../exec.ts";
import type { Stack } from "../types.ts";
import { submitStack } from "./index.ts";
import {
  cleanTemporaryDirectories,
  commandRunner,
  commandStartsWith,
  failure,
  stack,
  stackViewOutput,
  success,
  temporaryDirectory,
  writeDraft,
} from "./test-helpers.ts";

afterEach(cleanTemporaryDirectories);

function repositoryResult(
  argv: readonly string[],
  value: Stack,
  gitDirectory: string,
): CommandResult | null {
  if (commandStartsWith(argv, ["gh", "stack", "view"])) {
    return success(stackViewOutput(value));
  }
  if (commandStartsWith(argv, ["git", "rev-parse", "--show-toplevel"])) {
    return success("/repo\n");
  }
  if (commandStartsWith(argv, ["git", "rev-parse", "--absolute-git-dir"])) {
    return success(`${gitDirectory}\n`);
  }
  return null;
}

function unfilledResult(
  argv: readonly string[],
  value: Stack,
  gitDirectory: string,
): CommandResult {
  const result = repositoryResult(argv, value, gitDirectory);
  if (result !== null) {
    return result;
  }
  throw new Error(`unexpected command: ${argv.join(" ")}`);
}

function failedLayerResult(
  argv: readonly string[],
  value: Stack,
  gitDirectory: string,
): CommandResult {
  const result = repositoryResult(argv, value, gitDirectory);
  if (result !== null) {
    return result;
  }
  if (commandStartsWith(argv, ["gh", "pr", "view"])) {
    return failure(`no pull requests found for branch "${argv[3]}"`);
  }
  if (commandStartsWith(argv, ["gh", "pr", "create"])) {
    const head = argv[argv.indexOf("--head") + 1];
    if (head === "core") {
      return success("https://github.com/acme/repo/pull/21\n");
    }
    if (head === "api") {
      return failure("create failed");
    }
  }
  return success();
}

async function runUnfilledSubmit() {
  const gitDirectory = await temporaryDirectory();
  const value = stack(["core", "api"]);
  await writeDraft(gitDirectory, "core", "# Core title\nCore body\n");
  await writeDraft(gitDirectory, "api", "# \nBody without a title\n");
  const run = vi.fn<CommandRunner>(
    commandRunner((argv) => unfilledResult(argv, value, gitDirectory)),
  );

  const result = await submitStack(run);
  return { result, calls: run.mock.calls.map(([argv]) => argv) };
}

async function runFailedLayerSubmit() {
  const gitDirectory = await temporaryDirectory();
  const value = stack(["core", "api", "web"]);
  for (const layer of value.layers) {
    await writeDraft(
      gitDirectory,
      layer.name,
      `# ${layer.name} title\n${layer.name} body\n`,
    );
  }
  const run = vi.fn<CommandRunner>(
    commandRunner((argv) => failedLayerResult(argv, value, gitDirectory)),
  );
  const result = await submitStack(run);
  return { result, calls: run.mock.calls.map(([argv]) => argv) };
}

describe("submitStack stopping conditions", () => {
  describe("failure", () => {
    it("stops before PR lookup and mutation when any title is unfilled", async () => {
      const { result, calls } = await runUnfilledSubmit();
      expect(result).toEqual({ kind: "unfilled", layerNames: ["api"] });
      expect(calls.some((argv) => commandStartsWith(argv, ["gh", "pr"]))).toBe(
        false,
      );
      expect(calls).not.toContainEqual(["gh", "stack", "push"]);
    });
    it("stops after a failed layer and reports only completed PRs", async () => {
      const { result, calls } = await runFailedLayerSubmit();
      expect(result).toEqual({
        kind: "failed",
        pullRequests: [
          {
            layerName: "core",
            action: "created",
            number: 21,
            url: "https://github.com/acme/repo/pull/21",
          },
        ],
        failure: expect.objectContaining({
          exitCode: 1,
          stderr: "create failed",
        }),
      });
      expect(
        calls.some((argv) => argv.includes("web") && argv[2] === "create"),
      ).toBe(false);
      expect(calls.some((argv) => argv[2] === "link")).toBe(false);
    });
  });
});
