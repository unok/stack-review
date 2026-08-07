import { describe, expect, it } from "vitest";

import {
  buildLayerDescriptionTabLabel,
  buildLayerTabLabel,
  buildReviewWorkspaceLabel,
} from "./index.ts";

const LAYER_NUMBER = 3;

describe("review environment labels", () => {
  describe("success", () => {
    it("labels the workspace with the repository name", () => {
      expect(buildReviewWorkspaceLabel("stack-review")).toBe(
        "review: stack-review",
      );
    });

    it("labels a layer tab with its one-based number and branch name", () => {
      expect(buildLayerTabLabel(LAYER_NUMBER, "herdr-layout")).toBe(
        "3 herdr-layout",
      );
    });

    it("adds desc to the matching layer-tab label", () => {
      expect(buildLayerDescriptionTabLabel(LAYER_NUMBER, "herdr-layout")).toBe(
        "3 herdr-layout desc",
      );
    });
  });
});
