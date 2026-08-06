import { describe, expect, it } from "vitest";

import type { ReviewNote } from "../types.ts";
import { ReviewNoteStore } from "./index.ts";

function note(body: string): ReviewNote {
  return {
    filePath: "src/hunk.ts",
    line: 12,
    body,
    layerName: "hunk-session",
    side: "new",
  };
}

describe("ReviewNoteStore", () => {
  describe("success", () => {
    it("returns defensive copies of every layer snapshot in insertion order", () => {
      const store = new ReviewNoteStore();
      store.update("layer-1", {
        sessionAlive: true,
        notes: [{ ...note("first"), layerName: "layer-1" }],
      });
      store.update("layer-2", {
        sessionAlive: false,
        notes: [],
      });

      const entries = store.entries();
      expect(entries).toEqual([
        [
          "layer-1",
          {
            sessionAlive: true,
            notes: [{ ...note("first"), layerName: "layer-1" }],
          },
        ],
        ["layer-2", { sessionAlive: false, notes: [] }],
      ]);

      const firstSnapshot = entries[0]?.[1];
      if (firstSnapshot === undefined || firstSnapshot.notes[0] === undefined) {
        throw new Error("expected the first layer snapshot");
      }
      firstSnapshot.sessionAlive = false;
      firstSnapshot.notes[0].body = "mutated outside the store";

      expect(store.get("layer-1")).toEqual({
        sessionAlive: true,
        notes: [{ ...note("first"), layerName: "layer-1" }],
      });
    });
  });

  describe("failure", () => {
    it("keeps the last snapshot after its Hunk session disappears", () => {
      const store = new ReviewNoteStore();
      store.update("hunk-session", {
        sessionAlive: true,
        notes: [note("keep me")],
      });
      store.update("hunk-session", { sessionAlive: false, notes: [] });

      expect(store.get("hunk-session")).toEqual({
        sessionAlive: false,
        notes: [note("keep me")],
      });
    });
  });
});
