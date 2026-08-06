import { describe, expect, it } from "vitest";

import { buildControlScreen } from "./index.ts";
import { screenState } from "./test-helpers.ts";

const REVIEW_COMPLETION_PROMPT = "  全部見終えたら Enter → _";
const WORKING_TREE_WARNING =
  "警告: 未コミット変更 2 件はどのレイヤーにも含まれません。";

describe("buildControlScreen", () => {
  describe("success", () => {
    it("shows file counts, note counts, and live Hunk state for three layers", () => {
      expect(buildControlScreen(screenState())).toBe(
        [
          "review: xix   3 layers",
          "",
          "  #  branch         files  TODO  hunk",
          "  1  auth-layer         2     1  ● live",
          "  2  api-endpoints      5     0  ● live",
          "  3  frontend           3     2  ○ closed",
          "",
          REVIEW_COMPLETION_PROMPT,
        ].join("\n"),
      );
    });

    it("adds the uncommitted-change warning before the layer table", () => {
      const screen = buildControlScreen(screenState(true));

      expect(screen).toContain(WORKING_TREE_WARNING);
      expect(screen.indexOf("警告:")).toBeLessThan(screen.indexOf("branch"));
    });
  });
});
