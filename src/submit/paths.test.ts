import { describe, expect, it } from "vitest";

import { findUnfilledLayerNames } from "./index.ts";

describe("findUnfilledLayerNames", () => {
  describe("success", () => {
    it("finds every layer whose title is unfilled", () => {
      expect(
        findUnfilledLayerNames([
          { layerName: "core", draft: { title: "Core", body: "" } },
          { layerName: "api", draft: { title: null, body: "body only" } },
          { layerName: "web", draft: { title: null, body: "" } },
        ]),
      ).toEqual(["api", "web"]);
    });
  });
});
