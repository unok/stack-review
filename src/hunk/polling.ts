import type { CommandRunner } from "../exec.ts";
import type { ReviewNoteStore } from "./review-note-store.ts";
import { fetchReviewNotes } from "./review-notes.ts";

const DEFAULT_POLL_INTERVAL_MS = 2000;

interface HunkSessionBinding {
  layerName: string;
  sessionId: string;
}

interface PollingTimer {
  setInterval: (callback: () => void, intervalMs: number) => unknown;
  clearInterval: (handle: unknown) => void;
}

interface ReviewNotePollingOptions {
  intervalMs?: number;
  timer?: PollingTimer;
  onError?: (error: unknown) => void;
}

interface ReviewNotePoller {
  pollNow: () => Promise<void>;
  stop: () => void;
}

const defaultTimer: PollingTimer = {
  setInterval: (callback, intervalMs) =>
    globalThis.setInterval(callback, intervalMs),
  clearInterval: (handle) => {
    globalThis.clearInterval(handle as ReturnType<typeof setInterval>);
  },
};

function startReviewNotePolling(
  bindings: readonly HunkSessionBinding[],
  store: ReviewNoteStore,
  run: CommandRunner,
  options: ReviewNotePollingOptions = {},
): ReviewNotePoller {
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new TypeError("poll interval must be a positive number");
  }

  const timer = options.timer ?? defaultTimer;
  let stopped = false;
  let inFlight: Promise<void> | null = null;

  const pollNow = (): Promise<void> => {
    if (stopped) {
      return Promise.resolve();
    }
    if (inFlight !== null) {
      return inFlight;
    }

    const current = Promise.all(
      bindings.map(async ({ layerName, sessionId }) => ({
        layerName,
        result: await fetchReviewNotes(run, sessionId, layerName),
      })),
    ).then((updates) => {
      if (stopped) {
        return;
      }
      for (const { layerName, result } of updates) {
        store.update(layerName, result);
      }
    });
    inFlight = current.finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  const handle = timer.setInterval(() => {
    pollNow().catch((error: unknown) => {
      options.onError?.(error);
    });
  }, intervalMs);

  return {
    pollNow,
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      timer.clearInterval(handle);
    },
  };
}

export type {
  HunkSessionBinding,
  PollingTimer,
  ReviewNotePoller,
  ReviewNotePollingOptions,
};
export { DEFAULT_POLL_INTERVAL_MS, startReviewNotePolling };
