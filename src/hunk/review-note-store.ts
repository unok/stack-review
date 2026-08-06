import type { ReviewNote } from "../types.ts";
import type { ReviewNoteFetchResult } from "./review-notes.ts";

export interface ReviewNoteSnapshot {
  sessionAlive: boolean;
  notes: ReviewNote[];
}

export class ReviewNoteStore {
  readonly #snapshots = new Map<string, ReviewNoteSnapshot>();

  update(layerName: string, result: ReviewNoteFetchResult): void {
    if (result.sessionAlive) {
      this.#snapshots.set(layerName, {
        sessionAlive: true,
        notes: result.notes.map((note) => ({ ...note })),
      });
      return;
    }

    const previous = this.#snapshots.get(layerName);
    this.#snapshots.set(layerName, {
      sessionAlive: false,
      notes: previous?.notes.map((note) => ({ ...note })) ?? [],
    });
  }

  get(layerName: string): ReviewNoteSnapshot | undefined {
    const snapshot = this.#snapshots.get(layerName);
    if (snapshot === undefined) {
      return;
    }
    return {
      sessionAlive: snapshot.sessionAlive,
      notes: snapshot.notes.map((note) => ({ ...note })),
    };
  }

  entries(): [string, ReviewNoteSnapshot][] {
    return Array.from(
      this.#snapshots,
      ([layerName, snapshot]): [string, ReviewNoteSnapshot] => [
        layerName,
        {
          sessionAlive: snapshot.sessionAlive,
          notes: snapshot.notes.map((note) => ({ ...note })),
        },
      ],
    );
  }
}
