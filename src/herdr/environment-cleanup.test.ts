import { describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../exec.ts";
import { createReviewEnvironment, destroyReviewEnvironment } from "./index.ts";
import {
  failure,
  layers,
  repositoryRoot,
  success,
  workspaceCreateOutput,
  workspaceCreateOutputWithOnlyRootPaneId,
} from "./test-helpers.ts";

const CLOSE_WORKSPACE_COMMAND = ["herdr", "workspace", "close", "wB"];

function registerConstructionFailureTests(): void {
  it("closes the partial workspace when layer tab creation fails", async () => {
    const run = vi
      .fn<CommandRunner>()
      .mockResolvedValueOnce(success(workspaceCreateOutput()))
      .mockResolvedValueOnce(success())
      .mockResolvedValueOnce(failure("tab failed"))
      .mockResolvedValueOnce(success());

    await expect(
      createReviewEnvironment(run, repositoryRoot, "stack-review", layers),
    ).rejects.toThrow("tab failed");
    expect(run).toHaveBeenLastCalledWith(CLOSE_WORKSPACE_COMMAND);
  });

  it("does not close anything when workspace creation fails", async () => {
    const run = vi
      .fn<CommandRunner>()
      .mockResolvedValue(failure("create failed"));

    await expect(
      createReviewEnvironment(run, repositoryRoot, "stack-review", layers),
    ).rejects.toThrow("create failed");
    expect(run).toHaveBeenCalledOnce();
    expect(run).not.toHaveBeenCalledWith(CLOSE_WORKSPACE_COMMAND);
  });
}

function registerParseFailureTests(): void {
  it("closes the workspace recovered from root_pane after parsing fails", async () => {
    const run = vi
      .fn<CommandRunner>()
      .mockResolvedValueOnce(success(workspaceCreateOutputWithOnlyRootPaneId()))
      .mockResolvedValueOnce(success());

    await expect(
      createReviewEnvironment(run, repositoryRoot, "stack-review", layers),
    ).rejects.toThrow(
      "herdr workspace create output.result.workspace must be an object",
    );
    expect(run).toHaveBeenLastCalledWith(CLOSE_WORKSPACE_COMMAND);
  });

  it("does not close anything when parsing fails without a workspace ID", async () => {
    const run = vi.fn<CommandRunner>().mockResolvedValue(success("{}"));

    await expect(
      createReviewEnvironment(run, repositoryRoot, "stack-review", layers),
    ).rejects.toThrow("herdr workspace create output.result must be an object");
    expect(run).toHaveBeenCalledOnce();
    expect(run).not.toHaveBeenCalledWith(CLOSE_WORKSPACE_COMMAND);
  });

  it("preserves the parse error when closing the recovered workspace fails", async () => {
    const run = vi
      .fn<CommandRunner>()
      .mockResolvedValueOnce(success(workspaceCreateOutputWithOnlyRootPaneId()))
      .mockResolvedValueOnce(failure("close failed"));

    await expect(
      createReviewEnvironment(run, repositoryRoot, "stack-review", layers),
    ).rejects.toThrow(
      "herdr workspace create output.result.workspace must be an object",
    );
    expect(run).toHaveBeenLastCalledWith(CLOSE_WORKSPACE_COMMAND);
  });
}

describe("createReviewEnvironment", () => {
  describe("failure", () => {
    registerConstructionFailureTests();
    registerParseFailureTests();
  });
});

describe("destroyReviewEnvironment", () => {
  describe("success", () => {
    it("closes the review workspace", async () => {
      const run = vi.fn<CommandRunner>().mockResolvedValue(success());

      await destroyReviewEnvironment(run, "wB");

      expect(run).toHaveBeenCalledWith(["herdr", "workspace", "close", "wB"]);
    });
  });
});
