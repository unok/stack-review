import { describe, expect, it } from "vitest";

import {
  layerRevisionRange,
  parseNumstat,
  parsePorcelainStatus,
  parseStackView,
} from "./stack.ts";
import type { Layer } from "./types.ts";

const STACK_VIEW_FIXTURE = {
  trunk: "main",
  currentBranch: "skill-docs",
  branches: [
    {
      name: "core",
      base: "base-core",
      isCurrent: false,
      isMerged: false,
      isQueued: false,
      needsRebase: false,
    },
    {
      name: "hunk-session",
      base: "base-hunk-session",
      isCurrent: false,
      isMerged: false,
      isQueued: false,
      needsRebase: false,
    },
    {
      name: "skill-docs",
      base: "base-skill-docs",
      isCurrent: true,
      isMerged: false,
      isQueued: false,
      needsRebase: false,
    },
  ],
};

describe("parseStackView", () => {
  describe("success", () => {
    it("converts JSON text and preserves bottom-to-top layer order", () => {
      const result = parseStackView(JSON.stringify(STACK_VIEW_FIXTURE));

      expect(result.kind).toBe("stack");
      if (result.kind !== "stack") {
        throw new Error("expected a stack");
      }
      expect(result.stack.trunk).toBe("main");
      expect(result.stack.layers.map((layer) => layer.name)).toEqual([
        "core",
        "hunk-session",
        "skill-docs",
      ]);
      expect(result.stack.layers[0]).toEqual({
        name: "core",
        base: "base-core",
        stats: null,
      });
    });

    it("accepts an already parsed object", () => {
      const result = parseStackView(STACK_VIEW_FIXTURE);

      expect(result.kind).toBe("stack");
    });

    it("returns a distinct result when the current branch is not in a stack", () => {
      expect(
        parseStackView('current branch "main" is not part of a stack\n'),
      ).toEqual({
        kind: "not-in-stack",
        branch: "main",
        message: 'current branch "main" is not part of a stack',
      });
    });
  });
});

describe("layerRevisionRange", () => {
  describe("success", () => {
    it("uses the tracked base commit and layer name", () => {
      const layer: Layer = {
        name: "core",
        base: "base-core",
        stats: null,
      };

      expect(layerRevisionRange(layer)).toBe("base-core..core");
    });
  });
});

describe("parseNumstat", () => {
  describe("success", () => {
    it("counts text and binary files without treating binary markers as numbers", () => {
      const output = [
        "12\t3\tsrc/stack.ts",
        "4\t0\tsrc/types.ts",
        "-\t-\tassets/example.png",
        "",
      ].join("\n");

      expect(parseNumstat(output)).toEqual({
        fileCount: 3,
        additions: 16,
        deletions: 3,
        binaryFileCount: 1,
      });
    });

    it("returns zero counts for empty output", () => {
      expect(parseNumstat("")).toEqual({
        fileCount: 0,
        additions: 0,
        deletions: 0,
        binaryFileCount: 0,
      });
    });

    it("counts a rename as one file", () => {
      expect(parseNumstat("12\t3\tsrc/{old => new}.ts\n")).toEqual({
        fileCount: 1,
        additions: 12,
        deletions: 3,
        binaryFileCount: 0,
      });
    });
  });
});

describe("parsePorcelainStatus", () => {
  describe("success", () => {
    it("reports a clean working tree for empty output", () => {
      expect(parsePorcelainStatus("")).toEqual({
        hasChanges: false,
        changeCount: 0,
      });
    });

    it("counts modified, staged, and untracked entries", () => {
      const output = " M src/stack.ts\nA  src/types.ts\n?? package.json\n";

      expect(parsePorcelainStatus(output)).toEqual({
        hasChanges: true,
        changeCount: 3,
      });
    });

    it("counts a rename as one entry", () => {
      expect(parsePorcelainStatus("R  old.ts -> new.ts\n")).toEqual({
        hasChanges: true,
        changeCount: 1,
      });
    });
  });
});
