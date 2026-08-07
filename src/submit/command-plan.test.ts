import { describe, expect, it } from "vitest";
import type { SubmitLayerState } from "./index.ts";
import { baseBranchForLayer, buildSubmitCommandPlan } from "./index.ts";
import { stack } from "./test-helpers.ts";

function existingPullRequestLayers(
  layerNames: readonly string[],
): SubmitLayerState[] {
  return layerNames.map((layerName, index) => ({
    layerName,
    draft: { title: `Title ${layerName}`, body: "" },
    pullRequest: {
      number: index + 10,
      title: `Old ${layerName}`,
      body: "",
      url: `https://github.com/owner/repo/pull/${index + 10}`,
    },
  }));
}

describe("buildSubmitCommandPlan", () => {
  describe("success", () => {
    it("uses the trunk for the bottom layer and the branch below for each upper layer", () => {
      const value = stack(["core", "api", "web"]);
      const layers: SubmitLayerState[] = value.layers.map((layer) => ({
        layerName: layer.name,
        draft: { title: `Title ${layer.name}`, body: `Body ${layer.name}\n` },
        pullRequest: null,
      }));

      expect(baseBranchForLayer("main", ["core", "api", "web"], 0)).toBe(
        "main",
      );
      expect(
        buildSubmitCommandPlan(value, layers, "/repo/.git").layers,
      ).toEqual([
        expect.objectContaining({
          layerName: "core",
          argv: expect.arrayContaining(["--base", "main"]),
        }),
        expect.objectContaining({
          layerName: "api",
          argv: expect.arrayContaining(["--base", "core"]),
        }),
        expect.objectContaining({
          layerName: "web",
          argv: expect.arrayContaining(["--base", "api"]),
        }),
      ]);
    });

    it("omits --base because GitHub rejects base changes on stacked PRs", () => {
      const layerNames = ["core", "api", "web"];
      const value = stack(layerNames);
      const layers = existingPullRequestLayers(layerNames);

      const commands = buildSubmitCommandPlan(
        value,
        layers,
        "/repo/.git",
      ).layers;

      expect(commands).toHaveLength(layerNames.length);
      for (const command of commands) {
        expect(command.action).toBe("edit");
        expect(command.argv).not.toContain("--base");
      }
    });
  });
});
