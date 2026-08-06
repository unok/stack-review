import { describe, expect, it } from "vitest";

import { formatSubmitResult } from "./cli.ts";

describe("formatSubmitResult", () => {
  describe("success", () => {
    it("formats unfilled layers and completed progress for CLI output", () => {
      expect(
        formatSubmitResult({
          kind: "unfilled",
          layerNames: ["api", "web"],
        }),
      ).toContain("api\n  web");
      expect(
        formatSubmitResult({
          kind: "failed",
          pullRequests: [
            {
              layerName: "core",
              action: "created",
              number: 21,
              url: "https://github.com/acme/repo/pull/21",
            },
          ],
          failure: {
            argv: ["gh", "pr", "create"],
            exitCode: 1,
            stderr: "create failed",
          },
        }),
      ).toContain("core: #21 https://github.com/acme/repo/pull/21");
    });
  });
});
