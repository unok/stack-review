import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { CommandResult, CommandRunner } from "../exec.ts";
import type { Stack } from "../types.ts";
import { submitBodyPath, submitStack } from "./index.ts";
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

const EXPECTED_PULL_REQUESTS = [
  {
    layerName: "core",
    action: "updated",
    number: 10,
    url: "https://github.com/acme/repo/pull/10",
  },
  {
    layerName: "refactor/foo",
    action: "created",
    number: 11,
    url: "https://github.com/acme/repo/pull/11",
  },
  {
    layerName: "web",
    action: "created",
    number: 12,
    url: "https://github.com/acme/repo/pull/12",
  },
];

function pullRequestResult(argv: readonly string[]): CommandResult {
  if (argv[3] === "core") {
    return success(
      JSON.stringify({
        number: 10,
        title: "Old core title",
        body: "Old core body\n",
        url: "https://github.com/acme/repo/pull/10",
      }),
    );
  }
  return failure(`no pull requests found for branch "${argv[3]}"`);
}

function createResult(argv: readonly string[]): CommandResult {
  const head = argv[argv.indexOf("--head") + 1];
  if (head === "refactor/foo") {
    return success("https://github.com/acme/repo/pull/11\n");
  }
  return success("https://github.com/acme/repo/pull/12\n");
}

function mutationResult(
  argv: readonly string[],
  value: Stack,
  gitDirectory: string,
): CommandResult {
  if (commandStartsWith(argv, ["gh", "stack", "view"])) {
    return success(stackViewOutput(value));
  }
  if (commandStartsWith(argv, ["git", "rev-parse", "--show-toplevel"])) {
    return success("/repo\n");
  }
  if (commandStartsWith(argv, ["git", "rev-parse", "--absolute-git-dir"])) {
    return success(`${gitDirectory}\n`);
  }
  if (commandStartsWith(argv, ["gh", "pr", "view"])) {
    return pullRequestResult(argv);
  }
  if (commandStartsWith(argv, ["gh", "pr", "create"])) {
    return createResult(argv);
  }
  return success();
}

function expectedMutationCommands(gitDirectory: string): string[][] {
  return [
    [
      "gh",
      "pr",
      "edit",
      "10",
      "--title",
      "Core title",
      "--body-file",
      submitBodyPath(gitDirectory, "core"),
    ],
    [
      "gh",
      "pr",
      "create",
      "--base",
      "core",
      "--head",
      "refactor/foo",
      "--title",
      "Refactor title",
      "--body-file",
      submitBodyPath(gitDirectory, "refactor/foo"),
      "--draft",
    ],
    ["gh", "stack", "link", "core", "refactor/foo", "web"],
  ];
}

async function runMutations() {
  const gitDirectory = await temporaryDirectory();
  const value = stack(["core", "refactor/foo", "web"]);
  await writeDraft(gitDirectory, "core", "# Core title\nCore body\n");
  await writeDraft(
    gitDirectory,
    "refactor/foo",
    "# Refactor title\nRefactor body\n",
  );
  await writeDraft(gitDirectory, "web", "# Web title\nWeb body\n");
  const run = vi.fn<CommandRunner>(
    commandRunner((argv) => mutationResult(argv, value, gitDirectory)),
  );

  const result = await submitStack(run);
  const body = await readFile(
    join(gitDirectory, "stack-review/body/refactor%2Ffoo.md"),
    "utf8",
  );
  return { gitDirectory, run, result, body };
}

describe("submitStack mutations", () => {
  describe("success", () => {
    it("edits existing PRs, creates missing PRs, and links bottom to top", async () => {
      const { gitDirectory, run, result, body } = await runMutations();
      expect(result).toEqual({
        kind: "succeeded",
        pullRequests: EXPECTED_PULL_REQUESTS,
      });
      expect(run.mock.calls.map(([argv]) => argv)).toEqual(
        expect.arrayContaining(expectedMutationCommands(gitDirectory)),
      );
      expect(run).toHaveBeenCalledWith(["gh", "stack", "push"]);
      const commands = run.mock.calls.map(([argv]) => argv);
      const pushIndex = commands.findIndex((argv) =>
        commandStartsWith(argv, ["gh", "stack", "push"]),
      );
      const firstPullRequestMutationIndex = commands.findIndex(
        (argv) =>
          commandStartsWith(argv, ["gh", "pr", "edit"]) ||
          commandStartsWith(argv, ["gh", "pr", "create"]),
      );
      expect(pushIndex).toBeLessThan(firstPullRequestMutationIndex);
      expect(
        commands.filter((argv) =>
          commandStartsWith(argv, ["gh", "pr", "view"]),
        ),
      ).toEqual([
        ["gh", "pr", "view", "core", "--json", "number,title,body,url"],
        ["gh", "pr", "view", "refactor/foo", "--json", "number,title,body,url"],
        ["gh", "pr", "view", "web", "--json", "number,title,body,url"],
      ]);
      expect(body).toBe("Refactor body\n");
    });
  });
});
