import { describe, expect, it } from "vitest";

import { parseTabCreateOutput, parseWorkspaceCreateOutput } from "./index.ts";
import { tabCreateOutput, workspaceCreateOutput } from "./test-helpers.ts";

describe("herdr create output parsers", () => {
  describe("success", () => {
    it("extracts workspace, control tab, and control pane IDs", () => {
      expect(parseWorkspaceCreateOutput(workspaceCreateOutput())).toEqual({
        workspaceId: "wB",
        tabId: "wB:t1",
        paneId: "wB:p1",
      });
    });

    it("extracts layer tab and pane IDs", () => {
      expect(parseTabCreateOutput(tabCreateOutput(2))).toEqual({
        tabId: "wB:t2",
        paneId: "wB:p2",
      });
    });
  });
});
