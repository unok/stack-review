import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { askYesNo } from "./index.ts";

describe("askYesNo", () => {
  describe("success", () => {
    it("uses No for an empty submit answer", async () => {
      const input = new PassThrough();
      const output = new PassThrough();
      const answer = askYesNo("submit?", false, input, output);

      input.end("\n");

      await expect(answer).resolves.toBe(false);
      expect(output.read()?.toString()).toContain("submit? [y/N]");
    });

    it("uses Yes for an empty workspace-close answer", async () => {
      const input = new PassThrough();
      const output = new PassThrough();
      const answer = askYesNo("close?", true, input, output);

      input.end("\n");

      await expect(answer).resolves.toBe(true);
      expect(output.read()?.toString()).toContain("close? [Y/n]");
    });
  });
});
