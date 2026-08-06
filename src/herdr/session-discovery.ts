import type { CommandRunner } from "../exec.ts";
import { findNewHunkSession, listHunkSessions } from "../hunk/index.ts";
import type { SessionDiscoveryTimer } from "./types.ts";

interface DiscoverLaunchedSessionOptions {
  run: CommandRunner;
  before: Awaited<ReturnType<typeof listHunkSessions>>;
  repositoryRoot: string;
  layerName: string;
  intervalMs: number;
  timeoutMs: number;
  timer: SessionDiscoveryTimer;
}

export const DEFAULT_SESSION_DISCOVERY_INTERVAL_MS = 500;
export const DEFAULT_SESSION_DISCOVERY_TIMEOUT_MS = 10_000;

export const defaultTimer: SessionDiscoveryTimer = {
  sleep: (delayMs) =>
    new Promise((resolve) => {
      globalThis.setTimeout(resolve, delayMs);
    }),
};

export function requirePositiveNumber(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive number`);
  }
}

export async function discoverLaunchedSession({
  run,
  before,
  repositoryRoot,
  layerName,
  intervalMs,
  timeoutMs,
  timer,
}: DiscoverLaunchedSessionOptions): Promise<string> {
  let elapsedMs = 0;

  for (;;) {
    const after = await listHunkSessions(run);
    const session = findNewHunkSession(before, after, repositoryRoot);
    if (session !== null) {
      return session.sessionId;
    }

    if (elapsedMs >= timeoutMs) {
      throw new Error(
        `Hunk session for layer "${layerName}" did not appear within ${timeoutMs} ms`,
      );
    }

    const delayMs = Math.min(intervalMs, timeoutMs - elapsedMs);
    await timer.sleep(delayMs);
    elapsedMs += delayMs;
  }
}
