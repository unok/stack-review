import { describe, expect, it } from "vitest";

import { parsePullRequestUrl } from "./pull-request-url.ts";

describe("parsePullRequestUrl", () => {
  describe("success", () => {
    it("parses a positive pull request number", () => {
      const url = "https://github.com/unok/stack-review/pull/42";

      expect(parsePullRequestUrl(url)).toEqual({ number: 42, url });
    });
  });

  describe("failure", () => {
    it("rejects zero as a pull request number", () => {
      expect(() =>
        parsePullRequestUrl("https://github.com/unok/stack-review/pull/0"),
      ).toThrow("pull request number must be a positive integer");
    });

    it("rejects output that is not a URL", () => {
      expect(() => parsePullRequestUrl("not a URL")).toThrow(
        "gh pr output must be a pull request URL",
      );
    });
  });
});
