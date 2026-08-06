import { describe, expect, it } from "vitest";

import { ReviewNoteStore } from "../hunk/index.ts";
import {
  buildControlScreen,
  buildControlScreenState,
  reviewSessionSnapshotName,
} from "./index.ts";
import { controlState, screenState } from "./test-helpers.ts";

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
          "  #  branch         files  TODO  hunk      desc",
          "  1  auth-layer         2     1  ● live    書済",
          "  2  api-endpoints      5     0  ● live    空",
          "  3  frontend           3     2  ○ closed  書済",
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

    it("marks an empty description so it is visible at a glance", () => {
      const screen = buildControlScreen(screenState());

      expect(screen).toContain("desc");
      expect(screen).toContain("api-endpoints      5     0  ● live    空");
    });
  });
});

describe("buildControlScreenState", () => {
  describe("success", () => {
    it("adds diff and description review-note counts", () => {
      const state = controlState("/repo/.git");
      const store = new ReviewNoteStore();
      store.update(reviewSessionSnapshotName("auth-layer", "diff"), {
        sessionAlive: true,
        notes: [
          {
            layerName: "auth-layer",
            filePath: "src/auth.ts",
            line: 10,
            body: "code note",
            side: "new",
          },
        ],
      });
      store.update(reviewSessionSnapshotName("auth-layer", "description"), {
        sessionAlive: true,
        notes: [
          {
            layerName: "auth-layer",
            filePath: "auth-layer.md",
            line: 2,
            body: "description note",
            side: "new",
          },
        ],
      });

      expect(buildControlScreenState(state, store).layers[0]?.noteCount).toBe(
        2,
      );
    });
  });
});
