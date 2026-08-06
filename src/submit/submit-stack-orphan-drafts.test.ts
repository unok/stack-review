import { afterEach, describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../exec.ts";
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

function orphanDraftResult(
  argv: readonly string[],
  value: ReturnType<typeof stack>,
  gitDirectory: string,
) {
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
    return failure('no pull requests found for branch "core"');
  }
  if (commandStartsWith(argv, ["gh", "pr", "create"])) {
    return success("https://github.com/acme/repo/pull/31\n");
  }
  return success();
}

describe("submitStack orphan drafts", () => {
  describe("success", () => {
    it("warns about orphan drafts and continues submitting the stack", async () => {
      const gitDirectory = await temporaryDirectory();
      const value = stack(["core"]);
      await writeDraft(gitDirectory, "core", "# Core title\nCore body\n");
      await writeDraft(gitDirectory, "old-branch", "# Old title\nOld body\n");
      const run = vi.fn<CommandRunner>(
        commandRunner((argv) => orphanDraftResult(argv, value, gitDirectory)),
      );
      const onOrphanDrafts = vi.fn();

      await expect(submitStack(run, { onOrphanDrafts })).resolves.toEqual({
        kind: "succeeded",
        pullRequests: [
          {
            layerName: "core",
            action: "created",
            number: 31,
            url: "https://github.com/acme/repo/pull/31",
          },
        ],
      });
      expect(onOrphanDrafts).toHaveBeenCalledWith(["old-branch"]);
      const calls = run.mock.calls.map(([argv]) => argv);
      expect(calls).toContainEqual(["gh", "stack", "push"]);
      expect(calls).toContainEqual(["gh", "stack", "link", "core"]);
    });
  });
});
