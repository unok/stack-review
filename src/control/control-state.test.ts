import { describe, expect, it } from "vitest";

import { parseControlState } from "./index.ts";
import { controlState } from "./test-helpers.ts";

describe("parseControlState", () => {
  describe("failure", () => {
    it("rejects JSON whose nested state has an invalid shape", () => {
      const invalid = {
        ...controlState("/repo/.git"),
        stack: { trunk: "main", layers: "not-an-array" },
      };

      expect(() => parseControlState(JSON.stringify(invalid))).toThrow(
        "control state has an invalid shape",
      );
    });
  });
});
