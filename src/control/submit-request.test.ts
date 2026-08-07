import { describe, expect, it } from "vitest";

import { buildClaudeSubmitRequest } from "./index.ts";

const LAYER_COUNT = 5;
const UNFILLED_DRAFT_COUNT = 2;

describe("buildClaudeSubmitRequest", () => {
  describe("success", () => {
    it("asks Claude to submit when every draft has a title", () => {
      expect(buildClaudeSubmitRequest("stack-review", LAYER_COUNT, 0)).toBe(
        [
          "── submit の準備ができました ──",
          "",
          "下の一行を Claude に渡してください:",
          "",
          "  stack-review の submit を実行して",
          "  （stack-review / 5 layers / draft 全てあり）",
        ].join("\n"),
      );
    });

    it("asks Claude to fill drafts before submit when titles are missing", () => {
      const request = buildClaudeSubmitRequest(
        "stack-review",
        LAYER_COUNT,
        UNFILLED_DRAFT_COUNT,
      );

      expect(request.startsWith("── draft が未記入です ──")).toBe(true);
      expect(request).not.toContain("── submit の準備ができました ──");
      expect(request).toContain(
        "stack-review の draft を書いてから submit して\n" +
          "  （stack-review / 5 layers / draft 未記入 2 件）",
      );
    });
  });

  describe("failure", () => {
    it.each([
      ["", 1, 0, "repository name must not be empty"],
      ["stack-review", 0, 0, "layer count must be a positive integer"],
      ["stack-review", 1, 2, "unfilled draft count is out of range"],
    ])(
      "rejects invalid counts and names",
      (repository, layers, drafts, message) => {
        expect(() =>
          buildClaudeSubmitRequest(repository, layers, drafts),
        ).toThrow(message);
      },
    );
  });
});
